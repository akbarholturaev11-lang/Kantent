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
    const result = await transcribeOpenRouter({
      apiKey:key,model:"gemini-3.5-transcribe",audioPath:filename,
    });
    assert.ok(result.wordAnnotations.length >= 3, "Not enough word timestamps");
    assert.ok(result.wordAnnotations.every(w=>/^\d+\.\d{3}s$/.test(w.startOffset) && /^\d+\.\d{3}s$/.test(w.endOffset)));
    console.log("STT_SUCCESS",locale,"word_count="+result.wordAnnotations.length);
  }
  console.log("ALL_OPENROUTER_LIVE_VOICE_SMOKE_CHECKS_PASSED");
} finally {
  await fs.rm(dir,{recursive:true,force:true});
}
