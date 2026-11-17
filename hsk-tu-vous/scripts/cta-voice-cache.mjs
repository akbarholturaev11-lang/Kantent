import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { atomicWriteFile, atomicWriteJson, isValidWavBuffer, sha256 } from "./voice-checkpoint.mjs";

const normalized = value => String(value).replace(/\s+/gu, " ").trim();
export const CTA_TRANSPORTS = ["gemini-direct", "openrouter"];
export const ctaVoiceKey = (text, profile, transport) => sha256(JSON.stringify([
  normalized(text), profile.locale, profile.profileId, profile.provider, profile.ttsModel,
  profile.transcriptionModel, profile.voiceName, profile.spokenStyle,
  profile.sampleRateHz, profile.channels, transport,
]));

/**
 * The ending's subtitles as WebVTT, one cue per verified word (owner 2026-11-17:
 * every CTA voice is kept together with its subtitles and reused).
 */
export function ctaCaptionsVtt(words) {
  const stamp = (offset) => {
    const ms = Math.round(parseFloat(offset) * 1000);
    const pad = (n, w = 2) => String(n).padStart(w, "0");
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
  };
  return "WEBVTT\n\n" + words.map((word) => `${stamp(word.start_offset)} --> ${stamp(word.end_offset)}\n${word.text}`).join("\n\n") + "\n";
}

export async function readCtaVoice(cacheRoot, text, profile, transport) {
  const key = ctaVoiceKey(text, profile, transport);
  const dir = path.join(cacheRoot, key);
  let record;
  try { record = JSON.parse(await fs.readFile(path.join(dir, "receipt.json"), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  const wav = await fs.readFile(path.join(dir, "voice.wav"));
  const raw = await fs.readFile(path.join(dir, "words.json"));
  if (record.key !== key || record.audioSha256 !== sha256(wav) ||
      record.wordsSha256 !== sha256(raw) || !isValidWavBuffer(wav))
    throw new Error("Saved CTA voice or timing checksum failed.");
  const words = JSON.parse(raw);
  if (record.captionsSha256 &&
      record.captionsSha256 !== sha256(await fs.readFile(path.join(dir, "captions.vtt")).catch(() => Buffer.alloc(0))))
    throw new Error("Saved CTA subtitle checksum failed.");
  return { key, wav, words, captions: ctaCaptionsVtt(words), transport, source: record.source };
}

/**
 * The kept, verified ending for this take (owner 2026-11-17: "oldingi yasalgan
 * videolardan olib qo'yish" — the CTA recording of earlier videos is reused,
 * never voiced again). The one kept on the take's own transport comes first;
 * otherwise the same profile's recording kept on the other transport (same
 * Gemini model, voice and settings; only the API route differs).
 */
export async function findCtaVoiceForTake(cacheRoot, text, profile, lessonChunkTransports, preferredTransport) {
  const own = [...new Set(lessonChunkTransports)][0] ?? preferredTransport;
  for (const transport of [own, ...CTA_TRANSPORTS.filter((item) => item !== own)]) {
    const hit = await readCtaVoice(cacheRoot, text, profile, transport);
    if (hit) return hit;
  }
  return null;
}

export async function saveCtaVoice(cacheRoot, { text, profile, transport, wav, words, source }) {
  if (profile.status !== "approved" || !CTA_TRANSPORTS.includes(transport) ||
      !isValidWavBuffer(wav) || !Array.isArray(words) || !words.length)
    throw new Error("Cannot cache unverified CTA audio.");
  const key = ctaVoiceKey(text, profile, transport);
  const dir = path.join(cacheRoot, key);
  await fs.mkdir(cacheRoot, { recursive: true });
  // Publish the complete entry as a directory so concurrent runs never mix bytes.
  const temp = await fs.mkdtemp(path.join(cacheRoot, ".cta-"));
  try {
    const raw = Buffer.from(JSON.stringify(words));
    const captions = Buffer.from(ctaCaptionsVtt(words));
    await atomicWriteFile(path.join(temp, "voice.wav"), wav);
    await atomicWriteFile(path.join(temp, "words.json"), raw);
    await atomicWriteFile(path.join(temp, "captions.vtt"), captions);
    await atomicWriteJson(path.join(temp, "receipt.json"), { key, audioSha256: sha256(wav), wordsSha256: sha256(raw),
      captionsSha256: sha256(captions), text: normalized(text), locale: profile.locale, profileId: profile.profileId, transport, source });
    try { await fs.rename(temp, dir); }
    catch (error) {
      if (!["EEXIST", "ENOTEMPTY"].includes(error.code)) throw error;
      await readCtaVoice(cacheRoot, text, profile, transport);
    }
    return key;
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}

// `env`: the bundled Remotion ffmpeg needs its runtime library path (real
// 2026-11-16 RU take: "Library not loaded: libavdevice.dylib" without it).
export function extractCtaWav(ffmpeg, wavPath, output, startMs, env = process.env) {
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", wavPath,
    "-ss", String(startMs / 1000), "-c:a", "pcm_s16le", output], { env, stdio: ["ignore", "pipe", "pipe"] });
}
