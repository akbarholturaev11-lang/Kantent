export const CTA_PLATFORMS = Object.freeze(["instagram", "tiktok", "youtube"]);

const isText = (value) => typeof value === "string" && value.trim().length > 0;

export function validatePlatformCtaConfig(lab) {
  const errors = [];
  const variants = lab?.platformVariants;
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) {
    return ["platformVariants is required in content/cta-lab.json"];
  }
  for (const platform of CTA_PLATFORMS) {
    const item = variants[platform];
    if (!item || typeof item !== "object") {
      errors.push(`Missing CTA variant: ${platform}`);
      continue;
    }
    if (!["approved", "pending-owner-configuration"].includes(item.status))
      errors.push(`Invalid CTA variant status: ${platform}`);
    if (platform === "instagram" && item.status === "approved") {
      const template = item.sceneTemplate;
      if (!template || template.kind !== "cta" || template.id !== "cta" ||
          !Array.isArray(template.visualBeats) || !template.visualBeats.length ||
          !isText(template.headline) || !isText(template.editPlan) ||
          "narration" in template || "cta" in template || "ctaExperiment" in template) {
        errors.push("Instagram needs a central CTA sceneTemplate without duplicated narration or registrations");
      }
    }
    if (platform === "youtube" && item.status === "approved") {
      const template = item.sceneTemplate;
      if (!template || template.kind !== "cta" || template.id !== "cta" ||
          !Array.isArray(template.visualBeats) || !template.visualBeats.length ||
          !isText(template.headline) || !isText(template.screenCaption) || !isText(template.editPlan) ||
          "narration" in template || "cta" in template || "ctaExperiment" in template) {
        errors.push("YouTube needs a central CTA sceneTemplate without duplicated narration or registrations");
      }
    }
    if (platform === "instagram" && item.copySource !== "offer")
      errors.push("Instagram must reference the canonical offer; do not duplicate its wording");
    if (platform === "tiktok" && item.copySource !== "platform")
      errors.push(`${platform} needs its own platform CTA wording in the same lab`);
    if (platform === "youtube" && !["offer", "platform"].includes(item.copySource))
      errors.push("YouTube must reference the canonical offer or its own platform CTA wording");
    if (item.status === "approved" && item.copySource === "platform") {
      const template = item.sceneTemplate ?? item;
      if (!isText(item.canonicalRussian)) errors.push(`${platform}: approved copy missing`);
      if (!Array.isArray(template.visualBeats) || !template.visualBeats.length)
        errors.push(`${platform}: approved visual beats missing`);
      if (!isText(template.headline) || !isText(template.screenCaption) || !isText(template.editPlan))
        errors.push(`${platform}: approved scene fields missing`);
      if (item.deliveryMode === "keyword-dm" && item.automationVerified !== true)
        errors.push(`${platform}: keyword DM cannot be approved before real automation is verified`);
      if (!isText(item.deliveryMode))
        errors.push(`${platform}: deliveryMode missing`);
    }
    if (platform === "youtube" && item.status === "approved" && item.copySource === "offer" &&
        !isText(item.deliveryMode))
      errors.push("youtube: deliveryMode missing");
    if (item.status !== "approved" && item.copySource === "platform" &&
      (isText(item.canonicalRussian) || (Array.isArray(item.visualBeats) && item.visualBeats.length))) {
      // Draft text may be worked on, but an unapproved variant must never be rendered.
    }
    if (platform === "youtube" && item.publishingAuthorized !== true)
      errors.push("YouTube Shorts is an owner-authorized publication destination");
    if (platform === "tiktok" && item.publishingAuthorized !== false)
      errors.push("TikTok is not an authorized publication destination");
  }
  if (!isText(lab.offer?.canonicalRussian))
    errors.push("Canonical Instagram offer copy is missing");
  return errors;
}

export function getPlatformCtaStatus(lab, platform) {
  if (!CTA_PLATFORMS.includes(platform)) {
    throw new Error(`Unsupported video platform "${platform}"`);
  }
  const errors = validatePlatformCtaConfig(lab);
  if (errors.length) throw new Error(errors.join("; "));
  const variant = lab.platformVariants[platform];
  const text = variant.copySource === "offer"
    ? lab.offer.canonicalRussian : variant.canonicalRussian;
  const template = variant.sceneTemplate ?? variant;
  const missing = [];
  if (variant.status !== "approved") missing.push("owner approval of platform CTA");
  if (!isText(text)) missing.push("platform-specific CTA text");
  if (variant.copySource === "platform" &&
    (!Array.isArray(template.visualBeats) || !template.visualBeats.length))
    missing.push("platform-specific CTA visual beats/screenshots");
  if (variant.copySource === "platform" &&
    (!isText(template.headline) || !isText(template.screenCaption) || !isText(template.editPlan)))
    missing.push("approved CTA scene layout and cue instructions");
  if (variant.deliveryMode === "keyword-dm" && variant.automationVerified !== true)
    missing.push("real keyword-DM automation verification");
  return {
    platform,
    status: variant.status,
    readyForDraft: missing.length === 0,
    readyForRendering: missing.length === 0 && variant.publishingAuthorized === true,
    copySource: variant.copySource === "offer" ? "content/cta-lab.json#offer.canonicalRussian"
      : `content/cta-lab.json#platformVariants.${platform}.canonicalRussian`,
    copy: missing.length === 0 ? text : null,
    deliveryMode: variant.deliveryMode,
    requiresVoiceAndWordCues: true,
    missing,
    publishingAuthorized: variant.publishingAuthorized,
    destinationVerified: variant.destinationVerified === true,
    automationVerified: variant.automationVerified === true,
    warning: variant.destinationVerified !== true
      ? platform === "instagram"
        ? "Owner-approved instruction; the profile-link destination and app availability are not independently verified."
        : platform === "youtube"
          ? "Owner-approved YouTube CTA; the linked destination is not independently verified."
          : null
      : null,
  };
}

export function preparePlatformCtaDraft(baseEpisode, lab, platform) {
  const status = getPlatformCtaStatus(lab, platform);
  if (!status.readyForDraft) {
    throw new Error(`${platform} CTA is not ready: ${status.missing.join(", ")}. Do not substitute Instagram's CTA or fabricate wording.`);
  }
  if (!baseEpisode?.scenes?.length) throw new Error("A valid base lesson episode is required");
  const source = structuredClone(baseEpisode);
  const scene = source.scenes.find((item) => item.kind === "cta");
  if (!scene || source.scenes.filter((item) => item.kind === "cta").length !== 1)
    throw new Error("Exactly one CTA scene is required");
  if (platform === "instagram") {
    if (source.cta !== status.copy || scene.narration !== status.copy)
      throw new Error("Instagram episode CTA does not match the canonical approved offer. Register a new version in the working copy before rendering.");
    return source;
  }
  const variant = lab.platformVariants[platform];
  const template = variant.sceneTemplate ?? variant;
  const previousNarration = source.scenes
    .map((item) => item.narration.trim())
    .join("\n\n");
  source.cta = status.copy;
  scene.narration = status.copy;
  scene.headline = template.headline;
  scene.screenCaption = template.screenCaption;
  scene.editPlan = template.editPlan;
  scene.visualBeats = structuredClone(template.visualBeats);
  scene.cards = structuredClone(template.cards ?? []);
  source.ctaPlatform = platform;
  const nextNarration = source.scenes
    .map((item) => item.narration.trim())
    .join("\n\n");
  const sameSceneDurations = source.scenes.length === baseEpisode.scenes.length &&
    source.scenes.every((item, index) =>
      (item.durationFrames ?? item.durationSec ?? null) ===
      (baseEpisode.scenes[index].durationFrames ?? baseEpisode.scenes[index].durationSec ?? null));
  const narrationChanged = previousNarration !== nextNarration || !sameSceneDurations;
  // A platform variant always needs its own CTA registration and render
  // approval. Reuse speech/cue files when the spoken script and scene timing
  // are byte-for-byte equivalent; only the last CTA visuals then change.
  delete source.ctaExperiment;
  source.publishingStatus = "pending-owner-review";
  if (narrationChanged) {
    delete source.audioSrc;
    delete source.audioDurationMs;
    delete source.sourceAudioDurationMs;
    delete source.audioTrimAfterFrames;
    delete source.voiceTextHash;
    delete source.captions;
    source.captionSource = "pending-gemini-generation";
    for (const item of source.scenes) {
      delete item.startMs;
      delete item.endMs;
      delete item.durationFrames;
      delete item.audioSrc;
      delete item.audioHash;
      delete item.audioDurationMs;
    }
  }
  return source;
}
