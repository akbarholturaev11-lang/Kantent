import test from "node:test";
import assert from "node:assert/strict";
import {createMotionQaPlan} from "./motion-visual-qa.mjs";

const action=(id,asset,cue,explains)=>({
 id,kind:"asset",cueText:cue,explains,visual:{assetId:asset,title:cue,hanzi:"书",pinyin:"shū",meaning:cue}
});
const episode=()=>{
 const beats=[action("book","study-book","Книга","A real book"),action("tea","tea-cup","чай","A recognizable tea cup")];
 const shots=beats.map((beat,i)=>({
  shotId:"shot-"+beat.id,beatId:beat.id,meaningCue:beat.cueText,
  assetIds:["asset:"+beat.visual.assetId],camera:{xPx:i*20,yPx:0,scale:1},
  transition:i?{kind:"slide-match",frames:12,direction:"left"}:{kind:"cut",frames:0},
  focalRole:"object",zIndex:0
 }));
 return {id:"qa-synthetic",languageCode:"ru-RU",motionDesignStyle:"explain-actions-v1",
   captionSource:"gemini-word-timestamps",
   captions:[{text:"Книга",startMs:900,endMs:1200},{text:"потом",startMs:1500,endMs:1700},
      {text:"чай",startMs:2200,endMs:2480}],
   scenes:[{id:"scene-a",kind:"example",startMs:0,endMs:4000,durationFrames:120,motionBeats:beats,
      motionDirection:{schemaVersion:1,shots}}]};
};

test("generate exact cue-scoped QA evidence with stable before/cue/mid/end frames",()=>{
 const report=createMotionQaPlan(episode());
 assert.equal(report.productionApproved,false);
 assert.equal(report.audioAuthenticity,"not-verified-by-this-check");
 assert.equal(report.shotCount,2);
 assert.equal(report.shots[1].globalCueFrame,66);
 assert.deepEqual(report.shots[1].reviewFrames,{before:65,cue:66,midpoint:71,settled:77});
 assert.equal(report.shots[1].sourceCaptionIndex,2);
 assert.equal(report.shots[1].transition.direction,"left");
 assert.equal(report.shots[1].intendedMeaning,"A recognizable tea cup");
});

test("reject missing exact cue, duplicate text ambiguity and authored asset mismatch",()=>{
 const missing=episode();missing.captions.pop();
 assert.throws(()=>createMotionQaPlan(missing),/exact spoken cue/);
 const duplicate=episode();duplicate.captions.push({text:"чай",startMs:2750,endMs:2940});
 assert.throws(()=>createMotionQaPlan(duplicate),/ambiguous exact spoken cue/);
 const mismatch=episode();mismatch.scenes[0].motionDirection.shots[1].assetIds=["asset:market-stall"];
 assert.throws(()=>createMotionQaPlan(mismatch),/unknown\/unsupported|asset/);
});

test("refuse to claim voice/visual proof when directed plan lacks authored rationale",()=>{
 const bad=episode();bad.scenes[0].motionBeats[0].explains="";
 assert.throws(()=>createMotionQaPlan(bad),/visual meaning/);
 const old=episode();old.scenes[0].motionDirection=undefined;
 assert.throws(()=>createMotionQaPlan(old),/directed shot plan/);
});

test("invalid source timing and style cannot bypass preflight",()=>{
 const a=episode();a.captions[1].startMs=2450;
 assert.throws(()=>createMotionQaPlan(a),/unsorted/);
 const b=episode();b.captionSource="guess-equal-duration";
 assert.throws(()=>createMotionQaPlan(b),/only explicit/);
 const c=episode();c.scenes[0].endMs=1000;
 assert.throws(()=>createMotionQaPlan(c),/exact spoken cue|scene/);
 const d=episode();
 assert.throws(()=>createMotionQaPlan(d,{fps:0}),/FPS/);
});

test("source records are never mutated by evidence calculation",()=>{
 const e=episode(),original=JSON.stringify(e);
 createMotionQaPlan(e);
 assert.equal(JSON.stringify(e),original);
});
