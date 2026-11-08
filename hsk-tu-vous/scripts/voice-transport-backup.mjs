/**
 * Opt-in Gemini Direct -> OpenRouter backup for the same approved voice and model.
 * Distinct Google API keys are NOT rotated on HTTP 429.
 * Only provider availability failures may trigger a separate paid transport.
 */
export function fallbackHttpStatus(error) {
  const value = Number(error?.httpStatus);
  if (Number.isInteger(value) && value >= 100 && value <= 599) return value;
  const match = String(error?.message ?? "").match(/\bHTTP\s+(\d{3})\b/i);
  return match ? Number(match[1]) : 0;
}

// Failures before a TCP/TLS connection exists: the request never reached the
// provider, so it was neither generated nor billed. Real 2026-11-08 TG run:
// "fetch failed" caused by UND_ERR_CONNECT_TIMEOUT to Google aborted the take.
// Errors after the request was sent (socket reset, body timeout) are excluded.
const PRE_CONNECT_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN",
  "ENETUNREACH", "EHOSTUNREACH", "ENETDOWN",
]);

export function isPreConnectFailure(error) {
  const causes = [error, error?.cause, ...(error?.cause?.errors ?? [])].filter(Boolean);
  return causes.some((cause) => PRE_CONNECT_CODES.has(cause.code));
}

export function isOpenRouterBackupEligible(error) {
  return [429, 500, 502, 503, 504].includes(fallbackHttpStatus(error)) || isPreConnectFailure(error);
}

export function openRouterBackupKey(env = process.env, activeProvider) {
  if (activeProvider !== "gemini-direct" ||
      env.HSK_AI_OPENROUTER_FALLBACK_ENABLED !== "true") return null;
  const key = env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error(
    "OpenRouter backup is enabled but OPENROUTER_API_KEY is missing; do not start paid fallback."
  );
  return key;
}

export function fallbackEvent(stage, error) {
  return { stage, from: "gemini-direct", to: "openrouter",
    httpStatus: fallbackHttpStatus(error),
    ...(isPreConnectFailure(error) ? { reason: "provider-unreachable" } : {}) };
}

export async function withOpenRouterBackup({
  primary, backup, enabled = false, allowFallback = true, onFallback = () => {}, stage,
}) {
  try {
    return await primary();
  } catch (error) {
    if (!enabled || !allowFallback || !isOpenRouterBackupEligible(error)) throw error;
    // Switch state only after the replacement operation itself succeeds.
    const result = await backup();
    onFallback(fallbackEvent(stage, error));
    return result;
  }
}
