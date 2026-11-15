import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {cueTimelineSource} from "./cue-timeline.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {compileMotionKitCuePlan,assertMotionKitCuePlanMatches} from "./motion-kit-cue-plan.mjs";

function fixture() {
  const scenes=[{
    id:"hook",kind:"hook",narration:"Это пример",startMs:0,endMs:1800,
    motionBeats:[
      {id:"first",kind:"graphic",cueText:"Это",visual:{illustration:{layout:"scene",images:["verified-background"]}}},
      {id:"second",kind:"graphic",cueText:"пример",visual:{illustration:{layout:"scene",images:["verified-background-2"]}}},
    ],
  },{
    id:"cta",kind:"cta",narration:"Скачай HSK AI",startMs:1800,endMs:4000,
  }];
  const captions=[
    {text:"Это",startMs:100,endMs:360},
    {text:"пример",startMs:500,endMs:900},
    {text:"Скачай",startMs:1920,endMs:2400},
    {text:"HSK",startMs:2450,endMs:2700},
    {text:"AI",startMs:2720,endMs:3000},
  ];
  const voiceTextHash=createHash("sha256").update(scenes.map(s=>s.narration.trim()).join("\n\n")+"\n","utf8").digest("hex");
  const episode={
    id:"motion-kit-test",languageCode:"ru-RU",
    voiceTextHash,audioSha256:"a".repeat(64),
    captionSource:"gemini-word-timestamps",motionDesign:true,
    motionDesignStyle:"explain-actions-v1",scenes,captions,
  };
  const timeline={schemaVersion:1,episodeId:episode.id,languageCode:episode.languageCode,
    fps:30,voiceTextHash:episode.voiceTextHash,audioSha256:episode.audioSha256,
    cueSource:cueTimelineSource(episode),wordCues:structuredClone(captions),
    scenes:scenes.map(s=>({sceneId:s.id,startMs:s.startMs,endMs:s.endMs,
       motionBeats:s.motionBeats?resolveMotionBeats(s,captions,30,"ru-RU"):[],promoCue:null})),
  };
  return {episode,timeline};
}
test("opt-in plan binds exact two spoken word anchors and excludes CTA",()=>{
  const {episode,timeline}=fixture();
  const result=compileMotionKitCuePlan(episode,timeline);
  assert.equal(result.mode,"opt-in-review-only");
  assert.equal(result.scenes.length,1);
  assert.equal(result.scenes[0].sceneId,"hook");
  assert.deepEqual(result.scenes[0].beats.map(b=>b.localFrame),[3,15]);
  assert.equal(result.scenes.some(s=>s.sceneId==="cta"),false);
  assert.equal(assertMotionKitCuePlanMatches(episode,timeline,result),true);
  assert.deepEqual(compileMotionKitCuePlan(episode,timeline),result);
});
test("modified audio hash, locale and narration snapshot fail closed",()=>{
  const {episode,timeline}=fixture(),p=compileMotionKitCuePlan(episode,timeline);
  assert.throws(()=>assertMotionKitCuePlanMatches({...episode,audioSha256:"c".repeat(64)},timeline,p),/voice\/episode\/locale|Render cue timeline/);
  assert.throws(()=>assertMotionKitCuePlanMatches({...episode,languageCode:"tg-TJ"},timeline,p),/voice\/episode\/locale/);
  assert.throws(()=>compileMotionKitCuePlan({...episode,voiceTextHash:"b".repeat(64)},timeline),/timeline/);
});
test("unverified or guessed word cues cannot create production plan",()=>{
  const {episode,timeline}=fixture();
  assert.throws(()=>compileMotionKitCuePlan({...episode,captionSource:"pending-gemini-generation"},timeline),/imported Gemini/);
  assert.throws(()=>compileMotionKitCuePlan({...episode,audioSha256:null},timeline),/SHA-256|timeline/);
  const tampered=structuredClone(timeline);tampered.wordCues[0].startMs=200;
  assert.throws(()=>compileMotionKitCuePlan(episode,tampered),/timeline/);
});
test("fake resolved frames and changed cue order fail closed",()=>{
  const {episode,timeline}=fixture();
  const invalid=structuredClone(timeline);
  invalid.scenes[0].motionBeats[0].localFrame+=1;
  assert.throws(()=>compileMotionKitCuePlan(episode,invalid),/forged or stale/);
  const changed=structuredClone(episode);changed.scenes[0].motionBeats[0].cueText="нету";
  const modified=structuredClone(timeline);modified.cueSource=cueTimelineSource(changed);
  assert.throws(()=>compileMotionKitCuePlan(changed,modified),/missing\/ambiguous/);
});
test("no generated artwork or added CTA plan",()=>{
  const {episode,timeline}=fixture();
  const broken=structuredClone(episode);delete broken.scenes[0].motionBeats[0].visual.illustration;
  const t=structuredClone(timeline);t.cueSource=cueTimelineSource(broken);
  assert.throws(()=>compileMotionKitCuePlan(broken,t),/illustration/);
  const plan=compileMotionKitCuePlan(episode,timeline);
  plan.scenes.push({sceneId:"cta",componentId:"art-drift",beats:[{beatId:"fake",startMs:1920,localFrame:0}]});
  assert.throws(()=>assertMotionKitCuePlanMatches(episode,timeline,plan),/CTA|cue/);
});
test("art-adapters only and no implicit promo mode",()=>{
  const {episode,timeline}=fixture();
  assert.throws(()=>compileMotionKitCuePlan(episode,timeline,{contentType:"advertisement"}),/lesson art only/);
  const plan=compileMotionKitCuePlan(episode,timeline);
  plan.scenes[0].componentId="glass-info";
  assert.throws(()=>assertMotionKitCuePlanMatches(episode,timeline,plan),/Invalid MotionKit/);
});

test("Codex-supplied choice overrides algorithm suggestion in TEST mode",()=>{
  const {episode,timeline}=fixture();
  const codexDecision={chosenBy:"Codex",mode:"TEST_ONLY",episodeId:episode.id,
    contentType:"lesson",languageCode:episode.languageCode,scenes:[{sceneId:"hook",componentId:"art-drift",
      reason:"Slow artwork movement fits spoken picture, avoids extra labels",
      narrationEvidence:"пример"}]};
  const plan=compileMotionKitCuePlan(episode,timeline,{codexDecision});
  assert.equal(plan.selectionOwner,"Codex");
  assert.equal(plan.scenes[0].componentId,"art-drift");
  assert.equal(assertMotionKitCuePlanMatches(episode,timeline,plan),true);
});
test("motion binder rejects a falsely attributed model decision",()=>{
  const {episode,timeline}=fixture();
  assert.throws(()=>compileMotionKitCuePlan(episode,timeline,{codexDecision:{
    chosenBy:"LLM API",mode:"TEST_ONLY",episodeId:episode.id,contentType:"lesson",scenes:[]
  }}),/episode-bound Codex/);
});
