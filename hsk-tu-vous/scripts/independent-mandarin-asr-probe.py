#!/usr/bin/env python3
"""Offline independent Chinese ASR cross-check of actual archived RU/TJ WAV.

Forced alignment can stamp words that are not spoken. This independent ASR
recognizes source audio without feeding the expected Chinese text as context.
Even exact agreement is diagnostic, not owner approval / subtitle readiness.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path

import numpy as np
import soundfile as sf

MODEL = "Qwen/Qwen3-ASR-0.6B"

def hashhex(value):
    return hashlib.sha256(value).hexdigest()

def hanzi(text):
    return "".join(re.findall(r"[\u3400-\u9fff]+",str(text)))

def normalized_erhua(text):
    # Diagnostics only; no normalization is ever allowed to synthesize timing.
    return hanzi(text).replace("点儿", "点")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--review",required=True,type=Path)
    p.add_argument("--evidence",required=True,type=Path)
    p.add_argument("--out",required=True,type=Path)
    args=p.parse_args()
    evidence=json.loads(args.evidence.read_text(encoding="utf8"))
    if evidence.get("model")!="Qwen/Qwen3-ForcedAligner-0.6B":
        raise ValueError("Cannot compare to unknown forced aligner")
    import torch
    from qwen_asr import Qwen3ASRModel
    torch.set_num_threads(min(4,os.cpu_count() or 2))
    asr=Qwen3ASRModel.from_pretrained(MODEL,dtype=torch.float32,
        device_map="cpu",max_inference_batch_size=1,max_new_tokens=128)
    report={"status":"INDEPENDENT_ASR_DIAGNOSTIC_ONLY","asrModel":MODEL,
        "forcedAlignmentEvidenceSha256":hashhex(args.evidence.read_bytes()),
        "results":{}}
    for lang in ("ru","tg"):
        root=args.review/"youdianr-vs-yidianr-price-20261030"/("tg" if lang=="tg" else "")/"gemini-production"
        folder="2026-10-31T08-07-45-724Z" if lang=="ru" else "2026-10-31T08-07-45-540Z"
        wav=root/folder/"voice.wav"
        raw=wav.read_bytes()
        item=evidence["languages"][lang]
        if hashhex(raw)!=item["audioSha256"]:
            raise ValueError("ASR original WAV no longer matches forced-alignment test")
        audio,sr=sf.read(wav,dtype="float32")
        if audio.ndim!=1 or sr!=24000:raise ValueError("Expected source mono 24kHz")
        output=[]
        for x in item["data"]:
            begin,end=float(x["start"]),float(x["end"])
            clip=np.asarray(audio[round(begin*sr):round(end*sr)],dtype=np.float32)
            if hashhex(clip.tobytes())!=x["clipSha256"]:
                raise ValueError(f"Candidate clip {lang} #{x['id']} hash drift")
            recognized=asr.transcribe(audio=(clip,sr),language="Chinese")
            if len(recognized)!=1:
                raise ValueError("Unexpected ASR result count")
            heard=str(recognized[0].text)
            expected=x["text"]
            is_exact=hanzi(heard)==hanzi(expected)
            is_erhua=normalized_erhua(heard)==normalized_erhua(expected)
            output.append({"id":x["id"],"expected":expected,"heard":heard,
                "language":str(recognized[0].language),
                "expectedHanzi":hanzi(expected),"heardHanzi":hanzi(heard),
                "exactTextMatch":is_exact,
                "erhuaOnlyDifference":not is_exact and is_erhua,
                "forcedAlignmentTimeStatus":x["status"],
                "crossCheckedWordTimingCandidate":bool(is_exact and x["status"].startswith("TIMINGS_")),
                "needsOwnerListening":True})
            print(json.dumps({"lang":lang,"id":x["id"],"expected":expected,
               "asr":heard,"exact":is_exact,"erhuaOnly":not is_exact and is_erhua},
               ensure_ascii=False),flush=True)
        report["results"][lang]={"total":len(output),
            "exactMatches":sum(x["exactTextMatch"] for x in output),
            "erhuaEquivalent":sum(x["erhuaOnlyDifference"] for x in output),
            "independentTextAndTimingMatches":sum(x["crossCheckedWordTimingCandidate"] for x in output),
            "candidates":output}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("INDEPENDENT_ASR_SUMMARY",json.dumps({lang:{
       k:v[k] for k in ("total","exactMatches","erhuaEquivalent","independentTextAndTimingMatches")}
       for lang,v in report["results"].items()}),flush=True)

if __name__=="__main__":
    main()
