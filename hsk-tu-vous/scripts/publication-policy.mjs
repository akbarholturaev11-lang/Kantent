export const APPROVED_PUBLICATION_PLATFORMS = Object.freeze([
  "instagram",
  "youtube",
]);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

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
