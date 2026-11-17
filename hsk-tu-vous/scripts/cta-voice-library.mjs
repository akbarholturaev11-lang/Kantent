/**
 * The kept CTA voice library (owner 2026-11-17: every verified CTA recording and
 * its subtitles are kept and reused, so an ending is never voiced — or
 * mis-transcribed — again). Rules: content/WORKFLOW.md#reusable-cta-voice.
 *
 *   node scripts/cta-voice-library.mjs                    inventory + verified endings not yet kept
 *   node scripts/cta-voice-library.mjs --seed             keep every verified ending that is missing (no provider calls)
 *   node scripts/cta-voice-library.mjs --backfill-captions write captions.vtt into entries saved before subtitles were kept
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ctaCaptionsVtt, ctaVoiceKey } from "./cta-voice-cache.mjs";
import { atomicWriteFile, atomicWriteJson, sha256 } from "./voice-checkpoint.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CTA_CACHE_DIR = ".cta-voice-cache";
const TRANSPORTS = ["gemini-direct", "openrouter"];
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const exists = (file) => fs.access(file).then(() => true, () => false);

async function voiceProfiles(root) {
  const { languages } = await readJson(path.join(root, "content", "languages.json"));
  const out = {};
  for (const [lang, spec] of Object.entries(languages))
    out[lang] = await readJson(path.join(root, spec.contentRoot, "voice-profile.json")).catch(() => null);
  return out;
}

/** Every CTA narration of the review working copies (to name endings kept before receipts carried their text). */
async function knownCtaTexts(root) {
  const texts = new Set();
  const review = path.join(root, "review");
  for (const id of await fs.readdir(review).catch(() => []))
    for (const sub of ["", "tiktok", "tg", "tg/tiktok"]) {
      const cta = (await readJson(path.join(review, id, sub, "episode.json")).catch(() => null))?.scenes?.at(-1);
      if (cta?.kind === "cta" && cta.narration) texts.add(cta.narration);
    }
  return [...texts];
}

/** Every kept ending with its language, transport, text and subtitle state. */
export async function listSavedCtas(root = ROOT) {
  const cache = path.join(root, CTA_CACHE_DIR);
  const profiles = await voiceProfiles(root);
  const keys = await fs.readdir(cache).catch(() => []);
  let known = null;
  const entries = [];
  for (const key of keys.filter((name) => /^[0-9a-f]{64}$/u.test(name))) {
    const receipt = await readJson(path.join(cache, key, "receipt.json")).catch(() => null);
    if (!receipt) continue;
    const words = await readJson(path.join(cache, key, "words.json")).catch(() => []);
    let match = receipt.transport && receipt.locale && receipt.text
      ? { transport: receipt.transport, locale: receipt.locale, text: receipt.text } : null;
    const candidates = [words.map((word) => word.text).join(" ")];
    for (let pass = 0; !match && pass < 2; pass++) {
      if (pass === 1) candidates.push(...(known ??= await knownCtaTexts(root)));
      for (const text of candidates) for (const profile of Object.values(profiles)) for (const transport of TRANSPORTS)
        if (!match && profile && ctaVoiceKey(text, profile, transport) === key) match = { transport, locale: profile.locale, text };
    }
    entries.push({ key, text: match?.text ?? candidates[0], locale: match?.locale ?? null, transport: match?.transport ?? null,
      source: receipt.source ?? null, captions: Boolean(receipt.captionsSha256) && await exists(path.join(cache, key, "captions.vtt")),
      described: Boolean(receipt.text && receipt.locale && receipt.transport) });
  }
  return entries;
}

/** The route the ending's recording was voiced on (its own chunk when the take has one). */
export const endingTransport = (meta) => meta.ttsChunks?.filter(Boolean).at(-1)?.transport ?? meta.ttsTransport;

/** Imported, verified takes whose ending is not kept yet (each can be seeded without a provider call). */
export async function missingSavedCtas(root = ROOT) {
  const profiles = await voiceProfiles(root);
  const review = path.join(root, "review");
  const missing = [];
  for (const id of (await fs.readdir(review).catch(() => [])).sort()) {
    for (const lang of Object.keys(profiles)) for (const platform of [null, "tiktok"]) {
      const profile = profiles[lang];
      if (profile?.status !== "approved") continue;
      const folder = path.join(review, id, ...(lang === "ru" ? [] : [lang]), ...(platform ? [platform] : []));
      const episode = await readJson(path.join(folder, "episode.json")).catch(() => null);
      const cta = episode?.scenes?.at(-1);
      if (cta?.kind !== "cta" || !cta.narration || !episode.audioSha256 || episode.voiceProfileId !== profile.profileId) continue;
      const production = path.join(folder, "gemini-production");
      for (const take of (await fs.readdir(production).catch(() => [])).filter((name) => /^\d{4}-/u.test(name))) {
        const meta = await readJson(path.join(production, take, "metadata.json")).catch(() => null);
        if (!meta?.ttsTransport || !meta.production || meta.episodeId !== id) continue;
        const current = platform ? Number.isInteger(meta.captionWordCount) && meta.status === "imported" : meta.mp3Sha256 === episode.audioSha256;
        // An ending that already came from the kept library is not new speech.
        if (!current || (meta.reusedCtaVoiceKey && !meta.ctaVoicedOnTakeTransport)) continue;
        const transport = endingTransport(meta);
        const key = ctaVoiceKey(cta.narration, profile, transport);
        if (!await exists(path.join(root, CTA_CACHE_DIR, key, "receipt.json")))
          missing.push({ language: lang, episodeId: id, take, platform, transport, text: cta.narration });
      }
    }
  }
  return missing;
}

/**
 * Keeps every verified ending that is not kept yet (no provider calls). Never
 * throws: production calls it after voice import as a safety net, so a CTA
 * whose in-pipeline save failed is still kept for the next episode.
 */
export async function keepVerifiedCtas({ root = ROOT, language = null, episodeId = null, stdio = "inherit" } = {}) {
  const kept = [];
  const failed = [];
  const items = (await missingSavedCtas(root).catch(() => []))
    .filter((item) => (!language || item.language === language) && (!episodeId || item.episodeId === episodeId));
  for (const item of items) {
    const run = spawnSync(process.execPath, [path.join(root, "scripts", "seed-cta-voice.mjs"), item.episodeId, item.take,
      ...(item.platform ? [item.platform] : [])], { cwd: root, stdio, env: { ...process.env, HSK_CONTENT_LANGUAGE: item.language } });
    (run.status === 0 ? kept : failed).push(item);
  }
  return { kept, failed };
}

/** Adds the subtitles file (and its checksum) to endings kept before subtitles were stored. */
export async function backfillCtaCaptions(root = ROOT) {
  const cache = path.join(root, CTA_CACHE_DIR);
  let written = 0;
  for (const entry of await listSavedCtas(root)) {
    if (entry.captions && (entry.described || !entry.locale)) continue;
    const dir = path.join(cache, entry.key);
    const receipt = await readJson(path.join(dir, "receipt.json"));
    const raw = await fs.readFile(path.join(dir, "words.json"));
    if (receipt.wordsSha256 !== sha256(raw)) throw new Error(`${entry.key}: words checksum failed; not touched.`);
    const captions = Buffer.from(ctaCaptionsVtt(JSON.parse(raw)));
    await atomicWriteFile(path.join(dir, "captions.vtt"), captions);
    await atomicWriteJson(path.join(dir, "receipt.json"), { ...receipt, captionsSha256: sha256(captions),
      ...(entry.locale ? { locale: entry.locale } : {}), ...(entry.transport ? { transport: entry.transport } : {}), text: entry.text });
    written++;
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  if (args.includes("--backfill-captions")) console.log(`Subtitles added to ${await backfillCtaCaptions()} kept ending(s).`);
  if (args.includes("--seed")) {
    const { failed } = await keepVerifiedCtas();
    if (failed.length) process.exitCode = 1;
  }
  const saved = await listSavedCtas();
  for (const entry of saved)
    console.log([entry.locale ?? "?", entry.transport ?? "?", entry.captions ? "subtitles" : "NO-subtitles", entry.key.slice(0, 10), entry.text.slice(0, 70)].join("\t"));
  const missing = await missingSavedCtas();
  console.log(`${saved.length} kept ending(s); ${missing.length} verified ending(s) not kept yet.`);
  for (const item of missing) console.log(`  missing: ${item.language} ${item.episodeId} ${item.platform ?? "main"} ${item.transport} (take ${item.take}) — run with --seed`);
}
