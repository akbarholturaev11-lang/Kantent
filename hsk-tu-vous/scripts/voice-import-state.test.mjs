import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { assertImportedAudioHash, hasCurrentImportedVoice } from "./voice-import-state.mjs";
import { narrationHash } from "./lib.mjs";

const profile = { provider: "gemini-api", profileId: "ru-v1", locale: "ru-RU" };
const bytes = Buffer.from("voice");
const episode = () => {
  const value = {
    id: "lesson", languageCode: "ru-RU", voiceProvider: "gemini-api", voiceLocale: "ru-RU",
    voiceProfileId: "ru-v1", audioSrc: "generated/lesson/voice.mp3",
    captionSource: "gemini-word-timestamps", captions: [{ text: "你好", startMs: 0, endMs: 200 }],
    scenes: [{ id: "lesson", narration: "你好" }],
  };
  value.voiceTextHash = narrationHash(value);
  value.audioSha256 = createHash("sha256").update(bytes).digest("hex");
  return value;
};

test("reuses only a matching imported voice whose current file hash is intact", async () => {
  const valid = episode();
  assert.equal(await hasCurrentImportedVoice(valid, profile, {
    projectRoot: "/project", readFile: async () => bytes,
  }), true);
  assert.equal(await hasCurrentImportedVoice({ ...valid, voiceProfileId: "tg-v1" }, profile, {
    projectRoot: "/project", readFile: async () => bytes,
  }), false);
  assert.equal(await hasCurrentImportedVoice({ ...valid, audioSha256: "bad" }, profile, {
    projectRoot: "/project", readFile: async () => bytes,
  }), false);
  assert.equal(await hasCurrentImportedVoice({ ...valid, audioSrc: "../private.mp3" }, profile, {
    projectRoot: "/project", readFile: async () => bytes,
  }), false);
  assert.equal(await hasCurrentImportedVoice(valid, profile, {
    projectRoot: "/project", readFile: async () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; },
  }), false);
});

test("rejects changed imported audio when its recorded hash no longer matches", () => {
  const value = { audioSha256: createHash("sha256").update(Buffer.from("first take")).digest("hex") };
  assertImportedAudioHash(value, Buffer.from("first take"));
  assert.throws(() => assertImportedAudioHash(value, Buffer.from("replacement")), /hash does not match/);
});
