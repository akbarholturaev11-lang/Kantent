import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { assertNotPreviouslyPublished } from "./published-evidence.mjs";
import { requireFreshGitMain } from "./git-freshness.mjs";
import { getPlatformCtaStatus } from "./platform-cta.mjs";
import { readCtaLab, validateCtaEpisode } from "./cta-lab.mjs";
import { prepareSemanticRender } from "./semantic-review-integration.mjs";
import { validateProductionDuration } from "./duration-policy.mjs";
import { validateLessonPresentation } from "./lesson-presentation-policy.mjs";
import { compileMotionDesignTimeline } from "./motion-design-plan.mjs";
import {
  buildCaptionSections,
} from "./caption-utils.mjs";
import {
  captionsToSrt,
  episodeContentHash,
  narrationHash,
  PROJECT_ROOT,
  readJson,
  readStatus,
  requireApprovedVoiceProfile,
  reviewDir,
  validateEpisode,
  writeStatus,
  writeJson,
} from "./lib.mjs";
import { verifyPlatformVideo } from "./render-platform-videos.mjs";

const id = process.argv[2];
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id ?? "")) {
  throw new Error("Foydalanish: node scripts/render-tiktok-review.mjs <episode-ID>");
}
const sourceRevision = requireFreshGitMain();
assertNotPreviouslyPublished(id);
const folder = path.join(reviewDir(id), "tiktok");
const episodePath = path.join(folder, "episode.json");
const episode = await readJson(episodePath);
const visualSystem = await readJson(path.join(PROJECT_ROOT, "content", "visual-system.json"));
validateLessonPresentation(episode, visualSystem.lessonPresentation);
const lab = await readCtaLab();
const platformCta = getPlatformCtaStatus(lab, "tiktok");
if (!platformCta.readyForDraft || !platformCta.publishingAuthorized) {
  throw new Error("TikTok CTA or owner destination authorization is not ready.");
}
const ctaValidation = validateCtaEpisode(episode, lab);
if (!ctaValidation.valid) {
  throw new Error(`CTA rejasi yangilanishi kerak:\n${ctaValidation.errors.join("\n")}`);
}
validateEpisode(episode);
const voiceProfile = await requireApprovedVoiceProfile(id);
if (episode.voiceProvider !== voiceProfile.provider || episode.voiceProfileId !== voiceProfile.profileId) {
  throw new Error("TikTok review voice does not match the approved profile.");
}
if (!episode.audioSrc || episode.voiceTextHash !== narrationHash(episode)) {
  throw new Error("TikTok voice and timed captions must be generated for the current narration.");
}
if (!episode.captions?.length || episode.captionSource !== "gemini-word-timestamps") {
  throw new Error("Gemini word-level captions are required before rendering TikTok review.");
}
const perWordCueCount = episode.captions.filter(
  (caption) => caption.text.trim().split(/\s+/).length <= 2,
).length;
if (perWordCueCount / episode.captions.length < 0.8) {
  throw new Error("TikTok review captions are not word-timed.");
}
const semanticTimeline = prepareSemanticRender(episode);
const motionTimeline = compileMotionDesignTimeline(episode,visualSystem.lessonPresentation);
await fs.access(path.join(PROJECT_ROOT, "public", episode.audioSrc));
try {
  await fs.access(path.join(folder, "approval.json"));
  throw new Error("An approval record exists; this TikTok review package cannot be replaced.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const durationValidation = validateProductionDuration(episode, visualSystem.duration);
const propsPath = path.join(folder, "render-props.json");
const videoPath = path.join(folder, "video.mp4");
if (semanticTimeline) {
  await writeJson(path.join(folder, "visual-timeline.json"), semanticTimeline);
}
if (motionTimeline) await writeJson(path.join(folder, "motion-timeline.json"), motionTimeline);
await writeJson(propsPath, { episode, ...(semanticTimeline ? { semanticTimeline } : {}) });
const remotion = path.join(PROJECT_ROOT, "node_modules", ".bin", "remotion");
const render = spawnSync(
  remotion,
  [
    "render", "src/index.ts", "HSKAI-Episode", videoPath,
    "--props", propsPath,
    "--codec", "h264",
    "--image-format", "jpeg",
    "--pixel-format", "yuv420p",
    "--color-space", "bt709",
  ],
  { cwd: PROJECT_ROOT, stdio: ["ignore", "inherit", "inherit"] },
);
if (render.error) throw render.error;
if (render.status !== 0) {
  throw new Error(`Remotion TikTok review render failed (exit ${render.status}).`);
}
const totalFrames = Math.max(
  episode.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0),
  Math.ceil(((episode.audioDurationMs ?? 0) * 30) / 1000),
);
await verifyPlatformVideo(videoPath, totalFrames, (args) => {
  const executable = args[0] === "ffprobe" ? "ffprobe" : remotion;
  const commandArgs = args[0] === "ffprobe" ? args.slice(1) : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
});

const sections = buildCaptionSections(episode.scenes, 30);
await fs.writeFile(
  path.join(folder, "captions.srt"),
  captionsToSrt(episode.captions, visualSystem.captions, sections),
  "utf8",
);
const hashtags = (episode.hashtags ?? []).join(" ");
await fs.writeFile(
  path.join(folder, "post.md"),
  `${episode.caption || episode.title}\n\n${hashtags}\n\n${episode.cta}\n\nТема: ${episode.title}\nПлатформа: TikTok\nСтатус: только локальная проверка; точное одобрение публикации ещё не дано\n`,
  "utf8",
);
await fs.rm(propsPath, { force: true });
const videoSha256 = createHash("sha256").update(await fs.readFile(videoPath)).digest("hex");
await writeJson(path.join(folder, "status.json"), {
  stage: "rendered-pending-owner-approval",
  sourceRevision,
  updatedAt: new Date().toISOString(),
  platform: "tiktok",
  publicationAuthorized: false,
  ctaExperimentId: episode.ctaExperiment.id,
  ctaRuleVersion: ctaValidation.ruleVersion,
  contentHash: episodeContentHash(episode),
  videoSha256,
  durationSec: Number((totalFrames / 30).toFixed(2)),
  durationValidation,
  voiceProfileId: voiceProfile.profileId,
  timingSource: episode.captionSource,
});
const rootStatus = await readStatus(id);
const baseEpisode = await readJson(path.join(reviewDir(id), "episode.json"));
rootStatus.platformPackages = {
  ...(rootStatus.platformPackages ?? {}),
  tiktok: {
    platform: "tiktok",
    folder,
    episode: episodePath,
    video: videoPath,
    captions: path.join(folder, "captions.srt"),
    post: path.join(folder, "post.md"),
    contentHash: episodeContentHash(episode),
    baseContentHash: episodeContentHash(baseEpisode),
    ctaExperimentId: episode.ctaExperiment.id,
    ctaCopyHash: episode.ctaExperiment.copyHash,
    ctaRuleVersion: ctaValidation.ruleVersion,
    videoSha256,
  },
};
await writeStatus(id, rootStatus);
console.log(`TikTok video tayyor, faqat ko‘rib chiqish uchun: ${videoPath}`);
console.log(`CTA: ${episode.ctaExperiment.id}; davomiylik: ${(totalFrames / 30).toFixed(2)} s.`);
console.log("TikTok nashr qilinmadi; aniq video, post, sozlamalar va vaqt hali tasdiqlanmagan.");
