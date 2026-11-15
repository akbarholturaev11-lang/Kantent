#!/usr/bin/env python3
"""Audit/import pinned CC0 Kenney GitHub mirror WAVs. Zero production sound changes.

Never execute upstream code. Expected file set and every Git blob SHA come
from vendor-catalog/soundkit/kenney-mirror-lock.json (checked into our repo).
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
LOCK_FILE = ROOT / "vendor-catalog/soundkit/kenney-mirror-lock.json"
CATALOG = ROOT / "content/sound-library.json"
DESTINATION = ROOT / "assets/sound-library"
MAX_DOWNLOAD = 20_000_000
MAX_UNCOMPRESSED = 45_000_000
MAX_INDIVIDUAL_AUDIO = 2_000_000
VALID_HOSTS = {"codeload.github.com"}
VALID_REPOS = {"Calinou/kenney-ui-audio", "Calinou/kenney-interface-sounds"}
COUNT_PINS = {"ui-audio": 51, "interface-sounds": 100}
ROLE_PREFIXES = {
    "click": "ui-press",
    "mouse": "ui-press",
    "select": "ui-selection",
    "rollover": "ui-hover",
    "hover": "ui-hover",
    "switch": "ui-switch",
    "toggle": "ui-switch",
    "scroll": "ui-scroll",
    "back": "ui-navigation",
    "error": "ui-error",
    "confirm": "ui-confirmation",
}
AUDIO_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*\.wav$")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def classify(filename):
    name = filename.lower().removesuffix(".wav")
    for prefix, role in ROLE_PREFIXES.items():
        if name.startswith(prefix):
            return role
    return "uncategorized-needs-editorial-review"


def validate_lock(lock):
    if lock.get("schemaVersion") != 1 or set(lock.get("sources", {})) != set(COUNT_PINS):
        raise ValueError("unexpected mirror lock schema or pack set")
    for name, source in lock["sources"].items():
        if source.get("repository") not in VALID_REPOS:
            raise ValueError("unallowlisted source repository")
        if not re.fullmatch(r"[0-9a-f]{40}", source.get("commitSha", "")):
            raise ValueError("source must be commit pinned")
        expected_url = (
            "https://codeload.github.com/"
            + source["repository"] + "/zip/" + source["commitSha"]
        )
        if source.get("downloadUrl") != expected_url:
            raise ValueError("unpinned or unexpected archive location")
        if source.get("license") != "CC0-1.0":
            raise ValueError("mirror license must be recorded CC0")
        if source.get("pinnedMirrorAudio") != COUNT_PINS[name]:
            raise ValueError("pinned source inventory count changed")
        files = source["files"]
        if len(files) != COUNT_PINS[name] + 2:
            raise ValueError("lock must list audio and two upstream license files")
        seen = set()
        for entry in files:
            filename = entry["path"]
            if filename in seen or not re.fullmatch(r"[0-9a-f]{40}", entry["gitBlobSha"]):
                raise ValueError("duplicate or malformed locked file")
            seen.add(filename)
            if not isinstance(entry["size"], int) or entry["size"] <= 0:
                raise ValueError("invalid locked byte count")
        if not set(source.get("licenseFiles", [])).issubset(seen):
            raise ValueError("missing license lock")
    return True


def get_archive(source):
    expected = source["downloadUrl"]
    parsed = urllib.parse.urlparse(expected)
    if parsed.scheme != "https" or parsed.hostname not in VALID_HOSTS:
        raise ValueError("source must be pinned codeload.github.com HTTPS")
    request = urllib.request.Request(
        expected, headers={"User-Agent": "HSK-AI-Kenney-CC0-Mirror-Audit/1.0"}
    )
    with urllib.request.urlopen(request, timeout=70) as response:
        actual = urllib.parse.urlparse(response.geturl())
        if actual.scheme != "https" or actual.hostname not in VALID_HOSTS:
            raise ValueError("redirect out of pinned GitHub archive host")
        blob = response.read(MAX_DOWNLOAD + 1)
    if len(blob) > MAX_DOWNLOAD or not blob.startswith(b"PK"):
        raise ValueError("mirror archive missing/oversized/not ZIP")
    return blob


def zip_contents(payload, source):
    """Return verified pinned files only, fail on any suspicious or extra WAV."""
    if not payload.startswith(b"PK"):
        raise ValueError("ZIP magic missing")
    entries = {}
    audio_paths = set()
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        items = z.infolist()
        if sum(i.file_size for i in items) > MAX_UNCOMPRESSED:
            raise ValueError("expanded archive size exceeds cap")
        for item in items:
            path = PurePosixPath(item.filename)
            if (path.is_absolute() or ".." in path.parts
                or "\\" in item.filename or "\x00" in item.filename):
                raise ValueError("archive path traversal rejected")
            file_kind = (item.external_attr >> 16) & 0o170000
            if file_kind == 0o120000:
                raise ValueError("ZIP symlink rejected")
            if item.is_dir():
                continue
            parts = path.parts
            prefix = source["repository"].split("/")[1] + "-" + source["commitSha"]
            if not parts or parts[0] != prefix or len(parts) < 2:
                raise ValueError("unexpected archive root")
            rel = "/".join(parts[1:])
            if rel in entries:
                raise ValueError("duplicate ZIP path")
            if rel.lower().endswith((".wav", ".ogg", ".mp3", ".flac", ".aac")):
                audio_paths.add(rel)
            entries[rel] = item

        expected = {entry["path"]: entry for entry in source["files"]}
        expected_audio = {p for p in expected if p.lower().endswith(".wav")}
        if audio_paths != expected_audio:
            missing = sorted(expected_audio - audio_paths)
            added = sorted(audio_paths - expected_audio)
            raise ValueError("source audio differs from locked file set: "
                             + f"missing={missing[:5]}, unlisted={added[:5]}")
        if not expected.keys() <= entries.keys():
            raise ValueError("archive lacks locked license/audio files")
        result = {}
        for rel, pin in expected.items():
            if entries[rel].file_size != pin["size"]:
                raise ValueError("pinned file byte size mismatch: " + rel)
            if entries[rel].file_size > MAX_INDIVIDUAL_AUDIO and rel.endswith(".wav"):
                raise ValueError("unusually large WAV: " + rel)
            data = z.read(entries[rel])
            if git_blob(data) != pin["gitBlobSha"]:
                raise ValueError("Git blob SHA mismatch: " + rel)
            result[rel] = data
        for filename in source["licenseFiles"]:
            legal = result[filename].decode("utf8", errors="replace").lower()
            if not ("cc0" in legal or "creative commons zero" in legal):
                raise ValueError("locked source license missing CC0: " + filename)
        return result


def inspect_wav(payload):
    if not (payload[:4] == b"RIFF" and payload[8:12] == b"WAVE"):
        raise ValueError("WAV signature missing")
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        tmp.write(payload)
        tmp.flush()
        result = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration:stream=codec_type,codec_name,sample_rate,channels",
            "-of", "json", tmp.name,
        ], capture_output=True, text=True, check=False, timeout=20)
        if result.returncode:
            raise ValueError("ffprobe cannot decode source audio")
        info = json.loads(result.stdout)
        streams = [s for s in info.get("streams", [])
                   if s.get("codec_type") == "audio"]
        if len(streams) != 1:
            raise ValueError("not a single stream WAV")
        stream = streams[0]
        duration = float(info.get("format", {}).get("duration", 0))
        sample_rate = int(stream.get("sample_rate", 0))
        channels = int(stream.get("channels", 0))
        if not (0.005 <= duration <= 30 and 8000 <= sample_rate <= 192000
                and channels in (1, 2)):
            raise ValueError("WAV timing or channels outside safe bounds")
        decode = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error",
                                 "-i", tmp.name, "-f", "null", "-"],
                                capture_output=True, timeout=20, check=False)
        if decode.returncode:
            raise ValueError("source WAV PCM playback decoding failed")
        return {"durationSeconds": round(duration, 5),
                "codec": stream.get("codec_name"),
                "sampleRate": sample_rate, "channels": channels}


def import_mirrors(lock, download=get_archive, analyze=inspect_wav):
    validate_lock(lock)
    report = {
        "schemaVersion": 1, "status": "verified", "testMode": "TEST_ONLY",
        "sourceType": "pinned third-party CC0 Godot mirrors, not publisher ZIPs",
        "creativeSelectionOwner": "Codex (future Phase P2; no auto selection now)",
        "automaticallyUsedInProduction": False, "aiApiConnected": False,
        "packs": {}, "assets": [], "exactFileCount": 0,
    }
    staged_data = {}
    all_hashes = {}
    for name, source in lock["sources"].items():
        raw = download(source)
        checked = zip_contents(raw, source)
        report["packs"][name] = {
            "repository": source["repository"],
            "sourceCommit": source["commitSha"],
            "sourceTree": source["rootTreeSha"],
            "archiveUrl": source["downloadUrl"],
            "archiveSha256": digest(raw),
            "license": "CC0-1.0",
            "publisherPage": source["publisherPage"],
            "publisherListed": source["publisherListedAudio"],
            "mirrorObserved": source["pinnedMirrorAudio"],
            "countDiscrepancy": (source["pinnedMirrorAudio"]
                                 != source["publisherListedAudio"]),
            "licenseFiles": source["licenseFiles"],
            "licenseHashesSha256": {
                path: digest(checked[path]) for path in source["licenseFiles"]
            },
            "status": "mirror-bytes-verified",
        }
        for locked in source["files"]:
            path = locked["path"]
            raw = checked[path]
            if path.lower().endswith(".wav"):
                filename = PurePosixPath(path).name
                if not AUDIO_NAME.fullmatch(filename):
                    raise ValueError("unsafe WAV filename in pinned source")
                out_path = f"assets/sound-library/kenney-{name}/{filename}"
                staged_data[out_path] = raw
                data = {
                    "id": f"kenney-{name}/{filename.lower()}",
                    "file": out_path, "category": classify(filename),
                    "license": "CC0-1.0",
                    "originalFile": path, "gitBlobSha": locked["gitBlobSha"],
                    "sha256": digest(raw), "sizeBytes": len(raw),
                    "sourceCommit": source["commitSha"],
                    "publisherPage": source["publisherPage"],
                    "eligibleForAutomaticUse": False,
                    **analyze(raw),
                }
                all_hashes.setdefault(data["sha256"], []).append(data["id"])
                report["assets"].append(data)
        license_bytes = checked["LICENSE.txt"]
        staged_data[f"assets/sound-library/kenney-{name}/LICENSE.txt"] = license_bytes
    report["exactFileCount"] = len(report["assets"])
    if report["exactFileCount"] != sum(COUNT_PINS.values()):
        raise ValueError("mirror catalog total count unexpectedly changed")
    report["exactDuplicateGroups"] = [
        group for group in all_hashes.values() if len(group) > 1
    ]
    report["uniquePayloads"] = len(all_hashes)
    report["totalWavBytes"] = sum(x["sizeBytes"] for x in report["assets"])
    report["assets"].sort(key=lambda x: x["id"])
    return report, staged_data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("audit", "import", "verify"), default="audit")
    parser.add_argument("--report", required=False, default=str(CATALOG))
    args = parser.parse_args()
    lock = json.loads(LOCK_FILE.read_text(encoding="utf8"))
    if args.mode == "verify":
        manifest = json.loads(CATALOG.read_text(encoding="utf8"))
        if manifest["exactFileCount"] != sum(COUNT_PINS.values()):
            raise ValueError("unexpected existing audio inventory count")
        for entry in manifest["assets"]:
            path = ROOT / entry["file"]
            if not path.is_file() or digest(path.read_bytes()) != entry["sha256"]:
                raise ValueError("missing or altered imported audio: " + str(path))
        print(f"Verified {len(manifest['assets'])} imported source hashes offline")
        return 0
    catalog, files = import_mirrors(lock)
    report = Path(args.report)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    if args.mode == "import":
        # Stage all verified bytes first. Never write partially verified packs.
        for path, data in files.items():
            target = ROOT / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        print(f"Imported {catalog['exactFileCount']} PINNED mirror WAVs; "
              f"publisher lists 150; no new production audio enabled")
    else:
        print(f"Audited {catalog['exactFileCount']} PINNED mirror WAVs, no assets imported")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print("Kenney mirror importer rejected source: " + str(error), file=sys.stderr)
        sys.exit(1)
