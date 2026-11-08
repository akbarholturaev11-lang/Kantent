import test from "node:test";
import assert from "node:assert/strict";
import {planCueFrameReview} from "./cue-frame-review.mjs";
import {cueTimelineSource} from "./cue-timeline.mjs";
import {compileSemanticVisualTimeline} from "./semantic-visual-plan.mjs";

function fixture() {
  const episode={
    id:"cue-proof-test",languageCode:"tg-TJ",voiceTextHash:"verbatim-hash",
    audioSha256:"a".repeat(64),
    captionSource:"gemini-word-timestamps",
    scenes:[
      {id:"hook",kind:"hook",narration:"Китоб пайдо шуд",durationFrames:60,
        startMs:0,endMs:2000,motionBeats:[{id:"a",kind:"graphic",cueText:"Китоб"},
           {id:"b",kind:"graphic",cueText:"пайдо"}]},
      {id:"cta",kind:"cta",narration:"HSK AI",durationFrames:30,startMs:2000,endMs:3000},
    ],
    captions:[
      {text:"Китоб",startMs:400,endMs:700},
      {text:"пайдо",startMs:900,endMs:1190},
      {text:"шуд",startMs:1250,endMs:1490},
      {text:"HSK",startMs:2200,endMs:2400},
      {text:"AI",startMs:2450,endMs:2800},
    ],
  };
  const beats=[
    {id:"a",kind:"graphic",cueText:"Китоб",localFrame:12,startFrame:12,startMs:400,endMs:700,
      visual:{graphic:{tracks:[{nodeId:"book",property:"x",loop:false,keyframes:[
        {atMs:0,value:-50},{atMs:500,value:0}]}]}}},
    {id:"b",kind:"graphic",cueText:"пайдо",localFrame:27,startFrame:27,startMs:900,endMs:1190,
      visual:{graphic:{tracks:[{nodeId:"book",property:"opacity",keyframes:[
        {atMs:0,value:0},{atMs:600,value:1}]}]}}},
  ];
  const timeline={
    schemaVersion:1,episodeId:episode.id,languageCode:episode.languageCode,fps:30,
    voiceTextHash:episode.voiceTextHash,audioSha256:episode.audioSha256,
    cueSource:cueTimelineSource(episode),wordCues:structuredClone(episode.captions),
    scenes:[{sceneId:"hook",motionBeats:beats,promoCue:null},
      {sceneId:"cta",motionBeats:[],promoCue:null}],
  };
  return {episode,timeline};
}

test("real word start yields exact before/on/settled FRAME indices without overrunning next cue",()=>{
  const {episode,timeline}=fixture();
  const result=planCueFrameReview(episode,timeline);
  assert.equal(result.totalFrames,90);
  assert.equal(result.samples.length,2);
  assert.deepEqual([
    result.samples[0].beforeFrame,result.samples[0].cueFrame,result.samples[0].settledFrame,
    result.samples[0].nextCueFrameExclusive,
  ],[11,12,26,27]);
  assert.deepEqual([
    result.samples[1].beforeFrame,result.samples[1].cueFrame,result.samples[1].settledFrame,
  ],[26,27,45]);
  assert.equal(result.realVoiceAndTeachingMeaningReviewed,false);
  assert.equal(result.ownerPreviewApproved,false);
});

test("when cue occurs at scene start, before frame is explicitly unavailable",()=>{
  const {episode,timeline}=fixture();
  timeline.scenes[0].motionBeats[0].startMs=0;
  timeline.scenes[0].motionBeats[0].startFrame=0;
  timeline.scenes[0].motionBeats[0].localFrame=0;
  const result=planCueFrameReview(episode,timeline);
  assert.equal(result.samples[0].beforeFrame,null);
  assert.equal(result.samples[0].firstBeatWithoutPreCueFrame,true);
});

test("tampered caption, locale, audio hash and scene invalidate a rendered review",()=>{
  for(const mutate of [
    (e,t)=>{t.wordCues[0].text="WRONG";},
    (e,t)=>{t.languageCode="ru-RU";},
    (e,t)=>{t.audioSha256="b".repeat(64);},
    (e,t)=>{t.cueSource.scenes[0].narration="different";},
    (e,t)=>{t.scenes[0].sceneId="other";},
  ]) {
    const {episode,timeline}=fixture();
    mutate(episode,timeline);
    assert.throws(()=>planCueFrameReview(episode,timeline),/timeline does not match/i);
  }
});

test("no real cue plan cannot create fake semantic proof",()=>{
  const {episode,timeline}=fixture();
  timeline.scenes[0].motionBeats=[];
  assert.throws(()=>planCueFrameReview(episode,timeline),/No compiled action\/promo cue/);
});

test("reject off-scene cue, reversed cue time, unsafe beat id and unbounded work",()=>{
  for(const [mutate,pattern] of [
    [(e,t)=>{t.scenes[0].motionBeats[1].localFrame=999;},/real cue localFrame/],
    [(e,t)=>{t.scenes[0].motionBeats[1].localFrame=12;},/compiled word cue frame/],
    [(e,t)=>{const b=t.scenes[0].motionBeats[1];b.startMs=300;b.endMs=500;b.startFrame=9;b.localFrame=9;},/next word cue/],
    [(e,t)=>{t.scenes[0].motionBeats[0].id="../source";},/Unsafe scene\/beat/],
    [(e,t)=>{},/requires 2\+ beats/],
  ]){
    const {episode,timeline}=fixture();
    mutate(episode,timeline);
    assert.throws(()=>planCueFrameReview(episode,timeline,{maxBeats:pattern.source.includes("requires")?1:72}),pattern);
  }
});

test("promo cue is included without lesson motion design",()=>{
  const {episode,timeline}=fixture();
  episode.scenes[0].motionBeats=undefined;
  timeline.cueSource=cueTimelineSource(episode);
  timeline.scenes[0].motionBeats=[];
  timeline.scenes[0].promoCue={id:"promo-action",cueText:"Китоб",
    startFrame:12,localFrame:12,startMs:400,endMs:700};
  const planned=planCueFrameReview(episode,timeline);
  assert.equal(planned.samples.length,1);
  assert.equal(planned.samples[0].beatId,"promo-action");
});

test("audio tail extends final encoded MP4 beyond summed scene frames",()=>{
  const {episode,timeline}=fixture();
  episode.audioDurationMs=3260;
  timeline.cueSource=cueTimelineSource(episode);
  const plan=planCueFrameReview(episode,timeline);
  assert.equal(plan.sceneFrames,90);
  assert.equal(plan.totalFrames,98);
  assert.deepEqual(plan.ctaBoundaryFrames,{beforeCta:59,firstCta:60,finalCta:97});
});

test("scene-start drift against accumulated render duration is rejected before fake cue proof",()=>{
  const {episode,timeline}=fixture();
  episode.scenes[1].startMs=1900;
  timeline.cueSource=cueTimelineSource(episode);
  assert.throws(()=>planCueFrameReview(episode,timeline),/scene frames do not match audio-derived/);
});

function semanticFixture({withAction=true}={}) {
  const {episode,timeline}=fixture();
  episode.semanticVisual={schemaVersion:1,mode:"review-only"};
  episode.scenes[0].motionBeats=undefined;
  episode.scenes[0].semanticShot={
    environmentId:"street",shotType:"medium",cameraStyle:"static",
    actorIds:["walker"],objectIds:[],
  };
  episode.scenes[0].visualBeats=withAction
    ?[{hero:"书",pinyin:"shū",meaning:"китоб",syncCueText:"Китоб",
      semanticAction:{type:"approach-camera",subjectId:"walker",durationMs:400}}]
    :[];
  timeline.cueSource=cueTimelineSource(episode);
  timeline.scenes[0].motionBeats=[];
  timeline.semanticTimeline=compileSemanticVisualTimeline(episode);
  return {episode,timeline};
}

test("semantic action cue produces before/on/finished frames only at real speech onset",()=>{
  const {episode,timeline}=semanticFixture();
  const plan=planCueFrameReview(episode,timeline);
  assert.equal(plan.samples.length,1);
  assert.equal(plan.staticShots.length,0);
  assert.equal(plan.samples[0].beatId,"semantic-action-0");
  assert.deepEqual([
    plan.samples[0].beforeFrame,plan.samples[0].cueFrame,
    plan.samples[0].settledFrame,
  ],[11,12,24]);
});

test("stale semantic action cue is rejected rather than showing fake frame evidence",()=>{
  const {episode,timeline}=semanticFixture();
  timeline.semanticTimeline.scenes[0].actions[0].startFrame++;
  assert.throws(()=>planCueFrameReview(episode,timeline),/Stale or modified semantic timeline/);
});

test("static semantic shot produces explicitly unanchored proof, never a fake word cue",()=>{
  const {episode,timeline}=semanticFixture({withAction:false});
  const plan=planCueFrameReview(episode,timeline);
  assert.equal(plan.samples.length,0);
  assert.deepEqual(plan.staticShots,[{
    sceneId:"hook",firstFrame:0,middleFrame:29,lastFrame:59,
    hasVerifiedSpokenAction:false,
  }]);
  assert.equal(plan.realVoiceAndTeachingMeaningReviewed,false);
});
