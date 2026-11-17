/**
 * Opt-in Gemini Direct -> OpenRouter backup for the same approved voice and model.
 * Distinct Google API keys are NOT rotated on HTTP 429.
 * Only provider availability failures may trigger a separate paid transport.
 */
/**
 * Transport for a resumed, saved-transcript clip recovery.
 * - A Direct recovery that answered every clip and still did not match goes to
 *   the OpenRouter backup once, for independent evidence.
 * - A recovery that already failed on the backup goes back to the requested
 *   transport instead of replaying the same saved backup clip responses (real
 *   2026-11-16 RU/TG takes: backup clips heard "" / "Бад Бад бад").
 * - A Direct recovery whose clip request never got an answer (network failure,
 *   real 2026-11-16 RU "比" span: "fetch failed") stays on Direct: that clip
 *   was never heard, so switching would skip it instead of retrying it.
 */
export function resumedRecoveryTransport(lastRecoveryTransport, requestedTransport, lastRecoveryUnanswered = false) {
  if (requestedTransport === "openrouter") return "openrouter";
  if (lastRecoveryTransport === "openrouter") return requestedTransport;
  return lastRecoveryUnanswered ? requestedTransport : "openrouter";
}

/** A request that got no provider answer at all (nothing was heard or billed). */
export function isUnansweredRequest(error) {
  if (isPreConnectFailure(error)) return true;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return true;
  return error instanceof TypeError && /^fetch failed$/i.test(String(error.message ?? ""));
}

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

// A reset DURING the TLS handshake is also pre-request (real 2026-11-08
// probe: "Client network socket disconnected before secure TLS connection
// was established"); any other ECONNRESET may follow a sent request.
const TLS_HANDSHAKE_RESET = /before secure TLS connection was established/i;

export function isPreConnectFailure(error) {
  const causes = [error, error?.cause, ...(error?.cause?.errors ?? [])].filter(Boolean);
  return causes.some((cause) => PRE_CONNECT_CODES.has(cause.code) ||
    (cause.code === "ECONNRESET" && TLS_HANDSHAKE_RESET.test(String(cause.message ?? ""))));
}

// Google refuses the whole API for the caller's region before generating
// anything (real 2026-11-10 run: "HTTP 400 ... User location is not supported
// for the API use", status FAILED_PRECONDITION). Another Google key cannot fix
// it and nothing was produced or billed, so it is an availability failure of
// the Direct transport, not bad input. Any other HTTP 400 stays non-eligible.
const REGION_UNSUPPORTED = /User location is not supported for the API use/i;

export function isProviderRegionUnsupported(error) {
  return fallbackHttpStatus(error) === 400 && REGION_UNSUPPORTED.test(String(error?.message ?? ""));
}

export function isOpenRouterBackupEligible(error) {
  return [429, 500, 502, 503, 504].includes(fallbackHttpStatus(error)) ||
    isPreConnectFailure(error) || isProviderRegionUnsupported(error);
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
    ...(isPreConnectFailure(error) ? { reason: "provider-unreachable" } : {}),
    ...(isProviderRegionUnsupported(error) ? { reason: "provider-region-unsupported" } : {}) };
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
