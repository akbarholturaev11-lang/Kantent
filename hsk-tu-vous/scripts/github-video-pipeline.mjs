/**
 * GitHub Actions adapter for the existing HSK AI content:make pipeline.
 * This module does NOT generate speech, render, approve or publish anything.
 * It resolves an exact calendar episode and packages verified review outputs.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readLanguages, withLanguage } from "./language-context.mjs";
import { enabledVideoPlatforms } from "./video-credentials.mjs";
import { requestedLanguages } from "./bilingual-production.mjs";
import { confirmedPublishedFor, confirmedPublishedInAllLanguages } from "./published-evidence.mjs";
import { resolveTodayVideo } from "./resolve-production-date.mjs";
import { platformPackagePaths } from "./platform-exports.mjs";
import { PROJECT_ROOT, readJson, readStatus, reviewDir, safeId } from "./lib.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const DEFAULT_OUT = path.join(PROJECT_ROOT, "review", "github-review-bundle");
const SHA = /^[0-9a-f]{64}$/;

export function validateInput(value, language = "all") {
  if (value !== "today" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "")) {
    throw new Error("Use 'today', an exact YYYY-MM-DD or an existing episode ID.");
  }
  if (!["all", ...readLanguages().defaultProductionLanguages].includes(language)) {
    throw new Error("Use language all or one configured language (no fallback).");
  }
  return { input: value, language, languages: requestedLanguages(language) };
}

export function resolveExactEpisode(calendar, input, now, languages, publishedIds = new Set()) {
  const chosen = input === "today"
    ? resolveTodayVideo(calendar, now, { confirmedPublishedEpisodeIds: publishedIds }).episodeId
    : calendar.items.find((item) => item.id === input || item.date === input)?.id;
  if (!chosen) throw new Error("No matching episode in the canonical calendar; refusing to invent or retarget a date.");
  const item = calendar.items.find((entry) => entry.id === chosen);
  if (!item || item.status !== "planned") throw new Error("Only a canonical planned episode may enter video review production.");
  if (publishedIds.has(item.id)) throw new Error("This episode already has verified publication evidence; refuse duplicate render.");
  return { id: safeId(item.id), date: item.date, languages };
}

async function assetExists(relative) {
  if (typeof relative !== "string") return false;
  const absolute = path.resolve(PROJECT_ROOT, relative);
  if (!absolute.startsWith(PROJECT_ROOT + path.sep)) return false;
  try { return (await fs.stat(absolute)).isFile(); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

export async function assertProtectedVoiceAssets(episodeId, languages) {
  const config = readLanguages();
  for (const language of languages) {
    const location = config.languages[language].contentRoot;
    const profile = await readJson(path.join(PROJECT_ROOT, location, "voice-profile.json"));
    if (profile.status !== "approved" || profile.modelDecisionRequired) {
      throw new Error(language + ": approved Gemini voice profile is required before production.");
    }
    // An explicitly approved sample with protected transcription is NOT regenerable
    // on an ephemeral runner just because review/ is Git-ignored.
    if (profile.sampleEpisodeId === episodeId &&
        profile.captionValidation?.audioMustNotBeRegeneratedForTranscription === true) {
      const available = (await assetExists(profile.sampleAudio)) &&
        (await assetExists(profile.sampleCaptions));
      if (!available) {
        throw new Error(language + ": protected owner-approved sample audio/captions are not in this runner. " +
          "Restore the exact approved assets with hash verification before making this episode; " +
          "do not regenerate that voice or synthesize replacement word timing.");
      }
      // Even if the sample files were restored, normal content:make would generate
      // a new take without an imported, matching working review episode.
      const imported = await withLanguage(language, async () => {
        try {
          const working = await readJson(path.join(reviewDir(episodeId), "episode.json"));
          return Boolean(working.audioSrc && working.voiceTextHash &&
            working.captionSource === "gemini-word-timestamps" &&
            (await assetExists(path.join("public", working.audioSrc))));
        } catch (error) { if (error.code === "ENOENT") return false; throw error; }
      });
      if (!imported) throw new Error(language + ": protected sample restored, but no matching imported " +
        "voice/caption working copy is available; prevent silent regeneration.");
    }
  }
}

async function resolve(args) {
  if (args.length < 1 || args.length > 2) throw new Error("Usage: resolve <today|YYYY-MM-DD|episode-id> [all|ru|tg]");
  const { input, language, languages } = validateInput(args[0], args[1] ?? "all");
  const calendar = await readJson(path.join(PROJECT_ROOT, "content/calendar.json"));
  const published = confirmedPublishedInAllLanguages(languages);
  const found = resolveExactEpisode(calendar, input, new Date(), languages, published);
  if (confirmedPublishedFor(found.id).length) throw new Error("Publication evidence exists for this episode; manual review required before another export.");
  await assertProtectedVoiceAssets(found.id, languages);
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT,
      "episode_id=" + found.id + "\n" + "episode_date=" + found.date + "\n", "utf8");
  }
  console.log(JSON.stringify({ ...found, status: "preflight-only", publicationAuthorized: false }, null, 2));
}

export function validateProbe(value) {
  const video = value?.streams?.find((stream) => stream.codec_type === "video");
  const audio = value?.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(value?.format?.duration);
  if (!video || !audio || !Number.isInteger(video.width) || !Number.isInteger(video.height) ||
      video.width < 320 || video.height <= video.width || !(duration > 2) || !Number.isFinite(duration)) {
    throw new Error("Invalid MP4: expected portrait video + audio and a real positive duration.");
  }
  return { width: video.width, height: video.height, durationSec: duration };
}

function ffprobe(filename) {
  const proc = spawnSync("ffprobe", ["-v", "error", "-show_streams", "-show_format",
    "-of", "json", filename], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  if (proc.error || proc.status !== 0) {
    throw new Error("ffprobe failed for a review MP4: " + String(proc.stderr || proc.error?.message).slice(0, 200));
  }
  return validateProbe(JSON.parse(proc.stdout));
}

async function verifyReviewPackage(episodeId, language, platform) {
  const stored = await readStatus(episodeId);
  if (stored.stage !== "rendered-pending-owner-approval" ||
      stored.platformPackages?.[platform]?.videoSha256 === undefined) {
    throw new Error(language + "/" + platform + ": no complete unapproved review package exists.");
  }
  const paths = platformPackagePaths(episodeId, platform);
  const expectedHash = stored.platformPackages[platform].videoSha256;
  if (!SHA.test(expectedHash)) throw new Error("Invalid stored video SHA-256 for " + language + "/" + platform);
  for (const file of [paths.video, paths.captions, paths.post]) {
    if (!(await fs.stat(file)).isFile()) throw new Error("Missing review package file: " + file);
  }
  const size = (await fs.stat(paths.video)).size;
  if (size < 8_000) throw new Error("Truncated MP4: " + language + "/" + platform);
  const hash = createHash("sha256").update(await fs.readFile(paths.video)).digest("hex");
  if (hash !== expectedHash) throw new Error("MP4 does not match the renderer's saved SHA-256: " + language + "/" + platform);
  if (!(await fs.readFile(paths.captions, "utf8")).includes("-->"))
    throw new Error("Missing valid SRT captions for " + language + "/" + platform);
  if (!(await fs.readFile(paths.post, "utf8")).trim())
    throw new Error("Empty post text for " + language + "/" + platform);
  const postSha256 = createHash("sha256").update(await fs.readFile(paths.post)).digest("hex");
  return { paths, sha256: hash, postSha256, bytes: size, ...ffprobe(paths.video),
    ctaExperimentId: stored.platformPackages[platform].ctaExperimentId,
    contentHash: stored.platformPackages[platform].contentHash };
}

export async function packageReview(episodeId, languages, outputDir = DEFAULT_OUT) {
  safeId(episodeId);
  if (!Array.isArray(languages) || !languages.length || languages.some(x=>!["ru","tg"].includes(x))) {
    throw new Error("Invalid requested language set.");
  }
  // Validate every ENABLED destination before staging any artifact. A not-yet-
  // connected Tajik YouTube channel is never a required package or target.
  const checked = {};
  for (const language of languages) {
    checked[language] = await withLanguage(language, async () => {
      const result = {};
      for (const platform of enabledVideoPlatforms(language)) {
        result[platform] = await verifyReviewPackage(episodeId, language, platform);
      }
      return result;
    });
  }
  const destination = path.resolve(outputDir);
  if (destination === PROJECT_ROOT || destination === path.parse(destination).root) {
    throw new Error("Refusing to replace a root output folder.");
  }
  await fs.rm(destination, { recursive: true, force: true });
  const manifest = {
    schemaVersion: 1, episodeId, generatedAt: new Date().toISOString(),
    sourceCommit: process.env.GITHUB_SHA ?? null,
    state: "rendered-pending-owner-approval", publicationAuthorized: false, published: false,
    ownerMustReviewExactPlatformVideo: true, languages: {},
  };
  for (const [language, platforms] of Object.entries(checked)) {
    manifest.languages[language] = {};
    for (const [platform, verified] of Object.entries(platforms)) {
      const target = path.join(destination, language, platform);
      await fs.mkdir(target, { recursive: true });
      for (const [name, source] of [
        ["video.mp4", verified.paths.video],
        ["captions.srt", verified.paths.captions],
        ["post.md", verified.paths.post],
      ]) await fs.copyFile(source, path.join(target, name));
      const copiedHash = createHash("sha256").update(await fs.readFile(path.join(target, "video.mp4"))).digest("hex");
      if (copiedHash !== verified.sha256) throw new Error("Artifact copy changed MP4 bytes.");
      const copiedPostSha = createHash("sha256").update(await fs.readFile(path.join(target, "post.md"))).digest("hex");
      if (copiedPostSha !== verified.postSha256) throw new Error("Artifact copy changed proposed post preview text.");
      manifest.languages[language][platform] = {
        video: language + "/" + platform + "/video.mp4",
        sha256: verified.sha256, postSha256: copiedPostSha, bytes: verified.bytes,
        width: verified.width, height: verified.height, durationSec: verified.durationSec,
        ctaExperimentId: verified.ctaExperimentId, contentHash: verified.contentHash,
      };
    }
  }
  await fs.writeFile(path.join(destination, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log("Verified review artifact staged: " + destination);
  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "resolve") return resolve(args);
  if (command === "package") {
    if (args.length < 2 || args.length > 3) throw new Error("Usage: package <episode-id> <all|ru|tg> [output-directory]");
    const { languages } = validateInput(args[0], args[1]);
    return packageReview(args[0], languages, args[2] ?? DEFAULT_OUT);
  }
  throw new Error("Commands: resolve / package. Never publishes.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => { console.error("VIDEO_PIPELINE_BLOCKED: " + error.message); process.exitCode = 1; });
}
