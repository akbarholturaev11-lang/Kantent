export const APPROVED_PUBLICATION_PLATFORMS = Object.freeze([
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
]);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

/** Resolve the selected account's exact approved time; retain legacy shared schedules. */
export function publicationScheduledFor(intent, platform) {
  return intent.platforms?.find((target) => target.platform === platform)?.scheduledFor
    ?? intent.scheduledFor;
}

export function validatePublicationSchedule(intent, now = Date.now()) {
  const errors = [];
  const explicitTimes = [intent.scheduledFor, ...(intent.platforms ?? []).map((target) => target.scheduledFor)]
    .filter((value) => value !== undefined);
  if (intent.mode === "now") {
    if (explicitTimes.length) errors.push("Omit scheduledFor when publishing now.");
    return errors;
  }
  for (const value of explicitTimes) {
    if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value) ||
        !Number.isFinite(Date.parse(value)) || Date.parse(value) <= now)
      errors.push("Every scheduledFor must be an exact future timestamp with an offset.");
  }
  for (const target of intent.platforms ?? []) {
    if (!publicationScheduledFor(intent, target.platform))
      errors.push(`${target.platform} needs an exact scheduledFor timestamp.`);
  }
  return errors;
}

/** Validate the exact per-platform settings stored in an owner-approved preview. */
export function validatePublicationTarget(target) {
  const errors = [];
  if (!target || typeof target !== "object" || Array.isArray(target))
    return ["Zernio publication target must be an object."];
  if (!APPROVED_PUBLICATION_PLATFORMS.includes(target.platform))
    errors.push("Platform is not an authorized video destination.");
  if (!isNonEmptyString(target.accountId) || target.accountId.length > 180)
    errors.push("A valid social account ID is required.");
  if (!isNonEmptyString(target.accountName) || target.accountName.length > 180)
    errors.push("A valid social account name is required.");
  if (!isNonEmptyString(target.caption) || target.caption.length > 2200)
    errors.push("A non-empty caption/description of at most 2200 characters is required.");
  if (target.platform === "instagram" &&
      (!target.instagramSettings ||
       typeof target.instagramSettings.shareToFeed !== "boolean" ||
       typeof target.instagramSettings.isAiGenerated !== "boolean"))
    errors.push("Instagram preview must include feed sharing and AI-label settings.");
  if (target.platform === "youtube") {
    const settings = target.youtubeSettings;
    if (!settings || !isNonEmptyString(settings.title) || settings.title.length > 100)
      errors.push("YouTube preview must include a title of 1–100 characters.");
    if (!settings || !["public", "private", "unlisted"].includes(settings.visibility))
      errors.push("YouTube preview must include public, private, or unlisted visibility.");
    if (!settings || typeof settings.madeForKids !== "boolean")
      errors.push("YouTube preview must explicitly set its made-for-kids audience value.");
    if (!settings || typeof settings.containsSyntheticMedia !== "boolean")
      errors.push("YouTube preview must explicitly set its synthetic-media disclosure value.");
  }
  if (target.platform === "tiktok") {
    const settings = target.tiktokSettings;
    const keys = ["privacy_level", "allow_comment", "allow_duet", "allow_stitch",
      "content_preview_confirmed", "express_consent_given", "video_made_with_ai",
      "commercialContentType"];
    if (!settings || typeof settings !== "object" || Array.isArray(settings) ||
        Object.keys(settings).some((key) => !keys.includes(key)) ||
        keys.some((key) => !Object.hasOwn(settings, key))) {
      errors.push("TikTok preview must include the complete current creator settings and consent fields.");
    } else {
      if (!["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"].includes(settings.privacy_level))
        errors.push("TikTok privacy_level must be explicitly selected from the current supported values.");
      for (const key of ["allow_comment", "allow_duet", "allow_stitch", "video_made_with_ai"])
        if (typeof settings[key] !== "boolean") errors.push(`TikTok ${key} must be explicitly true or false.`);
      if (settings.content_preview_confirmed !== true || settings.express_consent_given !== true)
        errors.push("TikTok requires explicit content preview confirmation and express consent.");
      if (!["none", "brand_organic", "brand_content"].includes(settings.commercialContentType))
        errors.push("TikTok commercialContentType must be explicitly selected.");
    }
  }
  return errors;
}
