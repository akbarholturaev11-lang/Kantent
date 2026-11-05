/**
 * Explicitly requested live smoke check of the default OpenRouter voice API.
 * Two short licensed/original utterances only; never accesses user episodes or publishes.
 * No credentials, raw provider response or audio is committed or printed.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { synthesizeOpenRouterWav, transcribeOpenRouter } from "./openrouter-voice.mjs";

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY is missing from GitHub Actions secrets");
const cases = [
  { locale: "ru-RU", model: "gemini-3.8-flash-lite-tts",
    text: "Здравствуйте. Сегодня мы изучаем китайский язык. 你好。" },
  { locale: "tg-TJ", model: "gemini-3.8-flash-tts",
    text: "Салом. Имрӯз мо забони чиниро меомӯзем. 你好。" },
];
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-openrouter-smoke-"));
try {
  for (const {locale,model,text} of cases) {
    const wav = await synthesizeOpenRouterWav({
      apiKey:key, model, voice:"Kore", text,
      sampleRateHz:24000, channels:1,
    });
    assert.equal(wav.toString("ascii",0,4),"RIFF");
    assert.equal(wav.toString("ascii",8,12),"WAVE");
    assert.ok(wav.byteLength > 44 + 4800,"Audio suspiciously short");
    const filename = path.join(dir,locale+".wav");
    await fs.writeFile(filename,wav);
    console.log("TTS_SUCCESS",locale,model,"wav_bytes="+wav.byteLength);
    const reports = [];
    for (const hint of [undefined]) {
      const result = await transcribeOpenRouter({
        apiKey:key,model:"gemini-3.5-transcribe",audioPath:filename,language:hint,
      });
      console.log("STT_DIAGNOSTIC",locale,"hint="+(hint||"auto"),
        JSON.stringify({transcript:result.transcript,wordCount:result.wordAnnotations.length,
          words:result.wordAnnotations.map(w=>w.text)}));
      reports.push({hint:hint||"auto",...result});
    }
    for (const candidate of ["elevenlabs/scribe-v2"]) {
      const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization:"Bearer "+key, "Content-Type":"application/json" },
        body: JSON.stringify({
          model:candidate,
          input_audio: {data:wav.toString("base64"),format:"wav"},
          response_format:"verbose_json",
          timestamp_granularities:["word"],
        }),
        signal:AbortSignal.timeout(120000),
      });
      const body = await response.json();
      console.log("ALTERNATE_STT_DIAGNOSTIC",locale,candidate,
        JSON.stringify({status:response.status,text:body?.text||null,
          words:(body?.words||[]).map(w=>w.word||w.text).slice(0,40),
          code:body?.error?.code||null}));
    }
    const anyTimed = reports.some(r=>r.wordAnnotations.length >= 3);
    assert.ok(anyTimed,"No usable language hint returned 3+ word timestamp entries");
  }
  console.log("ALL_OPENROUTER_LIVE_VOICE_SMOKE_CHECKS_PASSED");
} finally {
  await fs.rm(dir,{recursive:true,force:true});
}
