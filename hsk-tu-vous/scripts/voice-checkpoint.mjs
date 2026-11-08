import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { assertReusableVoiceMetadata } from "./voice-language.mjs";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function isValidWavBuffer(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44 ||
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WAVE") return false;
  const riffEnd = bytes.readUInt32LE(4) + 8;
  if (riffEnd > bytes.length) return false;

  let hasFormat = false;
  let hasAudio = false;
  for (let offset = 12; offset + 8 <= riffEnd;) {
    const chunkName = bytes.toString("ascii", offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > riffEnd) return false;
    if (chunkName === "fmt ") {
      if (chunkSize < 16) return false;
      hasFormat = bytes.readUInt16LE(chunkStart + 2) > 0 &&
        bytes.readUInt32LE(chunkStart + 4) > 0 &&
        bytes.readUInt16LE(chunkStart + 14) > 0;
    } else if (chunkName === "data") {
      hasAudio = chunkSize > 0;
    }
    offset = chunkEnd + (chunkSize % 2);
  }
  return hasFormat && hasAudio;
}

/** Never treat a hashless or altered encoded audio take as verified. */
export function matchesRecordedAudioHash(bytes, recordedSha) {
  return Buffer.isBuffer(bytes) &&
    /^[a-f0-9]{64}$/.test(recordedSha ?? "") &&
    sha256(bytes) === recordedSha;
}

/** Verify a saved speech chunk against the exact checkpoint record.
 * This is deliberately stricter than WAV structural validation alone. */
export function matchesRecordedWavChunk(fileName, bytes, recorded, validateWav = isValidWavBuffer) {
  return recorded?.file === fileName &&
    validateWav(bytes) &&
    matchesRecordedAudioHash(bytes, recorded.sha256);
}

export async function atomicWriteFile(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + ".tmp-" + randomUUID();
  try {
    await fs.writeFile(tempPath, contents, { flag: "wx" });
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

export async function atomicWriteJson(filePath, value) {
  await atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function checkpointMatches(saved, expected, profile) {
  try {
    assertReusableVoiceMetadata(saved, profile);
  } catch {
    return false;
  }
  return saved?.production === true &&
    saved.sampleOnly !== true &&
    saved.episodeId === expected.episodeId &&
    (saved.platform ?? null) === (expected.platform ?? null) &&
    (saved.apiTransport ?? "gemini-direct") === expected.apiTransport &&
    saved.voiceProfileId === profile.profileId &&
    saved.languageCode === profile.locale &&
    saved.narrationTextHash === expected.narrationTextHash &&
    (saved.ttsGenerationMode ?? "scene") === expected.ttsGenerationMode &&
    saved.ttsChunkCount === expected.ttsChunkCount &&
    !["imported", "ready-for-owner-audition"].includes(saved.status);
}

export async function findReusableVoiceCheckpoint({
  productionRoot,
  expected,
  profile,
  validateWav = isValidWavBuffer,
}) {
  let entries;
  try {
    entries = await fs.readdir(productionRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const folders = entries.filter((entry) => entry.isDirectory())
    .map((entry) => entry.name).sort().reverse();

  for (const folderName of folders) {
    const folder = path.join(productionRoot, folderName);
    const saved = await readOptionalJson(path.join(folder, "checkpoint.json")) ??
      await readOptionalJson(path.join(folder, "metadata.json"));
    if (!saved) continue;
    // A take bought by an explicit owner --new-take rejects every older take
    // of the same narration, even if the new one failed before saving audio.
    const barrier = saved.newTakeRequested === true && saved.episodeId === expected.episodeId &&
      (saved.platform ?? null) === (expected.platform ?? null) &&
      saved.narrationTextHash === expected.narrationTextHash;
    if (!checkpointMatches(saved, expected, profile)) {
      if (barrier) return null;
      continue;
    }
    const chunks = Array.isArray(saved.chunks) ? saved.chunks :
      (Array.isArray(saved.ttsChunks) ? saved.ttsChunks : []);
    const expectedFiles = expected.ttsChunkCount === 1
      ? ["voice.wav"]
      : Array.from({ length: expected.ttsChunkCount }, (_, index) =>
          `voice-part-${String(index + 1).padStart(3, "0")}.wav`);
    let validChunkCount = 0;
    for (const fileName of expectedFiles) {
      let bytes;
      try {
        bytes = await fs.readFile(path.join(folder, fileName));
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }
      const recorded = chunks.find((chunk) => chunk.file === fileName);
      // A WAV header alone does not prove the original voice identity.
      if (!matchesRecordedWavChunk(fileName, bytes, recorded, validateWav))
        continue;
      validChunkCount += 1;
    }
    if (validChunkCount) return { folderName, saved, validChunkCount };
    if (barrier) return null;
  }
  return null;
}

const TAKE_FOLDER = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

/**
 * X-05/X-08: saved PAID takes of this exact narration that automatic resume
 * cannot use (no recorded SHA-256 from before checkpoints existed, another
 * transport/chunk plan, or an already imported take whose working copy was
 * reset). Real data: xiang-vs-yao bought 3 takes and zhuozi 2 takes of the
 * same narration. The caller must stop instead of silently buying another.
 * Takes older than an explicit owner --new-take are treated as rejected.
 */
export async function findUnresumableSavedTakes({ productionRoot, expected, profile }) {
  let entries;
  try {
    entries = await fs.readdir(productionRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const folders = entries.filter((entry) => entry.isDirectory() && TAKE_FOLDER.test(entry.name))
    .map((entry) => entry.name).sort().reverse();
  const found = [];
  for (const folderName of folders) {
    const folder = path.join(productionRoot, folderName);
    const saved = await readOptionalJson(path.join(folder, "checkpoint.json")) ??
      await readOptionalJson(path.join(folder, "metadata.json"));
    if (!saved) continue;
    const sameNarration = saved.production === true &&
      saved.episodeId === expected.episodeId &&
      (saved.platform ?? null) === (expected.platform ?? null) &&
      saved.narrationTextHash === expected.narrationTextHash;
    if (!sameNarration) continue;
    if (saved.newTakeRequested === true) break;
    if (saved.sampleOnly === true || saved.status === "ready-for-owner-audition") continue;
    try {
      assertReusableVoiceMetadata(saved, profile);
    } catch {
      continue; // another voice/model/locale: not the same paid take
    }
    const files = await fs.readdir(folder);
    if (!files.some((name) => /^voice(?:-part-\d{3})?\.wav$/.test(name))) continue;
    const reason = saved.status === "imported" ? "imported take; working copy no longer references it"
      : (saved.apiTransport ?? "gemini-direct") !== expected.apiTransport ? "saved with another transport"
      : (saved.ttsGenerationMode ?? "scene") !== expected.ttsGenerationMode ||
        saved.ttsChunkCount !== expected.ttsChunkCount ? "saved with another chunk plan"
      : "no verifiable per-chunk SHA-256";
    found.push({ folderName, status: saved.status ?? null, reason });
  }
  return found;
}

/**
 * V-12: objective signal QA of one 16-bit PCM WAV, measured right after TTS
 * and before any paid STT. Metrics are recorded for every chunk; only audio
 * that cannot be speech (no samples, digital silence, >=98% near-silent) is
 * rejected. 180 real saved WAV chunks (2026-11-08) measured 10–45% near-silent
 * samples, longest pause 0.2–1.3 s and peak −3.2…0 dBFS, with no false rejection.
 */
export function measureWavQuality(bytes) {
  if (!isValidWavBuffer(bytes)) throw new Error("Audio QA needs a complete RIFF/WAVE file.");
  let format;
  let data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (name === "fmt ") format = {
      encoding: bytes.readUInt16LE(offset + 8), channels: bytes.readUInt16LE(offset + 10),
      sampleRate: bytes.readUInt32LE(offset + 12), bits: bytes.readUInt16LE(offset + 22),
    };
    if (name === "data") data = bytes.subarray(offset + 8, Math.min(bytes.length, offset + 8 + size));
    offset += 8 + size + (size % 2);
  }
  if (!format || !data) throw new Error("Audio QA could not find WAV format and data.");
  if (format.encoding !== 1 || format.bits !== 16)
    throw new Error("Audio QA supports 16-bit PCM WAV only.");
  const samples = Math.floor(data.length / 2);
  const frames = Math.floor(samples / format.channels);
  const windowFrames = Math.max(1, Math.round(format.sampleRate * 0.02));
  let peak = 0;
  let sumSquares = 0;
  let clipped = 0;
  let nearSilent = 0;
  let silentRunFrames = 0;
  let longestSilentFrames = 0;
  let windowEnergy = 0;
  let windowCount = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    let frameEnergy = 0;
    for (let channel = 0; channel < format.channels; channel += 1) {
      const value = data.readInt16LE((frame * format.channels + channel) * 2);
      const magnitude = Math.abs(value);
      if (magnitude > peak) peak = magnitude;
      if (magnitude >= 32767) clipped += 1;
      if (magnitude / 32768 < 0.001) nearSilent += 1;
      sumSquares += value * value;
      frameEnergy += value * value;
    }
    windowEnergy += frameEnergy / format.channels;
    windowCount += 1;
    if (windowCount === windowFrames || frame === frames - 1) {
      // A 20 ms window under -50 dBFS counts as pause.
      const silent = Math.sqrt(windowEnergy / windowCount) / 32768 < 10 ** (-50 / 20);
      silentRunFrames = silent ? silentRunFrames + windowCount : 0;
      longestSilentFrames = Math.max(longestSilentFrames, silentRunFrames);
      windowEnergy = 0;
      windowCount = 0;
    }
  }
  const round = (value, digits = 4) => Number(value.toFixed(digits));
  const metrics = {
    durationMs: Math.round(frames / format.sampleRate * 1000),
    sampleRate: format.sampleRate,
    channels: format.channels,
    peakDbfs: peak ? round(20 * Math.log10(peak / 32768), 2) : null,
    rmsDbfs: sumSquares ? round(20 * Math.log10(Math.sqrt(sumSquares / samples) / 32768), 2) : null,
    clippedSampleFraction: samples ? round(clipped / samples, 6) : 0,
    nearSilentSampleFraction: samples ? round(nearSilent / samples) : 1,
    longestPauseMs: Math.round(longestSilentFrames / format.sampleRate * 1000),
  };
  const problems = [];
  if (!frames) problems.push("no audio samples");
  else if (!peak) problems.push("digital silence");
  else if (metrics.nearSilentSampleFraction >= 0.98) problems.push("audio is at least 98% near-silent");
  return { ...metrics, unusable: problems.length > 0, problems };
}
