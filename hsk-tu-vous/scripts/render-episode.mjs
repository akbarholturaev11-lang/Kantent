import { assertNotPreviouslyPublished } from "./published-evidence.mjs";
import { requireFreshGitMain } from "./git-freshness.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildCaptionSections } from "./caption-utils.mjs";
import { readCtaLab, writeCtaLab } from "./cta-lab.mjs";
import {
  prepareExportEpisodes,
  platformPackagePaths,
  videoHash,
} from "./platform-exports.mjs";
import { renderSharedPlatformVideos } from "./render-platform-videos.mjs";
import { prepareSemanticRender } from "./semantic-review-integration.mjs";
import { validateProductionDuration } from "./duration-policy.mjs";
import { compileMotionDesignTimeline } from "./motion-design-plan.mjs";
import { validateLessonPresentation } from "./lesson-presentation-policy.mjs";
import {
  getEpisode,
  episodeContentHash,
  invalidateReviewArtifacts,
  requireCurrentCta,
  narrationHash,
  PROJECT_ROOT,
  readJson,
  reviewDir,
  requireApprovedVoiceProfile,
  writeJson,
  writeStatus,
  captionsToSrt,
  validateEpisode,
} from "./lib.mjs";

const id = process.argv[2];
if (!id) throw new Error("Foydalanish: npm run content:render -- <mavzu-ID>");
const sourceRevision = requireFreshGitMain();
assertNotPreviouslyPublished(id);
const { episode, filePath } = await getEpisode(id);
const visualSystem = await readJson(
  path.join(PROJECT_ROOT, "content", "visual-system.json"),
);
validateEpisode(episode);
validateLessonPresentation(episode, visualSystem.lessonPresentation);
const ctaValidation = await requireCurrentCta(episode);
const voiceProfile = await requireApprovedVoiceProfile(id);
if (episode.voiceProvider !== voiceProfile.provider)
  throw new Error("Episode voice provider does not match the active voice profile.");
if (episode.audioSrc && episode.voiceProfileId !== voiceProfile.profileId)
  throw new Error(
    "Аудио сделано по другому профилю. Не заменяйте закреплённый голос.",
  );
if (!episode.audioSrc)
  throw new Error(
    "Gemini TTS voice must be generated and imported before Remotion rendering.",
  );
if (episode.voiceTextHash !== narrationHash(episode))
  throw new Error(
    "Озвучка подготовлена по другой версии сценария. Сгенерируйте текст заново и импортируйте совпадающие MP3+субтитры.",
  );
const audioPath = path.join(PROJECT_ROOT, "public", episode.audioSrc);
await fs.access(audioPath);
if (
  !episode.captions?.length ||
  episode.captionSource !== "gemini-word-timestamps"
) {
  throw new Error(
    "Gemini Transcribe word-level captions must be imported before rendering.",
  );
}
const perWordCueCount = episode.captions.filter(
  (caption) => caption.text.trim().split(/\s+/).length <= 2,
).length;
if (perWordCueCount / episode.captions.length < 0.8) {
  throw new Error(
    "Gemini word-level caption cues are incomplete; rerun voice generation.",
  );
}
// Verify every spoken action against real Gemini word captions BEFORE writing
// working copies, CTA registrations or production packages.
const durationValidation = validateProductionDuration(episode, visualSystem.duration);
const semanticTimeline = prepareSemanticRender(episode);
const motionTimeline = compileMotionDesignTimeline(episode);
const folder = reviewDir(id);
await fs.mkdir(folder, { recursive: true });
episode.publishingStatus = "pending-owner-review";
const lab = await readCtaLab();
const { episodes, registrations } = prepareExportEpisodes(episode, lab);
if (registrations.length) {
  lab.experiments.push(...registrations);
  await writeCtaLab(lab);
}
await writeJson(filePath, episode);
await invalidateReviewArtifacts(id);
if (semanticTimeline) await writeJson(path.join(folder, "visual-timeline.json"), semanticTimeline);
if (motionTimeline) await writeJson(path.join(folder, "motion-timeline.json"), motionTimeline);
await writeStatus(id, {
  stage: "rendering",
  sourceRevision,
  updatedAt: new Date().toISOString(),
});

const sfxResult = spawnSync(
  process.execPath,
  [path.join(PROJECT_ROOT, "scripts", "generate-sfx.mjs")],
  { cwd: PROJECT_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
if (sfxResult.error) throw sfxResult.error;
if (sfxResult.status !== 0)
  throw new Error(
    `Не удалось подготовить звуковые эффекты: ${sfxResult.stderr || sfxResult.stdout}`,
  );

const paths = Object.fromEntries(
  Object.keys(episodes).map((platform) => [
    platform,
    platformPackagePaths(id, platform),
  ]),
);
const platformPackages = {};
try {
  await renderSharedPlatformVideos({
    episodes,
    outputs: Object.fromEntries(
      Object.entries(paths).map(([platform, files]) => [platform, files.video]),
    ),
    workDir: path.join(folder, ".render-work"),
    semanticTimeline,
  });
  for (const [platform, variant] of Object.entries(episodes)) {
    const files = paths[platform];
    await writeJson(files.episode, variant);
    await fs.writeFile(
      files.captions,
      captionsToSrt(
        variant.captions,
        visualSystem.captions,
        buildCaptionSections(variant.scenes, 30),
      ),
      "utf8",
    );
    const hashtags = (variant.hashtags || []).join(" ");
    const labels = variant.languageCode === "tg-TJ"
      ? { topic: "Мавзӯъ", platform: "Платформа", status: "Ҳолат", ready: "баста барои баррасии дастӣ омода аст" }
      : { topic: "Тема", platform: "Платформа", status: "Статус", ready: "пакет готов к ручной проверке" };
    const postText = `${variant.caption || variant.title}\n\n${hashtags}\n\n${variant.cta}\n\n${labels.topic}: ${variant.title}\n${labels.platform}: ${platform}\n${labels.status}: ${labels.ready} HSK AI`;
    await fs.writeFile(files.post, `${postText}\n`, "utf8");
    platformPackages[platform] = {
      ...files,
      contentHash: episodeContentHash(variant),
      baseContentHash: episodeContentHash(episode),
      ctaExperimentId: variant.ctaExperiment.id,
      ctaCopyHash: variant.ctaExperiment.copyHash,
      ctaRuleVersion: variant.ctaExperiment.ruleVersion,
      videoSha256: await videoHash(files.video),
    };
  }
} catch (error) {
  await writeStatus(id, {
    stage: "render-failed",
    sourceRevision,
    updatedAt: new Date().toISOString(),
    error: error.message,
  });
  throw error;
}
await writeStatus(id, {
  stage: "rendered-pending-owner-approval",
  sourceRevision,
  updatedAt: new Date().toISOString(),
  video: paths.instagram.video,
  captions: paths.instagram.captions,
  post: paths.instagram.post,
  platformPackages,
  sharedLessonRenderedOnce: true,
  semanticReviewRendered: Boolean(semanticTimeline) && !motionTimeline,
  motionDesignRendered: Boolean(motionTimeline),
  motionBeatCount: motionTimeline?.scenes.reduce((sum,scene)=>sum+scene.beats.length,0) ?? 0,
  semanticPublicationGate: semanticTimeline ? "owner-preview-required" : null,
  voiceProfileId: voiceProfile.profileId,
  voice: voiceProfile.voiceName,
  hookExperimentId: episode.hookExperiment.id,
  hookFormatId: episode.hookExperiment.formatId,
  creativeFormatId: episode.creativeFormatId ?? null,
  hookPerformanceStatus: "unmeasured",
  ctaExperimentId: episode.ctaExperiment.id,
  ctaRuleVersion: ctaValidation.ruleVersion,
  ctaPerformanceStatus: "unmeasured",
  contentHash: episodeContentHash(episode),
  learningFactSourceCount: episode.learningFactSources?.length ?? 0,
  languageReviewStatus: episode.learningFactSources?.length
    ? "sources-recorded; owner-review-required"
    : "source-audit-needed",
  burnedInCaptions: true,
  timingSource: episode.captionSource,
  durationValidation,
  durationSec: Number(
    (
      episode.scenes.reduce(
        (sum, scene) => sum + (scene.durationFrames ?? 0),
        0,
      ) / 30
    ).toFixed(2),
  ),
});
console.log(`Пакет готов для проверки: ${folder}`);
for (const [platform, exported] of Object.entries(platformPackages)) {
  console.log(`${platform}: ${exported.video}`);
}
console.log("Видео не опубликовано. Автоматической публикации нет.");
