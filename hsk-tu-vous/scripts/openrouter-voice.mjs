/**
 * OpenRouter transport for the owner-approved Gemini voice models.
 * Keeps model/voice identity unchanged while replacing Google billing transport.
 * No automatic cross-provider fallback: failed audio must not silently regenerate.
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "https://openrouter.ai/api/v1";
const MODELS = new Set([
  "gemini-3.8-flash-lite-tts",
  "gemini-3.8-flash-tts",
  "gemini-3.5-transcribe",
]);

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

async function throwResponseError(response, operation) {
  let reason = "";
  try {
    const body = await response.json();
    reason = typeof body?.error?.message === "string" ? body.error.message : "";
  } catch {
    // Do not echo arbitrary provider responses or secrets.
  }
  throw new Error(operation + " failed (HTTP " + response.status + ")" +
    (reason ? ": " + reason.slice(0, 300) : ""));
}

function pcmToWav(bytes, sampleRate, channels) {
  if (sampleRate !== 24000 || channels !== 1) {
    throw new Error("OpenRouter PCM header requires approved 24 kHz mono voice settings.");
  }
  if (!bytes.length || bytes.length % 2 || bytes.length > 0xffffffff - 44) {
    throw new Error("OpenRouter returned empty, truncated or oversized PCM audio.");
  }
  const out = Buffer.alloc(44 + bytes.length);
  out.write("RIFF", 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * channels * 2, 28);
  out.writeUInt16LE(channels * 2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(bytes.length, 40);
  bytes.copy(out, 44);
  return out;
}

export async function synthesizeOpenRouterWav({
  apiKey, model, voice, text, style = "", sampleRateHz = 24000, channels = 1,
  fetchImpl = fetch, onAttempt = () => {},
}) {
  if (!text?.trim() || !voice?.trim()) throw new Error("OpenRouter needs text and approved voice.");
  if (style) throw new Error("OpenRouter Gemini style pass-through is not verified; refusing to ignore it.");
  const slug = openRouterModel(model);
  if (!slug.endsWith("-tts")) throw new Error("The requested model is not a TTS model.");
  onAttempt();
  const response = await fetchImpl(ROOT + "/audio/speech", {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model: slug, input: text, voice, response_format: "pcm",
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) await throwResponseError(response, "OpenRouter TTS");
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "audio/pcm" && contentType !== "application/octet-stream") {
    throw new Error("OpenRouter TTS sent unexpected audio content-type " + contentType);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return pcmToWav(bytes, sampleRateHz, channels);
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
  if (!response.ok) await throwResponseError(response, "OpenRouter transcription");
  const result = await response.json();
  if (!Array.isArray(result?.words) || result.words.length === 0) {
    throw new Error("OpenRouter transcription returned no provider word timestamps; stop before captions.");
  }
  const wordAnnotations = result.words.map((item, index) => {
    const text = item?.word ?? item?.text;
    const start = item?.start;
    const end = item?.end;
    if (typeof text !== "string" || !text.trim() ||
        typeof start !== "number" || !Number.isFinite(start) ||
        typeof end !== "number" || !Number.isFinite(end) ||
        start < 0 || end <= start) {
      throw new Error("Invalid OpenRouter provider word timestamp at index " + index);
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
