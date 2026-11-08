import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  resolveVoiceApi, requireOpenRouterKey, openRouterModel,
  synthesizeOpenRouterWav, transcribeOpenRouter,
  TranscriptionResponseError, transcribeUntilAligned,
  OPENROUTER_TTS_MAX_ATTEMPTS, STT_ATTEMPTS_PER_RUN, parsePcmFormat,
} from "./openrouter-voice.mjs";

test("default provider is OpenRouter; direct Gemini is explicit secondary", () => {
  assert.equal(resolveVoiceApi({}), "openrouter");
  assert.equal(resolveVoiceApi({ HSK_AI_VOICE_API_PROVIDER: "gemini-direct" }), "gemini-direct");
  assert.throws(() => resolveVoiceApi({ HSK_AI_VOICE_API_PROVIDER: "unknown" }));
  assert.throws(() => requireOpenRouterKey({}), /OPENROUTER_API_KEY/);
  assert.equal(requireOpenRouterKey({ OPENROUTER_API_KEY: " key " }), "key");
});

test("approved Russian, Tajik and STT models keep their exact identity", () => {
  assert.equal(openRouterModel("gemini-3.8-flash-lite-tts"), "google/gemini-3.8-flash-lite-tts");
  assert.equal(openRouterModel("gemini-3.8-flash-tts"), "google/gemini-3.8-flash-tts");
  assert.equal(openRouterModel("gemini-3.5-transcribe"), "google/gemini-3.5-transcribe");
  assert.throws(() => openRouterModel("any-unapproved-model"));
});

test("speech sends approved voice to OpenRouter and wraps 24k mono PCM as valid WAV", async () => {
  const seen = [];
  const pcm = Buffer.from([0, 0, 42, 0, 12, 0, 0, 0]);
  let called = 0;
  const wav = await synthesizeOpenRouterWav({
    apiKey: "test-secret", text: "Здравствуйте", voice: "Kore",
    model: "gemini-3.8-flash-lite-tts",
    onAttempt: () => called++,
    fetchImpl: async (url, options) => {
      seen.push({ url, options });
      return new Response(pcm, { status: 200, headers: { "content-type": "audio/pcm; rate=24000; channels=1" } });
    },
  });
  assert.equal(called, 1);
  assert.equal(seen[0].url, "https://openrouter.ai/api/v1/audio/speech");
  assert.equal(seen[0].options.headers.Authorization, "Bearer test-secret");
  assert.deepEqual(JSON.parse(seen[0].options.body), {
    model: "google/gemini-3.8-flash-lite-tts",
    input: "Здравствуйте", voice: "Kore", response_format: "pcm",
  });
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.deepEqual(wav.subarray(44), pcm);
});

test("speech fails closed when provider returns JSON error or wrong audio type", async () => {
  const opts = {
    apiKey: "key", text: "Salom", model: "gemini-3.8-flash-tts", voice: "Kore",
  };
  await assert.rejects(
    synthesizeOpenRouterWav({ ...opts, fetchImpl: async () =>
      new Response(JSON.stringify({error:{message:"Invalid key"}}),
        {status:401,headers:{"content-type":"application/json"}}),
    }), /HTTP 401/);
  await assert.rejects(
    synthesizeOpenRouterWav({ ...opts, fetchImpl: async () =>
      new Response("not-audio",{status:200,headers:{"content-type":"application/json"}}),
    }), /unexpected audio content-type/);
  await assert.rejects(
    synthesizeOpenRouterWav({ ...opts, style: "excited", fetchImpl: async () => { throw Error("must not call"); } }),
    /style pass-through/);
});

test("word timestamps are sourced exactly from OpenRouter verbose_json; never fabricated", async () => {
  let payload;
  const result = await transcribeOpenRouter({
    apiKey: "key", model: "gemini-3.5-transcribe", audioPath: "/tmp/voice.mp3",
    readFile: async () => Buffer.from([0xff, 0xfb, 0x11, 0x22]),
    fetchImpl: async (url,options) => {
      assert.equal(url,"https://openrouter.ai/api/v1/audio/transcriptions");
      payload=JSON.parse(options.body);
      return new Response(JSON.stringify({ text:"你好 мир",
        words:[{word:"你好",start:0,end:0.5},{word:"мир",start:0.5,end:1.2}] }),
        {status:200,headers:{"content-type":"application/json"}});
    },
  });
  assert.equal(payload.model,"google/gemini-3.5-transcribe");
  assert.equal(payload.response_format,"verbose_json");
  assert.deepEqual(payload.timestamp_granularities,["word"]);
  assert.equal(payload.language,undefined);
  assert.equal(payload.input_audio.format,"mp3");
  assert.deepEqual(result.wordAnnotations,[
    {text:"你好",startOffset:"0.000s",endOffset:"0.500s"},
    {text:"мир",startOffset:"0.500s",endOffset:"1.200s"},
  ]);
});

test("missing/invalid provider word timing blocks transcription", async () => {
  const opts = {
    apiKey:"key",model:"gemini-3.5-transcribe",audioPath:"/tmp/test.wav",
    readFile:async()=>Buffer.from("audio"),
  };
  await assert.rejects(
    transcribeOpenRouter({ ...opts, fetchImpl:async()=>new Response(JSON.stringify({text:"hello"}),{status:200}) }),
    /no provider word timestamps/);
  await assert.rejects(
    transcribeOpenRouter({ ...opts, fetchImpl:async()=>new Response(JSON.stringify({
      text:"hello",words:[{word:"hello",start:2,end:1}],
    }),{status:200}) }),
    /Invalid OpenRouter provider word timestamp/);
  // Real 2026-11-08 RU one-take window: a zero-length word is passed through
  // for the shared ≤250 ms repair instead of failing the whole paid response.
  const zero = await transcribeOpenRouter({ ...opts, fetchImpl:async()=>new Response(JSON.stringify({
    text:"и 他",words:[{word:"и",start:7.1,end:7.1},{word:"他",start:7.1,end:7.3}],
  }),{status:200}) });
  assert.deepEqual(zero.wordAnnotations.map((w)=>[w.startOffset,w.endOffset]),[["7.100s","7.100s"],["7.100s","7.300s"]]);
});

test("200 with empty words retries STT only and keeps the original audio bytes", async () => {
  const audio = Buffer.from("immutable-source-audio");
  const audioHash = createHash("sha256").update(audio).digest("hex");
  const submittedAudio = [];
  let sttCalls = 0;
  const result = await transcribeUntilAligned({
    transcribe: async () => {
      return transcribeOpenRouter({
        apiKey: "key",
        model: "gemini-3.5-transcribe",
        audioPath: "/tmp/voice.mp3",
        readFile: async () => audio,
        fetchImpl: async (_url, options) => {
          sttCalls += 1;
          const submitted = Buffer.from(JSON.parse(options.body).input_audio.data, "base64");
          submittedAudio.push(submitted);
          const response = sttCalls === 1
            ? { text: "" }
            : { text: "你好", words: [{ word: "你好", start: 0, end: 0.5 }] };
          return new Response(JSON.stringify(response), { status: 200 });
        },
      });
    },
    align: (transcription) => ({ captions: transcription.wordAnnotations }),
  });
  assert.equal(result.attempts, 2);
  assert.equal(sttCalls, 2);
  assert.equal(result.alignment.captions[0].text, "你好");
  assert.deepEqual(submittedAudio, [audio, audio]);
  assert.equal(createHash("sha256").update(audio).digest("hex"), audioHash);
});

test("STT retry budget is bounded and permanent HTTP errors are not retried", async () => {
  let transientCalls = 0;
  const exhausted = await transcribeUntilAligned({
    transcribe: async () => {
      transientCalls += 1;
      throw new TranscriptionResponseError("empty words", { retryable: true, httpStatus: 200 });
    },
    align: () => ({ captions: [] }),
  });
  assert.equal(transientCalls, 3);
  assert.equal(exhausted.attempts, 3);
  assert.equal(exhausted.retryable, true);

  let permanentCalls = 0;
  const permanent = await transcribeUntilAligned({
    transcribe: async () => {
      permanentCalls += 1;
      throw new TranscriptionResponseError("bad request", { retryable: false, httpStatus: 400 });
    },
    align: () => ({ captions: [] }),
  });
  assert.equal(permanentCalls, 1);
  assert.equal(permanent.retryable, false);
  assert.equal(permanent.error.httpStatus, 400);
});

const ttsOptions = (fetchImpl, extra = {}) => ({
  apiKey: "key", text: "Salom", model: "gemini-3.8-flash-tts", voice: "Kore", fetchImpl, ...extra,
});
const pcmResponse = (bytes, type = "audio/pcm; rate=24000; channels=1") =>
  new Response(bytes, { status: 200, headers: { "content-type": type } });
const errorResponse = (status, headers = {}) =>
  new Response(JSON.stringify({ error: { message: "upstream" } }),
    { status, headers: { "content-type": "application/json", ...headers } });

test("V-15: one bounded retry only for an HTTP error response that carried no audio", async () => {
  const waits = [];
  let attempts = 0;
  const wav = await synthesizeOpenRouterWav(ttsOptions(async () =>
    ++attempts === 1 ? errorResponse(502) : pcmResponse(Buffer.alloc(4)),
  { onAttempt: () => {}, sleep: async (ms) => waits.push(ms) }));
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [2000]);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(OPENROUTER_TTS_MAX_ATTEMPTS, 2);

  attempts = 0;
  await synthesizeOpenRouterWav(ttsOptions(async () =>
    ++attempts === 1 ? errorResponse(429, { "retry-after": "3" }) : pcmResponse(Buffer.alloc(2)),
  { sleep: async (ms) => waits.push(ms) }));
  assert.equal(waits.at(-1), 3000, "Retry-After is honored");

  for (const [status, headers] of [[503, {}], [429, { "retry-after": "120" }], [401, {}], [402, {}]]) {
    attempts = 0;
    await assert.rejects(synthesizeOpenRouterWav(ttsOptions(async () => { attempts += 1; return errorResponse(status, headers); },
      { sleep: async () => {} })), new RegExp("HTTP " + status));
    assert.equal(attempts, status === 503 ? 2 : 1, "status " + status + " attempts");
  }
});

test("V-15: a timeout or network abort may have billed audio, so it is never retried", async () => {
  let attempts = 0;
  await assert.rejects(synthesizeOpenRouterWav(ttsOptions(async () => {
    attempts += 1;
    throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  }, { sleep: async () => {} })), /timeout/);
  assert.equal(attempts, 1);
});

test("V-14: the declared PCM rate/channels label the WAV; unsafe formats fail closed", async () => {
  const stereo = await synthesizeOpenRouterWav(ttsOptions(async () =>
    pcmResponse(Buffer.alloc(8), "audio/pcm; rate=48000; channels=2")));
  assert.equal(stereo.readUInt32LE(24), 48000);
  assert.equal(stereo.readUInt16LE(22), 2);
  assert.equal(stereo.readUInt32LE(28), 48000 * 4);
  assert.equal(stereo.readUInt16LE(32), 4);
  const plain = await synthesizeOpenRouterWav(ttsOptions(async () =>
    pcmResponse(Buffer.alloc(2), "application/octet-stream")));
  assert.equal(plain.readUInt32LE(24), 24000, "no declared format keeps the approved 24 kHz mono");
  assert.deepEqual(parsePcmFormat("audio/pcm;Rate=16000"), { sampleRate: 16000, channels: 1 });
  await assert.rejects(synthesizeOpenRouterWav(ttsOptions(async () =>
    pcmResponse(Buffer.alloc(6), "audio/pcm; rate=24000; channels=2"))), /truncated/);
  for (const type of ["audio/pcm; bits=24", "audio/pcm; rate=abc", "audio/pcm; channels=6", "audio/pcm; encoding=f32le"])
    assert.throws(() => parsePcmFormat(type), /PCM/, type);
});

test("STT budget is per run: a resumed take with 3 spent attempts still gets 3 fresh ones", async () => {
  let calls = 0;
  const result = await transcribeUntilAligned({
    previousAttempts: 3,
    maxAttempts: 3 + STT_ATTEMPTS_PER_RUN,
    transcribe: async () => { calls += 1; return { wordAnnotations: [{ text: "x" }] }; },
    align: () => (calls === 2 ? { captions: [{ text: "x" }] } : { mismatches: ["x"] }),
  });
  assert.equal(calls, 2);
  assert.equal(result.attempts, 5, "attempt numbering continues for saved files");
  assert.ok(result.alignment.captions);
});

test("OpenRouter TTS retries once when it never connected, never after a sent request", async () => {
  const connect = Object.assign(new TypeError("fetch failed"),
    { cause: Object.assign(new Error("connect"), { code: "UND_ERR_CONNECT_TIMEOUT" }) });
  let attempts = 0;
  const wav = await synthesizeOpenRouterWav(ttsOptions(async () => {
    attempts += 1;
    if (attempts === 1) throw connect;
    return pcmResponse(Buffer.alloc(2));
  }, { sleep: async () => {} }));
  assert.equal(attempts, 2);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  attempts = 0;
  await assert.rejects(synthesizeOpenRouterWav(ttsOptions(async () => { attempts += 1; throw connect; },
    { sleep: async () => {} })), /fetch failed/);
  assert.equal(attempts, 2, "bounded");
});
