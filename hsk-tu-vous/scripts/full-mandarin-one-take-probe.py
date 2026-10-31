#!/usr/bin/env python3
"""Read-only real Qwen Chinese forced-alignment probe on archived RU/TJ WAV.

The provided candidate windows are not proven language boundaries. Every word
is either an actual model-returned timepoint or rejected; NEVER write captions
or integrate into production based on this diagnostic run alone.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import re
from types import SimpleNamespace
import numpy as np
import soundfile as sf

MODEL = "Qwen/Qwen3-ForcedAligner-0.6B"
HANZI = re.compile(r"[\u3400-\u9fff]+")

def digest(data: bytes) -> str:
    return sha256(data).hexdigest()

def original(lang, root, manifest):
    config = manifest["languages"][lang]
    locale_dir = root / manifest["episodeId"] / ("tg" if lang=="tg" else "")
    prod = locale_dir / "gemini-production" / (
        "2026-10-31T08-07-45-724Z" if lang=="ru" else "2026-10-31T08-07-45-540Z")
    audio = prod / "voice.wav"
    raw = audio.read_bytes()
    if digest(raw) != config["wavSha256"]:
        raise ValueError(f"{lang}: archived WAV source mismatch")
    meta = json.loads((prod / "metadata.json").read_text(encoding="utf8"))
    if not(meta.get("ttsRequestCount")==1 and meta.get("ttsGenerationMode")=="continuous-pilot" and
           meta.get("languageCode")==config["languageCode"]):
        raise ValueError(f"{lang}: archived voice metadata mismatch")
    episode = json.loads((locale_dir / "episode.json").read_text(encoding="utf8"))
    narration = " ".join(" ".join(s["narration"].split()) for s in episode["scenes"])
    if digest(narration.encode()) != config["narrationSha256"]:
        raise ValueError(f"{lang}: original voice script checksum mismatch")
    runs = re.findall(r"[\u3400-\u9fff]+(?:[，、？?][\u3400-\u9fff]+)*", narration)
    expected_runs = [r["text"] for r in config["windows"]]
    if runs != expected_runs:
        raise ValueError(f"{lang}: ordered Mandarin phrases changed in approved script")
    samples,sr = sf.read(audio,dtype="float32",always_2d=False)
    if samples.ndim!=1 or sr!=24000:
        raise ValueError(f"{lang}: archived WAV not mono 24kHz")
    return samples,sr,config

def fold_dianr(items):
    merged=[]
    provenance=[]
    for item in items:
        w=SimpleNamespace(text=str(item.text),start_time=float(item.start_time),
                          end_time=float(item.end_time))
        if (w.text=="儿" and w.start_time==w.end_time and
            merged and merged[-1].text=="点" and
            abs(w.start_time-merged[-1].end_time)<0.001):
            parent=merged[-1]
            merged[-1]=SimpleNamespace(text="点儿",start_time=parent.start_time,end_time=parent.end_time)
            provenance.append({"suffix":"儿","sourceTime":w.start_time,
                "parent":"点","parentStart":parent.start_time,"parentEnd":parent.end_time})
        else: merged.append(w)
    return merged,provenance

def check(words,expected,length):
    if "".join(HANZI.findall("".join(w.text for w in words))) != "".join(HANZI.findall(expected)):
        raise ValueError("Provider output no longer represents exactly the source Hanzi")
    out=[]
    prev_end=0.0
    for i,w in enumerate(words):
        s,e=float(w.start_time),float(w.end_time)
        if not(math.isfinite(s) and math.isfinite(e) and 0<=s<e<=length+0.05
               and s>=prev_end-0.02):
            raise ValueError(f"Provider invalid/nonmonotonic timestamp at unit {i+1}")
        out.append({"text":w.text,"start":round(s,3),"end":round(e,3)})
        prev_end=e
    return out

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--review",required=True,type=Path)
    parser.add_argument("--manifest",required=True,type=Path)
    parser.add_argument("--out",required=True,type=Path)
    args=parser.parse_args()
    m=json.loads(args.manifest.read_text(encoding="utf8"))
    if m["version"]!=1 or m["model"]!=MODEL:
        raise ValueError("Unreviewed Mandarin diagnostic manifest")
    import torch
    from qwen_asr import Qwen3ForcedAligner
    torch.set_num_threads(min(4,os.cpu_count() or 2))
    model=Qwen3ForcedAligner.from_pretrained(MODEL,dtype=torch.float32,device_map="cpu")
    result={"status":"DIAGNOSTIC_ONLY_NOT_FOR_CAPTIONS","model":MODEL,"license":"Apache-2.0",
            "manifestSha256":digest(args.manifest.read_bytes()),"languages":{}}
    for lang in ("ru","tg"):
        samples,sr,config=original(lang,args.review,m)
        rows=[]
        for spec in config["windows"]:
            start,end=float(spec["start"]),float(spec["end"])
            if start<0 or end<=start or end>len(samples)/sr:
                raise ValueError(f"{lang}: invalid measured source clip window")
            wave=np.asarray(samples[round(start*sr):round(end*sr)],dtype=np.float32)
            signal_level=float(np.sqrt(np.mean(wave**2)))
            if signal_level<0.002:
                raise ValueError(f"{lang}: candidate source contains no measurable speech energy")
            datum={"id":spec["id"],"text":spec["text"],"start":start,"end":end,
                "boundaryEvidence":spec["boundaryEvidence"],
                "clipSha256":digest(wave.tobytes()),"signalRms":round(signal_level,5)}
            try:
                aligned=model.align(audio=(wave,sr),text=spec["text"],language="Chinese")
                if len(aligned)!=1:raise ValueError("Unexpected provider result list count")
                raw=[{"text":str(w.text),"start":float(w.start_time),"end":float(w.end_time)}
                     for w in aligned[0]]
                units,erhua=fold_dianr(aligned[0])
                datum["rawProvider"]=raw
                datum["erhuaFold"]=erhua
                accepted=check(units,spec["text"],len(wave)/sr)
                datum["candidateUnits"]=[{**u,
                     "globalStart":round(u["start"]+start,3),
                     "globalEnd":round(u["end"]+start,3)} for u in accepted]
                datum["status"]="TIMINGS_STRUCTURALLY_VALID_BUT_CONTENT_UNVERIFIED"
            except Exception as exc:
                datum["status"]="MODEL_CANDIDATE_REJECTED"
                datum["error"]=str(exc)[:300]
            rows.append(datum)
            print(json.dumps({"lang":lang,"phrase":spec["id"],"status":datum["status"],
                "units":len(datum.get("candidateUnits",[]))},ensure_ascii=False),flush=True)
        result["languages"][lang]={"audioSha256":config["wavSha256"],
            "narrationSha256":config["narrationSha256"],"sourcePhrases":len(rows),
            "structurallyValid":sum(r["status"].startswith("TIMINGS_") for r in rows),
            "data":rows}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("DIAGNOSTIC_SUMMARY",json.dumps({
        lang:{k:v[k] for k in ("sourcePhrases","structurallyValid")}
        for lang,v in result["languages"].items()}))

if __name__=="__main__":
    main()
