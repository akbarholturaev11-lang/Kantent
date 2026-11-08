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
    if (!saved || !checkpointMatches(saved, expected, profile)) continue;
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
  }
  return null;
}
