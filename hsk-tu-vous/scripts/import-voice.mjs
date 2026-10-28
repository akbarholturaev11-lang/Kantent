import { requireFreshGitMain } from './git-freshness.mjs';
import { assertNotPreviouslyPublished } from './published-evidence.mjs';
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { generatedVoicePath } from "./language-context.mjs";
import { assertVoiceEpisodeLanguage, normalizeVoiceToken } from "./voice-language.mjs";
import {
  FPS,
  getEpisode,
  narrationHash,
  PROJECT_ROOT,
  requireApprovedVoiceProfile,
  normalizeEpisode,
  readStatus,
  reviewDir,
  readJson,
  writeJson,
  writeStatus,
  validateEpisode,
} from "./lib.mjs";

const [id, audioInput, captionsInput, ...options] = process.argv.slice(2);
let platform;
for (let index = 0; index < options.length; index += 1) {
  if (options[index] === "--platform" && !platform) {
    platform = options[++index];
  } else {
    throw new Error("Use [--platform tiktok] for a separate local TikTok review package.");
  }
}
if (platform && platform !== "tiktok") {
  throw new Error("Only the local tiktok review variant is supported here.");
}
if (!id || !audioInput || !captionsInput) {
  throw new Error(
    "Foydalanish: node scripts/import-voice.mjs <episode-ID> <audio.mp3> <captions.srt|captions.vtt>",
  );
}

let audioPath = path.resolve(audioInput);
const captionsPath = path.resolve(captionsInput);
const captionsExtension = path.extname(captionsPath).toLowerCase();
if (![".mp3", ".wav"].includes(path.extname(audioPath).toLowerCase())) {
  throw new Error(
    "Gemini tomonidan yaratilgan audio MP3 yoki WAV bo‘lishi kerak.",
  );
}
if (![".srt", ".vtt"].includes(captionsExtension)) {
  throw new Error(
    "Gemini word-timed subtitri .srt yoki .vtt bo‘lishi kerak.",
  );
}

const sourceRevision = requireFreshGitMain();
assertNotPreviouslyPublished(id);
const targetReviewDir = platform
  ? path.join(reviewDir(id), platform)
  : reviewDir(id);
const { episode, filePath } = platform
  ? {
      episode: normalizeEpisode(await readJson(path.join(targetReviewDir, "episode.json"))),
      filePath: path.join(targetReviewDir, "episode.json"),
    }
  : await getEpisode(id);
validateEpisode(episode);
const visualSystem = JSON.parse(
  await fs.readFile(
    path.join(PROJECT_ROOT, "content", "visual-system.json"),
    "utf8",
  ),
);
const beatEntryLeadFrames = visualSystem.motion.beatEntryLeadFrames;
const voiceProfile = await requireApprovedVoiceProfile(id);
assertVoiceEpisodeLanguage(episode, voiceProfile);
if (voiceProfile.provider !== "gemini-api") {
  throw new Error("Faol ovoz profili Gemini API provayderiga mos emas.");
}
// A separate TikTok review episode may be created after the base lesson has
// already been scheduled on other platforms. Protect the TikTok lifecycle
// independently while keeping the original episode guard unchanged.
const existingStatus = platform
  ? await readJson(path.join(targetReviewDir, "status.json"))
  : await readStatus(id);
const protectedStages = new Set([
  "owner-approved-for-zernio-publishing",
  "zernio-published",
  "zernio-scheduled",
  "zernio-publication-processing",
  "zernio-publication-partial",
  "zernio-publication-failed",
]);
if (
  protectedStages.has(existingStatus.stage) ||
  ["owner-approved-for-zernio-publishing", "published", "scheduled"].includes(
    episode.publishingStatus,
  )
) {
  throw new Error("Tasdiqlangan yoki e’lon qilingan episode ovozini import orqali almashtirib bo‘lmaydi.");
}
try {
  await fs.access(path.join(targetReviewDir, "approval.json"));
  throw new Error("Owner approval fayli mavjud. Ovoz almashtirishdan oldin paket egasi tomonidan bekor qilinishi kerak.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const parseTime = (value) => {
  const parts = value.trim().split(/[.:,]/).map(Number);
  if (
    ![3, 4].includes(parts.length) ||
    parts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    throw new Error("Subtitr vaqt formati noto‘g‘ri.");
  }
  const [hours, minutes, seconds, milliseconds] =
    parts.length === 4 ? parts : [0, ...parts];
  if (minutes > 59 || seconds > 59 || milliseconds > 999) {
    throw new Error("Subtitr vaqti noto‘g‘ri.");
  }
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + milliseconds;
};

const rawSrt = await fs.readFile(captionsPath, "utf8");
let captions = rawSrt
  .replace(/^\uFEFF/, "")
  .replace(/\r/g, "")
  .split(/\n\s*\n/)
  .map((block) => {
    if (
      /^(?:WEBVTT|NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/i.test(
        block.trim(),
      )
    ) {
      return null;
    }
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const timeIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeIndex < 0) return null;
    const [startValue, endValue] = lines[timeIndex].split("-->");
    const start = parseTime(startValue);
    const end = parseTime(endValue.trim().split(/\s+/)[0]);
    const text = lines
      .slice(timeIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (!text || end <= start) return null;
    return {
      text,
      startMs: start,
      endMs: end,
      timestampMs: Math.round((start + end) / 2),
      confidence: 1,
    };
  })
  .filter(Boolean);
if (!captions.length)
  throw new Error("SRT/VTT faylidan vaqtlangan subtitrlar topilmadi.");
const perWordCueCount = captions.filter(
  (caption) => caption.text.trim().split(/\s+/).length <= 2,
).length;
if (perWordCueCount / captions.length < 0.8) {
  throw new Error(
    "Subtitrlar so‘zma-so‘z vaqtlanmagan ko‘rinadi. Gemini Transcribe word-level vaqt belgilarini yozmagan; bunday audio import qilinmaydi.",
  );
}

const readDurationMs = (filePath) => {
  const info = spawnSync("afinfo", [filePath], { encoding: "utf8" });
  if (info.error || info.status !== 0) return 0;
  const match = `${info.stdout}\n${info.stderr}`.match(
    /(?:estimated\s+)?duration:\s*([\d.]+)\s*sec/i,
  );
  return match ? Math.round(Number(match[1]) * 1000) : 0;
};
let durationMs = readDurationMs(audioPath) || Math.max(...captions.map((caption) => caption.endMs));
if (!Number.isFinite(durationMs) || durationMs <= 0) {
  throw new Error("Audio davomiyligini aniqlab bo‘lmadi.");
}
const ctaCaptionEndMs = Math.max(...captions.map((caption) => caption.endMs));
if (ctaCaptionEndMs > durationMs + 250) {
  throw new Error("Subtitr audio davomiyligidan keyin tugayapti.");
}

if (platform === "tiktok") {
  const baseEpisode = await readJson(path.join(reviewDir(id), "episode.json"));
  if (baseEpisode.captionSource !== "gemini-word-timestamps" || !baseEpisode.captions?.length || !baseEpisode.audioSrc) {
    throw new Error("TikTok review needs the existing verified lesson audio and word cues.");
  }
  const baseCtaScene = baseEpisode.scenes.find((scene) => scene.kind === "cta");
  const ctaStartMs = baseCtaScene?.startMs;
  if (!Number.isFinite(ctaStartMs) || ctaStartMs <= 0) {
    throw new Error("The verified lesson CTA boundary is missing.");
  }
  const lessonCaptions = baseEpisode.captions.filter((caption) => caption.endMs <= ctaStartMs);
  if (!lessonCaptions.length || lessonCaptions.at(-1).endMs > ctaStartMs) {
    throw new Error("Verified lesson captions do not end before the CTA boundary.");
  }
  const lessonAudioPath = path.join(PROJECT_ROOT, "public", baseEpisode.audioSrc);
  const composedAudioPath = path.join(path.dirname(captionsPath), "voice-full.mp3");
  const ffmpeg = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", lessonAudioPath,
    "-i", audioPath,
    "-filter_complex",
    `[0:a]atrim=end=${(ctaStartMs / 1000).toFixed(3)},asetpts=PTS-STARTPTS[lesson];[1:a]asetpts=PTS-STARTPTS[ending];[lesson][ending]concat=n=2:v=0:a=1[out]`,
    "-map", "[out]", "-c:a", "libmp3lame", "-b:a", `${voiceProfile.mp3BitrateKbps}k`,
    "-ar", String(voiceProfile.sampleRateHz), "-ac", String(voiceProfile.channels),
    "-map_metadata", "-1", "-f", "mp3", composedAudioPath,
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (ffmpeg.error) throw ffmpeg.error;
  if (ffmpeg.status !== 0) throw new Error(`TikTok voice composition failed: ${ffmpeg.stderr || ffmpeg.stdout}`);
  captions = [
    ...lessonCaptions,
    ...captions.map((caption) => ({
      ...caption,
      startMs: caption.startMs + ctaStartMs,
      endMs: caption.endMs + ctaStartMs,
      timestampMs: caption.timestampMs + ctaStartMs,
    })),
  ];
  audioPath = composedAudioPath;
  durationMs = readDurationMs(audioPath) || ctaStartMs + durationMs;
}

const audioBuffer = await fs.readFile(audioPath);
if (!audioBuffer.length) throw new Error("Audio fayli bo‘sh.");
const lastCaptionEndMs = Math.max(...captions.map((caption) => caption.endMs));
if (lastCaptionEndMs > durationMs + 250) {
  throw new Error("Subtitr audio davomiyligidan keyin tugayapti.");
}

// Some TTS outputs contain several seconds of uncaptioned trailing silence.
// Keep a short natural tail after the final timed word and trim the rest in Remotion.
// Remotion's trimAfter is the source-frame endpoint, not the number of tail frames to remove.
let audioTrimAfterFrames;
let effectiveDurationMs = durationMs;
if (durationMs - lastCaptionEndMs > 1500) {
  const minimumEndMs = lastCaptionEndMs + 500;
  audioTrimAfterFrames = Math.max(1, Math.ceil((minimumEndMs / 1000) * FPS));
  effectiveDurationMs = (audioTrimAfterFrames / FPS) * 1000;
}

const normalize = (value) =>
  normalizeVoiceToken(value, voiceProfile.locale)
    .replace(/[^\p{L}\p{N}]/gu, "");
const sceneTexts = episode.scenes.map((scene) => normalize(scene.narration));
const sourceText = sceneTexts.join("");
if (
  !episode.voiceTextHash ||
  episode.voiceTextHash !== narrationHash(episode)
) {
  throw new Error(
    "Ssenariy ovoz tayyorlashdan keyin o‘zgargan yoki TTS matni tayyorlanmagan. Gemini voice generatorini joriy ssenariy bilan qayta bajaring; eski ovoz/subtitr import qilinmadi.",
  );
}
if (
  normalize(captions.map((caption) => caption.text).join("")) !== sourceText
) {
  throw new Error(
    "Subtitr matni joriy ssenariyga to‘liq mos emas. Gemini generatorini joriy ssenariy bilan qayta bajaring.",
  );
}
const sceneRanges = [];
let sourceCursor = 0;
for (const text of sceneTexts) {
  sceneRanges.push({ start: sourceCursor, end: sourceCursor + text.length });
  sourceCursor += text.length;
}

const sceneCaptionEnds = episode.scenes.map(() => 0);
const sceneCaptionStarts = episode.scenes.map(() => Number.POSITIVE_INFINITY);
let matchCursor = 0;
let fallbackCursor = 0;
for (let index = 0; index < captions.length; index += 1) {
  const caption = captions[index];
  const key = normalize(caption.text);
  let charPosition = key ? sourceText.indexOf(key, matchCursor) : -1;
  if (charPosition >= 0) {
    matchCursor = charPosition + key.length;
  } else {
    charPosition = Math.min(Math.max(sourceText.length - 1, 0), fallbackCursor);
  }
  fallbackCursor = Math.min(
    sourceText.length,
    fallbackCursor + Math.max(key.length, 1),
  );
  let sceneIndex = sceneRanges.findIndex(
    (range) => charPosition >= range.start && charPosition < range.end,
  );
  if (sceneIndex < 0) {
    const progress = captions.length <= 1 ? 0 : index / (captions.length - 1);
    const plannedFrames = episode.scenes.map(
      (scene) =>
        scene.durationFrames ?? Math.ceil((scene.durationSec ?? 4) * FPS),
    );
    const totalFrames = plannedFrames.reduce((sum, frames) => sum + frames, 0);
    const targetFrame = progress * Math.max(totalFrames - 1, 0);
    let frameCursor = 0;
    sceneIndex = plannedFrames.findIndex((frames) => {
      const within = targetFrame < frameCursor + frames;
      frameCursor += frames;
      return within;
    });
    if (sceneIndex < 0) sceneIndex = episode.scenes.length - 1;
  }
  sceneCaptionEnds[sceneIndex] = Math.max(
    sceneCaptionEnds[sceneIndex],
    caption.endMs,
  );
  sceneCaptionStarts[sceneIndex] = Math.min(
    sceneCaptionStarts[sceneIndex],
    caption.startMs,
  );
}

const sceneStartFrames = [];
for (const [index] of episode.scenes.entries()) {
  if (index === 0) {
    sceneStartFrames.push(0);
    continue;
  }
  const previousCaptionEndMs = sceneCaptionEnds[index - 1];
  const firstCaptionStartMs = Number.isFinite(sceneCaptionStarts[index])
    ? sceneCaptionStarts[index]
    : previousCaptionEndMs;
  const targetStartMs = Math.max(
    previousCaptionEndMs,
    firstCaptionStartMs - (beatEntryLeadFrames / FPS) * 1000,
  );
  const previousStartFrame = sceneStartFrames[index - 1];
  const targetStartFrame = Math.round((targetStartMs / 1000) * FPS);
  // Keep the historical six-second Russian hook cap. Tajik samples speak
  // more slowly, so their first transition follows the verified next-scene
  // cue and keeps the spoken answer inside the hook.
  const cueAlignedFrame = index === 1 && episode.languageCode === "ru-RU" && episode.kind !== "advertisement"
    ? Math.min(targetStartFrame, 180)
    : targetStartFrame;
  sceneStartFrames.push(Math.max(previousStartFrame + 1, cueAlignedFrame));
}

const finalSceneEndMs = Math.max(lastCaptionEndMs, effectiveDurationMs);
const finalSceneEndFrame = Math.ceil((finalSceneEndMs / 1000) * FPS);
for (const [index, scene] of episode.scenes.entries()) {
  const startFrame = sceneStartFrames[index];
  const endFrame =
    index + 1 < episode.scenes.length
      ? sceneStartFrames[index + 1]
      : finalSceneEndFrame;
  if (endFrame <= startFrame) {
    throw new Error(
      `Sahna ${scene.id} uchun cue vaqti boshqa sahna bilan ustma-ust tushdi. VTT cue’larini tekshiring.`,
    );
  }
  scene.startMs = (startFrame / FPS) * 1000;
  scene.durationFrames = endFrame - startFrame;
  scene.endMs = (endFrame / FPS) * 1000;
  delete scene.audioSrc;
  delete scene.audioDurationMs;
  delete scene.audioHash;
}

const sceneDurationSec =
  episode.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0) / FPS;
const outputDurationSec = Math.max(
  sceneDurationSec,
  effectiveDurationMs / 1000,
);
const folder = targetReviewDir;
const assetBase = generatedVoicePath(id);
const assetFolder = path.join(PROJECT_ROOT, "public", assetBase, ...(platform ? [platform] : []));
await fs.mkdir(assetFolder, { recursive: true });
const audioFilename = `voice${path.extname(audioPath).toLowerCase()}`;
const destinationAudio = path.join(assetFolder, audioFilename);
await fs.copyFile(audioPath, destinationAudio);
const importedCaptionsPath = path.join(folder, `gemini-word-timestamps${captionsExtension}`);
if (platform === "tiktok") {
  const vttTime = (ms) => {
    const value = Math.max(0, Math.round(ms));
    const hours = Math.floor(value / 3_600_000);
    const minutes = Math.floor((value % 3_600_000) / 60_000);
    const seconds = Math.floor((value % 60_000) / 1000);
    const milliseconds = value % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  };
  await fs.writeFile(
    importedCaptionsPath,
    `WEBVTT\n\n${captions.map((caption) => `${vttTime(caption.startMs)} --> ${vttTime(caption.endMs)}\n${caption.text}`).join("\n\n")}\n`,
    "utf8",
  );
} else {
  await fs.copyFile(captionsPath, importedCaptionsPath);
}

episode.audioSrc = `${assetBase}/${platform ? `${platform}/` : ""}${audioFilename}`;
episode.voiceProfileId = voiceProfile.profileId;
episode.voiceProvider = voiceProfile.provider;
episode.voiceLocale = voiceProfile.locale;
episode.sourceAudioDurationMs = durationMs;
episode.audioDurationMs = effectiveDurationMs;
episode.audioTrimAfterFrames = audioTrimAfterFrames;
episode.captions = captions;
episode.captionSource = "gemini-word-timestamps";
episode.publishingStatus = "pending-owner-review";
await writeJson(filePath, episode);

const durationSec = Number(outputDurationSec.toFixed(2));
const statusRecord = {
  sourceRevision,
  stage: "voice-and-captions-imported",
  updatedAt: new Date().toISOString(),
  provider: voiceProfile.serviceName,
  voiceProvider: voiceProfile.provider,
  voiceProfileId: voiceProfile.profileId,
  languageCode: voiceProfile.locale,
  voice: voiceProfile.voiceName,
  voiceSelection: "Gemini API profile; generated voice identity recorded from the API request",
  voiceTextHash: episode.voiceTextHash,
  audio: destinationAudio,
  sourceCaptions: captionsPath,
  durationSec,
  sourceDurationSec: Number((durationMs / 1000).toFixed(3)),
  trimmedTailMs: Math.round(durationMs - effectiveDurationMs),
  captionCount: captions.length,
  timingSource: `Gemini Transcribe word timestamps; exact normalized token match; ${captionsExtension.slice(1).toUpperCase()}`,
};
if (platform) await writeJson(path.join(targetReviewDir, "status.json"), statusRecord);
else await writeStatus(id, statusRecord);

console.log(`MP3 va subtitrlar import qilindi: ${folder}`);
console.log(
  `To‘liq ssenariy bo‘yicha video davomiyligi: ${durationSec.toFixed(1)} s.`,
);
