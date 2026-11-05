/**
 * Diagnostic A/B voice experiment. No publishing, never edits working episode.
 * Same approved model, Kore, script and provider; only chunk strategy differs.
 * First three authored scenes only. Writes no secrets or raw API bodies.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { synthesizeOpenRouterWav } from "./openrouter-voice.mjs";

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY is missing");
const locales = [
  { label: "ru", model: "gemini-3.8-flash-lite-tts",
    source: "content/episodes/ji-vs-duoshao-books-price-20261106.json" },
  { label: "tg", model: "gemini-3.8-flash-tts",
    source: "content/locales/tg/episodes/ji-vs-duoshao-books-price-20261106.json" },
];
const out = path.resolve(process.argv[2] || "voice-ab-audit-output");
await fs.mkdir(out, { recursive:true });
const metrics = [];

function measureWav(wav) {
  if (wav.toString("ascii",0,4)!=="RIFF" || wav.toString("ascii",8,12)!=="WAVE")
    throw new Error("Invalid WAV");
  const samples = [];
  for(let i=44;i+1<wav.length;i+=2) samples.push(wav.readInt16LE(i)/32768);
  if(samples.length<24000)throw new Error("Suspiciously short audio");
  let squares=0,clipped=0,veryQuiet=0;
  for(const a of samples){squares+=a*a;if(Math.abs(a)>0.98)clipped++;if(Math.abs(a)<0.001)veryQuiet++;}
  const rms=Math.sqrt(squares/samples.length);
  return {
    seconds:Number((samples.length/24000).toFixed(3)),
    rmsDbfs:Number((20*Math.log10(Math.max(rms,1e-9))).toFixed(2)),
    nearSilencePct:Number((100*veryQuiet/samples.length).toFixed(2)),
    clippedPct:Number((100*clipped/samples.length).toFixed(4)),
  };
}
for (const {label,model,source} of locales) {
  const episode = JSON.parse(await fs.readFile(source, "utf8"));
  const scenes = episode.scenes.slice(0,3);
  const narrations=scenes.map(x=>x.narration.trim());
  if(narrations.some(x=>!x) || narrations.join(" ").length>1200)throw Error("Unexpected script");
  const variants=[
    {name:"continuous",parts:[{id:"full",text:narrations.join(" ")}]},
    {name:"scene",parts:scenes.map(x=>({id:x.id,text:x.narration.trim()}))},
  ];
  for (const v of variants) {
    for(const part of v.parts) {
      const wav = await synthesizeOpenRouterWav({
        apiKey:key,model,voice:"Kore",text:part.text,sampleRateHz:24000,channels:1,
      });
      const filename=label+"-"+v.name+"-"+part.id+".wav";
      await fs.writeFile(path.join(out,filename),wav);
      const row={locale:label,model,variant:v.name,scene:part.id,chars:part.text.length,
        file:filename,...measureWav(wav)};
      metrics.push(row);
      console.log("AB_TTS",JSON.stringify(row));
    }
  }
}
await fs.writeFile(path.join(out,"metrics.json"),JSON.stringify(metrics,null,2)+"\n");
await fs.writeFile(path.join(out,"README.txt"),
  "AB evaluation: same content, Gemini TTS model and Kore voice over OpenRouter. continuous = first 3 scenes in one request; scene = separate per-scene requests. Compare accent, delivery, identity and Mandarin pronunciation by listening. No transcriber gate is applied here.\n");
console.log("VOICE_AB_DONE",metrics.length,"samples");
