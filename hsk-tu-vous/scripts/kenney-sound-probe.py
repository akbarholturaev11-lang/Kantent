#!/usr/bin/env python3
"""P1 publisher-hosted Kenney CC0 ZIP provenance and audio audit. No scripts executed from ZIP."""
import argparse
import hashlib
import io
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile

PACKS = {
    "ui-audio": {
        "url": "https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip",
        "page": "https://kenney.nl/assets/ui-audio",
        "expected": 50,
        "version": "1.0",
    },
    "interface-sounds": {
        "url": "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip",
        "page": "https://kenney.nl/assets/interface-sounds",
        "expected": 100,
        "version": "1.0",
    },
}
VALID_FORMATS = (".ogg", ".wav")
MAX_ZIP_BYTES = 25_000_000
MAX_AUDIO_BYTES = 2_000_000
MAX_TOTAL_AUDIO_BYTES = 35_000_000
ALLOWED_SOURCE_HOSTS = {"kenney.nl", "www.kenney.nl"}

def sha256(payload):
    return hashlib.sha256(payload).hexdigest()

def safe_member(info):
    p = pathlib.PurePosixPath(info.filename)
    if p.is_absolute() or ".." in p.parts or "\\" in info.filename or "\x00" in info.filename:
        raise ValueError("unsafe ZIP member path")
    if ((info.external_attr >> 16) & 0o170000) == 0o120000:
        raise ValueError("ZIP symlink not allowed")
    return p

def publisher_zip(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_SOURCE_HOSTS:
        raise ValueError("not an approved publisher URL")
    req = urllib.request.Request(url, headers={"User-Agent": "Kantent-SoundKit-Provenance/1.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        actual = urllib.parse.urlparse(response.geturl())
        if actual.scheme != "https" or actual.hostname not in ALLOWED_SOURCE_HOSTS:
            raise ValueError("cross-domain redirect requires review")
        raw = response.read(MAX_ZIP_BYTES + 1)
    if not raw.startswith(b"PK") or len(raw) > MAX_ZIP_BYTES:
        raise ValueError("invalid/oversized publisher ZIP")
    return raw

def inspect_audio(data, ext):
    if ext == ".wav" and not (data.startswith(b"RIFF") and data[8:12] == b"WAVE"):
        raise ValueError("invalid WAV signature")
    if ext == ".ogg" and not data.startswith(b"OggS"):
        raise ValueError("invalid OGG signature")
    with tempfile.NamedTemporaryFile(suffix=ext) as tmp:
        tmp.write(data)
        tmp.flush()
        check = subprocess.run(
            ["ffprobe", "-v", "error",
             "-show_entries", "format=duration:stream=codec_name,codec_type,sample_rate,channels",
             "-of", "json", tmp.name],
            capture_output=True, text=True, timeout=20, check=False,
        )
    if check.returncode != 0:
        raise ValueError("ffprobe rejected audio")
    output = json.loads(check.stdout)
    streams = [s for s in output.get("streams", []) if s.get("codec_type") == "audio"]
    if len(streams) != 1:
        raise ValueError("expected one audio stream")
    stream = streams[0]
    seconds = float(output.get("format", {}).get("duration", 0))
    sample_rate = int(stream.get("sample_rate", 0))
    channels = int(stream.get("channels", 0))
    if not (0.005 <= seconds <= 30 and 8000 <= sample_rate <= 192000 and channels in (1, 2)):
        raise ValueError("unsupported duration/sample rate/channel count")
    return {"durationSeconds": round(seconds, 4), "codec": stream.get("codec_name"),
            "sampleRate": sample_rate, "channels": channels}

def inspect_archive(pack, raw, import_root=None):
    source = PACKS[pack]
    result = {"name": pack, "source": source["page"], "archiveUrl": source["url"],
              "publisherVersion": source["version"], "license": "CC0-1.0",
              "archiveSha256": sha256(raw), "archiveBytes": len(raw),
              "expectedFiles": source["expected"], "assets": []}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        members = archive.infolist()
        for item in members:
            safe_member(item)
        licenses = [
            {"originalPath": item.filename, "sha256": sha256(archive.read(item))}
            for item in members if not item.is_dir() and item.file_size <= 128_000
            and pathlib.PurePosixPath(item.filename).name.lower()
            in ("license.txt", "licence.txt", "license.md")
            and any(s in archive.read(item).lower()
                    for s in (b"cc0", b"creative commons zero",
                              b"creativecommons.org/publicdomain/zero"))
        ]
        if not licenses:
            raise ValueError("archive lacks an embedded CC0 license")
        result["licenseFiles"] = licenses
        sounds = [item for item in members
                  if not item.is_dir() and item.filename.lower().endswith(VALID_FORMATS)]
        result["observedFiles"] = len(sounds)
        if len(sounds) != source["expected"]:
            raise ValueError(f'publisher audio count mismatch: {len(sounds)} vs {source["expected"]}')
        if sum(item.file_size for item in sounds) > MAX_TOTAL_AUDIO_BYTES:
            raise ValueError("expanded audio total is too large")
        names = set()
        for item in sorted(sounds, key=lambda f: f.filename):
            stem = pathlib.PurePosixPath(item.filename).name
            if not re.fullmatch(r"[A-Za-z0-9._-]+\.(ogg|wav)", stem, re.I):
                raise ValueError("unsafe/unsupported source audio filename")
            if stem.lower() in names:
                raise ValueError("duplicate output basename")
            names.add(stem.lower())
            if item.file_size > MAX_AUDIO_BYTES:
                raise ValueError("individual audio file exceeds limit")
            data = archive.read(item)
            if len(data) != item.file_size:
                raise ValueError("inflated audio length mismatch")
            metadata = inspect_audio(data, pathlib.PurePosixPath(stem).suffix.lower())
            target = f"assets/sound-library/kenney-{pack}/{stem}"
            result["assets"].append({
                "id": f"kenney-{pack}/{stem.lower()}",
                "originalPath": item.filename, "targetPath": target,
                "sha256": sha256(data), "bytes": len(data), **metadata,
            })
            if import_root is not None:
                dest = pathlib.Path(import_root) / target
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
        result["status"] = "verified"
        result["totalAudioBytes"] = sum(f["bytes"] for f in result["assets"])
        groups = {}
        for item in result["assets"]:
            groups.setdefault(item["sha256"], []).append(item["id"])
        result["duplicateSha256Groups"] = [v for v in groups.values() if len(v) > 1]
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--import-root", default=None,
                        help="ONLY after official archive probe and owner-acknowledged source review")
    args = parser.parse_args()
    result = {"schemaVersion": 1, "phase": "P1-publisher-archive-probe",
              "mode": "verified-import" if args.import_root else "probe-only",
              "allSourcesVerified": False, "externalSoundAPIUsed": False,
              "requiresRealVoiceA_B": True, "packs": {}}
    failed = []
    for name, info in PACKS.items():
        try:
            raw = publisher_zip(info["url"])
            checked = inspect_archive(name, raw)
            if args.import_root is not None:
                checked = inspect_archive(name, raw, import_root=args.import_root)
            result["packs"][name] = checked
        except Exception as exc:
            result["packs"][name] = {
                "name": name, "source": info["page"], "expectedFiles": info["expected"],
                "status": "blocked", "reason": str(exc)[:350],
            }
            failed.append(name)
    result["allSourcesVerified"] = not failed
    if failed and args.import_root:
        result["partialImportNotApproved"] = True
    report = pathlib.Path(args.report)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(f'Kenney official archive audit: verified={2 - len(failed)}/2, report={report}')
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
