import assert from "node:assert/strict";
import test from "node:test";
import { readMediaDurationMs } from "./media-duration.mjs";

test("reads media duration from ffprobe on any supported platform", () => {
  const calls = [];
  const duration = readMediaDurationMs("voice.mp3", {
    run: (...args) => {
      calls.push(args);
      return { status: 0, stdout: '{"format":{"duration":"12.3456"}}', stderr: "" };
    },
  });
  assert.equal(duration, 12_346);
  assert.equal(calls[0][0], "ffprobe");
  assert.deepEqual(calls[0][1].slice(-1), ["voice.mp3"]);
});

test("fails closed for missing or invalid duration instead of using caption timing", () => {
  for (const stdout of ["{}", "{bad", '{"format":{"duration":"NaN"}}', '{"format":{"duration":"0"}}']) {
    assert.throws(() => readMediaDurationMs("voice.mp3", {
      run: () => ({ status: 0, stdout, stderr: "" }),
    }));
  }
  assert.throws(() => readMediaDurationMs("voice.mp3", {
    run: () => ({ status: 1, stdout: "", stderr: "invalid input" }),
  }), /ffprobe could not read/);
});

test("system FFmpeg/FFprobe are proven before any paid voice request", async () => {
  const { requireSystemMediaTools } = await import("./media-duration.mjs");
  const seen = [];
  requireSystemMediaTools({ run: (command) => { seen.push(command); return { status: 0 }; } });
  assert.deepEqual(seen, ["ffmpeg", "ffprobe"]);
  assert.throws(() => requireSystemMediaTools({ run: (command) =>
    command === "ffprobe" ? { error: Object.assign(new Error("spawn ffprobe ENOENT"), { code: "ENOENT" }) } : { status: 0 } }),
  /system ffprobe on PATH[\s\S]*No paid TTS\/STT request was made/);
  const generator = (await import("node:fs")).readFileSync(new URL("./generate-voice-gemini.mjs", import.meta.url), "utf8");
  const check = generator.indexOf("requireSystemMediaTools();");
  assert.ok(check > 0 && check < generator.indexOf("await findReusableVoiceCheckpoint("), "checked before any take is chosen or bought");
});

