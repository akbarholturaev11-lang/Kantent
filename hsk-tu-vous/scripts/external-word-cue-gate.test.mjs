import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {verifyExternalWordCues} from "./external-word-cue-gate.mjs";
const wav=Buffer.alloc(64);wav.write("RIFF");wav.write("WAVE",8);
const sha=data=>createHash("sha256").update(data).digest("hex");
const narration="Представьте 这个有点儿贵";
const input={wavBytes:wav,narration,languageCode:"ru-RU",durationMs:2500};
const payload={version:1,languageCode:"ru-RU",audioSha256:sha(wav),
 narrationSha256:sha(Buffer.from(narration)),
 provenance:{method:"forced-alignment",model:"Qwen/Qwen3-ForcedAligner-0.6B"},
 wordAnnotations:[
   {text:"Представьте",startOffset:"0.100s",endOffset:"0.900s"},
   {text:"这个有点儿贵",startOffset:"1.000s",endOffset:"2.200s"}]};
test("validate original WAV/text hashes, locale and nonoverlapping source word times",()=>{
 const x=verifyExternalWordCues({...input,payload});
 assert.equal(x.wordAnnotations.length,2);assert.equal(x.source.wordCount,2);
});
test("reject changed source audio, text, locale or invented provenance",()=>{
 assert.throws(()=>verifyExternalWordCues({...input,wavBytes:Buffer.concat([wav,Buffer.from("x")]),payload}),/WAV SHA-256/);
 assert.throws(()=>verifyExternalWordCues({...input,narration:"Другой",payload}),/narration SHA-256/);
 assert.throws(()=>verifyExternalWordCues({...input,languageCode:"tg-TJ",payload}),/language/);
 assert.throws(()=>verifyExternalWordCues({...input,payload:{...payload,provenance:{method:"guessed",model:"unknown"}}}),/method/);
});
test("reject overlapping, zero, out-of-duration or missing word offsets",()=>{
 for(const words of [
   [{text:"x",startOffset:"0.000s",endOffset:"0.000s"}],
   [{text:"x",startOffset:"0.000s",endOffset:"0.500s"},
    {text:"y",startOffset:"0.400s",endOffset:"0.800s"}],
   [{text:"x",startOffset:"1.00",endOffset:"2.000s"}],
   [{text:"x",startOffset:"2.450s",endOffset:"3.000s"}]])
   assert.throws(()=>verifyExternalWordCues({...input,payload:{...payload,wordAnnotations:words}}),/timing|offset/);
 assert.throws(()=>verifyExternalWordCues({...input,payload:{...payload,wordAnnotations:[]}}),/nonempty/);
});
test("reject non-WAV audio input",()=>assert.throws(()=>
 verifyExternalWordCues({...input,wavBytes:Buffer.alloc(64),payload}),/RIFF\/WAV/));
