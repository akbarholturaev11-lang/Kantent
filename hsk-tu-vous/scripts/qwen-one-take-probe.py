#!/usr/bin/env python3
"""One-shot, read-only acoustic evidence probe for archived HSK AI RU TTS.

Loads an Apache-2.0 Qwen3 forced aligner on CPU, probes the original
owner-approved one-take WAV, and emits diagnostic-only model timestamps.
Neither the Chinese window nor the produced timestamps are treated as
verified word timings; this script NEVER writes VTT or imports a voice.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path

import numpy as np
import soundfile as sf

MODEL_ID = "Qwen/Qwen3-ForcedAligner-0.6B"
EXPECTED_WAV_SHA256 = "562c368a0dd5800f11da724a54480797631ed141625bcabba248111184cc652c"
EXPECTED_NARRATION_SHA256 = "75d2bad12fc1c5347ea097cb0d772c0abd1d4390178078ddc0987bace022ef59"
# RU span is taken from original Gemini *observed* 0.2–2.9s words;
# Chinese span is a *candidate* search window, NOT a verified boundary.
PROBES = [
    {"language": "Russian", "text": "Представьте: на рынке вещь дороговата.",
     "start": 0.0, "end": 3.05, "boundaryEvidence": "original-timed-ru-words"},
    {"language": "Chinese", "text": "这个有点儿贵",
     "start": 5.399, "end": 6.462, "boundaryEvidence": "measured-pause-window-4.783-to-5.400-and-6.461-to-7.293-unverified-word-identity"},
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_checked_source(wav: Path, episode: Path):
    raw = wav.read_bytes()
    if sha256(raw) != EXPECTED_WAV_SHA256:
        raise ValueError("Source RU original WAV SHA mismatch; model trial aborts.")
    meta = json.loads((wav.parent / "metadata.json").read_text(encoding="utf8"))
    if (meta.get("ttsRequestCount") != 1 or meta.get("ttsGenerationMode") != "continuous-pilot" or
        meta.get("languageCode") != "ru-RU"):
        raise ValueError("Original RU one-take provenance mismatch")
    source = json.loads(episode.read_text(encoding="utf8"))
    narration = " ".join(s["narration"].strip() for s in source["scenes"])
    narration = " ".join(narration.split())
    if sha256(narration.encode("utf8")) != EXPECTED_NARRATION_SHA256:
        raise ValueError("Approved RU narration hash mismatch")
    y, sr = sf.read(wav, dtype="float32", always_2d=False)
    if y.ndim != 1 or sr != 24000:
        raise ValueError("Expected archived 24k mono WAV only")
    return y, sr, {"audioSha256": sha256(raw), "narrationSha256": sha256(narration.encode())}


def validate_model_items(items, duration):
    previous = -1.0
    out = []
    for item in items:
        start, end = float(item.start_time), float(item.end_time)
        if not (np.isfinite(start) and np.isfinite(end) and
                0 <= start < end <= duration + 0.1 and start >= previous):
            raise ValueError("Invalid non-monotonic Qwen audio timestamps")
        out.append({"text": str(item.text), "start": round(start, 3), "end": round(end, 3)})
        previous = start
    if not out:
        raise ValueError("Aligner produced zero acoustic word candidates")
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--wav", type=Path, required=True)
    parser.add_argument("--episode", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    y, sr, source = read_checked_source(args.wav, args.episode)

    import torch
    from qwen_asr import Qwen3ForcedAligner

    torch.set_num_threads(min(os.cpu_count() or 2, 4))
    # No API keys, network speech service, TTS generation or video publishing.
    aligner = Qwen3ForcedAligner.from_pretrained(MODEL_ID, dtype=torch.float32,
                                                device_map="cpu")
    result = {"model": MODEL_ID, "modelLicense": "Apache-2.0",
              "status": "UNVERIFIED_DIAGNOSTIC_ONLY", "source": source, "clips": []}
    for spec in PROBES:
        start, end = spec["start"], spec["end"]
        clip = np.asarray(y[int(start*sr):int(end*sr)], dtype=np.float32)
        if len(clip) < sr:
            raise ValueError("Insufficient archived source clip")
        aligned = aligner.align(audio=(clip, sr), text=spec["text"], language=spec["language"])
        if len(aligned) != 1:
            raise ValueError("Unexpected Qwen result count")
        raw = [{"text": str(item.text), "start": float(item.start_time),
                "end": float(item.end_time)} for item in aligned[0]]
        try:
            words = validate_model_items(aligned[0], len(clip)/sr)
            outcome = "MODEL-CANDIDATE-NOT-VERIFIED-NOT-FOR-CAPTIONS"
            failure = None
        except ValueError as exc:
            words = []
            outcome = "INVALID-MODEL-TIMESTAMPS-REJECTED"
            failure = str(exc)
        result["clips"].append({**spec, "clipSha256": sha256(clip.tobytes()),
            "rawModelOutput": raw,
            "rawRelativeWords": words, "sourceGlobalCandidates": [
                {**w, "start": round(w["start"] + start, 3),
                 "end": round(w["end"] + start, 3)} for w in words],
            "validation": outcome, "error": failure})
        print(json.dumps({"language":spec["language"],"words":len(words),
            "rawWords":len(raw),"validation":outcome,"error":failure},
            ensure_ascii=False),flush=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("WROTE_DIAGNOSTIC_ONLY", args.out)


if __name__ == "__main__":
    main()
