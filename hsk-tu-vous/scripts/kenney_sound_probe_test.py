"""No-network tests for the Kenney archive licensing, integrity and count gate."""
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPT = pathlib.Path(__file__).with_name("kenney-sound-probe.py")
spec = importlib.util.spec_from_file_location("kenney_sound_probe", SCRIPT)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

def make_zip(count=50, licensed=True, extra=None):
    data = io.BytesIO()
    with zipfile.ZipFile(data, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
        if licensed:
            z.writestr("License.txt", "License: Creative Commons Zero (CC0) - Kenney.nl")
        for i in range(count):
            z.writestr(f"pack/Audio/click_{i:03d}.ogg", b"OggS" + bytes([i % 255]) * 200)
        if extra:
            z.writestr(extra, b"OggS" + b"x" * 100)
    return data.getvalue()

class SoundLibraryProbeTests(unittest.TestCase):
    @patch.object(probe, "inspect_audio", return_value={
        "durationSeconds": 0.1, "codec": "vorbis", "sampleRate": 44100,
        "channels": 1,
    })
    def test_good_count_and_license_produce_exact_50_sha_pinned_assets(self, _):
        result = probe.inspect_archive("ui-audio", make_zip())
        self.assertEqual(result["status"], "verified")
        self.assertEqual(result["observedFiles"], 50)
        self.assertEqual(len(result["assets"]), 50)
        self.assertTrue(all(x["sha256"] and x["targetPath"].startswith("assets/sound-library/")
                            for x in result["assets"]))

    def test_count_mismatch_fail_closed_instead_of_dropping_the_51st(self):
        with self.assertRaisesRegex(ValueError, "count mismatch"):
            probe.inspect_archive("ui-audio", make_zip(count=51))

    def test_missing_embedded_cc0_license_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "embedded CC0 license"):
            probe.inspect_archive("ui-audio", make_zip(licensed=False))

    def test_zip_slip_is_rejected_before_extract(self):
        with self.assertRaisesRegex(ValueError, "unsafe ZIP"):
            probe.inspect_archive("ui-audio", make_zip(extra="../evil.ogg"))

    def test_unexpected_hostname_fails_without_network(self):
        with self.assertRaisesRegex(ValueError, "approved publisher"):
            probe.publisher_zip("https://wrong-site.example/sfx.zip")

    def test_format_signature_preflight(self):
        with self.assertRaisesRegex(ValueError, "invalid OGG"):
            probe.inspect_audio(b"FAKE", ".ogg")
        with self.assertRaisesRegex(ValueError, "invalid WAV"):
            probe.inspect_audio(b"FAKE", ".wav")

    @patch.object(probe, "inspect_audio", return_value={
        "durationSeconds": 0.5, "codec": "vorbis", "sampleRate": 48000,
        "channels": 2,
    })
    def test_import_writes_only_whitelisted_audio_to_temp_root(self, _):
        with tempfile.TemporaryDirectory() as temp:
            result = probe.inspect_archive("ui-audio", make_zip(), import_root=temp)
            audio = list(pathlib.Path(temp).rglob("*.ogg"))
            self.assertEqual(len(audio), 50)
            self.assertEqual(len(result["assets"]), 50)
            self.assertEqual(len(list(pathlib.Path(temp).rglob("*.py"))), 0)

if __name__ == "__main__":
    unittest.main()
