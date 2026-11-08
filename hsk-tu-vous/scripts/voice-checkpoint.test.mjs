import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  atomicWriteFile, atomicWriteJson, findReusableVoiceCheckpoint,
  isValidWavBuffer, matchesRecordedWavChunk, sha256,
} from "./voice-checkpoint.mjs";

function wav(pcm = Buffer.from([0, 0, 1, 0])) {
  const result = Buffer.alloc(44 + pcm.length);
  result.write("RIFF", 0);
  result.writeUInt32LE(result.length - 8, 4);
  result.write("WAVEfmt ", 8);
  result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20);
  result.writeUInt16LE(1, 22);
  result.writeUInt32LE(24000, 24);
  result.writeUInt32LE(48000, 28);
  result.writeUInt16LE(2, 32);
  result.writeUInt16LE(16, 34);
  result.write("data", 36);
  result.writeUInt32LE(pcm.length, 40);
  pcm.copy(result, 44);
  return result;
}

const profile = {
  provider: "gemini-api", profileId: "tg-kore-v1", locale: "tg-TJ",
  ttsModel: "approved-tts", voiceName: "Kore", transcriptionModel: "approved-stt",
};
const expected = {
  episodeId: "lesson-20261106", platform: null, apiTransport: "openrouter",
  narrationTextHash: "narration-sha", ttsGenerationMode: "scene", ttsChunkCount: 1,
};
const checkpoint = (overrides = {}) => ({
  production: true, status: "transcript-mismatch", provider: profile.provider,
  episodeId: expected.episodeId, platform: expected.platform,
  apiTransport: expected.apiTransport, voiceProfileId: profile.profileId,
  languageCode: profile.locale, ttsModel: profile.ttsModel,
  voice: profile.voiceName, transcriptionModel: profile.transcriptionModel,
  narrationTextHash: expected.narrationTextHash,
  ttsGenerationMode: expected.ttsGenerationMode, ttsChunkCount: expected.ttsChunkCount,
  ...overrides,
});

test("validates complete RIFF/WAVE headers and rejects truncated chunks", () => {
  const bytes = wav();
  assert.equal(isValidWavBuffer(bytes), true);
  const truncated = Buffer.from(bytes);
  truncated.writeUInt32LE(999, 40);
  assert.equal(isValidWavBuffer(truncated), false);
  assert.equal(isValidWavBuffer(bytes.subarray(0, 42)), false);
});

test("atomic file checkpoints are readable and leave no temporary file", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-audio-checkpoint-"));
  try {
    const audioPath = path.join(root, "nested", "voice.wav");
    const bytes = wav();
    await atomicWriteFile(audioPath, bytes);
    await atomicWriteJson(path.join(root, "nested", "checkpoint.json"), { sha256: sha256(bytes) });
    assert.deepEqual(await fs.readFile(audioPath), bytes);
    assert.deepEqual(await fs.readdir(path.dirname(audioPath)), ["checkpoint.json", "voice.wav"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("finds only a matching, hash-verified, unapproved audio checkpoint", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-voice-resume-"));
  try {
    const older = path.join(root, "2026-11-06T01-00-00-000Z");
    const newer = path.join(root, "2026-11-06T02-00-00-000Z");
    await fs.mkdir(older, { recursive: true });
    await fs.mkdir(newer, { recursive: true });
    const bytes = wav();
    await fs.writeFile(path.join(older, "voice.wav"), bytes);
    await atomicWriteJson(path.join(older, "checkpoint.json"), checkpoint({
      chunks: [{ file: "voice.wav", sha256: sha256(bytes) }],
      transcriptionAttemptsByChunk: [2],
    }));
    await fs.writeFile(path.join(newer, "voice.wav"), Buffer.from("partial RIFF"));
    await atomicWriteJson(path.join(newer, "checkpoint.json"), checkpoint());

    const found = await findReusableVoiceCheckpoint({ productionRoot: root, expected, profile });
    assert.equal(found.folderName, path.basename(older));
    assert.equal(found.validChunkCount, 1);
    assert.deepEqual(found.saved.transcriptionAttemptsByChunk, [2]);

    assert.equal(await findReusableVoiceCheckpoint({
      productionRoot: root,
      expected: { ...expected, apiTransport: "gemini-direct" },
      profile,
    }), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("never resumes an approved sample or a checkpoint from another locale", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-voice-protected-"));
  try {
    const folder = path.join(root, "2026-11-06T01-00-00-000Z");
    await fs.mkdir(folder, { recursive: true });
    const bytes = wav();
    await fs.writeFile(path.join(folder, "voice.wav"), bytes);
    await atomicWriteJson(path.join(folder, "checkpoint.json"), checkpoint({
      sampleOnly: true, chunks: [{ file: "voice.wav", sha256: sha256(bytes) }],
    }));
    assert.equal(await findReusableVoiceCheckpoint({ productionRoot: root, expected, profile }), null);
    await atomicWriteJson(path.join(folder, "checkpoint.json"), checkpoint({
      languageCode: "ru-RU", chunks: [{ file: "voice.wav", sha256: sha256(bytes) }],
    }));
    assert.equal(await findReusableVoiceCheckpoint({ productionRoot: root, expected, profile }), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("does not silently reuse structurally valid WAV without a recorded SHA-256", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-unverified-wav-"));
  try {
    const folder = path.join(root, "2026-11-06T04-00-00-000Z");
    await fs.mkdir(folder, { recursive: true });
    const bytes = wav();
    await fs.writeFile(path.join(folder, "voice.wav"), bytes);
    for (const chunks of [
      [],
      [{ file: "voice.wav" }],
      [{ file: "voice.wav", sha256: "0".repeat(63) }],
      [{ file: "voice.wav", sha256: sha256(Buffer.from("wrong source")) }],
    ]) {
      await atomicWriteJson(path.join(folder, "checkpoint.json"), checkpoint({ chunks }));
      const found = await findReusableVoiceCheckpoint({
        productionRoot: root, expected, profile,
      });
      assert.equal(found, null, "Only hash-bound audio is reusable automatically");
      assert.deepEqual(await fs.readFile(path.join(folder, "voice.wav")), bytes,
        "Refused unverified WAV must not be destroyed");
    }
    await atomicWriteJson(path.join(folder, "checkpoint.json"), checkpoint({
      chunks: [{ file: "voice.wav", sha256: sha256(bytes) }],
    }));
    const verified = await findReusableVoiceCheckpoint({ productionRoot: root, expected, profile });
    assert.equal(verified.folderName, path.basename(folder));
    assert.equal(verified.validChunkCount, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("explicit resume refuses a structurally valid unverified or altered WAV, without deleting it", () => {
  const original = wav();
  const alternate = wav(Buffer.from([3, 0, 4, 0]));
  const record = { file: "voice.wav", sha256: sha256(original) };
  assert.equal(matchesRecordedWavChunk("voice.wav", original, record), true);
  assert.equal(matchesRecordedWavChunk("voice.wav", alternate, record), false);
  assert.equal(matchesRecordedWavChunk("voice.wav", original, { file: "voice.wav" }), false);
  assert.equal(matchesRecordedWavChunk("voice.wav", original, { file: "other.wav", sha256: sha256(original) }), false);
  assert.equal(matchesRecordedWavChunk("voice.wav", Buffer.from("not a wav"), record), false);
  assert.equal(matchesRecordedWavChunk("voice.wav", original, { file: "voice.wav", sha256: "bad" }), false);
});
