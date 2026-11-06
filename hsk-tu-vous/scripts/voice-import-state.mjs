import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function episodeNarrationHash(episode) {
  const narration = episode.scenes.map((scene) => scene.narration.trim()).join("\n\n") + "\n";
  return createHash("sha256").update(narration, "utf8").digest("hex");
}

export function assertImportedAudioHash(episode, bytes) {
  if (!episode?.audioSha256) return true;
  if (!Buffer.isBuffer(bytes) || createHash("sha256").update(bytes).digest("hex") !== episode.audioSha256) {
    throw new Error("Imported voice file hash does not match the episode record.");
  }
  return true;
}

export async function hasCurrentImportedVoice(episode, voiceProfile, {
  projectRoot,
  readFile = fs.readFile,
} = {}) {
  if (!projectRoot || !episode?.audioSrc || !Array.isArray(episode.scenes) ||
      episode.voiceProvider !== voiceProfile?.provider ||
      episode.voiceProfileId !== voiceProfile?.profileId ||
      episode.languageCode !== voiceProfile?.locale ||
      episode.voiceTextHash !== episodeNarrationHash(episode) ||
      episode.captionSource !== "gemini-word-timestamps" || !episode.captions?.length) return false;
  const publicRoot = path.resolve(projectRoot, "public");
  const audioPath = path.resolve(publicRoot, episode.audioSrc);
  if (!audioPath.startsWith(publicRoot + path.sep)) return false;
  let bytes;
  try { bytes = await readFile(audioPath); }
  catch (error) { if (error?.code === "ENOENT") return false; throw error; }
  if (!Buffer.isBuffer(bytes) || !bytes.length) return false;
  try { assertImportedAudioHash(episode, bytes); }
  catch { return false; }
  return true;
}
