import { requireFreshGitMain } from './git-freshness.mjs';
import { assertNotPreviouslyPublished } from './published-evidence.mjs';
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  FPS,
  getEpisode,
  narrationHash,
  PROJECT_ROOT,
  requireApprovedVoiceProfile,
  readStatus,
  reviewDir,
  writeJson,
  writeStatus,
  validateEpisode,
} from "./lib.mjs";

const [id, audioInput, captionsInput] = process.argv.slice(2);
if (!id || !audioInput || !captionsInput) {
  throw new Error(
    "Foydalanish: node scripts/import-voice.mjs <episode-ID> <audio.mp3> <captions.srt|captions.vtt>",
  );
}

const audioPath = path.resolve(audioInput);
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
const { episode, filePath } = await getEpisode(id);
validateEpisode(episode);
const visualSystem = JSON.parse(
  await fs.readFile(
    path.join(PROJECT_ROOT, "content", "visual-system.json"),
    "utf8",
  ),
);
const beatEntryLeadFrames = visualSystem.motion.beatEntryLeadFrames;
const voiceProfile = await requireApprovedVoiceProfile(id);
if (voiceProfile.provider !== "gemini-api") {
  throw new Error("Faol ovoz profili Gemini API provayderiga mos emas.");
}
const existingStatus = await readStatus(id);
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
  await fs.access(path.join(reviewDir(id), "approval.json"));
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
const captions = rawSrt
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

const audioBuffer = await fs.readFile(audioPath);
if (!audioBuffer.length) throw new Error("Audio fayli bo‘sh.");
const audioInfo = spawnSync("afinfo", [audioPath], { encoding: "utf8" });
let durationMs = 0;
if (!audioInfo.error && audioInfo.status === 0) {
  const durationMatch = `${audioInfo.stdout}\n${audioInfo.stderr}`.match(
    /(?:estimated\s+)?duration:\s*([\d.]+)\s*sec/i,
  );
  if (durationMatch) durationMs = Math.round(Number(durationMatch[1]) * 1000);
}
durationMs ||= Math.max(...captions.map((caption) => caption.endMs));
if (!Number.isFinite(durationMs) || durationMs <= 0) {
  throw new Error("Audio davomiyligini aniqlab bo‘lmadi.");
}
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
  value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
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
    "Subtitr matni joriy ruscha ssenariyga to‘liq mos emas. Gemini generatorini joriy ssenariy bilan qayta bajaring.",
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
  const cueAlignedFrame = index === 1
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
const folder = reviewDir(id);
const assetFolder = path.join(
  path.dirname(filePath),
  "..",
  "..",
  "public",
  "generated",
  id,
);
await fs.mkdir(assetFolder, { recursive: true });
const audioFilename = `voice${path.extname(audioPath).toLowerCase()}`;
const destinationAudio = path.join(assetFolder, audioFilename);
await fs.copyFile(audioPath, destinationAudio);
await fs.copyFile(
  captionsPath,
  path.join(folder, `gemini-word-timestamps${captionsExtension}`),
);

episode.audioSrc = `generated/${id}/${audioFilename}`;
episode.voiceProfileId = voiceProfile.profileId;
episode.voiceProvider = voiceProfile.provider;
episode.sourceAudioDurationMs = durationMs;
episode.audioDurationMs = effectiveDurationMs;
episode.audioTrimAfterFrames = audioTrimAfterFrames;
episode.captions = captions;
episode.captionSource = "gemini-word-timestamps";
episode.publishingStatus = "pending-owner-review";
await writeJson(filePath, episode);

const durationSec = Number(outputDurationSec.toFixed(2));
await writeStatus(id, {
  sourceRevision,
  stage: "voice-and-captions-imported",
  updatedAt: new Date().toISOString(),
  provider: voiceProfile.serviceName,
  voiceProvider: voiceProfile.provider,
  voiceProfileId: voiceProfile.profileId,
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
});

console.log(`MP3 va subtitrlar import qilindi: ${folder}`);
console.log(
  `To‘liq ssenariy bo‘yicha video davomiyligi: ${durationSec.toFixed(1)} s.`,
);
