#!/usr/bin/env python3
"""Tajik Vosk/Sherpa Zipformer2 transcript/timepoint evidence (read-only).

Commercially compatible Apache-2.0 offline model, but NOT a forced aligner:
ASR tokens and timepoints are candidates; missing Chinese speech is expected.
No VTT, metadata replacement, Gemini API, TTS or publication.
"""
import argparse
import hashlib
import json
import re
import wave
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np

MODEL="alphacep/vosk-model-tajik"
AUDIO_HASH="df7d2073f37d0c4bbd23f6542ac99cf9368823196f54a47104d29ce71bb80c23"
NARRATION_HASH="4bbb1e7ff18c262004f8a454c0efa804dd67780dffda478ad3ef18ac37335842"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def normalize_tajik(text):
    return re.findall(r"[а-яёӣӯқғҳҷъ]+", text.casefold())


def verify(wav_path, episode_path):
    if digest(wav_path.read_bytes())!=AUDIO_HASH:
        raise ValueError("Tajik WAV must match the archived original one-take source")
    meta=json.loads((wav_path.parent/"metadata.json").read_text())
    if (meta.get("languageCode")!="tg-TJ" or meta.get("ttsRequestCount")!=1 or
            meta.get("ttsGenerationMode")!="continuous-pilot"):
        raise ValueError("Wrong archived Tajik voice metadata")
    episode=json.loads(episode_path.read_text())
    text=" ".join(" ".join(s["narration"].split()) for s in episode["scenes"])
    if digest(text.encode("utf8"))!=NARRATION_HASH:
        raise ValueError("Archived Tajik narration text mismatch")
    return text


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--wav",required=True,type=Path)
    p.add_argument("--episode",required=True,type=Path)
    p.add_argument("--out",required=True,type=Path)
    args=p.parse_args()
    approved_text=verify(args.wav,args.episode)
    from huggingface_hub import snapshot_download
    import sherpa_onnx
    model=Path(snapshot_download(
        MODEL,allow_patterns=["am-onnx/encoder.onnx","am-onnx/decoder.onnx",
                              "am-onnx/joiner.onnx","lang/tokens.txt"]))
    with wave.open(str(args.wav),"rb") as f:
        if f.getnchannels()!=1 or f.getsampwidth()!=2:
            raise ValueError("Invalid archived PCM channels/format")
        sample_rate=f.getframerate()
        raw=f.readframes(f.getnframes())
    samples=np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768.0
    recog=sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(model/"am-onnx/encoder.onnx"),
        decoder=str(model/"am-onnx/decoder.onnx"),
        joiner=str(model/"am-onnx/joiner.onnx"),
        tokens=str(model/"lang/tokens.txt"),
        sample_rate=16000,num_threads=4,provider="cpu",
        decoding_method="modified_beam_search",max_active_paths=10)
    stream=recog.create_stream()
    stream.accept_waveform(sample_rate,samples)
    recog.decode_stream(stream)
    result=stream.result
    expected=normalize_tajik(approved_text)
    heard=normalize_tajik(result.text)
    matches=sum(m.size for m in SequenceMatcher(a=expected,b=heard,autojunk=False).get_matching_blocks())
    raw_tokens=list(result.tokens)
    raw_timestamps=[float(v) for v in result.timestamps]
    if len(raw_tokens)!=len(raw_timestamps):
        raise ValueError("ASR acoustic token and timestamp lengths differ")
    if any(t<0 or t>len(samples)/sample_rate+0.2 for t in raw_timestamps):
        raise ValueError("ASR provider timepoint out of recording bounds")
    evidence={
        "status":"DIAGNOSTIC_ONLY_NOT_FOR_CAPTIONS",
        "model":MODEL,"license":"Apache-2.0",
        "input":{"audioSha256":AUDIO_HASH,"narrationSha256":NARRATION_HASH,"languageCode":"tg-TJ"},
        "approvedTajikWords":len(expected),"asrTajikWords":len(heard),
        "textSequenceMatchCount":matches,
        "textSequenceCoverage":round(matches/max(1,len(expected)),3),
        "asrText":result.text,
        "sourceTokenTimepoints":[{"token":t,"modelStartSeconds":round(v,3)} for t,v in zip(raw_tokens,raw_timestamps)],
        "note":"Vosk returns recognized speech and token timepoints. These are NOT verified exact approved-word spans and MUST NOT enter final VTT or external-word-cue import."
    }
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({k:evidence[k] for k in ["approvedTajikWords","asrTajikWords","textSequenceCoverage"]}),flush=True)


if __name__=="__main__":
    main()
