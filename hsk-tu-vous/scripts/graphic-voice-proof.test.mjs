import test from "node:test";
import assert from "node:assert/strict";
import {narrationHash} from "./lib.mjs";
import {prepareGraphicVoiceProof} from "./graphic-voice-proof.mjs";
const model={title:"",hanzi:"",pinyin:"",meaning:"",object:"apple"};
const beats=[1,2].map((count,index)=>({id:"count-"+count,kind:"quantity",cueText:index?"Два":"Один",explains:"Show the spoken quantity",visual:{...model,count}}));
const source=()=>{
 const e={id:"test",languageCode:"ru-RU",audioSrc:"generated/test/voice.mp3",audioDurationMs:4000,
 captionSource:"gemini-word-timestamps",captions:[{text:"Один",startMs:100,endMs:700},{text:"Два",startMs:1900,endMs:2300},{text:"Дальше",startMs:2700,endMs:3200}],
 scenes:[{id:"lesson",kind:"example",narration:"Один. Два.",startMs:0,endMs:2000},{id:"next",kind:"example",narration:"Дальше.",startMs:2000,endMs:4000}]};
 e.voiceTextHash=narrationHash(e);return e;
};
test("proof keeps the last real spoken word past a capped scene boundary without including the next phrase",()=>{
 const e=source(),before=structuredClone(e);
 const proof=prepareGraphicVoiceProof(e,"lesson",beats,{maximumVisualHoldSec:6});
 assert.equal(proof.sourceToFrame,75);
 assert.deepEqual(proof.beats.map(beat=>beat.localFrame),[3,57]);
 assert.deepEqual(proof.captions.map(word=>word.text),["Один","Два"]);
 assert.equal(proof.captions.at(-1).endMs,2300);
 assert.deepEqual(e,before);
});
test("proof rejects stale speech, missing exact cues and a final word that overlaps the next phrase",()=>{
 const stale=source();stale.scenes[0].narration="Изменено";
 assert.throws(()=>prepareGraphicVoiceProof(stale,"lesson",beats,{maximumVisualHoldSec:6}),/matching imported/);
 assert.throws(()=>prepareGraphicVoiceProof(source(),"lesson",[{...beats[0],cueText:"Нет"},beats[1]],{maximumVisualHoldSec:6}),/missing\/ambiguous/);
 const overlap=source();overlap.captions[2].startMs=2200;
 assert.throws(()=>prepareGraphicVoiceProof(overlap,"lesson",beats,{maximumVisualHoldSec:6}),/last spoken word overlaps/);
});
test("a fractional scene boundary never cuts the first word and captions retain their original timing",()=>{
 const e=source();e.scenes[0].startMs=119;e.captions[0].startMs=121;e.captions[0].timestampMs=null;
 const proof=prepareGraphicVoiceProof(e,"lesson",beats,{maximumVisualHoldSec:6});
 assert.equal(proof.sourceFromFrame,3);
 assert.equal(proof.captions[0].startMs,21);
 assert.equal(proof.captions[0].timestampMs,null);
 assert.equal(proof.beats[0].localFrame,1);
});
