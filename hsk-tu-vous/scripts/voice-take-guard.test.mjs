import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findReusableVoiceCheckpoint, findUnresumableSavedTakes, measureWavQuality, sha256,
} from "./voice-checkpoint.mjs";

const profile = {
  provider: "gemini-api", ttsModel: "gemini-3.8-flash-tts", voiceName: "Kore",
  transcriptionModel: "gemini-3.5-transcribe", profileId: "tg-gemini-kore-v1", locale: "tg-TJ",
};
const expected = {
  episodeId: "zhuozi-you-book-20261031", platform: null, apiTransport: "openrouter",
  narrationTextHash: "a".repeat(64), ttsGenerationMode: "scene", ttsChunkCount: 2,
};
const take = (patch = {}) => ({
  production: true, status: "transcript-mismatch", episodeId: expected.episodeId,
  provider: "gemini-api", apiTransport: "openrouter", ttsModel: profile.ttsModel, voice: "Kore",
  transcriptionModel: profile.transcriptionModel, voiceProfileId: profile.profileId, languageCode: "tg-TJ",
  narrationTextHash: expected.narrationTextHash, ttsGenerationMode: "scene", ttsChunkCount: 2, ...patch,
});

function wav(samples, { sampleRate = 24000, channels = 1, bits = 16 } = {}) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, index) => data.writeInt16LE(value, index * 2));
  const out = Buffer.alloc(44 + data.length);
  out.write("RIFF", 0); out.writeUInt32LE(out.length - 8, 4); out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24); out.writeUInt32LE(sampleRate * channels * 2, 28);
  out.writeUInt16LE(channels * 2, 32); out.writeUInt16LE(bits, 34);
  out.write("data", 36); out.writeUInt32LE(data.length, 40); data.copy(out, 44);
  return out;
}
const speechLike = (seconds = 1, sampleRate = 24000) => Array.from({ length: seconds * sampleRate }, (_, i) =>
  // 220 Hz tone with a 300 ms pause in the middle.
  i > sampleRate * 0.4 && i < sampleRate * 0.7 ? 0 : Math.round(9000 * Math.sin(2 * Math.PI * 220 * i / sampleRate)));

async function root() {
  return fs.mkdtemp(path.join(os.tmpdir(), "hsk-take-guard-"));
}
async function saveTake(dir, name, meta, { wavFiles = ["voice-part-001.wav"], recordSha = false } = {}) {
  const folder = path.join(dir, name);
  await fs.mkdir(folder, { recursive: true });
  const bytes = wav(speechLike(0.2));
  for (const file of wavFiles) await fs.writeFile(path.join(folder, file), bytes);
  const chunks = recordSha ? wavFiles.map((file) => ({ file, sha256: sha256(bytes) })) : undefined;
  await fs.writeFile(path.join(folder, "metadata.json"), JSON.stringify({ ...meta, ...(chunks ? { ttsChunks: chunks } : {}) }));
  return folder;
}

test("X-05/X-08: a saved paid take that cannot auto-resume blocks a silent second purchase", async () => {
  const dir = await root();
  // Legacy take saved before per-chunk SHA-256 existed (all real 2026-11-03 takes).
  await saveTake(dir, "2026-11-03T08-15-36-177Z", take());
  assert.equal(await findReusableVoiceCheckpoint({ productionRoot: dir, expected, profile }), null);
  const blocking = await findUnresumableSavedTakes({ productionRoot: dir, expected, profile });
  assert.deepEqual(blocking, [{ folderName: "2026-11-03T08-15-36-177Z", status: "transcript-mismatch",
    reason: "no verifiable per-chunk SHA-256" }]);

  await saveTake(dir, "2026-11-04T08-00-00-000Z", take({ status: "imported" }));
  await saveTake(dir, "2026-11-05T08-00-00-000Z", take({ apiTransport: "gemini-direct" }));
  const reasons = (await findUnresumableSavedTakes({ productionRoot: dir, expected, profile })).map((t) => t.reason);
  assert.deepEqual(reasons, ["saved with another transport", "imported take; working copy no longer references it",
    "no verifiable per-chunk SHA-256"]);
});

test("only the same narration, voice and locale counts; samples and audio-less folders do not", async () => {
  const dir = await root();
  await saveTake(dir, "2026-11-01T00-00-00-000Z", take({ narrationTextHash: "b".repeat(64) }));
  await saveTake(dir, "2026-11-01T01-00-00-000Z", take({ voice: "Puck" }));
  await saveTake(dir, "2026-11-01T02-00-00-000Z", take({ languageCode: "ru-RU", voiceProfileId: "ru-gemini-kore-v1" }));
  await saveTake(dir, "2026-11-01T03-00-00-000Z", take({ sampleOnly: true, status: "ready-for-owner-audition" }));
  await saveTake(dir, "2026-11-01T04-00-00-000Z", take({ platform: "tiktok" }));
  await saveTake(dir, "2026-11-01T05-00-00-000Z", take(), { wavFiles: [] });
  await fs.mkdir(path.join(dir, "notes"));
  assert.deepEqual(await findUnresumableSavedTakes({ productionRoot: dir, expected, profile }), []);
  assert.deepEqual(await findUnresumableSavedTakes({ productionRoot: path.join(dir, "missing"), expected, profile }), []);
});

test("an explicit --new-take rejects every older take, for both resume and the guard", async () => {
  const dir = await root();
  // Older take is SHA-verified and would normally auto-resume.
  await saveTake(dir, "2026-11-02T00-00-00-000Z", take(), { wavFiles: ["voice-part-001.wav"], recordSha: true });
  assert.equal((await findReusableVoiceCheckpoint({ productionRoot: dir, expected, profile })).folderName,
    "2026-11-02T00-00-00-000Z");
  // Owner listened and bought a new take; its first TTS call failed before any audio.
  await saveTake(dir, "2026-11-03T00-00-00-000Z", take({ status: "failed", newTakeRequested: true }), { wavFiles: [] });
  assert.equal(await findReusableVoiceCheckpoint({ productionRoot: dir, expected, profile }), null);
  assert.deepEqual(await findUnresumableSavedTakes({ productionRoot: dir, expected, profile }), []);
});

test("the --new-take take itself is a saved paid take; only older takes are behind its barrier", async () => {
  // Real 2026-11-08: the imported RU one-take had newTakeRequested (A/B);
  // after the working copy was regenerated the guard skipped it and a
  // second TTS take was bought.
  const dir = await root();
  await saveTake(dir, "2026-11-02T00-00-00-000Z", take({ status: "imported" }));
  await saveTake(dir, "2026-11-03T00-00-00-000Z", take({ status: "imported", newTakeRequested: true }));
  assert.deepEqual(await findUnresumableSavedTakes({ productionRoot: dir, expected, profile }),
    [{ folderName: "2026-11-03T00-00-00-000Z", status: "imported", reason: "imported take; working copy no longer references it" }]);
});

test("V-12: real-like speech passes with recorded metrics; silent or near-silent audio is rejected", () => {
  const ok = measureWavQuality(wav(speechLike(1)));
  assert.equal(ok.unusable, false);
  assert.equal(ok.durationMs, 1000);
  assert.ok(ok.peakDbfs > -12 && ok.peakDbfs <= 0);
  assert.ok(ok.longestPauseMs >= 260 && ok.longestPauseMs <= 340, String(ok.longestPauseMs));
  assert.ok(ok.nearSilentSampleFraction > 0.25 && ok.nearSilentSampleFraction < 0.35);
  assert.equal(ok.clippedSampleFraction, 0);

  assert.deepEqual(measureWavQuality(wav(new Array(24000).fill(0))).problems, ["digital silence"]);
  const hiss = Array.from({ length: 24000 }, (_, i) => (i % 7 === 0 ? 20 : 0));
  assert.deepEqual(measureWavQuality(wav(hiss)).problems, ["audio is at least 98% near-silent"]);
  const clipped = measureWavQuality(wav(Array.from({ length: 2400 }, (_, i) => (i % 2 ? 32767 : 1000))));
  assert.equal(clipped.clippedSampleFraction, 0.5, "clipping is measured and recorded");
  assert.equal(measureWavQuality(wav(speechLike(1), { channels: 2, sampleRate: 12000 })).channels, 2);
  assert.throws(() => measureWavQuality(wav([1, 2], { bits: 8 })), /16-bit/);
  assert.throws(() => measureWavQuality(Buffer.from("not audio")), /RIFF/);
});

test("generator and MCP wiring: guard before buying, QA before STT, new take only on request", () => {
  const source = readFileSync(new URL("./generate-voice-gemini.mjs", import.meta.url), "utf8");
  const resume = source.indexOf("if (!RESUME_FOLDER_NAME && !NEW_TAKE) {\n  const checkpoint = await findReusableVoiceCheckpoint(");
  const guard = source.indexOf("const savedTakes = await findUnresumableSavedTakes(");
  const folder = source.indexOf("path.join(productionRoot, RESUME_FOLDER_NAME ?? timestamp)");
  assert.ok(resume > 0 && guard > resume && folder > guard, "lookup → guard → new folder");
  assert.match(source, /stage: "gemini-voice-blocked"[\s\S]{0,200}savedTakes,\s*\}\);\s*throw new Error\(reason\);/);
  assert.match(source, /\.\.\.\(NEW_TAKE \? \{ newTakeRequested: true \} : \{\}\)/);
  assert.match(source, /newTakeRequested === true \? \{ newTakeRequested: true \} : \{\}/, "checkpoint keeps the barrier");
  const qa = source.indexOf("const audioQa = measureWavQuality(chunkBytes);");
  const stt = source.indexOf("const result = await transcribeUntilAligned({");
  assert.ok(qa > 0 && stt > qa, "audio QA precedes any paid STT");
  assert.match(source, /if \(audioQa\.unusable\) \{\s*metadata\.status = "audio-qa-failed";/);
  const mcp = readFileSync(new URL("./mcp-server.mjs", import.meta.url), "utf8");
  const tool = mcp.slice(mcp.indexOf('"generate_voice"'), mcp.indexOf('"import_voice_artifacts"'));
  assert.match(tool, /forceNewTake: z\.boolean\(\)\.optional\(\)/);
  assert.match(tool, /runScript\("generate-voice-gemini\.mjs", item\.id, \.\.\.\(forceNewTake \? \["--new-take"\] : \[\]\)\)/);
  assert.doesNotMatch(tool, /sent to Google/);
  const make = readFileSync(new URL("./make-episode.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(make, /--new-take/, "ordinary content:make never buys a new take on its own");
});
