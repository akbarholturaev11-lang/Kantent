import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { assertNotPreviouslyPublished } from "./published-evidence.mjs";
import { requireGeminiKeySlots, withGeminiKeyFailover } from "./video-credentials.mjs";
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
const EPISODE_ID = process.argv[2];
const CLI_OPTIONS = process.argv.slice(3);
let PLATFORM;
let RESUME_FOLDER_NAME;
for (let index = 0; index < CLI_OPTIONS.length; index += 1) {
  const option = CLI_OPTIONS[index];
  if (option === "--platform" && !PLATFORM) {
    PLATFORM = CLI_OPTIONS[++index];
  } else if (option === "--resume" && !RESUME_FOLDER_NAME) {
    RESUME_FOLDER_NAME = CLI_OPTIONS[++index];
  } else {
    throw new Error("Use [--platform tiktok] [--resume <generation-folder>].");
  }
}

function requireEpisodeId(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "")) {
    throw new Error(
      "Foydalanish: npm run content:voice -- <episode-ID> [--resume <generation-folder>]",
    );
  }
  return value;
}

async function loadGeminiEnvironment(profile) {
  if (
    (!process.env.GEMINI_API_KEY || !process.env.HSK_AI_ALLOW_GEMINI_API) &&
    typeof process.loadEnvFile === "function"
  ) {
    try {
      process.loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if (process.env.HSK_AI_ALLOW_GEMINI_API !== "true") {
    throw new Error(
      "Gemini production TTS uchun .env.local ichida HSK_AI_ALLOW_GEMINI_API=true bo‘lishi kerak.",
    );
  }
  const slots = requireGeminiKeySlots(process.env);
  const credentialState = { slots, index: 0 };
  return {
    apiKey: slots[0].secret,
    credentialState,
    ttsModel: profile.ttsModel,
    voice: profile.voiceName,
    transcribeModel: profile.transcriptionModel,
    style: profile.spokenStyle || "",
    mp3BitrateKbps: profile.mp3BitrateKbps,
    sampleRateHz: profile.sampleRateHz,
    channels: profile.channels,
  };
}

async function requestJson(url, options, label) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(120_000),
    });
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
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < maxAttempts) {
      const delayMs = 1000 * 2 ** attempt;
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

/**
 * A single mixed-language Gemini transcription can drop Chinese or the
 * explanation language. This selects only evidence-backed word timestamps
 * from independent language transcriptions, never inventing timing or text.
 */
function alignIndependentLanguageTracks(text, tracks, audioDurationMs) {
  const expected = flattenExpected(sourceWords(text));
  const seen = [];
  for (const track of tracks) {
    const words = flattenRecognized(track.wordAnnotations, audioDurationMs, []);
    for (const word of words) seen.push({ ...word, language: track.language });
  }
  seen.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const dp = Array(expected.length + 1).fill(null);
  dp[0] = { indices: [], score: 0, lastStart: -1, lastEnd: -1 };
  for (let index = 0; index < seen.length; index++) {
    const recognized = seen[index];
    for (let k = expected.length - 1; k >= 0; k--) {
      const prev = dp[k];
      if (!prev || expected[k].text !== recognized.text ||
          recognized.startMs < prev.lastStart ||
          recognized.endMs < prev.lastEnd - 250) continue;
      const gap = Math.max(0, recognized.startMs - prev.lastEnd);
      const candidate = {
        indices: [...prev.indices, index],
        score: prev.score + gap * 0.001,
        lastStart: recognized.startMs,
        lastEnd: recognized.endMs,
      };
      if (!dp[k + 1] || candidate.score < dp[k + 1].score) dp[k + 1] = candidate;
    }
  }
  const path = dp[expected.length];
  if (!path) {
    const bestIndex = dp.findLastIndex(Boolean);
    return {
      success: false, matched: bestIndex,
      expectedCount: expected.length, recognizedCount: seen.length,
      nextExpected: expected.slice(bestIndex, bestIndex + 8).map(x => x.text),
      wordAnnotations: [],
    };
  }
  const wordAnnotations = path.indices.map(index => {
    const evidence = seen[index];
    return {
      // The token and timestamps are derived from a real Gemini annotation.
      text: evidence.text,
      startOffset: (evidence.startMs / 1000).toFixed(3) + "s",
      endOffset: (evidence.endMs / 1000).toFixed(3) + "s",
      languageEvidence: evidence.language,
    };
  });
  const check = alignWords(text, wordAnnotations, audioDurationMs);
  if (!check.captions || check.mismatches.length) {
    return { success: false, matched: expected.length,
      expectedCount: expected.length, recognizedCount: seen.length,
      mismatches: check.mismatches, wordAnnotations: [] };
  }
  return { success: true, matched: expected.length,
    expectedCount: expected.length, recognizedCount: seen.length,
    wordAnnotations };
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
      if (text && text.length + 1 + piece.length > maxCharacters) {
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

async function generateTtsWav(config, text) {
  const content = [{ type: "text", text }];
  if (config.style) {
    content[0].annotations = [
      { type: "speech_metadata", style: config.style },
    ];
  }
  // Rotate credentials only if this standalone TTS call fails. Do not
  // regenerate a successful take or change provider, model, voice or cues.
  const tts = await withGeminiKeyFailover(
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
    ),
  );
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

function safeErrorMessage(error) {
  return String(error?.message ?? error).replace(
    /(?:AIza)[A-Za-z0-9_-]{20,}/g,
    "[redacted]",
  );
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
const config = await loadGeminiEnvironment(voiceProfile);
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
const previousStatus = await readStatus(EPISODE_ID);
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
  provider: voiceProfile.serviceName,
  voiceProfileId: voiceProfile.profileId,
  voice: voiceProfile.voiceName,
  voiceTextHash: currentNarrationHash,
});

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const productionRoot = path.join(targetReviewDir, "gemini-production");
const outputDir = path.join(productionRoot, RESUME_FOLDER_NAME ?? timestamp);
await fs.mkdir(outputDir, { recursive: true });
const wavPath = path.join(outputDir, "voice.wav");
const mp3Path = path.join(outputDir, "voice.mp3");
const transcriptionPath = path.join(outputDir, "transcription.json");
const metadataPath = path.join(outputDir, "metadata.json");
const textHash = createHash("sha256").update(narration, "utf8").digest("hex");
let metadata;
if (RESUME_FOLDER_NAME) {
  metadata = await readJson(metadataPath);
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
  const savedText = (
    await fs.readFile(path.join(outputDir, "tts-input.txt"), "utf8")
  ).trim();
  if (savedText !== narration) {
    throw new Error(
      "Existing Gemini production text does not match the current narration.",
    );
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
    provider: "gemini-api",
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
const ttsChunks = createTtsChunks(
  PLATFORM ? { ...episode, scenes: [tiktokCtaScene] } : episode,
);
if (!ttsChunks.length) throw new Error("No narration chunks were created.");
if (RESUME_FOLDER_NAME && metadata.ttsChunkCount !== ttsChunks.length) {
  throw new Error("Saved generation chunk count does not match the current narration.");
}
metadata.ttsChunkCount = ttsChunks.length;
metadata.chunkSceneIds = ttsChunks.map((chunk) => chunk.sceneIds);
metadata.chunkingStrategy = "scene boundaries; at most 12000 narration characters per TTS and transcription request";
metadata.previousVoiceProvider = episode.voiceProvider ?? null;
metadata.previousVoiceProfileId = episode.voiceProfileId ?? null;
await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

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
    try {
      await fs.access(chunkPath);
      const header = await fs.open(chunkPath, "r");
      const signature = Buffer.alloc(12);
      await header.read(signature, 0, 12, 0);
      await header.close();
      if (signature.subarray(0, 4).toString("ascii") !== "RIFF" ||
          signature.subarray(8, 12).toString("ascii") !== "WAVE")
        throw new Error(`Saved TTS chunk ${index + 1} is not a WAV file.`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const wav = await generateTtsWav(config, chunk.text);
      await fs.writeFile(chunkPath, wav, { flag: "wx" });
    }
    completedTtsChunks += 1;
    metadata.completedTtsChunks = completedTtsChunks;
    metadata.status = "audio-generating";
    await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  }

  if (ttsChunks.length > 1) {
    const concatListPath = path.join(outputDir, "audio-concat.txt");
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
        "-ac", String(config.channels), wavPath,
      ],
      { cwd: outputDir, env: ffmpegRuntime.env, stdio: ["ignore", "pipe", "pipe"] },
    );
  }

  await fs.access(mp3Path).then(
    () => {
      if (!RESUME_FOLDER_NAME)
        throw new Error("Production MP3 output already exists; refusing to overwrite it.");
    },
    (error) => {
      if (error?.code !== "ENOENT") throw error;
    },
  );
  try {
    await fs.access(mp3Path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    execFileSync(
      ffmpegRuntime.ffmpegPath,
      [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-i", wavPath, "-map", "0:a:0", "-vn", "-c:a", "libmp3lame",
        "-b:a", `${config.mp3BitrateKbps}k`, "-ar", String(config.sampleRateHz),
        "-ac", String(config.channels), "-map_metadata", "-1", "-f", "mp3", mp3Path,
      ],
      { env: ffmpegRuntime.env, stdio: ["ignore", "pipe", "pipe"] },
    );
  }
  metadata.wavBytes = (await fs.stat(wavPath)).size;
  metadata.mp3Bytes = (await fs.stat(mp3Path)).size;
  metadata.audioDurationMs = audioDurationMs(mp3Path, ffmpegRuntime);
  metadata.chunkDurationsMs = await Promise.all(
    chunkWavPaths.map((chunkPath) => mediaDurationMs(chunkPath, ffmpegRuntime)),
  );
  metadata.status = "audio-ready";
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

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
    let attempts = metadata.transcriptionAttempts?.[index] ?? (transcription ? 1 : 0);
    while (!chunkAlignment?.captions && attempts < 2) {
      attempts += 1;
      // Keep resumable upload atomic per key; a rejected start may switch to a
      // backup and start a NEW upload. Transcribe + cleanup use that SAME key.
      const uploadedFile = await withGeminiKeyFailover(
        config.credentialState,
        (apiKey) => uploadForTranscription(
          apiKey,
          transcriptionAudioPath,
          `hsk-production-${EPISODE_ID}-${index + 1}-attempt-${attempts}`,
        ),
      );
      config.apiKey = config.credentialState.slots[config.credentialState.index].secret;
      try {
        const tracks = [];
        for (const languageCode of transcriptionLanguages) {
          const response = await requestJson(
            API_ROOT + "/v1beta/interactions",
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
                    language_codes: [languageCode],
                    mode: { type: "verbatim", timestamp_granularities: ["word"] },
                  },
                },
              }),
            },
            "Gemini independent " + languageCode + " word transcription",
          );
          const annotations = getWordAnnotations(response.data);
          const transcriptText = response.data.output_text ??
            (response.data.steps ?? [])
              .filter(step => step.type === "model_output")
              .flatMap(step => step.content ?? [])
              .filter(block => block.type === "text")
              .map(block => block.text ?? "")
              .join("");
          tracks.push({ language: languageCode, wordAnnotations: annotations,
            transcript: transcriptText });
        }
        const combined = alignIndependentLanguageTracks(
          ttsChunks[index].text,
          tracks,
          metadata.chunkDurationsMs[index],
        );
        if (!combined.success) {
          metadata.lastTranscriptionError =
            "Independent bilingual word cues incomplete: matched " +
            combined.matched + "/" + combined.expectedCount +
            "; next expected: " + JSON.stringify(combined.nextExpected ?? []) +
            "; recognizer token count: " + combined.recognizedCount;
        }
        transcription = {
          transcript: tracks.map(t => t.transcript).join(" / "),
          wordAnnotations: combined.wordAnnotations,
          sourceLanguageTracks: tracks.map(track => ({
            language: track.language, transcript: track.transcript,
            wordAnnotations: track.wordAnnotations,
          })),
          exactSequenceMatched: combined.success,
        };
      } finally {
        try {
          await deleteGeminiFile(config.apiKey, uploadedFile.name);
          metadata.transcriptionUploadCleanupResults.push({
            chunk: index + 1,
            attempt: attempts,
            deleted: true,
          });
        } catch (error) {
          metadata.transcriptionUploadCleanupResults.push({
            chunk: index + 1,
            attempt: attempts,
            deleted: false,
            error: safeErrorMessage(error),
          });
          metadata.transcriptionUploadCleanupErrors ??= [];
          metadata.transcriptionUploadCleanupErrors.push({
            chunk: index + 1,
            attempt: attempts,
            fileName: uploadedFile.name,
            error: safeErrorMessage(error),
          });
        }
        metadata.transcriptionUploadDeleted = metadata.transcriptionUploadCleanupResults.every(
          (result) => result.deleted === true,
        );
        await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
      }
      const attemptPath = path.join(
        outputDir,
        `transcription-part-${chunkNumber}-attempt-${attempts}.json`,
      );
      await fs.writeFile(attemptPath, `${JSON.stringify(transcription, null, 2)}\n`);
      metadata.transcriptionAttempts ??= [];
      metadata.transcriptionAttempts[index] = attempts;
      try {
        chunkAlignment = alignWords(
          ttsChunks[index].text,
          transcription.wordAnnotations,
          metadata.chunkDurationsMs[index],
        );
      } catch (error) {
        metadata.lastTranscriptionError = safeErrorMessage(error);
        chunkAlignment = undefined;
      }
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
        await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
      }
    }
    metadata.transcriptionAttempts ??= [];
    metadata.transcriptionAttempts[index] = attempts;
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
      await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
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
      await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
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
    await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
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
  metadata.captionWordCount = alignment.captions.length;
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
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
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Gemini production voice imported: ${mp3Path}`);
  console.log(`Word-timed VTT: ${path.join(outputDir, "captions.vtt")}`);
  console.log(`Metadata: ${metadataPath}`);
} catch (error) {
  if (!metadata.status || ["starting", "audio-generating", "audio-ready", "ready-for-import"].includes(metadata.status))
    metadata.status = "failed";
  metadata.error = safeErrorMessage(error);
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
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
