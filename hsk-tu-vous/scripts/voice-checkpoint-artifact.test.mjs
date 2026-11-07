import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { packageVoiceRecoveryArtifacts } from "./voice-checkpoint-artifact.mjs";
import { sha256 } from "./voice-checkpoint.mjs";

function wav() {
  const pcm = Buffer.from([0, 0, 1, 0]);
  const bytes = Buffer.alloc(44 + pcm.length);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24); bytes.writeUInt32LE(48000, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write("data", 36); bytes.writeUInt32LE(pcm.length, 40); pcm.copy(bytes, 44);
  return bytes;
}

function narrationHash(episode) {
  return createHash("sha256").update(episode.scenes.map((scene) => scene.narration.trim()).join("\n\n") + "\n").digest("hex");
}

async function makeProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-recovery-artifact-"));
  const output = root + "-artifact";
  await fs.mkdir(path.join(root, "content/locales/tg"), { recursive: true });
  await fs.mkdir(path.join(root, "content"), { recursive: true });
  await fs.writeFile(path.join(root, "content/languages.json"), JSON.stringify({
    schemaVersion: 1, defaultProductionLanguages: ["ru", "tg"],
    languages: { ru: { contentRoot: "content" }, tg: { contentRoot: "content/locales/tg" } },
  }));
  const profiles = {
    ru: { status: "approved", provider: "gemini-api", profileId: "ru-v1", locale: "ru-RU", ttsModel: "tts-ru", voiceName: "Kore", transcriptionModel: "stt", sampleEpisodeId: "other" },
    tg: { status: "approved", provider: "gemini-api", profileId: "tg-v1", locale: "tg-TJ", ttsModel: "tts-tg", voiceName: "Kore", transcriptionModel: "stt", sampleEpisodeId: "other" },
  };
  await fs.writeFile(path.join(root, "content/voice-profile.json"), JSON.stringify(profiles.ru));
  await fs.writeFile(path.join(root, "content/locales/tg/voice-profile.json"), JSON.stringify(profiles.tg));
  const ruAudio = Buffer.from("generated-unapproved-mp3");
  const ruEpisode = {
    id: "lesson-20261106", languageCode: "ru-RU", voiceProfileId: "ru-v1", voiceProvider: "gemini-api", voiceLocale: "ru-RU",
    scenes: [{ id: "lesson", narration: "Здесь китайский: 你好。" }], captions: [{ text: "test" }],
    captionSource: "gemini-word-timestamps", audioSrc: "generated/lesson-20261106/voice.mp3", audioSha256: sha256(ruAudio),
  };
  ruEpisode.voiceTextHash = narrationHash(ruEpisode);
  const ruReview = path.join(root, "review/lesson-20261106");
  await fs.mkdir(ruReview, { recursive: true });
  await fs.writeFile(path.join(ruReview, "episode.json"), JSON.stringify(ruEpisode));
  await fs.writeFile(path.join(ruReview, "status.json"), JSON.stringify({ stage: "voice-and-captions-imported", updatedAt: "now", privateRunnerPath: "/private/path" }));
  await fs.mkdir(path.join(root, "public/generated/lesson-20261106"), { recursive: true });
  await fs.writeFile(path.join(root, "public/generated/lesson-20261106/voice.mp3"), ruAudio);

  const tgReview = path.join(root, "review/lesson-20261106/tg/gemini-production/2026-11-06T02-00-00-000Z");
  await fs.mkdir(tgReview, { recursive: true });
  const ttsWav = wav();
  await fs.writeFile(path.join(tgReview, "voice.wav"), ttsWav);
  await fs.writeFile(path.join(tgReview, "tts-input.txt"), "must not be packaged");
  await fs.writeFile(path.join(tgReview, "checkpoint.json"), JSON.stringify({
    schemaVersion: 1, production: true, status: "audio-ready", episodeId: "lesson-20261106", platform: null,
    provider: "gemini-api", apiTransport: "openrouter", languageCode: "tg-TJ", voiceProfileId: "tg-v1",
    ttsModel: "tts-tg", voice: "Kore", transcriptionModel: "stt", narrationTextHash: "narration-hash",
    ttsGenerationMode: "scene", ttsChunkCount: 1, sampleOnly: false, transcriptionAttemptsByChunk: [2],
    chunks: [{ file: "voice.wav", bytes: ttsWav.length, sha256: sha256(ttsWav) }],
  }));
  return { root, output, ruReview, tgReview };
}

test("packages only hash-verified, unapproved audio recovery data", async () => {
  const project = await makeProject();
  try {
    const result = await packageVoiceRecoveryArtifacts({ projectRoot: project.root, episodeId: "lesson-20261106", outputRoot: project.output });
    assert.ok(result.files.includes(path.join("review", "lesson-20261106", "episode.json")));
    assert.ok(result.files.includes(path.join("public", "generated", "lesson-20261106", "voice.mp3")));
    assert.ok(result.files.includes(path.join("review", "lesson-20261106", "tg", "gemini-production", "2026-11-06T02-00-00-000Z", "voice.wav")));
    assert.ok(!result.files.some((file) => file.includes("tts-input.txt") || file.endsWith("video.mp4")));
    const restoredStatus = JSON.parse(await fs.readFile(path.join(project.output, "review/lesson-20261106/status.json"), "utf8"));
    assert.equal(restoredStatus.privateRunnerPath, undefined);
    assert.equal(await fs.readFile(path.join(project.output, "public/generated/lesson-20261106/voice.mp3"), "utf8"), "generated-unapproved-mp3");
    const restoredCheckpoint = JSON.parse(await fs.readFile(path.join(project.output, "review/lesson-20261106/tg/gemini-production/2026-11-06T02-00-00-000Z/checkpoint.json"), "utf8"));
    assert.deepEqual(restoredCheckpoint.transcriptionAttemptsByChunk, [2]);
  } finally {
    await fs.rm(project.root, { recursive: true, force: true });
    await fs.rm(project.output, { recursive: true, force: true });
  }
});

test("does not package an approved or cross-profile checkpoint", async () => {
  const project = await makeProject();
  try {
    await fs.writeFile(path.join(project.ruReview, "approval.json"), "{}");
    const checkpointPath = path.join(project.tgReview, "checkpoint.json");
    const checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8"));
    checkpoint.voiceProfileId = "wrong-locale";
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint));
    const result = await packageVoiceRecoveryArtifacts({ projectRoot: project.root, episodeId: "lesson-20261106", outputRoot: project.output });
    assert.equal(result.fileCount, 0);
  } finally {
    await fs.rm(project.root, { recursive: true, force: true });
    await fs.rm(project.output, { recursive: true, force: true });
  }
});
