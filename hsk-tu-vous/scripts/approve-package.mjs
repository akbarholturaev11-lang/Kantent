import fs from "node:fs/promises";
import path from "node:path";
import {
  getEpisode,
  episodeContentHash,
  requireCurrentCta,
  safeId,
  readStatus,
  reviewDir,
  writeJson,
  writeStatus,
} from "./lib.mjs";

const id = process.argv[2];
const publicationIntentJson = process.argv[3];
if (!id || !publicationIntentJson)
  throw new Error(
    "Foydalanish: npm run content:approve -- <mavzu-ID> '<Zernio nashr preview JSON>'",
  );
let publicationIntent;
try {
  publicationIntent = JSON.parse(publicationIntentJson);
} catch {
  throw new Error("Zernio publication intent JSON sifatida o‘qilmadi.");
}
if (
  !publicationIntent ||
  !["now", "scheduled"].includes(publicationIntent.mode) ||
  publicationIntent.timezone !== "Asia/Shanghai" ||
  !Array.isArray(publicationIntent.platforms) ||
  publicationIntent.platforms.length < 1 ||
  publicationIntent.platforms.length > 2
)
  throw new Error("Zernio publication intent maydoni noto‘g‘ri.");
const selectedPlatforms = new Set();
for (const target of publicationIntent.platforms) {
  if (
    !["instagram", "tiktok"].includes(target.platform) ||
    selectedPlatforms.has(target.platform) ||
    typeof target.accountId !== "string" ||
    !target.accountId.trim() ||
    typeof target.accountName !== "string" ||
    !target.accountName.trim() ||
    typeof target.caption !== "string" ||
    !target.caption.trim() ||
    target.caption.length > 2200
  )
    throw new Error("Zernio previewdagi platform/account/caption noto‘g‘ri.");
  selectedPlatforms.add(target.platform);
  if (target.platform === "tiktok") {
    const settings = target.tiktokSettings;
    if (
      !settings ||
      ![
        "PUBLIC_TO_EVERYONE",
        "MUTUAL_FOLLOW_FRIENDS",
        "FOLLOWER_OF_CREATOR",
        "SELF_ONLY",
      ].includes(settings.privacy_level) ||
      typeof settings.allow_comment !== "boolean" ||
      typeof settings.allow_duet !== "boolean" ||
      typeof settings.allow_stitch !== "boolean" ||
      settings.content_preview_confirmed !== true ||
      settings.express_consent_given !== true ||
      settings.video_made_with_ai !== true ||
      settings.commercialContentType !== "brand_organic"
    )
      throw new Error(
        "TikTok preview uchun creator privacy/toggle qiymatlari va egasining preview roziligi kerak.",
      );
  }
  if (
    target.platform === "instagram" &&
    (!target.instagramSettings ||
      typeof target.instagramSettings.shareToFeed !== "boolean" ||
      typeof target.instagramSettings.isAiGenerated !== "boolean")
  )
    throw new Error("Instagram previewdagi disclosure/share sozlamalari kerak.");
}
if (publicationIntent.mode === "scheduled") {
  if (
    typeof publicationIntent.scheduledFor !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/i.test(publicationIntent.scheduledFor) ||
    !Number.isFinite(Date.parse(publicationIntent.scheduledFor)) ||
    Date.parse(publicationIntent.scheduledFor) <= Date.now()
  )
    throw new Error("Kelajakdagi aniq rejalashtirilgan vaqt talab qilinadi.");
} else if (publicationIntent.scheduledFor !== undefined) {
  throw new Error("Hozir joylash rejimida scheduledFor berilmaydi.");
}

const { episode } = await getEpisode(id, { seed: false });
const ctaValidation = await requireCurrentCta(episode);
if (!episode.learningFactSources?.length) {
  throw new Error(
    "Перед одобрением добавьте learningFactSources с URL и датой проверки для китайских учебных фактов. Плановые referenceFacts сами по себе не являются проверкой.",
  );
}
const folder = reviewDir(id);
const status = await readStatus(id);
if (status.stage !== "rendered-pending-owner-approval") {
  throw new Error(
    "Текущая версия сценария ещё не собрана в пакет для проверки. Сначала обновите озвучку и субтитры, затем соберите Remotion.",
  );
}
if (
  status.contentHash !== episodeContentHash(episode) ||
  status.ctaExperimentId !== episode.ctaExperiment.id
)
  throw new Error(
    "Rendered package no longer matches this episode/CTA version. Render the current plan before approval.",
  );
for (const filename of ["video.mp4", "captions.srt", "post.md"]) {
  try {
    await fs.access(path.join(folder, filename));
  } catch {
    throw new Error(
      `${filename} topilmadi. Avval npm run content:render -- ${id} ni bajaring.`,
    );
  }
}
const approval = {
  episodeId: id,
  state: "approved-for-zernio-publishing",
  approvedAt: new Date().toISOString(),
  ctaExperimentId: episode.ctaExperiment.id,
  ctaCopyHash: episode.ctaExperiment.copyHash,
  ctaRuleVersion: ctaValidation.ruleVersion,
  contentHash: status.contentHash,
  publicationIntent,
  note: "Владелец подтвердил показанный Zernio preview. Для фактической публикации требуется отдельный вызов Zernio MCP.",
};
await writeJson(path.join(folder, "approval.json"), approval);
// Keep exact-version approval evidence when later edits invalidate current output.
await writeJson(
  path.join(folder, "approvals", `${safeId(episode.ctaExperiment.id)}.json`),
  approval,
);
await writeStatus(id, {
  ...status,
  stage: "owner-approved-for-zernio-publishing",
  updatedAt: approval.approvedAt,
});
episode.publishingStatus = approval.state;
await writeJson(path.join(folder, "episode.json"), episode);
console.log(
  "Zernio publication preview tasdig‘i yozildi. Bu buyruqning o‘zi post joylamaydi.",
);
