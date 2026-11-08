import fs from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  atomicWriteFile, atomicWriteJson, findReusableVoiceCheckpoint, findUnresumableSavedTakes,
  isValidWavBuffer, matchesRecordedAudioHash, matchesRecordedWavChunk, measureWavQuality, sha256,
} from "./voice-checkpoint.mjs";
import { assertNotPreviouslyPublished } from "./published-evidence.mjs";
import { hasCurrentImportedVoice } from "./voice-import-state.mjs";
import { requireSystemMediaTools } from "./media-duration.mjs";
import { buildRecoveryPlan, selectRecoveredBlocks, mergeRecoveredBlocks } from "./gemini-word-recovery.mjs";
import { createContinuousTtsChunks } from "./continuous-tts-plan.mjs";
import { offsetAnnotations, parseSilences, planSttWindows, windowsTouching } from "./stt-windows.mjs";
import { redactCredentials, requireGeminiKeySlots, withGeminiKeyFailover } from "./video-credentials.mjs";
import {
  resolveVoiceApi, requireOpenRouterKey, synthesizeOpenRouterWav,
  transcribeOpenRouter, transcribeUntilAligned, TranscriptionResponseError, openRouterLanguage,
  OPENROUTER_TTS_MAX_ATTEMPTS, STT_ATTEMPTS_PER_RUN,
} from "./openrouter-voice.mjs";
import { isPreConnectFailure, openRouterBackupKey, withOpenRouterBackup } from "./voice-transport-backup.mjs";
import {
  alignSpokenTokens, buildHanziReadings, collectHanziPinyinPairs, createSpokenMatcher,
} from "./spoken-token-match.mjs";
import { requireFreshGitMain } from "./git-freshness.mjs";
import { validateLessonPresentation } from "./lesson-presentation-policy.mjs";
import { languageEnvironment, languageSettings } from "./language-context.mjs";
import {
  assertReusableVoiceMetadata,
  assertVoiceEpisodeLanguage,
  normalizeVoiceToken,
  voiceTranscriptionLanguages,
} from "./voice-language.mjs";
import {
  PROJECT_ROOT,
  narrationHash,
  normalizeEpisode,
  readJson,
  writeJson,
  writeStatus,
  getEpisode,
  readStatus,
  requireApprovedVoiceProfile,
  requireCurrentCta,
  reviewDir,
  validateEpisode,
} from "./lib.mjs";

const API_ROOT = "https://generativelanguage.googleapis.com";
const API_REVISION = "2026-05-20";
// Owner decision 2026-11-08 after listening to the bi-comparison RU/TG A/B:
// one exact unchanged narration take per language is the DEFAULT (fewer
// requests, no scene-joint stretching, steadier Tajik accent).
// HSK_AI_TTS_MODE=scene keeps the older per-scene takes on explicit request.
const TTS_MODE_SETTING = (process.env.HSK_AI_TTS_MODE ?? "one-take").trim() || "one-take";
if (!["one-take", "scene"].includes(TTS_MODE_SETTING))
  throw new Error("HSK_AI_TTS_MODE must be one-take (default) or scene.");
const ONE_TAKE = TTS_MODE_SETTING === "one-take";
const EPISODE_ID = process.argv[2];
const CLI_OPTIONS = process.argv.slice(3);
let PLATFORM;
let RESUME_FOLDER_NAME;
// Explicit owner decision after listening: buy a new paid take even though a
// saved take of the same narration exists. Never chosen automatically.
let NEW_TAKE = false;
for (let index = 0; index < CLI_OPTIONS.length; index += 1) {
  const option = CLI_OPTIONS[index];
  if (option === "--platform" && !PLATFORM) {
    PLATFORM = CLI_OPTIONS[++index];
  } else if (option === "--resume" && !RESUME_FOLDER_NAME) {
    RESUME_FOLDER_NAME = CLI_OPTIONS[++index];
  } else if (option === "--new-take" && !NEW_TAKE) {
    NEW_TAKE = true;
  } else {
    throw new Error("Use [--platform tiktok] [--resume <generation-folder> | --new-take].");
  }
}
if (NEW_TAKE && RESUME_FOLDER_NAME) throw new Error("--new-take and --resume are mutually exclusive.");

function requireEpisodeId(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "")) {
    throw new Error(
      "Foydalanish: npm run content:voice -- <episode-ID> [--resume <generation-folder> | --new-take]",
    );
  }
  return value;
}

async function loadVoiceEnvironment(profile) {
  const provider = resolveVoiceApi(process.env);
  if (typeof process.loadEnvFile === "function" &&
      (!process.env.OPENROUTER_API_KEY || !process.env.GEMINI_API_KEY)) {
    try {
      process.loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const apiProvider = resolveVoiceApi(process.env);
  let apiKey;
  let credentialState = null;
  if (apiProvider === "openrouter") {
    apiKey = requireOpenRouterKey(process.env);
  } else {
    if (process.env.HSK_AI_ALLOW_GEMINI_API !== "true") {
      throw new Error("Direct Gemini API requires HSK_AI_ALLOW_GEMINI_API=true.");
    }
    const slots = requireGeminiKeySlots(process.env);
    credentialState = { slots, index: 0 };
    apiKey = slots[0].secret;
  }
  // Owner-enabled Gemini Direct -> OpenRouter backup (PR #56). Never a
  // Google key rotation on quota; only a separate, explicitly enabled transport.
  const backupKey = openRouterBackupKey(process.env, apiProvider);
  return {
    apiProvider, apiKey, credentialState,
    openRouterBackupKey: backupKey,
    ttsTransport: apiProvider,
    transcriptionTransport: apiProvider,
    fallbackEvents: [],
    completedTtsChunks: 0,
    ttsRequestCount: 0,
    ttsModel: profile.ttsModel,
    voice: profile.voiceName,
    transcribeModel: profile.transcriptionModel,
    style: profile.spokenStyle || "",
    mp3BitrateKbps: profile.mp3BitrateKbps,
    sampleRateHz: profile.sampleRateHz,
    channels: profile.channels,
  };
}

async function requestJson(url, options, label, { maxAttempts = 4, onAttempt } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    onAttempt?.();
    let response;
    try {
      response = await fetch(url, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(120_000),
      });
    } catch (error) {
      // Only a failure BEFORE the connection exists is retried here: the
      // request never reached Google. Anything later is not repeated blindly.
      if (!isPreConnectFailure(error) || attempt >= maxAttempts) throw error;
      const delayMs = 2000 * 2 ** (attempt - 1);
      console.warn(`${label} could not connect to Google; retrying in ${delayMs / 1000}s (${attempt}/${maxAttempts - 1}).`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`${label}: Gemini returned a non-JSON response.`);
      }
    }
    if (response.ok) return { data, headers: response.headers };

    const detail = data?.error?.message;
    // A per-day Free Tier cap cannot reset within this run. Do not waste
    // retries or rotate accounts against the provider's daily quota.
    if (response.status === 429 && /requests per day|per-day quota/i.test(detail ?? "")) {
      throw new Error(`${label} blocked by Gemini's daily quota (HTTP 429)${detail ? `: ${detail}` : ""}`);
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < maxAttempts) {
      // A 429 may specify when the model's per-minute bucket resets.
      // Honor that period rather than retrying at 2/4/8 seconds.
      const retrySeconds = Number(detail?.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i)?.[1]);
      const delayMs = response.status === 429
        ? Math.min(90_000, Math.max(20_000, Number.isFinite(retrySeconds) && retrySeconds > 0
          ? Math.ceil(retrySeconds * 1000) + 1500
          : 20_000 * attempt))
        : 1000 * 2 ** attempt;
      console.warn(
        `${label} returned HTTP ${response.status}; retrying in ${delayMs / 1000}s (${attempt}/${maxAttempts - 1}).`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    throw new Error(
      `${label} failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts.`);
}

function getAudioData(interaction) {
  const blocks = (interaction.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((block) => block.type === "audio" && block.data);
  const encoded = interaction.output_audio?.data ?? blocks.at(-1)?.data;
  if (!encoded) throw new Error("Gemini TTS javobida audio topilmadi.");
  return Buffer.from(encoded, "base64");
}

function getWordAnnotations(interaction) {
  return (interaction.steps ?? [])
    .flatMap((step) => step.content ?? [])
    .flatMap((content) => content.annotations ?? [])
    .filter(
      (annotation) =>
        annotation.type === "word_info" &&
        typeof annotation.text === "string" &&
        annotation.start_offset !== undefined &&
        annotation.end_offset !== undefined,
    );
}

function parseOffsetMs(offset) {
  if (typeof offset === "number" && Number.isFinite(offset)) {
    return Math.round(offset * 1000);
  }
  if (typeof offset === "string") {
    const match = offset.match(/^(-?\d+(?:\.\d+)?)s$/);
    if (match) return Math.round(Number(match[1]) * 1000);
  }
  throw new Error(`Gemini word timestamp format not recognized: ${offset}`);
}

const wordTokenPattern = /[\p{L}\p{N}]+(?:[-‐‑‒–—][\p{L}\p{N}]+)*/gu;

function tokenParts(value) {
  const transcriptionAliases = {
    цай: "цзай",
    тя: "цзя",
    我: "во",
    想: "сян",
    喝: "хэ",
    茶: "ча",
    要: "яо",
    一: "и",
    杯: "бэй",
    水: "шуй",
    ...(voiceProfile.locale === "tg-TJ"
      ? {
          二: "эр",
          两: "лян",
          兩: "лян",
          十: "ши",
          第: "ди",
          ...(EPISODE_ID === "er-vs-liang-cafe-20261026"
            ? {
                亮: "лян",
                量: "лян",
                мехоҳи: "мехоҳӣ",
                дигари: "дигаре",
                чи: "чӣ",
                руи: "рӯйи",
                руйи: "рӯйи",
                кон: "кун",
              }
            : {}),
        }
      : {}),
  };
  return (value.match(wordTokenPattern) ?? []).flatMap((token) => {
    const normalized = normalizeVoiceToken(token, voiceProfile.locale);
    if (
      voiceProfile.locale === "tg-TJ" &&
      /^hsk[-‐‑‒–—]?ai[-‐‑‒–—]?ро$/u.test(normalized)
    ) {
      return ["hsk", "ai", "ро"];
    }
    if (
      voiceProfile.locale === "tg-TJ" &&
      /^ai[-‐‑‒–—]?ро$/u.test(normalized)
    ) {
      return ["ai", "ро"];
    }
    // Mandarin transcripts may time each Hanzi syllable separately even when
    // the written narration has no spaces. Keep the source phrase as one
    // caption word while aligning its characters against those timed units.
    if (/^\p{Script=Han}+$/u.test(normalized)) {
      return Array.from(normalized, (character) =>
        transcriptionAliases[character] ?? character,
      );
    }
    return [transcriptionAliases[normalized] ?? normalized];
  });
}

function spokenParts(token) {
  if (token === "hsk") return ["эйч", "эс", "кей"];
  if (token === "ai") return ["эй", "ай"];
  // Real RU one-take window 2026-11-08: "Попробуй HSKAI." for "HSK AI".
  if (token === "hskai") return ["эйч", "эс", "кей", "эй", "ай"];
  if (token === "сюэсяо") return ["сюэ", "сяо"];
  return [token];
}

function sourceWords(text) {
  const matches = [...text.matchAll(wordTokenPattern)];
  return matches.map((match, index) => {
    const end =
      index + 1 < matches.length ? matches[index + 1].index : text.length;
    const gap = text.slice(match.index + match[0].length, end);
    const punctuation = gap.match(/^[»”"']*([,.!?;:…])/u)?.[1] ?? "";
    return {
      display: `${match[0]}${punctuation}`,
      normalized: tokenParts(match[0]),
    };
  });
}

function flattenExpected(words) {
  return words.flatMap((word, wordIndex) =>
    word.normalized.flatMap((token) =>
      spokenParts(token).map((text) => ({ text, wordIndex })),
    ),
  );
}

function flattenRecognized(annotations, audioDurationMs, timingRepairs) {
  let previousStartMs = -1;
  let previousEndMs = -1;
  return annotations.flatMap((annotation, index) => {
    const rawStartMs = parseOffsetMs(
      annotation.start_offset ?? annotation.startOffset,
    );
    const rawEndMs = parseOffsetMs(annotation.end_offset ?? annotation.endOffset);
    if (
      rawStartMs < 0 ||
      rawEndMs < 0 ||
      rawStartMs > audioDurationMs + 100 ||
      rawEndMs > audioDurationMs + 100
    ) {
      throw new Error("Gemini returned an invalid word timing.");
    }
    let startMs = rawStartMs;
    if (rawStartMs < previousStartMs) {
      const correctionMs = previousStartMs - rawStartMs;
      if (correctionMs <= 250) {
        startMs = previousStartMs;
        timingRepairs.push({ index, field: "start", correctionMs });
      } else if (
        previousEndMs >= 0 &&
        rawEndMs >= previousEndMs &&
        rawEndMs - previousEndMs <= 250
      ) {
        startMs = previousEndMs;
        timingRepairs.push({
          index,
          field: "start",
          correctionMs: startMs - rawStartMs,
          reason: "repaired-from-adjacent-word-boundary",
        });
      } else {
        throw new Error("Gemini word timings moved backwards by more than 250 ms.");
      }
    }
    let endMs = rawEndMs;
    if (endMs <= startMs) {
      const correctionMs = startMs + 1 - endMs;
      if (correctionMs > 250)
        throw new Error("Gemini returned a word ending before its start by more than 250 ms.");
      endMs = startMs + 1;
      timingRepairs.push({ index, field: "end", correctionMs });
    }
    if (endMs > audioDurationMs + 100)
      throw new Error("Gemini word timing ends after the generated audio.");
    previousStartMs = startMs;
    previousEndMs = endMs;
    return tokenParts(annotation.text).flatMap((token) =>
      spokenParts(token).map((text) => ({
        text,
        startMs,
        endMs: Math.max(endMs, startMs + 1),
      })),
    );
  });
}

function alignWords(text, annotations, audioDurationMs) {
  const words = sourceWords(text);
  const expected = flattenExpected(words);
  const timingRepairs = [];
  const recognized = flattenRecognized(annotations, audioDurationMs, timingRepairs);
  // V-10/V-11: accept only position-aligned spellings of the SAME spoken word
  // (Tajik long-vowel marks, split compounds, verified Hanzi readings).
  const spoken = alignSpokenTokens(expected, recognized, spokenMatch());
  if (spoken.aligned) return captionsFromAligned(words, expected, spoken.aligned, audioDurationMs, timingRepairs);
  const mismatches = [];
  if (expected.length !== recognized.length) {
    mismatches.push({
      kind: "token-count",
      expected: expected.length,
      recognized: recognized.length,
    });
  }
  const limit = Math.min(expected.length, recognized.length);
  for (let index = 0; index < limit; index += 1) {
    if (expected[index].text !== recognized[index].text) {
      mismatches.push({
        kind: "token",
        index,
        expected: expected[index].text,
        recognized: recognized[index].text,
      });
    }
  }
  if (mismatches.length) return { mismatches, timingRepairs };
  return captionsFromAligned(words, expected, recognized, audioDurationMs, timingRepairs);
}

// Hanzi readings come only from author-verified {hanzi, pinyin} pairs: this
// episode first, then every lesson source in the repository. Built once.
let cachedSpokenMatch;
function spokenMatch() {
  if (cachedSpokenMatch) return cachedSpokenMatch;
  const pairs = collectHanziPinyinPairs(episode);
  const dirs = [path.join(PROJECT_ROOT, "content", "episodes")];
  try {
    for (const locale of readdirSync(path.join(PROJECT_ROOT, "content", "locales")))
      dirs.push(path.join(PROJECT_ROOT, "content", "locales", locale, "episodes"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  for (const dir of dirs) {
    let files = [];
    try { files = readdirSync(dir).filter((name) => name.endsWith(".json")); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    for (const file of files) collectHanziPinyinPairs(JSON.parse(readFileSync(path.join(dir, file), "utf8")), pairs);
  }
  cachedSpokenMatch = createSpokenMatcher({ locale: voiceProfile.locale, readings: buildHanziReadings(pairs) });
  return cachedSpokenMatch;
}

function captionsFromAligned(words, expected, recognized, audioDurationMs, timingRepairs) {
  const captions = words.map((word, wordIndex) => {
    const parts = recognized.filter(
      (part, index) => expected[index].wordIndex === wordIndex,
    );
    return {
      text: word.display,
      startMs: Math.min(...parts.map((part) => part.startMs)),
      endMs: Math.max(...parts.map((part) => part.endMs)),
    };
  });
  let previousStartMs = -1;
  for (const caption of captions) {
    if (
      caption.startMs < previousStartMs ||
      caption.endMs <= caption.startMs ||
      caption.endMs > audioDurationMs + 100
    ) {
      throw new Error(
        "Gemini word timings are outside the audio or out of order.",
      );
    }
    previousStartMs = caption.startMs;
  }
  return { captions, mismatches: [], timingRepairs };
}

function vttTime(ms) {
  const value = Math.max(0, Math.round(ms));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  const milliseconds = value % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function writeVtt(captions) {
  return `WEBVTT\n\n${captions
    .map(
      (caption) =>
        `${vttTime(caption.startMs)} --> ${vttTime(caption.endMs)}\n${caption.text}`,
    )
    .join("\n\n")}\n`;
}

async function resolveFfmpegRuntime() {
  const bundledDir = path.join(
    PROJECT_ROOT,
    "node_modules",
    `@remotion/compositor-${process.platform}-${process.arch}`,
  );
  const bundled = {
    directory: bundledDir,
    ffmpegPath: path.join(bundledDir, "ffmpeg"),
    ffprobePath: path.join(bundledDir, "ffprobe"),
  };
  try {
    await Promise.all([
      fs.access(bundled.ffmpegPath),
      fs.access(bundled.ffprobePath),
    ]);
    const env = { ...process.env };
    if (process.platform === "darwin") {
      env.DYLD_LIBRARY_PATH = [bundledDir, env.DYLD_LIBRARY_PATH]
        .filter(Boolean)
        .join(path.delimiter);
    }
    return { ...bundled, env };
  } catch {
    for (const command of ["ffmpeg", "ffprobe"]) {
      try {
        execFileSync(command, ["-version"], { stdio: "ignore" });
      } catch {
        throw new Error(
          "MP3 conversion requires FFmpeg and FFprobe. Install them or install the project dependencies, which include Remotion's local runtime.",
        );
      }
    }
    return {
      ffmpegPath: "ffmpeg",
      ffprobePath: "ffprobe",
      env: process.env,
    };
  }
}

function audioDurationMs(filePath, runtime) {
  const output = execFileSync(
    runtime.ffprobePath,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8", env: runtime.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const probe = JSON.parse(output);
  if (
    !(probe.streams ?? []).some(
      (stream) => stream.codec_type === "audio" && stream.codec_name === "mp3",
    )
  ) {
    throw new Error("The generated file does not contain an MP3 audio stream.");
  }
  const durationSec = Number(probe.format?.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("FFprobe could not read the generated MP3 duration.");
  }
  return Math.round(durationSec * 1000);
}

function mediaDurationMs(filePath, runtime) {
  const output = execFileSync(
    runtime.ffprobePath,
    ["-v", "error", "-show_entries", "format=duration", "-of", "json", filePath],
    { encoding: "utf8", env: runtime.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const durationSec = Number(JSON.parse(output).format?.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0)
    throw new Error("FFprobe could not read an audio segment duration.");
  return Math.round(durationSec * 1000);
}

function audioMimeType(filePath) {
  return path.extname(filePath).toLowerCase() === ".wav"
    ? "audio/wav"
    : "audio/mpeg";
}

function createTtsChunks(episode, maxCharacters = 12000) {
  const chunks = [];
  let scenes = [];
  let text = "";
  for (const scene of episode.scenes) {
    const narration = scene.narration.trim();
    const pieces = [];
    for (const sentence of narration.split(/(?<=[.!?…])\s+/u)) {
      if (sentence.length <= maxCharacters) {
        pieces.push(sentence);
        continue;
      }
      let phrase = "";
      for (const word of sentence.match(/\S+\s*/gu) ?? []) {
        if (phrase && phrase.length + word.length > maxCharacters) {
          pieces.push(phrase.trim());
          phrase = "";
        }
        phrase += word;
      }
      if (phrase.trim()) pieces.push(phrase.trim());
    }
    for (const piece of pieces) {
      // Honor authored scene boundaries as the original production contract
      // says: short scene audio is easier to transcribe in RU+Mandarin/TJ+Mandarin.
      // Do not concatenate unrelated scenes into one long ASR request.
      if (text && (!scenes.includes(scene.id) || text.length + 1 + piece.length > maxCharacters)) {
        chunks.push({ text, sceneIds: scenes });
        scenes = [];
        text = "";
      }
      if (!scenes.includes(scene.id)) scenes.push(scene.id);
      text = text ? `${text} ${piece}` : piece;
    }
  }
  if (text) chunks.push({ text, sceneIds: scenes });
  return chunks;
}

/** OpenRouter key for the current transport: primary key or the opt-in backup. */
function openRouterKeyFor(config) {
  return config.apiProvider === "openrouter" ? config.apiKey : config.openRouterBackupKey;
}

function synthesizeWithOpenRouter(config, text) {
  return synthesizeOpenRouterWav({
    apiKey: openRouterKeyFor(config),
    model: config.ttsModel,
    voice: config.voice,
    text,
    style: config.style,
    sampleRateHz: config.sampleRateHz,
    channels: config.channels,
    onAttempt: () => { config.ttsRequestCount += 1; },
  });
}

async function generateTtsWav(config, text) {
  // Primary OpenRouter, or a take that already switched to the recorded
  // backup. Completed chunks are never regenerated.
  if (config.ttsTransport === "openrouter") return synthesizeWithOpenRouter(config, text);
  const content = [{ type: "text", text }];
  if (config.style) {
    content[0].annotations = [
      { type: "speech_metadata", style: config.style },
    ];
  }
  // Rotate credentials only if this standalone TTS call fails. Do not
  // regenerate a successful take or change provider, model, voice or cues.
  // A quota/5xx failure may switch to the opt-in OpenRouter backup ONLY
  // before this take has any saved Direct chunk: one video, one TTS vendor.
  const tts = await withOpenRouterBackup({
    stage: "tts",
    enabled: Boolean(config.openRouterBackupKey),
    allowFallback: config.completedTtsChunks === 0,
    backup: () => synthesizeWithOpenRouter(config, text),
    onFallback: (event) => {
      config.ttsTransport = "openrouter";
      config.transcriptionTransport = "openrouter";
      config.fallbackEvents.push(event);
      console.warn("VOICE_TRANSPORT_FALLBACK " + JSON.stringify(event));
    },
    primary: () => withGeminiKeyFailover(
    config.credentialState,
    (apiKey) => requestJson(
      `${API_ROOT}/v1beta/interactions`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
          "Api-Revision": API_REVISION,
        },
        body: JSON.stringify({
          model: config.ttsModel,
          input: [{ type: "user_input", content }],
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice: config.voice }] },
        }),
      },
      "Gemini speech generation",
      {
        maxAttempts: ONE_TAKE ? 2 : 4,
        onAttempt: () => {
          if (ONE_TAKE && config.ttsRequestCount >= 2)
            throw new Error("One-take TTS limit of two HTTP attempts reached; original audio remains preserved.");
          config.ttsRequestCount += 1;
        },
      },
    ),
    ),
  });
  // The backup already returned a complete WAV from the same model/voice.
  if (config.ttsTransport === "openrouter") return tts;
  config.apiKey = config.credentialState.slots[config.credentialState.index].secret;
  const wav = getAudioData(tts.data);
  if (
    wav.subarray(0, 4).toString("ascii") !== "RIFF" ||
    wav.subarray(8, 12).toString("ascii") !== "WAVE"
  ) {
    throw new Error("Gemini TTS response was not a WAV file.");
  }
  return wav;
}

async function uploadForTranscription(apiKey, filePath, displayName) {
  const bytes = await fs.readFile(filePath);
  const mimeType = audioMimeType(filePath);
  const start = await requestJson(
    `${API_ROOT}/upload/v1beta/files`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
        "Api-Revision": API_REVISION,
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    },
    "Gemini file upload initialization",
  );
  const uploadUrl = start.headers.get("x-goog-upload-url");
  const uploadOrigin = uploadUrl ? new URL(uploadUrl) : undefined;
  if (
    !uploadOrigin ||
    uploadOrigin.protocol !== "https:" ||
    !uploadOrigin.hostname.endsWith(".googleapis.com")
  ) {
    throw new Error("Gemini did not return a secure resumable upload URL.");
  }
  const finalized = await requestJson(
    uploadUrl,
    {
      method: "POST",
      headers: {
        "Content-Length": String(bytes.length),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Type": mimeType,
      },
      body: bytes,
    },
    "Gemini audio upload",
  );
  const file = finalized.data.file ?? finalized.data;
  if (!/^files\/[a-z0-9-]+$/.test(file?.name ?? "") || !file?.uri) {
    throw new Error(
      "Gemini file upload did not return a valid file reference.",
    );
  }
  return { name: file.name, uri: file.uri };
}

async function deleteGeminiFile(apiKey, name) {
  const response = await fetch(`${API_ROOT}/v1beta/${name}`, {
    method: "DELETE",
    headers: {
      "x-goog-api-key": apiKey,
      "Api-Revision": API_REVISION,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    let detail = "";
    try {
      detail = JSON.parse(body)?.error?.message ?? "";
    } catch {
      // Keep cleanup errors concise and never log request credentials.
    }
    throw new Error(
      `Gemini file cleanup failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
}


/**
 * The normal multi-language transcript is always attempted first. If it omits
 * speech, only transcribe the exact audible gap between the adjacent
 * *provider-timed* verified words. Never guess missing word timestamps.
 * The same approved Gemini Transcribe model is used for every recovery clip.
 */
function timedBlocks(annotations, durationMs) {
  // V8-01 (real 2026-11-03 zhuozi and 2026-11-08 bi-comparison RU takes): use
  // the SAME provider-timing policy as flattenRecognized(). A zero-length word
  // (e.g. "и" 7.100s→7.100s) gets a 1 ms end when the inversion is ≤250 ms,
  // instead of aborting the whole Mandarin gap recovery. Larger inversions and
  // times outside the audio still fail closed; no timestamp is invented.
  return annotations.map((word, annotationIndex) => {
    const startMs = parseOffsetMs(word.startOffset ?? word.start_offset);
    let endMs = parseOffsetMs(word.endOffset ?? word.end_offset);
    if (startMs < 0 || startMs > durationMs + 100 || endMs > durationMs + 100)
      throw new Error("Invalid Gemini source clip word timing.");
    if (endMs <= startMs) {
      if (startMs + 1 - endMs > 250 || startMs + 1 > durationMs + 100)
        throw new Error("Invalid Gemini source clip word timing.");
      endMs = startMs + 1;
    }
    return {
      tokens: tokenParts(word.text).flatMap(spokenParts),
      text: word.text,
      startMs, endMs, annotationIndex,
    };
  });
}

/** Direct Gemini word transcription of one saved audio file with explicit hints. */
async function transcribeDirectAudio(filePath, languageCodes, displayName, config) {
  const uploaded = await withGeminiKeyFailover(config.credentialState, (apiKey) =>
    uploadForTranscription(apiKey, filePath, displayName));
  config.apiKey = config.credentialState.slots[config.credentialState.index].secret;
  let response;
  try {
    response = await requestJson(
      API_ROOT + "/v1beta/interactions",
      { method: "POST", headers: {
        "x-goog-api-key": config.apiKey, "Content-Type": "application/json",
        "Api-Revision": API_REVISION,
      }, body: JSON.stringify({
        model: config.transcribeModel,
        input: [{ type: "audio", uri: uploaded.uri, mime_type: audioMimeType(filePath) }],
        generation_config: { transcription_config: {
          language_codes: languageCodes,
          mode: { type: "verbatim", timestamp_granularities: ["word"] },
        } },
      }) }, "Gemini word transcription");
  } finally {
    await deleteGeminiFile(config.apiKey, uploaded.name);
  }
  return getWordAnnotations(response.data).map((w) => ({
    text: w.text, startOffset: w.start_offset, endOffset: w.end_offset,
  }));
}

const pad2 = (value) => String(value).padStart(2, "0");

/** Exact WAV cut of saved audio; offsets are never inferred or expanded. */
function cutWavClip(sourcePath, startMs, endMs, clipPath, ffmpegRuntime) {
  // -ss after -i ensures an accurate cut.
  execFileSync(ffmpegRuntime.ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", sourcePath, "-ss", (startMs / 1000).toFixed(3),
    "-t", ((endMs - startMs) / 1000).toFixed(3),
    "-map", "0:a:0", "-ac", "1", "-ar", String(config.sampleRateHz),
    "-c:a", "pcm_s16le", clipPath,
  ], { env: ffmpegRuntime.env, stdio: ["ignore", "pipe", "pipe"] });
  const actualMs = mediaDurationMs(clipPath, ffmpegRuntime);
  if (actualMs <= 0) throw new Error("Gemini STT clip was empty.");
  return actualMs;
}

/** Measured silences of saved audio (ffmpeg silencedetect, -35 dB, ≥0.25 s). */
function measureSilences(sourcePath, ffmpegRuntime) {
  const result = spawnSync(ffmpegRuntime.ffmpegPath, [
    "-hide_banner", "-nostdin", "-i", sourcePath,
    "-af", "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-",
  ], { env: ffmpegRuntime.env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error("ffmpeg silence detection failed.");
  return parseSilences(result.stderr);
}

/**
 * One saved audio file -> provider word annotations. Gemini Direct with the
 * given hints (opt-in OpenRouter backup on quota/5xx/unreachable), or the
 * OpenRouter transport with the first code as its single ISO hint. Same saved audio
 * either way; speech is never regenerated here.
 */
async function transcribeSavedAudio(filePath, languageCodes, displayName, { stage, chunk, allowBackup = true }) {
  const openRouterHint = openRouterLanguage(languageCodes[0]);
  const openRouter = async () => (await transcribeOpenRouter({
    apiKey: openRouterKeyFor(config), model: config.transcribeModel, audioPath: filePath,
    language: openRouterHint,
  })).wordAnnotations;
  if (config.transcriptionTransport === "openrouter")
    return { annotations: await openRouter(), provider: "openrouter", languageCodes: openRouterHint ? [openRouterHint] : [] };
  let provider = "gemini-direct";
  const annotations = await withOpenRouterBackup({
    stage,
    enabled: allowBackup && Boolean(config.openRouterBackupKey),
    backup: async () => { provider = "openrouter"; return openRouter(); },
    onFallback: (event) => {
      config.transcriptionTransport = "openrouter";
      config.fallbackEvents.push({ ...event, chunk });
      if (metadata) {
        metadata.transcriptionTransport = config.transcriptionTransport;
        metadata.fallbackEvents = config.fallbackEvents;
      }
      console.warn("VOICE_TRANSPORT_FALLBACK " + JSON.stringify(event));
    },
    primary: () => transcribeDirectAudio(filePath, languageCodes, displayName, config),
  });
  return { annotations, provider,
    languageCodes: provider === "openrouter" ? (openRouterHint ? [openRouterHint] : []) : languageCodes };
}

/**
 * A provider response for one exact clip is paid for once: it is saved and
 * reused by later attempts and resumed runs (key = exact bounds + hints).
 * Empty responses are not cached, so they may be requested again.
 * A backup (OpenRouter) answer is reused while STT runs on the backup; once
 * Gemini Direct is available again the same clip is asked once on Direct
 * WITHOUT a second backup call, and the backup answer is kept beside it as
 * extra evidence (`alternates`) for the strict recovery selection.
 */
async function cachedClipTranscription(cachePath, key, request) {
  const alternatePath = cachePath.replace(/\.json$/, ".openrouter.json");
  const readRecord = async (file) => {
    try {
      const saved = await readJson(file);
      return saved?.key === key && Array.isArray(saved.annotations) && saved.annotations.length ? saved : null;
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      return null;
    }
  };
  const withAlternates = async (record) => {
    const alternate = record.provider === "openrouter" ? null : await readRecord(alternatePath);
    return alternate ? { ...record, alternates: [alternate.annotations] } : record;
  };
  const saved = await readRecord(cachePath);
  if (saved && (saved.provider !== "openrouter" || config.transcriptionTransport === "openrouter"))
    return withAlternates(saved);
  let result;
  try {
    result = await request({ allowBackup: !saved });
  } catch (error) {
    if (saved) return saved;
    throw error;
  }
  const record = { key, ...result, model: config.transcribeModel, savedAt: new Date().toISOString() };
  if (!record.annotations?.length) return saved ?? record;
  if (saved && record.provider !== saved.provider)
    await fs.writeFile(alternatePath, JSON.stringify(saved, null, 2) + "\n");
  await fs.writeFile(cachePath, JSON.stringify(record, null, 2) + "\n");
  return withAlternates(record);
}

async function recoverActualWordClips({
  chunkText, originalAnnotations, audioPath, durationMs, outputDir,
  chunkNumber, ffmpegRuntime, transcriptionLanguages,
  windows = [{ startMs: 0, endMs: durationMs }],
}) {
  const words = sourceWords(chunkText);
  const expected = flattenExpected(words).map((entry) => ({
    text: entry.text,
    language: /\p{Script=Han}/u.test(words[entry.wordIndex].display) ? "zh" : "locale",
  }));
  const match = spokenMatch();
  const chunk = Number(chunkNumber);
  const directory = path.join(outputDir, "recovery-diagnostic", "chunk-" + chunkNumber);
  await fs.mkdir(directory, { recursive: true });
  const byTime = (a, b) => a.startMs - b.startMs || a.endMs - b.endMs;
  const blocks = timedBlocks(originalAnnotations, durationMs).sort(byTime);
  let plan = buildRecoveryPlan(expected, blocks, durationMs, { match });
  // X-10 (real 2026-11-08 runs): a mixed-hint pass drops one language — RU
  // lost every Mandarin sentence, TG chunk 2 kept only the Mandarin. One
  // single-hint pass per language that is still MISSING, only over the
  // silence-bounded windows that contain a gap, over the SAME saved audio.
  // The strict DP then selects one time-ordered exact cover. Direct only:
  // On OpenRouter each pass sends its single ISO hint.
  const languagePasses = [];
  if (plan.gaps.length && transcriptionLanguages.length > 1) {
    const codesFor = (gap) => gap.language === "zh" ? [transcriptionLanguages.at(-1)]
      : gap.language === "locale" ? [transcriptionLanguages[0]] : transcriptionLanguages;
    for (const windowIndex of windowsTouching(windows, plan.gaps)) {
      const window = windows[windowIndex];
      const gapsHere = plan.gaps.filter((gap) => gap.startMs < window.endMs && gap.endMs > window.startMs);
      for (const code of [...new Set(gapsHere.flatMap(codesFor))]) {
        const name = `window-${pad2(windowIndex + 1)}-${code}`;
        try {
          const record = await cachedClipTranscription(path.join(directory, name + ".json"),
            `${window.startMs}-${window.endMs}-${code}`, async ({ allowBackup }) => {
              const clipPath = path.join(directory, `window-${pad2(windowIndex + 1)}.wav`);
              cutWavClip(audioPath, window.startMs, window.endMs, clipPath, ffmpegRuntime);
              return transcribeSavedAudio(clipPath, [code],
                `hsk-language-pass-${EPISODE_ID}-${chunkNumber}-${windowIndex + 1}-${code}`,
                { stage: "stt-language-pass", chunk, allowBackup });
            });
          for (const annotations of [record.annotations, ...(record.alternates ?? [])])
            blocks.push(...timedBlocks(offsetAnnotations(annotations, window.startMs), durationMs));
          languagePasses.push({ window: windowIndex + 1, languageCode: code, provider: record.provider, words: record.annotations.length });
        } catch (error) {
          languagePasses.push({ window: windowIndex + 1, languageCode: code, error: safeErrorMessage(error) });
        }
      }
    }
    await fs.writeFile(path.join(directory, "language-passes.json"),
      JSON.stringify({ sourceAudio: path.basename(audioPath), windows, languagePasses }, null, 2) + "\n");
    blocks.sort(byTime);
    plan = buildRecoveryPlan(expected, blocks, durationMs, { match });
  }
  const recovered = [];
  const unconfirmed = [];
  // Bounded: at most 8 independently bounded spans per STT window.
  if (plan.gaps.length > 8 * windows.length)
    throw new Error(`Recovery allows at most ${8 * windows.length} bounded missing speech spans; found ${plan.gaps.length}.`);
  await fs.writeFile(path.join(directory, "plan.json"), JSON.stringify({
    sourceAudio: path.basename(audioPath), windows, originalAnnotations,
    missingGaps: plan.gaps, matchedTokenCount: plan.matchedTokenCount,
    expectedTokens: expected.length,
  }, null, 2) + "\n");
  for (const gap of plan.gaps) {
    if (gap.noAudio || gap.endMs - gap.startMs < 80) {
      unconfirmed.push({ startMs: gap.startMs, endMs: gap.endMs, expected: gap.tokens.join(" "), heard: "",
        reason: gap.noAudio ? "No audible clip between verified word boundaries." : "Recoverable speech clip is too short." });
      recovered.push(null);
      continue;
    }
    const clipName = `span-${gap.startMs}-${gap.endMs}`;
    // A mixed RU/TG+Mandarin gap gets one single-hint pass per language
    // (a mixed hint drops one of them), on either transport.
    const hintSets = gap.language === "zh" ? [[transcriptionLanguages.at(-1)]]
        : gap.language === "locale" ? [[transcriptionLanguages[0]]]
          : transcriptionLanguages.map((code) => [code]);
    const clipPath = path.join(directory, clipName + ".wav");
    const gapBlocks = [];
    try {
      for (const hints of hintSets) {
        const label = hints.length ? hints.join("+") : "nohint";
        const record = await cachedClipTranscription(path.join(directory, `${clipName}-${label}.json`),
          `${gap.startMs}-${gap.endMs}-${label}`, async ({ allowBackup }) => {
            const actualMs = cutWavClip(audioPath, gap.startMs, gap.endMs, clipPath, ffmpegRuntime);
            return { ...(await transcribeSavedAudio(clipPath, hints.length ? hints : transcriptionLanguages,
              `hsk-recovery-${EPISODE_ID}-${chunkNumber}-${clipName}-${label}`, { stage: "stt-recovery", chunk, allowBackup })),
            clipStartMs: gap.startMs, clipEndMs: gap.endMs, actualClipDurationMs: actualMs };
          });
        const clipMs = record.actualClipDurationMs ?? (gap.endMs - gap.startMs);
        for (const annotations of [record.annotations, ...(record.alternates ?? [])])
          gapBlocks.push(...timedBlocks(annotations, clipMs)
            .map((b) => ({ ...b, startMs: b.startMs + gap.startMs, endMs: b.endMs + gap.startMs })));
      }
      gapBlocks.sort(byTime);
      let selected;
      try {
        selected = selectRecoveredBlocks(gap.tokens, gapBlocks, { match });
      } catch (firstError) {
        // One bounded second request per unconfirmed span: the same saved
        // audio with ~0.7 s of neighbouring speech on each side, because a
        // bare 1 s clip loses context (real RU one-take: "HSK AI" → "HSGKAI").
        // Neighbour words are extras the strict selection discards; the
        // missing words must still be heard exactly, inside the span.
        const contextStart = Math.max(0, gap.startMs - 700);
        const contextEnd = Math.min(durationMs, gap.endMs + 700);
        const contextName = `context-${contextStart}-${contextEnd}`;
        const contextPath = path.join(directory, contextName + ".wav");
        const record = await cachedClipTranscription(path.join(directory, `${contextName}-${hintSets[0].join("+") || "nohint"}.json`),
          `${contextStart}-${contextEnd}-${hintSets[0].join("+") || "nohint"}`, async ({ allowBackup }) => {
            const actualMs = cutWavClip(audioPath, contextStart, contextEnd, contextPath, ffmpegRuntime);
            return { ...(await transcribeSavedAudio(contextPath, hintSets[0].length ? hintSets[0] : transcriptionLanguages,
              `hsk-recovery-${EPISODE_ID}-${chunkNumber}-${contextName}`, { stage: "stt-recovery", chunk, allowBackup })),
            clipStartMs: contextStart, clipEndMs: contextEnd, actualClipDurationMs: actualMs };
          });
        const inside = [record.annotations, ...(record.alternates ?? [])]
          .flatMap((annotations) => timedBlocks(annotations, record.actualClipDurationMs ?? (contextEnd - contextStart)))
          .map((b) => ({ ...b, startMs: b.startMs + contextStart, endMs: b.endMs + contextStart }))
          // Provider times are kept as returned; only words lying inside the
          // span (±120 ms tolerance) may fill it.
          .filter((b) => b.startMs >= gap.startMs - 120 && b.endMs <= gap.endMs + 120);
        gapBlocks.push(...inside);
        try {
          selected = selectRecoveredBlocks(gap.tokens, inside, { match });
        } catch {
          throw firstError;
        }
      }
      recovered.push(selected);
    } catch (error) {
      // Keep going: every other gap's evidence is saved now (a network error
      // on one clip re-requests only that clip next run), so one run shows
      // the complete list of words the provider did not confirm.
      unconfirmed.push({ startMs: gap.startMs, endMs: gap.endMs, expected: gap.tokens.join(" "),
        heard: gapBlocks.map((b) => b.text).join(" "), reason: safeErrorMessage(error) });
    }
  }
  if (unconfirmed.length) {
    await fs.writeFile(path.join(directory, "unconfirmed-gaps.json"), JSON.stringify(unconfirmed, null, 2) + "\n");
    throw new Error(`Recovery could not confirm ${unconfirmed.length} of ${plan.gaps.length} spans: ` +
      unconfirmed.map((u) => `${u.startMs}-${u.endMs} "${u.expected}" heard "${u.heard}"`).join("; "));
  }
  const joined = mergeRecoveredBlocks(expected, blocks, plan, recovered);
  const joinedAnnotations = joined.map((b) => ({
    text: b.text,
    startOffset: (b.startMs / 1000).toFixed(3) + "s",
    endOffset: (b.endMs / 1000).toFixed(3) + "s",
  }));
  const verified = alignWords(chunkText, joinedAnnotations, durationMs);
  if (verified.mismatches.length)
    throw new Error("Recovered words still failed exact whole-narration word alignment.");
  await fs.writeFile(path.join(directory, "verified-merge.json"), JSON.stringify({
    provider: config.transcriptionTransport, model: config.transcribeModel,
    windows, languagePasses, actualClipOffsets: plan.gaps,
    wordAnnotations: joinedAnnotations, exactAlignment: true,
  }, null, 2) + "\n");
  return { wordAnnotations: joinedAnnotations, alignment: verified, transcript: chunkText,
    recoverySpans: plan.gaps.length, languagePasses: languagePasses.length };
}

function safeErrorMessage(error) {
  return redactCredentials(error?.message ?? error);
}

async function findVerifiedSampleFallback({ episodeId, episode, narration, textHash, profile }) {
  if (profile.sampleEpisodeId !== episodeId || !profile.sampleAudio || !profile.sampleCaptions)
    return null;
  const audioPath = path.resolve(PROJECT_ROOT, profile.sampleAudio);
  const captionsPath = path.resolve(PROJECT_ROOT, profile.sampleCaptions);
  if (
    !audioPath.startsWith(PROJECT_ROOT + path.sep) ||
    !captionsPath.startsWith(PROJECT_ROOT + path.sep)
  ) return null;
  const sampleRoot = path.dirname(audioPath);
  const metadata = await readJson(path.join(sampleRoot, "metadata.json"));
  try {
    assertReusableVoiceMetadata(metadata, profile);
  } catch {
    return null;
  }
  if (
    metadata.sampleOnly !== true ||
    metadata.status !== "ready-for-owner-audition" ||
    metadata.episodeId !== episodeId ||
    metadata.episodeNarrationHash !== narrationHash(episode) ||
    (metadata.narrationTextHash !== textHash && metadata.auditionTextHash !== textHash) ||
    metadata.provider !== profile.provider ||
    metadata.ttsModel !== profile.ttsModel ||
    metadata.voice !== profile.voiceName ||
    metadata.transcriptionModel !== profile.transcriptionModel ||
    metadata.transcriptionUploadDeleted !== true
  ) return null;
  const savedText = (await fs.readFile(path.join(sampleRoot, "tts-input.txt"), "utf8")).trim();
  if (savedText !== narration) return null;
  const transcription = await readJson(path.join(sampleRoot, "transcription.json"));
  if (!Array.isArray(transcription.wordAnnotations) || !transcription.wordAnnotations.length)
    return null;
  const alignment = alignWords(narration, transcription.wordAnnotations, metadata.audioDurationMs);
  if (alignment.mismatches.length) return null;
  const vtt = await fs.readFile(captionsPath, "utf8");
  const cueTexts = vtt
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split("\n");
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      return timeIndex < 0 ? [] : [lines.slice(timeIndex + 1).join(" ")];
    })
    .join(" ");
  const words = (value) =>
    (value.match(/[\p{L}\p{N}]+/gu) ?? [])
      .map((word) => tokenParts(word)[0])
      .join(" ");
  const wordCueCount = cueTexts.split(/\s+/).filter(Boolean).length;
  const sourceWordCount = narration.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  if (
    words(cueTexts) !== words(narration) ||
    wordCueCount === 0 ||
    wordCueCount / sourceWordCount < 0.8
  ) return null;
  await Promise.all([fs.access(audioPath), fs.access(captionsPath)]);
  return {
    audioPath,
    captionsPath,
    wavPath: path.join(sampleRoot, "voice.wav"),
    transcriptionPath: path.join(sampleRoot, "transcription.json"),
    metadata,
    transcription,
    alignment,
  };
}

async function archiveRejectedFile(filePath) {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const parsed = path.parse(filePath);
  for (let suffix = 0; ; suffix += 1) {
    const candidate = path.join(
      parsed.dir,
      `${parsed.name}-unmatched-attempt${suffix ? `-${suffix}` : ""}${parsed.ext}`,
    );
    try {
      await fs.access(candidate);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await fs.rename(filePath, candidate);
      return candidate;
    }
  }
}

requireEpisodeId(EPISODE_ID);
if (PLATFORM && PLATFORM !== "tiktok") {
  throw new Error("Only the local tiktok review variant is supported here.");
}
if (CLI_OPTIONS.includes("--resume") && !RESUME_FOLDER_NAME) {
  throw new Error("--resume requires an existing Gemini production folder name.");
}
if (
  RESUME_FOLDER_NAME &&
  !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(RESUME_FOLDER_NAME)
) {
  throw new Error(
    "--resume must name a timestamped folder under this episode's gemini-production directory.",
  );
}
const sourceRevision = requireFreshGitMain();
assertNotPreviouslyPublished(EPISODE_ID);
const voiceProfile = await requireApprovedVoiceProfile(EPISODE_ID);
if (voiceProfile.provider !== "gemini-api") {
  throw new Error("Faol ovoz profili Gemini API provayderiga mos emas.");
}
const targetReviewDir = PLATFORM
  ? path.join(reviewDir(EPISODE_ID), PLATFORM)
  : reviewDir(EPISODE_ID);
const episodePath = PLATFORM
  ? path.join(targetReviewDir, "episode.json")
  : (await getEpisode(EPISODE_ID)).filePath;
const rawEpisode = await readJson(episodePath);
const episode = normalizeEpisode(rawEpisode);
assertVoiceEpisodeLanguage(episode, voiceProfile);
if (episode.id !== EPISODE_ID) {
  throw new Error("Review episode ID does not match the requested episode.");
}
validateEpisode(episode);
const visualSystem = await readJson(path.join(PROJECT_ROOT, "content", "visual-system.json"));
validateLessonPresentation(episode, visualSystem.lessonPresentation);
await requireCurrentCta(episode);
// A separately registered TikTok variant has its own review and publication
// lifecycle. Do not let another platform's scheduled root status block its
// first voice render; the platform-specific approval check below still guards
// any TikTok voice that has already been approved.
const previousStatus = PLATFORM
  ? await readJson(path.join(targetReviewDir, "status.json"))
  : await readStatus(EPISODE_ID);
if (
  [
    "owner-approved-for-zernio-publishing",
    "zernio-published",
    "zernio-scheduled",
    "zernio-publication-processing",
    "zernio-publication-partial",
    "zernio-publication-failed",
  ].includes(previousStatus.stage) ||
  ["owner-approved-for-zernio-publishing", "published", "scheduled"].includes(
    episode.publishingStatus,
  )
) {
  throw new Error("Approved or published episode voice cannot be replaced.");
}
try {
  await fs.access(path.join(targetReviewDir, "approval.json"));
  throw new Error("An owner approval record exists; voice regeneration is blocked.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
if (episode.voiceTextHash && episode.voiceTextHash !== narrationHash(episode)) {
  throw new Error(
    "Saved voice script fingerprint no longer matches the narration.",
  );
}

const tiktokCtaScene = PLATFORM
  ? episode.scenes.find((scene) => scene.kind === "cta")
  : null;
if (PLATFORM && !tiktokCtaScene) {
  throw new Error("TikTok review variant is missing its CTA scene.");
}
const narration = (PLATFORM
  ? tiktokCtaScene.narration
  : episode.scenes.map((scene) => scene.narration.trim()).join(" "))
  .replace(/\s+/g, " ")
  .trim();
if (!narration) throw new Error("Episode has no narration to voice.");
const transcriptionLanguages = voiceTranscriptionLanguages(voiceProfile);
const currentNarrationHash = narrationHash(episode);
if (episode.voiceTextHash && episode.voiceTextHash !== currentNarrationHash) {
  throw new Error("Saved voice script fingerprint no longer matches the narration.");
}
if (!RESUME_FOLDER_NAME && !CLI_OPTIONS.includes("--resume") &&
    await hasCurrentImportedVoice(episode, voiceProfile, { projectRoot: PROJECT_ROOT })) {
  await new Promise((resolve) => process.stdout.write(
    "Matching imported voice and word-timed captions are intact; reusing the first take without TTS/STT calls.\n",
    resolve,
  ));
  process.exit(0);
}
const config = await loadVoiceEnvironment(voiceProfile);
// Downstream import/render use system FFmpeg/FFprobe: prove they exist first.
requireSystemMediaTools();
episode.voiceTextHash = currentNarrationHash;
await writeJson(episodePath, episode);
await fs.writeFile(path.join(targetReviewDir, "tts-input.txt"), `${narration}\n`, "utf8");
const writeTargetStatus = (status) => PLATFORM
  ? writeJson(path.join(targetReviewDir, "status.json"), status)
  : writeStatus(EPISODE_ID, status);
await writeTargetStatus({
  stage: "gemini-voice-generating",
  sourceRevision,
  updatedAt: new Date().toISOString(),
  provider: config.apiProvider === "openrouter" ? "OpenRouter (Gemini models)" : voiceProfile.serviceName,
  apiTransport: config.apiProvider,
  voiceProfileId: voiceProfile.profileId,
  voice: voiceProfile.voiceName,
  voiceTextHash: currentNarrationHash,
});

const productionRoot = path.join(targetReviewDir, "gemini-production");
const textHash = createHash("sha256").update(narration, "utf8").digest("hex");
const ttsSource = PLATFORM ? { ...episode, scenes: [tiktokCtaScene] } : episode;
// "continuous-pilot" is the stored id of one-take audio since the pilot;
// kept unchanged so saved takes stay resumable (checkpoints compare it).
const ttsMode = ONE_TAKE ? "continuous-pilot" : "scene";
const ttsChunks = ONE_TAKE
  ? createContinuousTtsChunks(ttsSource, { expectedNarration: narration })
  : createTtsChunks(ttsSource);
if (!ttsChunks.length) throw new Error("No narration chunks were created.");
if (!RESUME_FOLDER_NAME && !NEW_TAKE) {
  const checkpoint = await findReusableVoiceCheckpoint({
    productionRoot,
    profile: voiceProfile,
    expected: {
      episodeId: EPISODE_ID,
      platform: PLATFORM ?? null,
      apiTransport: config.apiProvider,
      narrationTextHash: textHash,
      ttsGenerationMode: ttsMode,
      ttsChunkCount: ttsChunks.length,
    },
  });
  if (checkpoint) {
    RESUME_FOLDER_NAME = checkpoint.folderName;
    console.log(`Resuming verified TTS checkpoint ${checkpoint.folderName}; saved audio will not be regenerated.`);
  } else {
    // X-05/X-08: never silently buy another paid take of identical narration
    // while a saved take exists that automatic resume cannot use.
    const savedTakes = await findUnresumableSavedTakes({
      productionRoot,
      profile: voiceProfile,
      expected: {
        episodeId: EPISODE_ID,
        platform: PLATFORM ?? null,
        apiTransport: config.apiProvider,
        narrationTextHash: textHash,
        ttsGenerationMode: ttsMode,
        ttsChunkCount: ttsChunks.length,
      },
    });
    if (savedTakes.length) {
      const list = savedTakes.map((take) => `${take.folderName} (${take.status ?? "unknown"}: ${take.reason})`).join("; ");
      const reason = `A saved paid take of this exact narration already exists and was not resumed automatically: ${list}. ` +
        "No new TTS was requested. Listen to it first: re-import an imported take with content:import-voice, " +
        "resume a SHA-verified one with --resume <folder>, or buy a new take explicitly with --new-take.";
      await writeTargetStatus({
        stage: "gemini-voice-blocked", sourceRevision, updatedAt: new Date().toISOString(),
        voiceProfileId: voiceProfile.profileId, voiceTextHash: currentNarrationHash,
        reason, savedTakes,
      });
      throw new Error(reason);
    }
  }
}
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(productionRoot, RESUME_FOLDER_NAME ?? timestamp);
await fs.mkdir(outputDir, { recursive: true });
const wavPath = path.join(outputDir, "voice.wav");
const mp3Path = path.join(outputDir, "voice.mp3");
const transcriptionPath = path.join(outputDir, "transcription.json");
const metadataPath = path.join(outputDir, "metadata.json");
const checkpointPath = path.join(outputDir, "checkpoint.json");
let metadata;
if (RESUME_FOLDER_NAME) {
  try {
    metadata = await readJson(metadataPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    metadata = await readJson(checkpointPath);
    metadata.status ??= "audio-ready";
    metadata.ttsRequestCount ??= metadata.chunks?.length ?? 0;
    metadata.ttsChunks ??= metadata.chunks ?? [];
    metadata.transcriptionAttempts ??= metadata.transcriptionAttemptsByChunk ?? [];
  }
  assertReusableVoiceMetadata(metadata, voiceProfile);
  if (
    metadata?.production !== true ||
    metadata.episodeId !== EPISODE_ID ||
    (metadata.platform ?? undefined) !== PLATFORM ||
    metadata.provider !== "gemini-api" ||
    metadata.narrationTextHash !== textHash
  ) {
    throw new Error(
      "Existing Gemini production metadata or narration hash does not match this episode.",
    );
  }
  try {
    const savedText = (await fs.readFile(path.join(outputDir, "tts-input.txt"), "utf8")).trim();
    if (savedText !== narration)
      throw new Error("Existing Gemini production text does not match the current narration.");
  } catch (error) {
    if (error?.code !== "ENOENT" || metadata.narrationTextHash !== textHash) throw error;
  }
  if ((metadata.apiTransport ?? "gemini-direct") !== config.apiProvider) {
    throw new Error("Resume transport differs from the original audio; refusing provider switch.");
  }
  // A take that already moved to the opt-in backup continues on it; its saved
  // chunks are never regenerated and never mixed with new Direct speech.
  config.ttsTransport = metadata.ttsTransport ?? config.apiProvider;
  // STT only reads the saved audio, so a resumed run asks the requested
  // transport first again (a spent Direct daily quota resets); it may fall
  // back again on its own 429/5xx. Real TG one-take 2026-11-08: Tajik STT on
  // the backup was far noisier than Direct with tg-TJ + Mandarin hints.
  config.transcriptionTransport = config.apiProvider;
  config.fallbackEvents = Array.isArray(metadata.fallbackEvents) ? metadata.fallbackEvents : [];
  if (config.apiProvider === "gemini-direct" && !config.openRouterBackupKey &&
      config.ttsTransport === "openrouter") {
    throw new Error("Resuming an OpenRouter-backed take requires HSK_AI_OPENROUTER_FALLBACK_ENABLED=true and OPENROUTER_API_KEY.");
  }
  delete metadata.error;
  metadata.status = "starting";
  metadata.sourceRevision = sourceRevision;
  metadata.transcriptionModel = config.transcribeModel;
  metadata.wordAlignment =
    `Gemini Transcribe verbatim with ${transcriptionLanguages.join(" and ")} language hints; word timestamps; normalized-token gate (цай→цзай, тя→цзя, сюэсяо→сюэ сяо; Mandarin Hanzi-to-script phonetic aliases; HSK/AI acronym recognition)`;
} else {
  metadata = {
    production: true,
    status: "starting",
    episodeId: EPISODE_ID,
    ...(PLATFORM ? { platform: PLATFORM } : {}),
    episodeNarrationHash: narrationHash(episode),
    narrationTextHash: textHash,
    sourceRevision,
    createdAt: new Date().toISOString(),
    ...(NEW_TAKE ? { newTakeRequested: true } : {}),
    provider: "gemini-api",
    apiTransport: config.apiProvider,
    ttsTransport: config.ttsTransport,
    transcriptionTransport: config.transcriptionTransport,
    fallbackEvents: [],
    languageCode: voiceProfile.locale,
    voiceProfileId: voiceProfile.profileId,
    ttsModel: config.ttsModel,
    voice: config.voice,
    transcriptionModel: config.transcribeModel,
    wordAlignment:
      `Gemini Transcribe verbatim with ${transcriptionLanguages.join(" and ")} language hints; word timestamps; normalized-token gate (цай→цзай, тя→цзя, сюэсяо→сюэ сяо; Mandarin Hanzi-to-script phonetic aliases; HSK/AI acronym recognition)`,
  };
}

const ffmpegRuntime = await resolveFfmpegRuntime();
if (RESUME_FOLDER_NAME && (metadata.ttsGenerationMode ?? "scene") !== ttsMode) {
  throw new Error("Refusing to resume saved audio under a different TTS chunking mode.");
}
if (RESUME_FOLDER_NAME && metadata.ttsChunkCount !== ttsChunks.length) {
  throw new Error("Saved generation chunk count does not match the current narration.");
}
config.ttsRequestCount = metadata.ttsRequestCount ?? 0;
metadata.ttsGenerationMode = ttsMode;
metadata.ttsHttpAttemptLimitPerTake = config.apiProvider === "openrouter"
  ? OPENROUTER_TTS_MAX_ATTEMPTS : (ONE_TAKE ? 2 : 4);
metadata.openRouterBackupHttpAttemptsPerChunk = config.openRouterBackupKey ? OPENROUTER_TTS_MAX_ATTEMPTS : 0;
metadata.googleQuotaKeyRotationEnabled = false;
metadata.ttsTransport = config.ttsTransport;
metadata.transcriptionTransport = config.transcriptionTransport;
metadata.fallbackEvents = config.fallbackEvents;
metadata.ttsChunkCount = ttsChunks.length;
metadata.chunkSceneIds = ttsChunks.map((chunk) => chunk.sceneIds);
metadata.chunkingStrategy = ONE_TAKE
  ? "one exact unchanged narration take per language/package (max 12000 chars)"
  : "scene boundaries; at most 12000 narration characters per TTS and transcription request";
metadata.previousVoiceProvider = episode.voiceProvider ?? null;
metadata.previousVoiceProfileId = episode.voiceProfileId ?? null;
metadata.ttsChunks ??= [];
const persistMetadata = () => atomicWriteJson(metadataPath, metadata);
const persistCheckpoint = () => atomicWriteJson(checkpointPath, {
  schemaVersion: 1,
  production: true,
  status: metadata.status,
  episodeId: EPISODE_ID,
  platform: PLATFORM ?? null,
  provider: "gemini-api",
  apiTransport: config.apiProvider,
  ttsTransport: config.ttsTransport,
  transcriptionTransport: config.transcriptionTransport,
  fallbackEvents: config.fallbackEvents,
  languageCode: voiceProfile.locale,
  voiceProfileId: voiceProfile.profileId,
  ttsModel: config.ttsModel,
  voice: config.voice,
  transcriptionModel: config.transcribeModel,
  narrationTextHash: textHash,
  masterWavSha256: metadata.wavSha256 ?? null,
  mp3Sha256: metadata.mp3Sha256 ?? null,
  audioDurationMs: metadata.audioDurationMs ?? null,
  chunkDurationsMs: metadata.chunkDurationsMs ?? null,
  ttsGenerationMode: ttsMode,
  ttsChunkCount: ttsChunks.length,
  ttsRequestCount: config.ttsRequestCount,
  createdAt: metadata.createdAt,
  ...(metadata.newTakeRequested === true ? { newTakeRequested: true } : {}),
  sampleOnly: metadata.sampleOnly === true,
  chunks: metadata.ttsChunks.filter(Boolean),
  transcriptionAttemptsByChunk: metadata.transcriptionAttempts ?? [],
});
await persistMetadata();
await persistCheckpoint();

try {
  if (!RESUME_FOLDER_NAME) {
    await fs.writeFile(
      path.join(outputDir, "tts-input.txt"),
      `${narration}\n`,
      "utf8",
    );
  }
  const chunkWavPaths = ttsChunks.map((_, index) =>
    ttsChunks.length === 1
      ? wavPath
      : path.join(outputDir, `voice-part-${String(index + 1).padStart(3, "0")}.wav`),
  );
  let completedTtsChunks = 0;
  for (const [index, chunk] of ttsChunks.entries()) {
    const chunkPath = chunkWavPaths[index];
    const chunkFile = path.basename(chunkPath);
    const recordedChunk = metadata.ttsChunks[index];
    let chunkBytes;
    try {
      chunkBytes = await fs.readFile(chunkPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (chunkBytes && !matchesRecordedWavChunk(chunkFile, chunkBytes, recordedChunk)) {
      // A stale, altered or hashless WAV must never be passed off as a
      // verified first take. Preserve it for diagnosis; no paid TTS retry.
      throw new Error(
        `Saved TTS WAV chunk ${chunkFile} failed SHA-256 or format verification; original file preserved. Manual review required.`,
      );
    }
    let chunkTransport = recordedChunk?.transport ?? config.ttsTransport;
    if (!chunkBytes) {
      // Backup is allowed only while no chunk of this take exists yet.
      config.completedTtsChunks = completedTtsChunks;
      const generated = await generateTtsWav(config, chunk.text);
      if (!isValidWavBuffer(generated))
        throw new Error(`TTS chunk ${index + 1} is not a complete RIFF/WAVE audio file.`);
      await atomicWriteFile(chunkPath, generated);
      chunkBytes = generated;
      chunkTransport = config.ttsTransport;
    }
    // V-12: objective signal QA before any paid STT. A chunk that cannot be
    // speech is kept as evidence and blocks; it is never silently re-voiced.
    const audioQa = measureWavQuality(chunkBytes);
    metadata.ttsChunks[index] = {
      file: chunkFile, bytes: chunkBytes.length, sha256: sha256(chunkBytes), transport: chunkTransport,
      audioQa,
    };
    if (audioQa.unusable) {
      metadata.status = "audio-qa-failed";
      await persistMetadata();
      await persistCheckpoint();
      throw new Error(
        `TTS chunk ${index + 1} failed audio QA (${audioQa.problems.join(", ")}); original WAV preserved, ` +
        "no STT was spent. Listen to it, then request --new-take explicitly if it is really unusable.",
      );
    }
    completedTtsChunks += 1;
    metadata.ttsTransport = config.ttsTransport;
    metadata.transcriptionTransport = config.transcriptionTransport;
    metadata.fallbackEvents = config.fallbackEvents;
    metadata.ttsRequestCount = config.ttsRequestCount;
    metadata.completedTtsChunks = completedTtsChunks;
    metadata.status = "audio-generating";
    await persistMetadata();
    await persistCheckpoint();
  }

  if (ttsChunks.length > 1) {
    const concatListPath = path.join(outputDir, "audio-concat.txt");
    const combinedWavTemp = path.join(outputDir, "voice-combined.tmp.wav");
    await fs.rm(combinedWavTemp, { force: true });
    await fs.writeFile(
      concatListPath,
      chunkWavPaths.map((chunkPath) => `file '${path.basename(chunkPath)}'`).join("\n") + "\n",
      "utf8",
    );
    execFileSync(
      ffmpegRuntime.ffmpegPath,
      [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-f", "concat", "-safe", "0", "-i", concatListPath,
        "-c:a", "pcm_s16le", "-ar", String(config.sampleRateHz),
        "-ac", String(config.channels), combinedWavTemp,
      ],
      { cwd: outputDir, env: ffmpegRuntime.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    const combinedBytes = await fs.readFile(combinedWavTemp);
    if (!isValidWavBuffer(combinedBytes))
      throw new Error("Concatenated TTS audio is not a complete RIFF/WAVE file.");
    await fs.rename(combinedWavTemp, wavPath);
  }

  const masterWav = await fs.readFile(wavPath);
  if (!isValidWavBuffer(masterWav))
    throw new Error("Saved TTS master is not a complete RIFF/WAVE file.");
  if (RESUME_FOLDER_NAME && metadata.wavSha256 &&
      !matchesRecordedAudioHash(masterWav, metadata.wavSha256)) {
    throw new Error("Saved master WAV hash differs from its checkpoint; preserving original for review.");
  }
  let mp3Exists = false;
  try {
    await fs.access(mp3Path);
    mp3Exists = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (mp3Exists && !RESUME_FOLDER_NAME)
    throw new Error("Production MP3 output already exists; refusing to overwrite it.");
  let mp3Ready = false;
  if (mp3Exists) {
    // A valid MP3 duration proves only decodability, not voice identity.
    // A mismatched or unrecorded existing take must never be silently
    // accepted, removed or replaced on resume.
    if (!matchesRecordedAudioHash(await fs.readFile(mp3Path), metadata.mp3Sha256)) {
      throw new Error(
        "Saved MP3 lacks a matching recorded SHA-256; preserving the original file for manual review.",
      );
    }
    await audioDurationMs(mp3Path, ffmpegRuntime);
    mp3Ready = true;
  }
  if (!mp3Ready) {
    const mp3Temp = path.join(outputDir, "voice.tmp.mp3");
    await fs.rm(mp3Temp, { force: true });
    execFileSync(
      ffmpegRuntime.ffmpegPath,
      [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-i", wavPath, "-map", "0:a:0", "-vn", "-c:a", "libmp3lame",
        "-b:a", `${config.mp3BitrateKbps}k`, "-ar", String(config.sampleRateHz),
        "-ac", String(config.channels), "-map_metadata", "-1", "-f", "mp3", mp3Temp,
      ],
      { env: ffmpegRuntime.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    await audioDurationMs(mp3Temp, ffmpegRuntime);
    await fs.rename(mp3Temp, mp3Path);
  }
  metadata.wavBytes = (await fs.stat(wavPath)).size;
  metadata.mp3Bytes = (await fs.stat(mp3Path)).size;
  metadata.wavSha256 = sha256(masterWav);
  metadata.mp3Sha256 = sha256(await fs.readFile(mp3Path));
  metadata.audioDurationMs = audioDurationMs(mp3Path, ffmpegRuntime);
  metadata.chunkDurationsMs = await Promise.all(
    chunkWavPaths.map((chunkPath) => mediaDurationMs(chunkPath, ffmpegRuntime)),
  );
  metadata.status = "audio-ready";
  await persistMetadata();
  await persistCheckpoint();

  const combinedAnnotations = [];
  const chunkTranscripts = [];
  let verifiedSampleFallbackUsed = false;
  metadata.transcriptionUploadCleanupResults ??= (
    metadata.transcriptionUploadsDeleted ?? []
  ).map((deleted, index) => ({ chunk: index + 1, attempt: 1, deleted }));
  let offsetMs = 0;
  for (const [index, chunkWavPath] of chunkWavPaths.entries()) {
    const chunkNumber = String(index + 1).padStart(3, "0");
    const transcriptPath = path.join(outputDir, `transcription-part-${chunkNumber}.json`);
    const transcriptionAudioPath = chunkWavPaths.length === 1 ? mp3Path : chunkWavPath;
    let transcription;
    try {
      transcription = await readJson(transcriptPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    let chunkAlignment;
    if (transcription?.wordAnnotations?.length) {
      try {
        chunkAlignment = alignWords(
          ttsChunks[index].text,
          transcription.wordAnnotations,
          metadata.chunkDurationsMs[index],
        );
      } catch (error) {
        metadata.lastTranscriptionError = safeErrorMessage(error);
      }
    }
    // `attempts` numbers every STT response this take ever received; the
    // bounded budget is PER RUN. A cumulative cap left a resumed take with
    // zero new STT attempts forever (real 2026-11-03 zhuozi RU take: 3/3
    // used, chunk 3 never retried), which pushes operators to buy a new TTS.
    let attempts = metadata.transcriptionAttempts?.[index] ?? (transcription ? 1 : 0);
    // Free first: a response an earlier run already paid for may pass the
    // current gate (e.g. after a matcher fix). Newest saved attempt first.
    for (let saved = attempts; saved >= 1 && !chunkAlignment?.captions; saved -= 1) {
      let previous;
      try {
        previous = await readJson(path.join(outputDir, `transcription-part-${chunkNumber}-attempt-${saved}.json`));
      } catch (error) {
        if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
        continue;
      }
      if (!previous?.wordAnnotations?.length) continue;
      try {
        const reused = alignWords(ttsChunks[index].text, previous.wordAnnotations, metadata.chunkDurationsMs[index]);
        if (reused.captions) {
          transcription = previous;
          chunkAlignment = reused;
          await fs.writeFile(transcriptPath, `${JSON.stringify(previous, null, 2)}\n`);
          metadata.reusedSavedTranscriptions ??= [];
          metadata.reusedSavedTranscriptions.push({ chunk: index + 1, attempt: saved });
          delete metadata.lastTranscriptionError;
          delete metadata.lastTranscriptionMismatch;
        }
      } catch {
        // Still fails the gate: not reused, a fresh bounded attempt follows.
      }
    }
    // Long one-take audio is transcribed in silence-bounded windows (see
    // stt-windows.mjs); a scene chunk under 25 s stays one request. The
    // windows are fixed per take so saved window responses stay valid.
    metadata.sttWindows ??= [];
    let sttWindows = metadata.sttWindows[index];
    if (!Array.isArray(sttWindows) || !sttWindows.length ||
        sttWindows.at(-1).endMs !== metadata.chunkDurationsMs[index]) {
      try {
        sttWindows = planSttWindows({
          durationMs: metadata.chunkDurationsMs[index],
          silences: metadata.chunkDurationsMs[index] >= 25_000 ? measureSilences(chunkWavPath, ffmpegRuntime) : [],
        });
      } catch (error) {
        // No measured silence: keep the whole-file request, never cut speech.
        metadata.sttWindowError = safeErrorMessage(error);
        sttWindows = [{ startMs: 0, endMs: metadata.chunkDurationsMs[index] }];
      }
      metadata.sttWindows[index] = sttWindows;
      await persistMetadata();
    }
    const windowedStt = sttWindows.length > 1;
    async function transcribeWindows(attempt) {
      const windowDir = path.join(outputDir, "stt-windows");
      await fs.mkdir(windowDir, { recursive: true });
      const annotations = [];
      for (const [windowIndex, window] of sttWindows.entries()) {
        const name = `part-${chunkNumber}-window-${pad2(windowIndex + 1)}`;
        const record = await cachedClipTranscription(path.join(windowDir, name + ".json"),
          `${window.startMs}-${window.endMs}-${transcriptionLanguages.join("+")}`, async ({ allowBackup }) => {
            const clipPath = path.join(windowDir, name + ".wav");
            cutWavClip(chunkWavPath, window.startMs, window.endMs, clipPath, ffmpegRuntime);
            return transcribeSavedAudio(clipPath, transcriptionLanguages,
              `hsk-production-${EPISODE_ID}-${index + 1}-w${windowIndex + 1}-attempt-${attempt}`,
              { stage: "stt", chunk: index + 1, allowBackup });
          });
        annotations.push(...offsetAnnotations(record.annotations, window.startMs));
      }
      if (!annotations.length)
        throw new TranscriptionResponseError("Windowed STT returned no provider word timestamps.", { retryable: true });
      return {
        transcript: annotations.map((word) => word.text).join(" "),
        wordAnnotations: annotations,
        sttWindows,
      };
    }
    if (!chunkAlignment?.captions) {
      // Direct Gemini STT on the saved audio (upload, transcribe, always delete).
      async function transcribeDirect(attempt) {
          // Keep resumable upload atomic per key; rejected credentials may start a NEW upload.
          const uploadedFile = await withGeminiKeyFailover(
            config.credentialState,
            (apiKey) => uploadForTranscription(
              apiKey,
              transcriptionAudioPath,
              `hsk-production-${EPISODE_ID}-${index + 1}-attempt-${attempt}`,
            ),
          );
          config.apiKey = config.credentialState.slots[config.credentialState.index].secret;
          try {
            const response = await requestJson(
              `${API_ROOT}/v1beta/interactions`,
              {
                method: "POST",
                headers: {
                  "x-goog-api-key": config.apiKey,
                  "Content-Type": "application/json",
                  "Api-Revision": API_REVISION,
                },
                body: JSON.stringify({
                  model: config.transcribeModel,
                  input: [{
                    type: "audio",
                    uri: uploadedFile.uri,
                    mime_type: audioMimeType(transcriptionAudioPath),
                  }],
                  generation_config: {
                    transcription_config: {
                      language_codes: transcriptionLanguages,
                      mode: { type: "verbatim", timestamp_granularities: ["word"] },
                    },
                  },
                }),
              },
              "Gemini word transcription",
            );
            const annotations = getWordAnnotations(response.data);
            const transcriptText = response.data.output_text ??
              (response.data.steps ?? [])
                .filter((step) => step.type === "model_output")
                .flatMap((step) => step.content ?? [])
                .filter((block) => block.type === "text")
                .map((block) => block.text ?? "")
                .join("");
            transcription = {
              transcript: transcriptText,
              wordAnnotations: annotations.map((word) => ({
                text: word.text,
                startOffset: word.start_offset,
                endOffset: word.end_offset,
              })),
            };
          } finally {
            try {
              await deleteGeminiFile(config.apiKey, uploadedFile.name);
              metadata.transcriptionUploadCleanupResults.push({
                chunk: index + 1, attempt, deleted: true,
              });
            } catch (error) {
              metadata.transcriptionUploadCleanupResults.push({
                chunk: index + 1, attempt, deleted: false,
                error: safeErrorMessage(error),
              });
              metadata.transcriptionUploadCleanupErrors ??= [];
              metadata.transcriptionUploadCleanupErrors.push({
                chunk: index + 1, attempt,
                fileName: uploadedFile.name,
                error: safeErrorMessage(error),
              });
            }
            metadata.transcriptionUploadDeleted = metadata.transcriptionUploadCleanupResults.every(
              (result) => result.deleted === true,
            );
            await persistMetadata();
          }
          return transcription;
      }
      const result = await transcribeUntilAligned({
        previousAttempts: attempts,
        // Windowed: saved window responses are reused, so a second attempt
        // only re-requests windows that failed; an identical mismatch retry
        // would buy nothing. Gaps go to bounded recovery instead.
        maxAttempts: attempts + (windowedStt ? 2 : STT_ATTEMPTS_PER_RUN),
        onAttempt: async (attempt) => {
          attempts = attempt;
          metadata.transcriptionAttempts ??= [];
          metadata.transcriptionAttempts[index] = attempt;
          await persistMetadata();
          await persistCheckpoint();
        },
        onRetry: async (error) => {
          metadata.lastTranscriptionError = safeErrorMessage(error);
          await persistMetadata();
          await persistCheckpoint();
        },
        transcribe: async (attempt) => {
          if (windowedStt) return transcribeWindows(attempt);
          // A malformed/empty 200 retries this STT request only. The saved
          // TTS WAV/MP3 remain the immutable input to every attempt.
          const openRouterStt = () => transcribeOpenRouter({
            apiKey: openRouterKeyFor(config),
            model: config.transcribeModel,
            audioPath: transcriptionAudioPath,
            language: openRouterLanguage(transcriptionLanguages[0]),
          });
          if (config.transcriptionTransport === "openrouter") return openRouterStt();
          // Direct quota/5xx: same saved audio via the opt-in backup; speech is
          // never regenerated and the exact-token gate is unchanged.
          return withOpenRouterBackup({
            stage: "stt",
            enabled: Boolean(config.openRouterBackupKey),
            backup: openRouterStt,
            onFallback: (event) => {
              config.transcriptionTransport = "openrouter";
              config.fallbackEvents.push({ ...event, chunk: index + 1 });
              metadata.transcriptionTransport = config.transcriptionTransport;
              metadata.fallbackEvents = config.fallbackEvents;
              console.warn("VOICE_TRANSPORT_FALLBACK " + JSON.stringify(event));
            },
            primary: () => transcribeDirect(attempt),
          });
        },
        align: (response) => alignWords(
          ttsChunks[index].text,
          response.wordAnnotations,
          metadata.chunkDurationsMs[index],
        ),
      });
      attempts = result.attempts;
      transcription = result.transcription;
      chunkAlignment = result.alignment;
      if (result.error) {
        metadata.lastTranscriptionError = safeErrorMessage(result.error);
        // A failure with no provider response (transport/network, even a
        // retryable one whose run budget is spent) is fatal here and is
        // reported as such, not as a mismatch. A response that failed
        // alignment (e.g. timings moving backwards, real RU one-take
        // 2026-11-08) still goes to the recovery path below.
        if (!result.transcription) {
          await persistMetadata();
          await persistCheckpoint();
          throw result.error;
        }
      }
      const attemptPath = path.join(
        outputDir,
        `transcription-part-${chunkNumber}-attempt-${attempts}.json`,
      );
      await fs.writeFile(attemptPath, `${JSON.stringify(transcription, null, 2)}\n`);
      metadata.transcriptionAttempts ??= [];
      metadata.transcriptionAttempts[index] = attempts;
      if (chunkAlignment?.captions) {
        await fs.writeFile(
          transcriptPath,
          `${JSON.stringify(transcription, null, 2)}\n`,
        );
        delete metadata.lastTranscriptionError;
        delete metadata.lastTranscriptionMismatch;
      } else {
        metadata.lastTranscriptionMismatch = {
          chunk: index + 1,
          attempt: attempts,
          mismatches: chunkAlignment?.mismatches?.slice(0, 12) ?? [],
          error: metadata.lastTranscriptionError ?? null,
        };
        await persistMetadata();
      }
    }
    metadata.transcriptionAttempts ??= [];
    metadata.transcriptionAttempts[index] = attempts;
    if (!chunkAlignment?.captions && transcription?.wordAnnotations?.length) {
      try {
        const clips = await recoverActualWordClips({
          chunkText:ttsChunks[index].text,
          originalAnnotations:transcription.wordAnnotations,
          // Exact cuts from the WAV whose duration the timings were checked against.
          audioPath:chunkWavPath,
          durationMs:metadata.chunkDurationsMs[index],
          outputDir,chunkNumber,ffmpegRuntime,transcriptionLanguages,
          windows:sttWindows,
        });
        chunkAlignment=clips.alignment;
        transcription={
          transcript:clips.transcript,
          wordAnnotations:clips.wordAnnotations,
          recoverySpans:clips.recoverySpans,
        };
        await fs.writeFile(transcriptPath,JSON.stringify(transcription,null,2)+"\n");
        metadata.recoveredClips ??= [];
        metadata.recoveredClips.push({chunk:index+1,spans:clips.recoverySpans,
          languagePasses:clips.languagePasses,model:config.transcribeModel});
        delete metadata.lastTranscriptionError;
        delete metadata.lastTranscriptionMismatch;
        await persistMetadata();
        console.log("GEMINI_CLIP_RECOVERY_VERIFIED "+JSON.stringify({
          language:voiceProfile.locale,chunk:index+1,spans:clips.recoverySpans}));
      } catch(recoveryError) {
        metadata.lastRecoveryError=safeErrorMessage(recoveryError);
        console.warn("GEMINI_CLIP_RECOVERY_BLOCKED "+JSON.stringify({
          language:voiceProfile.locale,chunk:index+1,
          reason:metadata.lastRecoveryError}));
      }
    }
    if (!chunkAlignment?.captions && transcription?.wordAnnotations?.length) {
      metadata.lastTranscriptionMismatch = {
        chunk: index + 1,
        attempt: attempts,
        mismatches: chunkAlignment?.mismatches?.slice(0, 12) ?? [],
        error: metadata.lastTranscriptionError ?? null,
      };
    }
    if (!chunkAlignment?.captions) {
      metadata.status = "transcript-mismatch";
      metadata.transcriptMismatchCount = metadata.lastTranscriptionMismatch?.mismatches?.length ?? 1;
      metadata.firstTranscriptMismatches = metadata.lastTranscriptionMismatch?.mismatches ?? [];
      await persistMetadata();
      const fallback = await findVerifiedSampleFallback({
        episodeId: EPISODE_ID,
        episode,
        narration,
        textHash,
        profile: voiceProfile,
      });
      if (!fallback) {
        // Diagnostic only: published/approved audio is never replaced. Keep
        // exact mismatch tokens, not any secret or raw Gemini response.
        console.error("GEMINI_WORD_ALIGNMENT_DIAGNOSTIC " + JSON.stringify({
          language: voiceProfile.locale,
          episodeId: EPISODE_ID,
          chunk: index + 1,
          attempts,
          mismatches: metadata.firstTranscriptMismatches,
          error: metadata.lastTranscriptionError ?? null,
        }));
        throw new Error(
          `Gemini transcription did not match narration chunk ${index + 1} after ${attempts} attempt(s); audio was kept and VTT was not written.`,
        );
      }
      await Promise.all([
        fs.access(fallback.audioPath),
        fs.access(fallback.wavPath),
        fs.access(fallback.captionsPath),
      ]);
      const rejectedMp3 = await archiveRejectedFile(mp3Path);
      const rejectedWav = await archiveRejectedFile(wavPath);
      await Promise.all([
        fs.copyFile(fallback.audioPath, mp3Path),
        fs.copyFile(fallback.wavPath, wavPath),
      ]);
      combinedAnnotations.splice(
        0,
        combinedAnnotations.length,
        ...fallback.transcription.wordAnnotations,
      );
      chunkTranscripts.splice(
        0,
        chunkTranscripts.length,
        fallback.transcription.transcript ?? "",
      );
      metadata.audioDurationMs = fallback.metadata.audioDurationMs;
      metadata.wavBytes = (await fs.stat(wavPath)).size;
      metadata.mp3Bytes = (await fs.stat(mp3Path)).size;
      // The folder now holds the verified sample copy, not the rejected take:
      // its hashes must describe the imported bytes, or the checkpoint and the
      // imported episode disagree and an explicit resume refuses the folder.
      const sampleWavBytes = await fs.readFile(wavPath);
      metadata.wavSha256 = sha256(sampleWavBytes);
      metadata.mp3Sha256 = sha256(await fs.readFile(mp3Path));
      if (ttsChunks.length === 1)
        metadata.ttsChunks[0] = {
          file: "voice.wav", bytes: sampleWavBytes.length, sha256: metadata.wavSha256,
          transport: "verified-sample-copy",
        };
      metadata.sampleFallbackUsed = {
        reason: "Fresh Gemini transcription failed exact narration alignment after three attempts.",
        sourceAudio: path.relative(PROJECT_ROOT, fallback.audioPath),
        sourceCaptions: path.relative(PROJECT_ROOT, fallback.captionsPath),
        sourceVerifiedTranscript: path.relative(
          PROJECT_ROOT,
          fallback.transcriptionPath,
        ),
        sourceSampleMetadata: path.relative(
          PROJECT_ROOT,
          path.join(path.dirname(fallback.audioPath), "metadata.json"),
        ),
        alignment: "source annotations exactly match current narration tokens",
        rejectedMp3: rejectedMp3
          ? path.relative(PROJECT_ROOT, rejectedMp3)
          : null,
        rejectedWav: rejectedWav
          ? path.relative(PROJECT_ROOT, rejectedWav)
          : null,
      };
      metadata.status = "audio-ready";
      verifiedSampleFallbackUsed = true;
      await persistMetadata();
      await persistCheckpoint();
      console.warn(
        "Gemini transcription failed exact alignment; using the existing fully verified sample audio for this designated sample episode.",
      );
      break;
    }
    for (const word of transcription.wordAnnotations) {
      const startMs = parseOffsetMs(word.startOffset ?? word.start_offset) + offsetMs;
      const endMs = parseOffsetMs(word.endOffset ?? word.end_offset) + offsetMs;
      combinedAnnotations.push({
        text: word.text,
        start_offset: `${(startMs / 1000).toFixed(3)}s`,
        end_offset: `${(endMs / 1000).toFixed(3)}s`,
      });
    }
    chunkTranscripts.push(transcription.transcript ?? "");
    offsetMs += metadata.chunkDurationsMs[index];
  }
  if (metadata.transcriptionUploadDeleted === false) {
    console.warn(
      `Gemini temporary audio cleanup needs attention; see ${metadataPath}.`,
    );
  }
  await fs.writeFile(
    transcriptionPath,
    `${JSON.stringify({ transcript: chunkTranscripts.join(" "), wordAnnotations: combinedAnnotations }, null, 2)}\n`,
  );

  const alignment = alignWords(narration, combinedAnnotations, metadata.audioDurationMs);
  metadata.timestampRepairs = alignment.timingRepairs;
  if (alignment.mismatches.length) {
    metadata.status = "transcript-mismatch";
    metadata.transcriptMismatchCount = alignment.mismatches.length;
    metadata.firstTranscriptMismatches = alignment.mismatches.slice(0, 12);
    await persistMetadata();
    throw new Error(
      `Gemini transcript differs from the narration in ${alignment.mismatches.length} place(s); audio was kept, VTT was not written.`,
    );
  }
  if (metadata.lastTranscriptionMismatch) {
    metadata.previousRejectedTranscription ??= metadata.lastTranscriptionMismatch;
    delete metadata.lastTranscriptionMismatch;
  }
  delete metadata.transcriptMismatchCount;
  delete metadata.firstTranscriptMismatches;
  delete metadata.lastTranscriptionError;
  await fs.writeFile(
    path.join(outputDir, "captions.vtt"),
    writeVtt(alignment.captions),
    "utf8",
  );
  metadata.status = "ready-for-import";
  metadata.ttsTransport = config.ttsTransport;
  metadata.transcriptionTransport = config.transcriptionTransport;
  metadata.fallbackEvents = config.fallbackEvents;
  if (config.transcriptionTransport === "openrouter" && config.apiProvider === "gemini-direct")
    metadata.wordAlignment = "OpenRouter backup word timestamps (one ISO-639-1 hint per request) + exact token alignment";
  metadata.captionWordCount = alignment.captions.length;
  await persistMetadata();
  await persistCheckpoint();
  execFileSync(
    process.execPath,
    [
      path.join(PROJECT_ROOT, "scripts", "import-voice.mjs"),
      EPISODE_ID,
      mp3Path,
      path.join(outputDir, "captions.vtt"),
      ...(PLATFORM ? ["--platform", PLATFORM] : []),
    ],
    { cwd: PROJECT_ROOT, stdio: "inherit", env: languageEnvironment() },
  );
  metadata.status = "imported";
  metadata.importedAt = new Date().toISOString();
  if (!PLATFORM && voiceProfile.status === "pending-owner-approval" &&
      voiceProfile.sampleEpisodeId === EPISODE_ID) {
    metadata.sampleOnly = true;
    metadata.status = "ready-for-owner-audition";
    voiceProfile.sampleAudio = path.relative(PROJECT_ROOT, mp3Path);
    voiceProfile.sampleCaptions = path.relative(PROJECT_ROOT, path.join(outputDir, "captions.vtt"));
    await writeJson(languageSettings().voiceProfilePath, voiceProfile);
  }
  await persistMetadata();
  await persistCheckpoint();
  console.log(`${config.apiProvider} production voice imported: ${mp3Path}`);
  console.log(`Word-timed VTT: ${path.join(outputDir, "captions.vtt")}`);
  console.log(`Metadata: ${metadataPath}`);
} catch (error) {
  metadata.ttsRequestCount = config.ttsRequestCount;
  if (!metadata.status || ["starting", "audio-generating", "audio-ready", "ready-for-import"].includes(metadata.status))
    metadata.status = "failed";
  metadata.error = safeErrorMessage(error);
  await persistMetadata();
  await persistCheckpoint();
  await writeTargetStatus({
    stage: "gemini-voice-blocked",
    sourceRevision,
    updatedAt: new Date().toISOString(),
    voiceProfileId: voiceProfile.profileId,
    voiceTextHash: currentNarrationHash,
    reason: metadata.error,
    metadataPath,
    audioPreserved: Boolean(metadata.mp3Bytes),
  });
  throw error;
}
