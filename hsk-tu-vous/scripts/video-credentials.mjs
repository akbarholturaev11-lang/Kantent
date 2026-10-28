/**
 * GitHub video production secret-name registry.
 * Never echo secret values. No API requests, video rendering or publication here.
 */
export const GEMINI_SECRET_NAMES = Object.freeze([
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_BACKUP_1",
  "GEMINI_API_KEY_BACKUP_2",
  "GEMINI_API_KEY_BACKUP_3",
]);

export const ZERNIO_SECRET_NAMES = Object.freeze({
  ru: ["ZERNIO_RU_API_KEY", "ZERNIO_API_KEY"],
  tg: ["ZERNIO_TG_API_KEY"],
});

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

/**
 * Enabled social destinations are intentionally asymmetric until the owner
 * connects a Tajik YouTube channel. Never infer that a missing account ID
 * may be substituted with the Russian YouTube channel.
 */
export const VIDEO_PLATFORM_TARGETS = Object.freeze({
  ru: Object.freeze(["instagram", "youtube"]),
  tg: Object.freeze(["instagram"]),
});

export function enabledVideoPlatforms(language) {
  const platforms = VIDEO_PLATFORM_TARGETS[language];
  if (!platforms) throw Error("Unsupported video language " + language);
  return [...platforms];
}

export function zernioTargetAccount(language, platform, env = process.env) {
  if (!enabledVideoPlatforms(language).includes(platform)) {
    throw Error("Zernio " + language + "/" + platform + " is not enabled or has no connected destination.");
  }
  const variable = "ZERNIO_" + language.toUpperCase() + "_" + platform.toUpperCase() + "_ACCOUNT_ID";
  const accountId = typeof env[variable] === "string" ? env[variable].trim() : "";
  if (!/^[a-f0-9]{24}$/.test(accountId)) {
    throw Error("Missing/invalid " + variable + " Actions variable; never guess an account or cross language.");
  }
  return { language, platform, accountId, variable };
}

export function zernioRoute(language, env = process.env) {
  if (language !== "ru" && language !== "tg") throw Error("Unsupported Zernio content language: " + language);
  const names = ZERNIO_SECRET_NAMES[language];
  const matching = names.filter((name) => typeof env[name] === "string" && env[name].trim());
  // Do not silently prefer conflicting legacy/new RU credentials.
  if (matching.length > 1 && env[matching[0]].trim() !== env[matching[1]].trim()) {
    throw Error("Zernio RU: conflicting legacy and named credentials; fix mapping before posting.");
  }
  const keyName = matching[0];
  if (!keyName) throw Error("No Zernio " + language + " API key; never route to another language's account.");
  return { language, secretName: keyName, secret: env[keyName].trim() };
}

export function credentialReadiness(env = process.env) {
  const names = geminiKeySlots(env).map(({name}) => name);
  return {
    geminiKeyNames: names,
    geminiBackupCount: Math.max(0, names.length - 1),
    zernio: {
      ru: ZERNIO_SECRET_NAMES.ru.filter(n => Boolean(env[n])).map(n => n),
      tg: ZERNIO_SECRET_NAMES.tg.filter(n => Boolean(env[n])).map(n => n),
    },
    includesSecretValues: false,
  };
}
