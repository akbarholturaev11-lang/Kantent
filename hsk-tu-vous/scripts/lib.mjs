import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  CAPTION_STYLE_IDS,
  buildCaptionSections,
  groupTimedCaptions,
} from "./caption-utils.mjs";
import { readCtaLab, validateCtaEpisode } from "./cta-lab.mjs";
import { assertCanonicalLessonSource, composeLessonCta } from "./episode-cta-assembly.mjs";
import { decorateCanonicalLesson, compareAuthorialContent } from "./auto-storyboard.mjs";
import { validateStoryboardScene } from "./storyboard-validation.mjs";
import { validateSemanticVisualEpisode } from "./semantic-visual-plan.mjs";
import { validateStorytellingEpisode } from "./storytelling-plan.mjs";

export const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const CALENDAR_PATH = path.join(
  PROJECT_ROOT,
  "content",
  "calendar.json",
);
export const REVIEW_ROOT = path.join(PROJECT_ROOT, "review");
export const VOICE_PROFILE_PATH = path.join(
  PROJECT_ROOT,
  "content",
  "voice-profile.json",
);
export const FPS = 30;

export async function readVoiceProfile() {
  const profile = await readJson(VOICE_PROFILE_PATH);
  if (
    profile?.profileId !== "ru-gemini-kore-v1" ||
    profile.provider !== "gemini-api" ||
    profile.serviceName !== "Google Gemini API" ||
    profile.locale !== "ru-RU" ||
    profile.voiceName !== "Kore" ||
    profile.ttsModel !== "gemini-3.8-flash-lite-tts" ||
    profile.transcriptionModel !== "gemini-3.5-transcribe" ||
    profile.outputFormat !== "MP3" ||
    profile.mp3BitrateKbps !== 128 ||
    profile.sampleRateHz !== 24000 ||
    profile.channels !== 1
  ) {
    throw new Error(
      "content/voice-profile.json Gemini production sozlamalariga mos kelmaydi.",
    );
  }
  if (!["pending-owner-approval", "approved"].includes(profile.status)) {
    throw new Error("Ovoz profilining tasdiq holati noto‘g‘ri.");
  }
  if (
    profile.status === "approved" &&
    (!profile.approval?.approvedAt || profile.approval?.approvedBy !== "owner")
  ) {
    throw new Error("Tasdiqlangan ovoz profilida egasining tasdiq qaydi yo‘q.");
  }
  return profile;
}

export async function requireApprovedVoiceProfile(
  episodeId,
  { allowPendingSample = true } = {},
) {
  const profile = await readVoiceProfile();
  if (profile.status === "approved") return profile;
  if (
    allowPendingSample &&
    profile.status === "pending-owner-approval" &&
    profile.sampleEpisodeId === episodeId
  ) {
    return profile;
  }
  throw new Error(
    "Doimiy ovoz hali tasdiqlanmagan. Hozirgi namuna: " +
      profile.voiceName +
      " (" +
      profile.locale +
      "). Egasi namuna ovozini tinglab, bir marta Tasdiqlayman degandan keyingina boshqa sanalar uchun ovoz tayyorlanadi.",
  );
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function reviewDir(id) {
  return path.join(REVIEW_ROOT, safeId(id));
}

export function safeId(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "")) {
    throw new Error(
      "Mavzu identifikatori noto‘g‘ri. content:plan buyrug‘idagi IDdan foydalaning.",
    );
  }
  return value;
}

export function narrationText(episode) {
  return (
    episode.scenes.map((scene) => scene.narration.trim()).join("\n\n") + "\n"
  );
}

export function narrationHash(episode) {
  return createHash("sha256")
    .update(narrationText(episode), "utf8")
    .digest("hex");
}

export async function requireCurrentCta(episode) {
  const validation = validateCtaEpisode(episode, await readCtaLab());
  if (!validation.valid)
    throw new Error(
      `CTA rejasi yangilanishi kerak:\n${validation.errors.join("\n")}`,
    );
  return validation;
}

// Approval is excluded because approving a rendered package does not edit its content.
export function episodeContentHash(episode) {
  const { publishingStatus: _publishingStatus, ...content } = episode;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export async function invalidateReviewArtifacts(
  id,
  { narrationChanged = false } = {},
) {
  const folder = reviewDir(id);
  const files = [
    "video.mp4",
    "captions.srt",
    "post.md",
    "render-props.json",
    "visual-timeline.json",
    "approval.json",
  ];
  if (narrationChanged) files.push("tts-input.txt");
  await Promise.all(
    files.map((filename) =>
      fs.rm(path.join(folder, filename), { force: true }),
    ),
  );
  // Current derived exports are disposable; append-only approvals and
  // publication history remain in the parent review directory.
  await fs.rm(path.join(folder, "youtube"), { recursive: true, force: true });
  await fs.rm(path.join(folder, ".render-work"), { recursive: true, force: true });
  if (narrationChanged)
    await fs.rm(path.join(PROJECT_ROOT, "public", "generated", safeId(id)), {
      recursive: true,
      force: true,
    });
}

export async function getCalendarItem(id) {
  const calendar = await readJson(CALENDAR_PATH);
  const item = calendar.items.find((entry) => entry.id === safeId(id));
  if (!item) throw new Error(`Taqvimda “${id}” IDli mavzu topilmadi.`);
  return item;
}

export async function getCalendarItemByDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
    throw new Error(
      "Sanani YYYY-MM-DD formatida kiriting, masalan 2026-09-28.",
    );
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Kiritilgan sana haqiqiy kalendar sanasi emas.");
  }
  const calendar = await readJson(CALENDAR_PATH);
  const item = calendar.items.find((entry) => entry.date === date);
  if (!item) {
    const dates = calendar.items.map((entry) => entry.date).join(", ");
    throw new Error(
      `Taqvimda ${date} uchun video rejasi yo‘q. Rejalangan sanalar: ${dates}`,
    );
  }
  return item;
}

export async function getPlannedEpisode(date) {
  const item = await getCalendarItemByDate(date);
  const filePath = path.join(PROJECT_ROOT, "content", item.episodeFile);
  const sourceLesson = normalizeEpisode(await readJson(filePath));
  const ctaLab = await readCtaLab();
  assertCanonicalLessonSource(sourceLesson, ctaLab);
  const lesson = decorateCanonicalLesson(sourceLesson);
  // CTA-free future plans get the current central CTA only when materialized.
  // Legacy completed/registered plans keep their original version snapshots.
  const episode = lesson.scenes.some((scene) => scene.kind === "cta")
    ? lesson
    : composeLessonCta(lesson, ctaLab);
  validateEpisode(episode);
  if (episode.id !== item.id || episode.date !== item.date) {
    throw new Error(
      `Kontent rejasi kalendardagi ${date} yozuviga mos kelmadi.`,
    );
  }
  return { item, episode, filePath };
}

export function synchronizeAutoStoryboard(saved, planned, status = {stage:"planned"}) {
  const wanted=planned.creativeFormatId;
  if(!wanted || !planned.scenes.some(s=>s.kind!=="cta" && s.storyboard)) return saved;
  if(saved.id!==planned.id || saved.date!==planned.date)
    throw Error("Review-copy date/episode mismatch; refused creative migration");
  const current=saved.creativeFormatId;
  const formats=saved.scenes.filter(s=>s.kind!=="cta");
  // An older clean review draft may already have the correct broad format,
  // but still lack the newly required semantic scene contract. Migrate only
  // before voice; never rewrite an approved, rendered or manually edited copy.
  const semanticSync = JSON.stringify({
    marker:saved.semanticVisual,
    scenes:saved.scenes.filter(s=>s.kind!=="cta").map(s=>({shot:s.semanticShot,
      actions:(s.visualBeats??[]).map(b=>b.semanticAction)}))
  }) === JSON.stringify({
    marker:planned.semanticVisual,
    scenes:planned.scenes.filter(s=>s.kind!=="cta").map(s=>({shot:s.semanticShot,
      actions:(s.visualBeats??[]).map(b=>b.semanticAction)}))
  });
  if(current===wanted && formats.every(s=>s.storyboard?.formatId===wanted) && semanticSync) return saved;
  const protectedStages=["rendered-pending-owner-approval","owner-approved-for-zernio-publishing",
    "zernio-published","zernio-scheduled","zernio-publication-processing",
    "zernio-publication-partial","zernio-publication-failed"];
  if(protectedStages.includes(status.stage)||saved.audioSrc||saved.voiceTextHash||
     saved.captions?.length||!["planned","plan-ready"].includes(status.stage)||
     !compareAuthorialContent(saved,planned)) {
    throw Error("Existing review copy differs from current creative storyboard or already has voice/review state. "+
      "Do not silently replace approved or manually edited work; inspect this episode and explicitly regenerate an unapproved draft.");
  }
  // Only touch clean pre-voice copies matching canonical source exactly.
  return planned;
}

export async function getRunEpisodeByDate(date) {
  const { item, episode: plannedEpisode } = await getPlannedEpisode(date);
  const folder = reviewDir(item.id);
  const filePath = path.join(folder, "episode.json");
  try {
    const saved = normalizeEpisode(await readJson(filePath));
    const status = await readStatus(item.id);
    const episode = synchronizeAutoStoryboard(saved, plannedEpisode, status);
    if (episode !== saved) await writeJson(filePath, episode);
    return { item, episode, filePath, isRunCopy: true };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeJson(filePath, plannedEpisode);
  await writeStatus(item.id, {
    stage: "plan-ready",
    updatedAt: new Date().toISOString(),
  });
  return { item, episode: plannedEpisode, filePath, isRunCopy: false };
}

export function normalizeEpisode(episode) {
  if (!episode || typeof episode !== "object") return episode;
  episode.languageCode ||= episode.voiceLocale || "ru-RU";
  episode.title ||= episode.titleRu || episode.titleTg;
  episode.caption ||= episode.captionRu || episode.captionTg;
  for (const scene of episode.scenes ?? []) {
    scene.headline ||= scene.headlineRu || scene.headlineTg;
    scene.narration ||= scene.narrationRu || scene.narrationTg;
    scene.screenCaption ||= scene.screenCaptionRu || scene.screenCaptionTg;
    for (const card of scene.cards ?? [])
      card.meaning ||= card.meaningRu || card.meaningTg;
  }
  return episode;
}

export async function getEpisode(id, { seed = true } = {}) {
  const folder = reviewDir(id);
  const draft = path.join(folder, "episode.json");
  try {
    const saved = normalizeEpisode(await readJson(draft));
    const {episode} = await getRunEpisodeByDate(saved.date);
    return { episode, filePath: draft, isSeed: false };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  if (!seed)
    throw new Error(`Avval draft yarating: npm run content:draft -- ${id}`);
  const seedPath = path.join(
    PROJECT_ROOT,
    "content",
    "episodes",
    `${safeId(id)}.json`,
  );
  try {
    const base = normalizeEpisode(await readJson(seedPath));
    const ctaLab = await readCtaLab();
    assertCanonicalLessonSource(base, ctaLab);
    const lesson = decorateCanonicalLesson(base);
    const episode = lesson.scenes.some((scene) => scene.kind === "cta")
      ? lesson
      : composeLessonCta(lesson, ctaLab);
    validateEpisode(episode);
    await writeJson(draft, episode);
    return { episode, filePath: draft, isSeed: true };
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `“${id}” uchun draft topilmadi. Avval npm run content:draft -- ${id} buyrug‘ini bajaring.`,
      );
    }
    throw error;
  }
}

export async function readStatus(id) {
  try {
    return await readJson(path.join(reviewDir(id), "status.json"));
  } catch (error) {
    if (error?.code === "ENOENT") return { stage: "planned" };
    throw error;
  }
}

export async function writeStatus(id, status) {
  await writeJson(path.join(reviewDir(id), "status.json"), status);
}

export function getEpisodeDurationFrames(episode) {
  return episode.scenes.reduce((sum, scene) => {
    const frames = Number.isFinite(scene.durationFrames)
      ? scene.durationFrames
      : Math.ceil((scene.durationSec ?? 4) * FPS);
    return sum + Math.max(1, frames);
  }, 0);
}

export function makeApproximateCaptions(episode) {
  let startFrame = 0;
  return episode.scenes.map((scene) => {
    const durationFrames = Number.isFinite(scene.durationFrames)
      ? scene.durationFrames
      : Math.ceil((scene.durationSec ?? 4) * FPS);
    const caption = {
      text: scene.narration,
      startMs: Math.round((startFrame / FPS) * 1000),
      endMs: Math.round(((startFrame + durationFrames) / FPS) * 1000),
      timestampMs: Math.round((startFrame / FPS) * 1000),
      confidence: 0.45,
    };
    startFrame += durationFrames;
    return caption;
  });
}

export function captionsToSrt(captions, captionStyle, sections) {
  const formatTime = (milliseconds) => {
    const value = Math.max(0, Math.round(milliseconds));
    const hours = Math.floor(value / 3_600_000);
    const minutes = Math.floor((value % 3_600_000) / 60_000);
    const seconds = Math.floor((value % 60_000) / 1000);
    const millis = value % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
  };
  return groupTimedCaptions(captions, {
    ...captionStyle,
    sections,
  })
    .map(
      (page, index) =>
        `${index + 1}\n${formatTime(page.startMs)} --> ${formatTime(page.endMs)}\n${page.text}\n`,
    )
    .join("\n");
}

export function validateEpisode(episode) {
  normalizeEpisode(episode);
  const storytellingErrors = validateStorytellingEpisode(episode);
  if (storytellingErrors.length) throw new Error(storytellingErrors.join("\n"));
  const semanticErrors = validateSemanticVisualEpisode(episode);
  if (semanticErrors.length) throw new Error(semanticErrors.join("\n"));
  if (
    !episode?.id ||
    !episode.title ||
    !Array.isArray(episode.scenes) ||
    episode.scenes.length < 3
  ) {
    throw new Error(
      "Ssenariyda ID, sarlavha va kamida 3 ta sahna bo‘lishi kerak.",
    );
  }
  const hook = episode.scenes.find((scene) => scene.kind === "hook");
  if (!hook || episode.scenes[0]?.kind !== "hook") {
    throw new Error("Birinchi sahna hook bo‘lishi kerak.");
  }
  const hookFrames = hook.durationFrames ?? (hook.durationSec ?? 4) * FPS;
  if (hookFrames > 180) {
    throw new Error(
      "Hook 6 soniyadan oshmasligi kerak; asosiy va’dani tez ko‘rsating.",
    );
  }
  const experiment = episode.hookExperiment;
  if (
    !experiment?.id ||
    !["question", "contrast", "scenario"].includes(experiment.formatId) ||
    typeof experiment.hypothesis !== "string" ||
    experiment.hypothesis.trim().length < 20 ||
    ![
      "three-second-hold-rate",
      "average-watch-ratio",
      "chose-to-view-rate",
    ].includes(
      experiment.primaryMetric,
    ) ||
    ![
      "three-second-hold-rate",
      "average-watch-ratio",
      "chose-to-view-rate",
    ].includes(
      experiment.fallbackMetric,
    ) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(experiment.registeredAt ?? "")
  ) {
    throw new Error(
      "Har bir epizodda hookExperiment ID, format, oldindan yozilgan taxmin, metrika va sana bo‘lishi kerak.",
    );
  }
  for (const [index, scene] of episode.scenes.entries()) {
    const storyboardErrors = validateStoryboardScene(scene);
    if (storyboardErrors.length) throw new Error(`${scene.id ?? index}: ${storyboardErrors.join("; ")}`);
    if (!scene.id || !scene.headline || !scene.narration) {
      throw new Error(
        `${index + 1}-sahnada ID, sarlavha yoki ovoz matni yetishmayapti.`,
      );
    }
    if (typeof scene.narration !== "string" || scene.narration.length > 1200) {
      throw new Error(
        `${scene.id} sahnasidagi ovoz matni noto‘g‘ri yoki juda uzun.`,
      );
    }
    if (scene.cards && !Array.isArray(scene.cards)) {
      throw new Error(`${scene.id} sahnasidagi cards ro‘yxat bo‘lishi kerak.`);
    }
    if (
      scene.captionStyleId &&
      !CAPTION_STYLE_IDS.includes(scene.captionStyleId)
    ) {
      throw new Error(
        `${scene.id} sahnasida captionStyleId tanilmagan. Ruxsat etilgan uslublar: ${CAPTION_STYLE_IDS.join(", ")}.`,
      );
    }
    for (const beat of scene.visualBeats ?? []) {
      if (
        typeof beat.hero !== "string" ||
        (!beat.hero.trim() && !beat.actionIcon)
      )
        throw new Error(
          `${scene.id}: visual beat needs hero text or an actionIcon.`,
        );
      if (
        beat.actionIcon &&
        !["bookmark", "comment", "app-download", "direct-message"].includes(
          beat.actionIcon,
        )
      )
        throw new Error(`${scene.id}: unsupported actionIcon.`);
      if (
        beat.transitionStyle &&
        !["mask-reveal", "slide-match", "type-reveal"].includes(
          beat.transitionStyle,
        )
      )
        throw new Error(`${scene.id}: unsupported transitionStyle.`);
      if (
        beat.syncCueText !== undefined &&
        (typeof beat.syncCueText !== "string" || !beat.syncCueText.trim())
      )
        throw new Error(`${scene.id}: syncCueText must match a spoken word.`);
      if (
        beat.visualFocus &&
        ![
          "friend",
          "teacher",
          "elder",
          "shopkeeper",
          "group",
          "single-person",
          "book",
          "person-with-book",
          "coffee",
          "empty-cup",
          "apple-near",
          "apple-far",
          "apple-pair",
        ].includes(beat.visualFocus)
      ) {
        throw new Error(
          `${scene.id} sahnasidagi visualFocus qo‘llab-quvvatlanmaydi.`,
        );
      }
    }
  }
  const captionStyleCount = new Set(
    buildCaptionSections(episode.scenes, FPS).map((section) =>
      section.styleId === "ctaFooter" ? "pill" : section.styleId,
    ),
  ).size;
  if (captionStyleCount < 2 || captionStyleCount > 3) {
    throw new Error(
      `Har bir rolikda 2–3 xil subtitr uslubi ishlating; tanlangan uslublar soni: ${captionStyleCount}.`,
    );
  }
}

export function extractWav(buffer) {
  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("Ovoz fayli to‘g‘ri WAV formatida emas.");
  }
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (chunkId === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(payload + 0),
        channels: buffer.readUInt16LE(payload + 2),
        sampleRate: buffer.readUInt32LE(payload + 4),
        byteRate: buffer.readUInt32LE(payload + 8),
        blockAlign: buffer.readUInt16LE(payload + 12),
        bitsPerSample: buffer.readUInt16LE(payload + 14),
      };
    }
    if (chunkId === "data")
      data = buffer.subarray(payload, payload + chunkSize);
    offset = payload + chunkSize + (chunkSize % 2);
  }
  if (!format || !data || !format.byteRate)
    throw new Error("WAV faylida fmt ёки data qismi topilmadi.");
  return {
    format,
    data,
    durationMs: Math.round((data.length / format.byteRate) * 1000),
  };
}

export function createWav(data, format) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(format.audioFormat, 20);
  header.writeUInt16LE(format.channels, 22);
  header.writeUInt32LE(format.sampleRate, 24);
  header.writeUInt32LE(format.byteRate, 28);
  header.writeUInt16LE(format.blockAlign, 32);
  header.writeUInt16LE(format.bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
