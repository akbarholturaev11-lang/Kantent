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
 * shared Google project quota. Auth rejection can try another configured key.
 * Quota fallback is off unless independently validated project isolation has
 * explicitly been configured; never assume keys imply separate quotas.
 */
export function geminiRotationDecision({ httpStatus, reason = "", separateProjectsVerified = false } = {}) {
  if (httpStatus === 401) return { rotate: true, classification: "invalid-credential" };
  if (httpStatus === 403 && /API_KEY_INVALID|API_KEY_REVOKED|API_KEY_EXPIRED|PERMISSION_DENIED|key (?:invalid|expired|revoked)/i.test(reason)) {
    return { rotate: true, classification: "credential-rejected" };
  }
  if (httpStatus === 429) {
    return { rotate: separateProjectsVerified === true, classification: "quota-exceeded" };
  }
  return { rotate: false, classification: "not-safe-to-rotate" };
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
