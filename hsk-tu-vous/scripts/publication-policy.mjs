export const APPROVED_PUBLICATION_PLATFORMS = Object.freeze([
  "instagram",
  "youtube",
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
    errors.push("Only Instagram Reels and YouTube Shorts are currently authorized.");
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
  return errors;
}
