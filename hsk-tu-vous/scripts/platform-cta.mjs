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
    if (platform === "instagram" && item.copySource !== "offer")
      errors.push("Instagram must reference the canonical offer; do not duplicate its wording");
    if (platform !== "instagram" && item.copySource !== "platform")
      errors.push(`${platform} needs its own platform CTA wording in the same lab`);
    if (item.status === "approved" && item.copySource === "platform") {
      if (!isText(item.canonicalRussian)) errors.push(`${platform}: approved copy missing`);
      if (!Array.isArray(item.visualBeats) || !item.visualBeats.length)
        errors.push(`${platform}: approved visual beats missing`);
      if (!isText(item.headline) || !isText(item.screenCaption) || !isText(item.editPlan))
        errors.push(`${platform}: approved scene fields missing`);
      if (item.deliveryMode === "keyword-dm" && item.automationVerified !== true)
        errors.push(`${platform}: keyword DM cannot be approved before real automation is verified`);
      if (!isText(item.deliveryMode))
        errors.push(`${platform}: deliveryMode missing`);
    }
    if (item.status !== "approved" && item.copySource === "platform" &&
      (isText(item.canonicalRussian) || (Array.isArray(item.visualBeats) && item.visualBeats.length))) {
      // Draft text may be worked on, but an unapproved variant must never be rendered.
    }
    if (platform === "youtube" && item.publishingAuthorized !== false)
      errors.push("YouTube publishing requires a separate owner policy authorization");
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
  const missing = [];
  if (variant.status !== "approved") missing.push("owner approval of platform CTA");
  if (!isText(text)) missing.push("platform-specific CTA text");
  if (variant.copySource === "platform" &&
    (!Array.isArray(variant.visualBeats) || !variant.visualBeats.length))
    missing.push("platform-specific CTA visual beats/screenshots");
  if (variant.copySource === "platform" &&
    (!isText(variant.headline) || !isText(variant.screenCaption) || !isText(variant.editPlan)))
    missing.push("approved CTA scene layout and cue instructions");
  if (variant.deliveryMode === "keyword-dm" && variant.automationVerified !== true)
    missing.push("real keyword-DM automation verification");
  return {
    platform,
    status: variant.status,
    readyForDraft: missing.length === 0,
    readyForRendering: missing.length === 0 && platform === "instagram",
    copySource: variant.copySource === "offer" ? "content/cta-lab.json#offer.canonicalRussian"
      : `content/cta-lab.json#platformVariants.${platform}.canonicalRussian`,
    copy: missing.length === 0 ? text : null,
    deliveryMode: variant.deliveryMode,
    requiresVoiceAndWordCues: true,
    missing,
    publishingAuthorized: variant.publishingAuthorized,
    destinationVerified: variant.destinationVerified === true,
    automationVerified: variant.automationVerified === true,
    warning: platform === "instagram" && variant.destinationVerified !== true
      ? "Owner-approved instruction; website reachability and downloads are not independently verified."
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
  source.cta = status.copy;
  scene.narration = status.copy;
  scene.headline = variant.headline;
  scene.screenCaption = variant.screenCaption;
  scene.editPlan = variant.editPlan;
  scene.visualBeats = structuredClone(variant.visualBeats);
  scene.cards = [];
  // Explicitly invalidate all identity and derived media. A variant is a fresh
  // experiment; a previous platform's voice/render/approval cannot be reused.
  delete source.ctaExperiment;
  delete source.audioSrc;
  delete source.audioDurationMs;
  delete source.sourceAudioDurationMs;
  delete source.audioTrimAfterFrames;
  delete source.voiceTextHash;
  delete source.captions;
  source.captionSource = "pending-tts-export";
  source.publishingStatus = "pending-owner-review";
  for (const item of source.scenes) {
    delete item.startMs;
    delete item.endMs;
    delete item.durationFrames;
    delete item.audioSrc;
    delete item.audioHash;
    delete item.audioDurationMs;
  }
  return source;
}
