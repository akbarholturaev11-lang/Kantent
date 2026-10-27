import assert from "node:assert/strict";
import test from "node:test";
import { validateStorytellingWordTiming } from "./storytelling-timing.mjs";

const policy={firstPayoffLatestRatio:.3};
const sample=()=>({
  captionSource:"gemini-word-timestamps",
  scenes:[
    {id:"hook",kind:"hook",startMs:0,endMs:3000},
    {id:"request",kind:"example",startMs:3000,endMs:7000},
    {id:"payoff",kind:"context",startMs:7000,endMs:11000}
  ],
  storytelling:{schemaVersion:1,pattern:"single-rehook",
    firstPayoff:{sceneId:"hook",cueText:"Можно сказать"},
    reHooks:[{sceneId:"request",cueText:"А если",
      payoffSceneId:"payoff",payoffCueText:"Тогда нужно",
      reason:"A separate meaningful follow-up"}]
  },
  captions:[
    {text:"Можно",startMs:400,endMs:700},
    {text:"сказать",startMs:700,endMs:1000},
    {text:"А",startMs:4000,endMs:4100},
    {text:"если",startMs:4100,endMs:4550},
    {text:"Тогда",startMs:7900,endMs:8200},
    {text:"нужно",startMs:8200,endMs:8520}
  ]
});
test("timed payoff and follow-up are grounded in exact Gemini word cues",()=>{
  const result=validateStorytellingWordTiming(sample(),policy);
  assert.equal(result.firstPayoff.endMs,1000);
  assert.equal(result.reHooks[0].rehook.startMs,4000);
  assert.equal(result.reHooks[0].payoff.endMs,8520);
  assert.equal(result.teachingDurationMs,11000);
});
test("legacy episodes do not require new metadata or word timings",()=>{
  assert.equal(validateStorytellingWordTiming({scenes:[]},policy),null);
});
test("refuse missing word timestamps, duplicate cue, opaque multiword caption",()=>{
  let e=sample();e.captions=[];
  assert.throws(()=>validateStorytellingWordTiming(e,policy),/word timestamps/);
  e=sample();e.captions.push({text:"Можно",startMs:1050,endMs:1400},{text:"сказать",startMs:1400,endMs:1700});
  assert.throws(()=>validateStorytellingWordTiming(e,policy),/ambiguous/);
  e=sample();e.captions[0].text="Можно сказать";
  assert.throws(()=>validateStorytellingWordTiming(e,policy),/single-word/);
});
test("fail when early answer is late in actual word timing",()=>{
  assert.throws(()=>validateStorytellingWordTiming(sample(),{firstPayoffLatestRatio:.05}),/too late/);
});
test("fail if answer appears before later learner question",()=>{
  const e=sample();
  e.storytelling.reHooks[0].payoffSceneId="hook";
  e.storytelling.reHooks[0].payoffCueText="Можно сказать";
  assert.throws(()=>validateStorytellingWordTiming(e,policy),/overlap|before/);
});
