"""Offline SoundKit mirror-import tests: pinned WAV bytes, license, count and safety."""
import importlib.util
import io
import json
from pathlib import Path
import unittest
import zipfile

SCRIPT = Path(__file__).with_name("kenney-mirror-import.py")
spec = importlib.util.spec_from_file_location("kenney_mirror_import", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fake_source(wav=b"RIFF" + b"\x00" * 4 + b"WAVE" + b"x" * 44,
                license_text=b"Kenney, Creative Commons Zero CC0"):
    source = {
        "repository": "Calinou/kenney-ui-audio",
        "commitSha": "8c3d81b9159d058c444f89d12d518276b0b09345",
        "licenseFiles": ["LICENSE.txt", "addons/kenney_ui_audio/LICENSE.txt"],
    }
    content = {
        "LICENSE.txt": license_text,
        "addons/kenney_ui_audio/LICENSE.txt": license_text,
        "addons/kenney_ui_audio/click1.wav": wav,
    }
    source["files"] = [
        {"path": p, "gitBlobSha": mod.git_blob(raw), "size": len(raw)}
        for p, raw in content.items()
    ]
    return source, content


def make_zip(source, content, added=None):
    fileobj = io.BytesIO()
    prefix = source["repository"].split("/")[1] + "-" + source["commitSha"]
    with zipfile.ZipFile(fileobj, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for filename, data in content.items():
            archive.writestr(prefix + "/" + filename, data)
        if added:
            filename, data = added
            archive.writestr(filename, data)
    return fileobj.getvalue()


class KenneyMirrorTests(unittest.TestCase):
    def test_lock_keeps_full_51_plus_100_inventory_without_fudging(self):
        obj = json.loads(mod.LOCK_FILE.read_text(encoding="utf8"))
        self.assertTrue(mod.validate_lock(obj))
        self.assertEqual([obj["sources"][p]["pinnedMirrorAudio"]
                          for p in ("ui-audio", "interface-sounds")], [51, 100])
        self.assertEqual(obj["sources"]["ui-audio"]["publisherListedAudio"], 50)
        self.assertEqual(len(obj["sources"]["ui-audio"]["files"]), 53)
        self.assertEqual(len(obj["sources"]["interface-sounds"]["files"]), 102)

    def test_good_pinned_wav_and_license_zip(self):
        source, content = fake_source()
        checked = mod.zip_contents(make_zip(source, content), source)
        self.assertEqual(checked, content)

    def test_tampered_wav_same_length_rejected_by_git_blob_sha(self):
        source, content = fake_source()
        audio = content["addons/kenney_ui_audio/click1.wav"]
        content["addons/kenney_ui_audio/click1.wav"] = audio[:-1] + b"Q"
        with self.assertRaisesRegex(ValueError, "SHA mismatch"):
            mod.zip_contents(make_zip(source, content), source)

    def test_unlisted_extra_audio_not_accepted(self):
        source, content = fake_source()
        extra = source["repository"].split("/")[1] + "-" + source["commitSha"]
        with self.assertRaisesRegex(ValueError, "unlisted"):
            mod.zip_contents(make_zip(source, content, (extra+"/evil.wav", b"RIFF")), source)

    def test_no_zip_slip(self):
        source, content = fake_source()
        with self.assertRaisesRegex(ValueError, "path traversal"):
            mod.zip_contents(make_zip(source, content, ("../escape.wav", b"x")), source)

    def test_no_unlicensed_mirror_code(self):
        source, content = fake_source(license_text=b"All rights reserved")
        source["files"] = [
            {"path": p, "gitBlobSha": mod.git_blob(raw), "size": len(raw)}
            for p, raw in content.items()
        ]
        with self.assertRaisesRegex(ValueError, "license missing CC0"):
            mod.zip_contents(make_zip(source, content), source)

    def test_url_must_be_exact_pinned_git_commit(self):
        obj = json.loads(mod.LOCK_FILE.read_text(encoding="utf8"))
        obj["sources"]["ui-audio"]["downloadUrl"] = "https://evil.example/payload.zip"
        with self.assertRaisesRegex(ValueError, "unpinned"):
            mod.validate_lock(obj)

    def test_audio_signature_never_trusts_extension_only(self):
        with self.assertRaisesRegex(ValueError, "WAV signature"):
            mod.inspect_wav(b"this is not a PCM file")

    def test_classification_advisory_not_automatic_approval(self):
        self.assertEqual(mod.classify("click1.wav"), "ui-press")
        self.assertEqual(mod.classify("switch38.wav"), "ui-switch")
        self.assertIn("review", mod.classify("mystery.wav"))


if __name__ == "__main__":
    unittest.main()
