import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isValidWavBuffer, sha256 } from "./voice-checkpoint.mjs";

const SAFE_FOLDER = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
const PROTECTED_STAGES = new Set([
  "owner-approved-for-zernio-publishing", "zernio-published", "zernio-scheduled",
  "zernio-publication-processing", "zernio-publication-partial", "zernio-publication-failed",
]);

function narrationHash(episode) {
  const narration = episode.scenes.map((scene) => scene.narration.trim()).join("\n\n") + "\n";
  return createHash("sha256").update(narration, "utf8").digest("hex");
}

async function readJson(filePath) {
  try { return JSON.parse(await fs.readFile(filePath, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

async function copyWithin(source, relative, outputRoot, projectRoot, files) {
  const safeRelative = path.normalize(relative);
  if (path.isAbsolute(safeRelative) || safeRelative === ".." || safeRelative.startsWith(`..${path.sep}`))
    throw new Error("Recovery artifact path escapes its root.");
  const destination = path.join(outputRoot, safeRelative);
  const normalizedSource = path.resolve(source);
  if (!normalizedSource.startsWith(path.resolve(projectRoot) + path.sep))
    throw new Error("Recovery source escapes the project root.");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(normalizedSource, destination);
  files.add(safeRelative);
}

function packageableCheckpoint(checkpoint, episodeId, profile) {
  return checkpoint?.schemaVersion === 1 && checkpoint.production === true &&
    checkpoint.episodeId === episodeId && checkpoint.provider === "gemini-api" &&
    checkpoint.sampleOnly !== true && checkpoint.status !== "imported" &&
    checkpoint.status !== "ready-for-owner-audition" &&
    checkpoint.voiceProfileId === profile.profileId && checkpoint.languageCode === profile.locale &&
    checkpoint.ttsModel === profile.ttsModel && checkpoint.voice === profile.voiceName &&
    checkpoint.transcriptionModel === profile.transcriptionModel &&
    Number.isInteger(checkpoint.ttsChunkCount) && checkpoint.ttsChunkCount > 0;
}

async function packageCheckpoint({ reviewFolder, reviewRelative, episodeId, profile, outputRoot, projectRoot, files }) {
  const productionRoot = path.join(reviewFolder, "gemini-production");
  let entries;
  try { entries = await fs.readdir(productionRoot, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return; throw error; }

  for (const entry of entries) {
    if (!entry.isDirectory() || !SAFE_FOLDER.test(entry.name)) continue;
    const sourceFolder = path.join(productionRoot, entry.name);
    const checkpoint = await readJson(path.join(sourceFolder, "checkpoint.json"));
    if (!packageableCheckpoint(checkpoint, episodeId, profile)) continue;
    const names = checkpoint.ttsChunkCount === 1
      ? ["voice.wav"]
      : Array.from({ length: checkpoint.ttsChunkCount }, (_, index) => `voice-part-${String(index + 1).padStart(3, "0")}.wav`);
    const validChunks = [];
    for (const file of names) {
      const recorded = checkpoint.chunks?.find((chunk) => chunk.file === file);
      if (recorded && (recorded.file !== file || path.basename(recorded.file) !== recorded.file)) continue;
      const source = path.join(sourceFolder, file);
      let bytes;
      try { bytes = await fs.readFile(source); }
      catch (error) { if (error?.code === "ENOENT") continue; throw error; }
      if (!isValidWavBuffer(bytes) || (recorded?.sha256 && sha256(bytes) !== recorded.sha256)) continue;
      validChunks.push({ file, source });
    }
    if (!validChunks.length) continue;
    const artifactBase = path.join(reviewRelative, "gemini-production", entry.name);
    await copyWithin(path.join(sourceFolder, "checkpoint.json"), path.join(artifactBase, "checkpoint.json"), outputRoot, projectRoot, files);
    for (const chunk of validChunks)
      await copyWithin(chunk.source, path.join(artifactBase, chunk.file), outputRoot, projectRoot, files);

    if (typeof checkpoint.masterWavSha256 === "string") {
      const master = path.join(sourceFolder, "voice.wav");
      try {
        const bytes = await fs.readFile(master);
        if (isValidWavBuffer(bytes) && sha256(bytes) === checkpoint.masterWavSha256)
          await copyWithin(master, path.join(artifactBase, "voice.wav"), outputRoot, projectRoot, files);
      } catch (error) { if (error?.code !== "ENOENT") throw error; }
    }
    if (typeof checkpoint.mp3Sha256 === "string") {
      const mp3 = path.join(sourceFolder, "voice.mp3");
      try {
        const bytes = await fs.readFile(mp3);
        if (bytes.length && sha256(bytes) === checkpoint.mp3Sha256)
          await copyWithin(mp3, path.join(artifactBase, "voice.mp3"), outputRoot, projectRoot, files);
      } catch (error) { if (error?.code !== "ENOENT") throw error; }
    }
  }
}

async function packageImportedVoice({ reviewFolder, reviewRelative, episodeId, profile, outputRoot, projectRoot, files }) {
  try { await fs.access(path.join(reviewFolder, "approval.json")); return; }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  const episode = await readJson(path.join(reviewFolder, "episode.json"));
  const status = await readJson(path.join(reviewFolder, "status.json"));
  if (!episode || !status || PROTECTED_STAGES.has(status.stage) ||
      ["owner-approved-for-zernio-publishing", "published", "scheduled"].includes(episode.publishingStatus) ||
      episode.id !== episodeId || episode.voiceProfileId !== profile.profileId ||
      episode.voiceProvider !== profile.provider || episode.voiceLocale !== profile.locale ||
      episode.voiceTextHash !== narrationHash(episode) || episode.captionSource !== "gemini-word-timestamps" ||
      !episode.captions?.length || typeof episode.audioSha256 !== "string" ||
      typeof episode.audioSrc !== "string" || !episode.audioSrc.startsWith("generated/")) return;
  const publicRelative = path.normalize(episode.audioSrc);
  if (path.isAbsolute(publicRelative) || publicRelative === ".." || publicRelative.startsWith(`..${path.sep}`)) return;
  const audioPath = path.join(projectRoot, "public", publicRelative);
  const audioBytes = await fs.readFile(audioPath).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (!audioBytes?.length || sha256(audioBytes) !== episode.audioSha256) return;
  await copyWithin(path.join(reviewFolder, "episode.json"), path.join(reviewRelative, "episode.json"), outputRoot, projectRoot, files);
  const safeStatus = {
    stage: "voice-and-captions-imported",
    updatedAt: status.updatedAt,
    voiceProfileId: profile.profileId,
    languageCode: profile.locale,
    voiceTextHash: episode.voiceTextHash,
    audio: episode.audioSrc,
    captionCount: episode.captions.length,
  };
  const statusDestination = path.join(outputRoot, reviewRelative, "status.json");
  await fs.mkdir(path.dirname(statusDestination), { recursive: true });
  await fs.writeFile(statusDestination, `${JSON.stringify(safeStatus, null, 2)}\n`);
  files.add(path.join(reviewRelative, "status.json"));
  await copyWithin(audioPath, path.join("public", publicRelative), outputRoot, projectRoot, files);
}

/** Package only hash-verified, unapproved voice recovery state; never videos or secrets. */
export async function packageVoiceRecoveryArtifacts({ projectRoot, episodeId, outputRoot }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episodeId ?? "")) throw new Error("Invalid recovery episode ID.");
  const root = path.resolve(projectRoot);
  const output = path.resolve(outputRoot);
  if (output === root || output.startsWith(root + path.sep))
    throw new Error("Recovery artifact directory must be outside the project checkout.");
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  const config = await readJson(path.join(root, "content", "languages.json"));
  if (!config || config.schemaVersion !== 1) throw new Error("Invalid language configuration for voice recovery.");
  const files = new Set();
  for (const language of config.defaultProductionLanguages) {
    const languageConfig = config.languages?.[language];
    if (!languageConfig) throw new Error("Language configuration is incomplete.");
    const contentRoot = path.join(root, languageConfig.contentRoot);
    const profile = await readJson(path.join(contentRoot, "voice-profile.json"));
    if (!profile || profile.status !== "approved" || profile.modelDecisionRequired ||
        profile.sampleEpisodeId === episodeId) continue;
    const reviewRelative = path.join("review", episodeId, ...(language === "ru" ? [] : [language]));
    for (const variant of ["", "tiktok"]) {
      const reviewPath = path.join(root, reviewRelative, variant);
      const relative = path.join(reviewRelative, variant);
      try { await fs.access(path.join(reviewPath, "approval.json")); continue; }
      catch (error) { if (error?.code !== "ENOENT") throw error; }
      const currentStatus = await readJson(path.join(reviewPath, "status.json"));
      const currentEpisode = await readJson(path.join(reviewPath, "episode.json"));
      if (PROTECTED_STAGES.has(currentStatus?.stage) ||
          ["owner-approved-for-zernio-publishing", "published", "scheduled"].includes(currentEpisode?.publishingStatus)) continue;
      await packageImportedVoice({ reviewFolder: reviewPath, reviewRelative: relative, episodeId, profile, outputRoot: output, projectRoot: root, files });
      await packageCheckpoint({ reviewFolder: reviewPath, reviewRelative: relative, episodeId, profile, outputRoot: output, projectRoot: root, files });
    }
  }
  return { files: [...files].sort(), fileCount: files.size, outputRoot: output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const [command, episodeId, outputRoot] = process.argv.slice(2);
  if (command !== "package" || !episodeId || !outputRoot)
    throw new Error("Usage: node scripts/voice-checkpoint-artifact.mjs package <episode-id> <outside-project-dir>");
  const result = await packageVoiceRecoveryArtifacts({ projectRoot: process.cwd(), episodeId, outputRoot });
  if (process.env.GITHUB_OUTPUT)
    await fs.appendFile(process.env.GITHUB_OUTPUT, `files=${result.fileCount}\n`, "utf8");
  console.log(JSON.stringify({ fileCount: result.fileCount, files: result.files }, null, 2));
}
