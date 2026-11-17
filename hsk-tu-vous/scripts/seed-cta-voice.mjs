// Import a verified ending from an existing production take. No provider calls.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readMediaDurationMs } from "./media-duration.mjs";
import { saveCtaVoice, extractCtaWav } from "./cta-voice-cache.mjs";
import { sha256 } from "./voice-checkpoint.mjs";
import { PROJECT_ROOT, readJson, requireApprovedVoiceProfile, reviewDir, safeId } from "./lib.mjs";
import { assertReusableVoiceMetadata, normalizeVoiceToken } from "./voice-language.mjs";
import { hasCurrentImportedVoice } from "./voice-import-state.mjs";

const [id, take, platform, ...extra] = process.argv.slice(2);
if (!id || !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/u.test(take ?? "") ||
    (platform && platform !== "tiktok") || extra.length)
  throw new Error("Usage: node scripts/seed-cta-voice.mjs <episode-id> <take-folder> [tiktok]");
const folder = path.join(reviewDir(safeId(id)), ...(platform ? [platform] : []));
const episode = await readJson(path.join(folder, "episode.json"));
const profile = await requireApprovedVoiceProfile(id);
const dir = path.join(folder, "gemini-production", take);
const meta = await readJson(path.join(dir, "metadata.json"));
assertReusableVoiceMetadata(meta, profile);
const wavPath = path.join(dir, "voice.wav");
const original = await fs.readFile(wavPath);
const mp3 = await fs.readFile(path.join(dir, "voice.mp3"));
if (!await hasCurrentImportedVoice(episode, profile, { projectRoot: PROJECT_ROOT }) ||
    meta.episodeId !== id || !meta.production || (meta.platform ?? undefined) !== platform ||
    !(meta.status === "imported" || (platform && Number.isInteger(meta.captionWordCount))) ||
    meta.wavSha256 !== sha256(original) || meta.mp3Sha256 !== sha256(mp3) ||
    (!platform && meta.mp3Sha256 !== episode.audioSha256))
  throw new Error("The source is not a verified matching imported take.");
if (meta.reusedCtaVoiceKey && !meta.ctaVoicedOnTakeTransport) {
  console.log(`This take's ending is already the kept CTA ${meta.reusedCtaVoiceKey}; nothing to keep.`);
  process.exit(0);
}
const cta = episode.scenes.at(-1);
if (cta?.kind !== "cta" || !Number.isFinite(cta.startMs))
  throw new Error("Imported CTA boundary is missing.");
const input = (platform ? [cta] : episode.scenes).map(scene => scene.narration.trim()).join(" ").replace(/\s+/gu, " ");
if (meta.narrationTextHash !== sha256(input)) throw new Error("Original take narration fingerprint differs.");
const words = episode.captions.filter(cue => cue.startMs >= cta.startMs)
  .map(cue => ({ text: cue.text, start_offset: `${((cue.startMs - cta.startMs) / 1000).toFixed(3)}s`,
    end_offset: `${((cue.endMs - cta.startMs) / 1000).toFixed(3)}s` }));
const normalize = value => normalizeVoiceToken(value, profile.locale).replace(/[^\p{L}\p{N}]/gu, "");
const start = platform ? 0 : cta.startMs;
const duration = readMediaDurationMs(wavPath) - start;
if (platform) {
  const stamped = await fs.readFile(path.join(dir, "captions.vtt"), "utf8");
  const time = value => value.split(":").reduce((sum, n) => sum * 60 + Number(n), 0);
  const same = stamped.trim().split(/\n\s*\n/u).slice(1).map(block => {
    const [range, ...lines] = block.split("\n");
    const [a, b] = range.split(" --> ");
    return [lines.join(" "), time(a).toFixed(3) + "s", time(b).toFixed(3) + "s"];
  });
  if (JSON.stringify(same) !== JSON.stringify(words.map(w => [w.text, w.start_offset, w.end_offset])))
    throw new Error("TikTok ending timestamps do not match the imported source take.");
}
if (!words.length || words.some(word => parseFloat(word.end_offset) * 1000 > duration + 50) ||
    normalize(words.map(word => word.text).join("")) !== normalize(cta.narration))
  throw new Error("Saved CTA audio and the exact localized word cues do not match.");
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-cta-seed-"));
try {
  const clip = path.join(tmp, "cta.wav");
  extractCtaWav("ffmpeg", wavPath, clip, start);
  const key = await saveCtaVoice(path.join(PROJECT_ROOT, ".cta-voice-cache"), {
    text: cta.narration, profile, transport: meta.ttsChunks?.filter(Boolean).at(-1)?.transport ?? meta.ttsTransport,
    wav: await fs.readFile(clip), words, source: { episodeId: id, startMs: start, wavSha256: meta.wavSha256 },
  });
  console.log(`Saved verified ${profile.locale} ${platform ?? "shared"} CTA: ${key}`);
} finally { await fs.rm(tmp, { recursive: true, force: true }); }
