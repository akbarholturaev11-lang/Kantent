import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {cueTimelineSource} from "./cue-timeline.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {compileMotionKitCuePlan} from "./motion-kit-cue-plan.mjs";
import {loadReviewMotionKitPlan} from "./codex-soundkit-render-test.mjs";

function fixture() {
  const scenes=[{
    id:"hook",kind:"hook",narration:"Это пример",startMs:0,endMs:1800,
    motionBeats:[
      {id:"first",kind:"graphic",cueText:"Это",visual:{illustration:{layout:"scene",images:["verified-background"]}}},
      {id:"second",kind:"graphic",cueText:"пример",visual:{illustration:{layout:"scene",images:["verified-background-2"]}}},
    ],
  },{id:"cta",kind:"cta",narration:"Скачай HSK AI",startMs:1800,endMs:4000}];
  const captions=[
    {text:"Это",startMs:100,endMs:360},{text:"пример",startMs:500,endMs:900},
    {text:"Скачай",startMs:1920,endMs:2400},{text:"HSK",startMs:2450,endMs:2700},{text:"AI",startMs:2720,endMs:3000},
  ];
  const voiceTextHash=createHash("sha256").update(scenes.map(s=>s.narration.trim()).join("\n\n")+"\n","utf8").digest("hex");
  const episode={id:"p4-motion-kit-test",languageCode:"ru-RU",voiceTextHash,audioSha256:"a".repeat(64),
    captionSource:"gemini-word-timestamps",motionDesign:true,motionDesignStyle:"explain-actions-v1",scenes,captions};
  const timeline={schemaVersion:1,episodeId:episode.id,languageCode:episode.languageCode,fps:30,
    voiceTextHash,audioSha256:episode.audioSha256,cueSource:cueTimelineSource(episode),wordCues:structuredClone(captions),
    scenes:scenes.map(s=>({sceneId:s.id,startMs:s.startMs,endMs:s.endMs,
      motionBeats:s.motionBeats?resolveMotionBeats(s,captions,30,"ru-RU"):[],promoCue:null}))};
  return {episode,timeline};
}
const reader=(text)=>async()=>{if(text===null){const e=Error("missing");e.code="ENOENT";throw e}return text};

test("P4 adds the review MotionKit plan only under the explicit MotionKit opt-in", async()=>{
  const {episode,timeline}=fixture();
  const plan=compileMotionKitCuePlan(episode,timeline);
  const base={root:"/review",episode,timeline,readFile:reader(JSON.stringify(plan))};
  assert.equal(await loadReviewMotionKitPlan({...base,platform:"instagram",env:{}}),null);
  assert.equal(await loadReviewMotionKitPlan({...base,platform:"instagram",env:{HSK_AI_MOTION_KIT_REVIEW:"0"}}),null);
  assert.equal(await loadReviewMotionKitPlan({...base,platform:"tiktok",env:{HSK_AI_MOTION_KIT_REVIEW:"1"}}),null,
    "TikTok has its own voice and no shared review MotionKit plan");
  assert.deepEqual(await loadReviewMotionKitPlan({...base,platform:"youtube",env:{HSK_AI_MOTION_KIT_REVIEW:"1"}}),plan);
});

test("P4 MotionKit opt-in fails closed on a missing or stale review plan", async()=>{
  const {episode,timeline}=fixture();
  const env={HSK_AI_MOTION_KIT_REVIEW:"1"};
  await assert.rejects(loadReviewMotionKitPlan({root:"/review",platform:"instagram",episode,timeline,env,readFile:reader(null)}),
    /needs the review render's motion-kit-cue-plan\.json/);
  const stale=compileMotionKitCuePlan(episode,timeline);
  stale.scenes[0].beats[0].localFrame+=9;
  await assert.rejects(loadReviewMotionKitPlan({root:"/review",platform:"instagram",episode,timeline,env,
    readFile:reader(JSON.stringify(stale))}));
});
