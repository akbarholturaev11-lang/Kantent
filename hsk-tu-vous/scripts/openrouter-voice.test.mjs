import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveVoiceApi, requireOpenRouterKey, openRouterModel,
  synthesizeOpenRouterWav, transcribeOpenRouter,
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
});
