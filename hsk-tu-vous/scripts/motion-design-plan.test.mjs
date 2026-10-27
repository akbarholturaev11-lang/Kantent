import test from "node:test";
import assert from "node:assert/strict";
import {resolveMotionBeats,compileMotionDesignTimeline} from "./motion-design-plan.mjs";
const scene={id:"example",startMs:1000,endMs:6000,motionBeats:[{id:"buy",kind:"purchase",cueText:"купил"}]};
const words=[{text:"Я",startMs:1200,endMs:1400},{text:"купил",startMs:1551,endMs:1800},
  {text:"книгу.",startMs:1900,endMs:2200}];
test("meaningful motion starts on the spoken cue frame, without early lead",()=>{
  const [beat]=resolveMotionBeats(scene,words);
  assert.equal(beat.startFrame,47);assert.equal(beat.localFrame,17);assert.equal(beat.startMs,1551);
});
test("missing or repeated cues fail; explicit occurrence resolves repetition",()=>{
  assert.throws(()=>resolveMotionBeats(scene,words.filter(w=>w.text!=="купил")),/missing\/ambiguous/);
  const repeated=[...words,{text:"купил",startMs:3000,endMs:3300}];
  assert.throws(()=>resolveMotionBeats(scene,repeated),/ambiguous/);
  assert.equal(resolveMotionBeats({...scene,motionBeats:[{...scene.motionBeats[0],cueOccurrence:2}]},repeated)[0].startMs,3000);
});
test("a boundary-crossing word keeps its real onset, while next-scene words stay excluded",()=>{
  const boundary={...scene,endMs:1800};
  const crossing=words.map(w=>w.text==="купил"?{...w,endMs:1850}:w);
  assert.equal(resolveMotionBeats(boundary,crossing)[0].endMs,1850);
  assert.throws(()=>resolveMotionBeats({...boundary,motionBeats:[{id:"next",kind:"example",cueText:"книгу"}]},crossing),/missing/);
});
test("phrase cues use actual adjacent annotations, preserving the original timestamps",()=>{
  const input=structuredClone(words);
  assert.equal(resolveMotionBeats({...scene,motionBeats:[{id:"example",kind:"example",cueText:"купил книгу"}]},words)[0].endMs,2200);
  assert.deepEqual(words,input);
  assert.throws(()=>resolveMotionBeats({...scene,motionBeats:[{id:"bad",kind:"example",cueText:"Я книгу"}]},words),/missing/);
});
test("rejects reversed events and unverified/CTA plans",()=>{
  assert.throws(()=>resolveMotionBeats({...scene,motionBeats:[{id:"book",kind:"example",cueText:"книгу"},...scene.motionBeats]},words),/speech order/);
  const episode={id:"lesson",motionDesign:true,motionDesignStyle:"le-context-v1",captionSource:"gemini-word-timestamps",captions:words,scenes:[scene]};
  assert.equal(compileMotionDesignTimeline(episode).scenes[0].beats.length,1);
  assert.throws(()=>compileMotionDesignTimeline({...episode,captionSource:"guessed"}),/verified/);
  assert.throws(()=>compileMotionDesignTimeline({...episode,motionDesignStyle:"unimplemented"}),/Unsupported/);
  assert.throws(()=>compileMotionDesignTimeline({...episode,scenes:[{...scene,kind:"cta"}]}),/CTA/);
});
