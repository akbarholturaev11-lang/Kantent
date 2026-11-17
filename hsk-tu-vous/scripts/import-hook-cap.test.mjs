import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// import-voice.mjs is a CLI with file side effects; its hook-cap rule is
// asserted structurally (real 2026-11-08 bi-comparison RU: an 8.1 s hook).
const source = readFileSync(new URL("./import-voice.mjs", import.meta.url), "utf8");

test("the six-second RU hook cap never cuts the hook's own speech", () => {
  assert.match(source, /const hookSpeechEndFrame = Math\.ceil\(\(previousCaptionEndMs \/ 1000\) \* FPS\);/);
  assert.match(source, /\? Math\.min\(targetStartFrame, Math\.max\(180, hookSpeechEndFrame\)\)/);
  assert.doesNotMatch(source, /Math\.min\(targetStartFrame, 180\)/);
});

test("a TikTok import keeps the verified base lesson frame for frame and starts its ending at the base CTA boundary", () => {
  assert.match(source, /tiktokBaseScenes = baseEpisode\.scenes;/);
  const pin = source.indexOf("if (tiktokBaseScenes) {");
  assert.ok(pin > source.lastIndexOf("sceneStartFrames.push(") && pin < source.indexOf("const finalSceneEndMs ="),
    "pinned after cue-derived starts and before scene timings are written");
  assert.match(source, /sceneStartFrames\[index\] = Math\.round\(\(scene\.startMs \/ 1000\) \* FPS\);/);
  assert.match(source, /TikTok review scenes no longer match the verified lesson/);
});
