/**
 * OpenRouter transport for the owner-approved Gemini voice models.
 * Keeps model/voice identity unchanged while replacing Google billing transport.
 * Cross-provider backup is opt-in and lives in voice-transport-backup.mjs; saved
 * audio is never silently regenerated.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { isPreConnectFailure } from "./voice-transport-backup.mjs";

const ROOT = "https://openrouter.ai/api/v1";
const MODELS = new Set([
  "gemini-3.8-flash-lite-tts",
  "gemini-3.8-flash-tts",
  "gemini-3.5-transcribe",
]);

export class TranscriptionResponseError extends Error {
  constructor(message, { retryable = false, httpStatus } = {}) {
    super(message);
    this.name = "TranscriptionResponseError";
    this.retryable = retryable;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
  }
}

export function isRetryableTranscriptionError(error) {
  if (error?.retryable === true) return true;
  return ["AbortError", "TimeoutError"].includes(error?.name) ||
    (error?.name === "TypeError" && /fetch|network|connect/i.test(error.message ?? ""));
}

// Fresh bounded STT attempts per chunk in EACH run on the same saved audio.
export const STT_ATTEMPTS_PER_RUN = 3;

export async function transcribeUntilAligned({
  transcribe,
  align,
  previousAttempts = 0,
  maxAttempts = 3,
  onAttempt = () => {},
  onRetry = () => {},
}) {
  if (typeof transcribe !== "function" || typeof align !== "function")
    throw new TypeError("Transcription retry needs transcribe and align functions.");
  if (!Number.isInteger(previousAttempts) || previousAttempts < 0 ||
      !Number.isInteger(maxAttempts) || maxAttempts < 1 || previousAttempts > maxAttempts)
    throw new RangeError("Transcription attempt budget is invalid.");

  let attempts = previousAttempts;
  let transcription;
  let alignment;
  while (!alignment?.captions && attempts < maxAttempts) {
    attempts += 1;
    await onAttempt(attempts);
    try {
      transcription = await transcribe(attempts);
    } catch (error) {
      const retryable = isRetryableTranscriptionError(error);
      if (!retryable || attempts >= maxAttempts)
        return { attempts, transcription: null, alignment: null, error, retryable };
      await onRetry(error, attempts);
      continue;
    }
    try {
      alignment = align(transcription);
    } catch (error) {
      if (attempts >= maxAttempts)
        return { attempts, transcription, alignment: null, error, retryable: false };
      await onRetry(error, attempts);
      continue;
    }
    if (!alignment?.captions && attempts < maxAttempts)
      await onRetry(new TranscriptionResponseError("Transcript did not match source narration.", { retryable: true }), attempts);
  }
  return { attempts, transcription, alignment, error: null, retryable: false };
}

export function resolveVoiceApi(env = process.env) {
  const provider = (env.HSK_AI_VOICE_API_PROVIDER || "openrouter").trim();
  if (provider !== "openrouter" && provider !== "gemini-direct") {
    throw new Error("HSK_AI_VOICE_API_PROVIDER must be openrouter or gemini-direct.");
  }
  return provider;
}

export function requireOpenRouterKey(env = process.env) {
  const key = env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is required for the primary OpenRouter voice API.");
  return key;
}

export function openRouterModel(model) {
  if (!MODELS.has(model)) throw new Error("OpenRouter model is not approved for this voice profile.");
  return "google/" + model;
}

function authHeaders(apiKey) {
  return { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" };
}

async function throwResponseError(response, operation, { retryableStatuses = false } = {}) {
  let reason = "";
  try {
    const body = await response.json();
    reason = typeof body?.error?.message === "string" ? body.error.message : "";
  } catch {
    // Do not echo arbitrary provider responses or secrets.
  }
  const message = operation + " failed (HTTP " + response.status + ")" +
    (reason ? ": " + reason.slice(0, 300) : "");
  if (retryableStatuses) {
    throw new TranscriptionResponseError(message, {
      httpStatus: response.status,
      retryable: response.status === 408 || response.status === 409 ||
        response.status === 425 || response.status === 429 || response.status >= 500,
    });
  }
  throw new Error(message);
}

/**
 * V-14: the response's own PCM format decides the WAV header. Writing a fixed
 * 24 kHz mono header over audio declared at another rate/channel count would
 * play it at the wrong speed/pitch, fail STT and waste the paid take.
 */
export function parsePcmFormat(contentType, requested = { sampleRate: 24000, channels: 1 }) {
  const params = Object.fromEntries(String(contentType ?? "").split(";").slice(1)
    .map((part) => part.split("=").map((value) => value?.trim().toLowerCase()))
    .filter(([name, value]) => name && value));
  const rateText = params.rate ?? params.samplerate ?? params.sample_rate;
  const channelText = params.channels;
  const sampleRate = rateText === undefined ? requested.sampleRate : Number(rateText);
  const channels = channelText === undefined ? requested.channels : Number(channelText);
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 ||
      !Number.isInteger(channels) || channels < 1 || channels > 2)
    throw new Error("OpenRouter TTS declared an unsupported PCM format.");
  for (const name of ["bits", "bitdepth", "sample_size"])
    if (params[name] !== undefined && params[name] !== "16")
      throw new Error("OpenRouter TTS declared non-16-bit PCM; refusing to mislabel it.");
  if (params.encoding !== undefined && !["s16le", "pcm_s16le", "signed-integer"].includes(params.encoding))
    throw new Error("OpenRouter TTS declared an unsupported PCM encoding.");
  return { sampleRate, channels };
}

function pcmToWav(bytes, sampleRate, channels, declared = { sampleRate, channels }) {
  if (sampleRate !== 24000 || channels !== 1) {
    throw new Error("OpenRouter PCM header requires approved 24 kHz mono voice settings.");
  }
  const frameBytes = declared.channels * 2;
  if (!bytes.length || bytes.length % frameBytes || bytes.length > 0xffffffff - 44) {
    throw new Error("OpenRouter returned empty, truncated or oversized PCM audio.");
  }
  // FFmpeg later resamples every chunk to the approved 24 kHz mono master.
  const out = Buffer.alloc(44 + bytes.length);
  out.write("RIFF", 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(declared.channels, 22);
  out.writeUInt32LE(declared.sampleRate, 24);
  out.writeUInt32LE(declared.sampleRate * frameBytes, 28);
  out.writeUInt16LE(frameBytes, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(bytes.length, 40);
  bytes.copy(out, 44);
  return out;
}

// V-15: an HTTP error RESPONSE (429/5xx) or a failure to connect at all carries
// no audio, so one bounded retry cannot buy a second take. A timeout or abort
// after the request was sent may have produced billed audio we never
// received, so it is never retried automatically.
export const OPENROUTER_TTS_MAX_ATTEMPTS = 2;
const TTS_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_TTS_RETRY_WAIT_MS = 30000;

function ttsRetryWaitMs(response, attempt) {
  const header = response.headers.get("retry-after");
  if (header === null) return 2000 * attempt;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, ms) : null;
}

export async function synthesizeOpenRouterWav({
  apiKey, model, voice, text, style = "", sampleRateHz = 24000, channels = 1,
  fetchImpl = fetch, onAttempt = () => {}, maxAttempts = OPENROUTER_TTS_MAX_ATTEMPTS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!text?.trim() || !voice?.trim()) throw new Error("OpenRouter needs text and approved voice.");
  if (style) throw new Error("OpenRouter Gemini style pass-through is not verified; refusing to ignore it.");
  const slug = openRouterModel(model);
  if (!slug.endsWith("-tts")) throw new Error("The requested model is not a TTS model.");
  let response;
  for (let attempt = 1; ; attempt += 1) {
    onAttempt();
    try {
      response = await fetchImpl(ROOT + "/audio/speech", {
        method: "POST",
        headers: authHeaders(apiKey),
        body: JSON.stringify({
          model: slug, input: text, voice, response_format: "pcm",
        }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (error) {
      // Never connected: nothing was generated or billed, so retry is safe.
      if (!isPreConnectFailure(error) || attempt >= maxAttempts) throw error;
      await sleep(2000 * attempt);
      continue;
    }
    if (response.ok) break;
    const waitMs = TTS_RETRY_STATUSES.has(response.status) && attempt < maxAttempts
      ? ttsRetryWaitMs(response, attempt) : null;
    if (waitMs === null || waitMs > MAX_TTS_RETRY_WAIT_MS)
      await throwResponseError(response, "OpenRouter TTS");
    await response.body?.cancel().catch(() => {});
    await sleep(waitMs);
  }
  const fullType = response.headers.get("content-type") ?? "";
  const contentType = fullType.split(";")[0].trim().toLowerCase();
  if (contentType !== "audio/pcm" && contentType !== "application/octet-stream") {
    throw new Error("OpenRouter TTS sent unexpected audio content-type " + contentType);
  }
  const declared = parsePcmFormat(fullType, { sampleRate: sampleRateHz, channels });
  const bytes = Buffer.from(await response.arrayBuffer());
  return pcmToWav(bytes, sampleRateHz, channels, declared);
}

export async function transcribeOpenRouter({
  apiKey, model, audioPath, fetchImpl = fetch, readFile = fs.readFile,
}) {
  const slug = openRouterModel(model);
  if (!slug.endsWith("-transcribe")) throw new Error("The requested model is not transcription.");
  const format = path.extname(audioPath).slice(1).toLowerCase();
  if (format !== "mp3" && format !== "wav") {
    throw new Error("Only MP3/WAV input is approved for OpenRouter transcription.");
  }
  const bytes = await readFile(audioPath);
  if (!bytes.length) throw new Error("Cannot transcribe empty audio.");
  const response = await fetchImpl(ROOT + "/audio/transcriptions", {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model: slug,
      input_audio: { data: bytes.toString("base64"), format },
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      // Intentionally no single-language hint: narration mixes Russian/Tajik and Mandarin.
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) await throwResponseError(response, "OpenRouter transcription", { retryableStatuses: true });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new TranscriptionResponseError("OpenRouter transcription returned malformed JSON.", { retryable: true });
  }
  if (!Array.isArray(result?.words) || result.words.length === 0) {
    throw new TranscriptionResponseError("OpenRouter transcription returned no provider word timestamps; retry STT before captions.", { retryable: true });
  }
  const wordAnnotations = result.words.map((item, index) => {
    const text = item?.word ?? item?.text;
    const start = item?.start;
    const end = item?.end;
    if (typeof text !== "string" || !text.trim() ||
        typeof start !== "number" || !Number.isFinite(start) ||
        typeof end !== "number" || !Number.isFinite(end) ||
        // V8-01 policy, as on Gemini Direct: a zero-length or slightly
        // inverted word (≤250 ms, real OpenRouter window 2026-11-08) is passed
        // through unchanged; the shared aligner repairs it with a 1 ms end
        // and still rejects anything larger. Nothing is invented here.
        start < 0 || end < 0 || end < start - 0.25) {
      throw new TranscriptionResponseError("Invalid OpenRouter provider word timestamp at index " + index, { retryable: true });
    }
    return {
      text,
      startOffset: start.toFixed(3) + "s",
      endOffset: end.toFixed(3) + "s",
    };
  });
  return {
    transcript: typeof result.text === "string" ? result.text : wordAnnotations.map(x => x.text).join(" "),
    wordAnnotations,
  };
}
