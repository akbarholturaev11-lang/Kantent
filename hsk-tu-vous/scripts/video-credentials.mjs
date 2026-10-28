import fs from "node:fs";

const PUBLICATION_DESTINATIONS = JSON.parse(
  fs.readFileSync(new URL("../content/publication-destinations.json", import.meta.url), "utf8"),
);

/**
 * GitHub video production secret-name registry.
 * Never echo secret values. No API requests, video rendering or publication here.
 */
export const GEMINI_SECRET_NAMES = Object.freeze([
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_BACKUP_1",
  "GEMINI_API_KEY_BACKUP_2",
  "GEMINI_API_KEY_BACKUP_3",
  // Compatibility with the existing local .env.local numeric key slots.
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
  "GEMINI_API_KEY_4",
  "GEMINI_API_KEY_5",
]);

export const ZERNIO_SECRET_NAMES = Object.freeze({
  "ru-primary": ["ZERNIO_RU_API_KEY", "ZERNIO_API_KEY"],
  "tg-primary": ["ZERNIO_TG_API_KEY"],
  "tiktok-telegram": ["ZERNIO_TIKTOK_TELEGRAM_API_KEY"],
  "tiktok-facebook": ["ZERNIO_TIKTOK_FACEBOOK_API_KEY"],
});
export const SOCIAL_CONNECTION_GROUPS = Object.freeze(Object.keys(ZERNIO_SECRET_NAMES));

export function geminiKeySlots(env = process.env) {
  const seen = new Set();
  return GEMINI_SECRET_NAMES.flatMap((name) => {
    const value = typeof env[name] === "string" ? env[name].trim() : "";
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [{ name, secret: value }];
  });
}

export function requireGeminiKeySlots(env = process.env) {
  const slots = geminiKeySlots(env);
  if (!slots.length) throw Error("No configured Gemini credential (set GEMINI_API_KEY, backups optional).");
  return slots;
}

/** Initial key selection is allowed even if the primary secret is missing. */
export function initialGeminiCredential(env = process.env) {
  return requireGeminiKeySlots(env)[0];
}

/**
 * Errors must not cause blind re-tries or rotate credentials just to exceed a
 * Google API quota. Auth rejection can try another configured key.
 * The provider forbids bypassing API usage limits through multiple accounts
 * or projects. HTTP 429 never rotates credentials; use backoff and authorized
 * quota increases instead.
 */
export function geminiRotationDecision({ httpStatus, reason = "" } = {}) {
  if (httpStatus === 401) return { rotate: true, classification: "invalid-credential" };
  if (httpStatus === 403 && /API_KEY_INVALID|API_KEY_REVOKED|API_KEY_EXPIRED|PERMISSION_DENIED|key (?:invalid|expired|revoked)/i.test(reason)) {
    return { rotate: true, classification: "credential-rejected" };
  }
  if (httpStatus === 429) {
    return { rotate: false, classification: "quota-exceeded" };
  }
  return { rotate: false, classification: "not-safe-to-rotate" };
}

/**
 * Rotate only at a safe standalone request boundary (not between a Gemini
 * upload and its transcription or cleanup). Never retry after any successful
 * TTS response: this prevents two different generated voice takes.
 * Caller supplies its current progress object and a single API operation.
 */
export async function withGeminiKeyFailover(state, operation) {
  if (!state || !Array.isArray(state.slots) || !state.slots.length)
    throw Error("Missing configured Gemini keyring.");
  if (!Number.isInteger(state.index) || state.index < 0 || state.index >= state.slots.length)
    throw Error("Invalid Gemini credential selection.");
  for (;;) {
    const slot = state.slots[state.index];
    try {
      return await operation(slot.secret, slot.name);
    } catch (error) {
      const match = String(error?.message ?? "").match(/\bHTTP (\d{3})\b/);
      const httpStatus = Number(error?.httpStatus ?? match?.[1]) || 0;
      const choice = geminiRotationDecision({
        httpStatus,
        reason: String(error?.message ?? ""),
      });
      if (!choice.rotate || state.index + 1 >= state.slots.length) throw error;
      state.index++;
      // No secret values or full error responses in logs.
      console.warn("Gemini " + choice.classification + ": moving to credential " +
        state.slots[state.index].name + " for a new standalone request.");
    }
  }
}

/** Review targets are derived from the canonical language/account map. */
export const VIDEO_PLATFORM_TARGETS = Object.freeze(Object.fromEntries(
  Object.entries(PUBLICATION_DESTINATIONS.videoDestinations ?? {}).map(([language, route]) => [
    language,
    Object.freeze(Object.entries(route.platforms ?? {})
      .filter(([, destination]) => destination.ownerAuthorized === true)
      .map(([platform]) => platform)),
  ]),
));

export function enabledVideoPlatforms(language) {
  const platforms = VIDEO_PLATFORM_TARGETS[language];
  if (!platforms) throw Error("Unsupported video language " + language);
  return [...platforms];
}

export function zernioTargetAccount(language, platform, env = process.env) {
  const destination = PUBLICATION_DESTINATIONS.videoDestinations?.[language]?.platforms?.[platform];
  if (!destination || destination.ownerAuthorized !== true || typeof destination.account !== "string")
    throw Error("Zernio " + language + "/" + platform + " is not an owner-authorized video destination.");
  const verified = destination.verifiedAccountId;
  const credentialGroup = destination.credentialGroup;
  if (!/^[a-f0-9]{24}$/.test(verified ?? "") || !ZERNIO_SECRET_NAMES[credentialGroup])
    throw Error("No verified Zernio account ID/credential group for " + language + "/" + platform);
  const variable = "ZERNIO_" + language.toUpperCase() + "_" + platform.toUpperCase() + "_ACCOUNT_ID";
  const configured = typeof env[variable] === "string" ? env[variable].trim() : "";
  // Public account IDs (not API secrets) are bound to the owner's canonical map.
  // An Actions Variable may override only if it exactly matches the verified ID.
  if (configured && configured !== verified)
    throw Error(variable + " conflicts with the verified owner account map; refuse cross-language posting.");
  return { language, platform, accountId: verified, variable, expectedUsername: destination.account,
    credentialGroup };
}

export function assertZernioPublishingAuthorized(language, platform) {
  const destination = PUBLICATION_DESTINATIONS.videoDestinations?.[language]?.platforms?.[platform];
  if (!destination || destination.ownerAuthorized !== true || destination.zernioPublishingAuthorized !== true)
    throw Error("Zernio publishing is disabled for " + language + "/" + platform + "; use its owner-directed manual publishing route.");
}

/** This chooses the actual Zernio connection, NOT the language label alone.
 * RU TikTok and TG Telegram are in one connection. TG TikTok and Facebook
 * are in another connection. Neither key may silently fall back to RU/TG primary.
 */
export function zernioRoute(language, env = process.env, platform = "instagram") {
  const destination = zernioTargetAccount(language, platform, env);
  const group = destination.credentialGroup;
  const names = ZERNIO_SECRET_NAMES[group];
  const matching = names.filter((name) => typeof env[name] === "string" && env[name].trim());
  if (matching.length > 1 && env[matching[0]].trim() !== env[matching[1]].trim()) {
    throw Error("Zernio " + group + ": conflicting legacy and named credentials; fix mapping before posting.");
  }
  const keyName = matching[0];
  if (!keyName) throw Error("No Zernio API key for " + group + "; never use another Zernio connection.");
  return { language, platform, group, secretName: keyName, secret: env[keyName].trim() };
}

export function telegramNewsRoute(env = process.env) {
  const telegram = PUBLICATION_DESTINATIONS.otherDestinations?.telegram;
  if (telegram?.language !== "tg" || telegram?.videoPublishingAuthorized !== false ||
      telegram?.cadenceDays !== 3 || !/^[a-f0-9]{24}$/.test(telegram?.verifiedAccountId ?? "") ||
      telegram?.credentialGroup !== "tiktok-telegram" || telegram?.account !== "@aibotsakbar")
    throw Error("Telegram TJ text-news route differs from owner's canonical rules.");
  const variable = "ZERNIO_TG_TELEGRAM_ACCOUNT_ID";
  const configured = typeof env[variable] === "string" ? env[variable].trim() : "";
  if (configured && configured !== telegram.verifiedAccountId)
    throw Error("Telegram account ID conflicts with verified route.");
  const secretName = ZERNIO_SECRET_NAMES["tiktok-telegram"].find(name => env[name]?.trim());
  if (!secretName) throw Error("Missing TikTok/Telegram Zernio connection key.");
  return {accountId:telegram.verifiedAccountId,expectedUsername:"aibotsakbar",
    platform:"telegram",language:"tg",group:"tiktok-telegram",secretName,secret:env[secretName].trim()};
}

export function credentialReadiness(env = process.env) {
  const names = geminiKeySlots(env).map(({name}) => name);
  return {
    geminiKeyNames: names,
    geminiBackupCount: Math.max(0, names.length - 1),
    zernio: {
      ru: ZERNIO_SECRET_NAMES["ru-primary"].filter(n => Boolean(env[n])),
      tg: ZERNIO_SECRET_NAMES["tg-primary"].filter(n => Boolean(env[n])),
      groups: Object.fromEntries(Object.entries(ZERNIO_SECRET_NAMES)
        .map(([group,keys])=>[group,keys.filter(name=>Boolean(env[name]))])),
    },
    includesSecretValues: false,
  };
}
