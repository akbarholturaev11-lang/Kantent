import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {cueTimelineSource} from "./cue-timeline.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {makeSoundKitRenderPlan,assertSoundKitRenderPlanMatches} from "./sound-kit-render-plan.mjs";

const sha=x=>createHash("sha256").update(x).digest("hex");
const soundId="kenney-interface-sounds/select_001.wav";
const audioSha="a".repeat(64),sfxSha="b".repeat(64);
const staticSrc="soundkit-p4-preview-tests/"+sfxSha+".wav";
const soundTokens={sceneCueVolume:0.08,beatCueVolume:0.09};
function fixture(){
  // SYNTHETIC only; imported Gemini bytes are validated by explicit CLI, not this test.
  const scenes=[
    {id:"hook",kind:"hook",headline:"Hook",narration:"Начало",startMs:0,endMs:1000,durationFrames:30},
    {id:"demo",kind:"example",headline:"Demo",narration:"Здесь пример",startMs:1000,endMs:3000,durationFrames:60,
      motionBeats:[{id:"reveal",kind:"meaning",cueText:"пример",visual:{title:"Real art",graphic:{nodes:[]}}}]},
    {id:"cta",kind:"cta",headline:"CTA",narration:"Открой",startMs:3000,endMs:4000,durationFrames:30},
  ];
  const captions=[
    {text:"Начало",startMs:100,endMs:440},
    {text:"Здесь",startMs:1230,endMs:1500},
    {text:"пример",startMs:1950,endMs:2230},
    {text:"Открой",startMs:3280,endMs:3670},
  ];
  const episode={id:"soundkit-p4-fixture",languageCode:"ru-RU",scenes,captions,
    captionSource:"gemini-word-timestamps",audioSha256:audioSha,
    voiceTextHash:sha(scenes.map(s=>s.narration.trim()).join("\n\n")+"\n")};
  const timeline={schemaVersion:1,episodeId:episode.id,languageCode:episode.languageCode,
    fps:30,voiceTextHash:episode.voiceTextHash,audioSha256:episode.audioSha256,
    cueSource:cueTimelineSource(episode),wordCues:structuredClone(captions),
    scenes:scenes.map(s=>({sceneId:s.id,startMs:s.startMs,endMs:s.endMs,
      motionBeats:resolveMotionBeats(s,captions,30,"ru-RU"),promoCue:null}))};
  const p3={mode:"TEST_ONLY",phase:"P3_EXACT_CUE_BINDING",
    audioMixProduced:false,renderEnabled:false,episodeId:episode.id,
    voiceTextHash:episode.voiceTextHash,audioSha256:episode.audioSha256,
    languageCode:episode.languageCode,fps:30,
    cueTimelineSha256:"c".repeat(64),sourceSha256:"d".repeat(64),
    librarySha256:"e".repeat(64),policySha256:"f".repeat(64),
    selected:[{sceneId:"demo",eventId:"reveal",soundId,
      assetSha256:sfxSha,startMs:1950,endCueMs:2230,
      startFrame:59,endFrame:64,clipFrames:5,hardDeadlineFrame:90,
      captionIndex:2,volume:undefined,reason:"Quiet actual visible change",
      role:"gentle-illustration-reveal",file:"assets/sound-library/kenney-interface-sounds/select_001.wav"}]};
  return {episode,timeline,p3,stage:{[soundId]:staticSrc}};
}
test("valid synthetic P3 SFX intent creates strictly opt-in subdued P4 preview plan",()=>{
  const f=fixture(),p=makeSoundKitRenderPlan(f.episode,f.timeline,f.p3,f.stage,soundTokens);
  assert.equal(p.mode,"TEST_ONLY");
  assert.equal(p.phase,"P4_ISOLATED_MIX_REVIEW");
  assert.equal(p.productionEffectsEnabled,false);
  assert.equal(p.ownerApprovalGranted,false);
  assert.equal(p.removesLegacySoundCues,true);
  assert.equal(p.audioSha256,audioSha);
  assert.equal(p.selected[0].startFrame,59);
  assert.equal(p.selected[0].volume,0.04);
  assert.equal(assertSoundKitRenderPlanMatches(f.episode,f.timeline,p),true);
});
test("default missing P4 plan never asserts or enables changes",()=>{
  const f=fixture();assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,null),/TEST-only plan/);
});
test("invalid TEST flags, source voice SHA and locale fail closed",()=>{
  const f=fixture();const p=makeSoundKitRenderPlan(f.episode,f.timeline,f.p3,f.stage,soundTokens);
  p.productionEffectsEnabled=true;
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,p),/TEST-only plan/);
  p.productionEffectsEnabled=false;p.audioSha256="0".repeat(64);
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,p),/TEST-only plan/);
  p.audioSha256=audioSha;p.ownerApprovalGranted=true;
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,p),/TEST-only plan/);
});
test("missing or tampered historical source word cue / visual anchor fails",()=>{
  const f=fixture(),p=makeSoundKitRenderPlan(f.episode,f.timeline,f.p3,f.stage,soundTokens);
  const t=structuredClone(f.timeline);t.wordCues[2].startMs=1200;
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,t,p),/timeline|word anchor/);
  const x=structuredClone(p);x.selected[0].startFrame++;
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,x),/frames invalid/);
  x.selected[0].startFrame--;
  x.selected[0].eventId="made-up";
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,x),/visual cue/);
});
test("forbidden CTA overlap, over-volume or unsafe filename fail",()=>{
  const f=fixture(),p=makeSoundKitRenderPlan(f.episode,f.timeline,f.p3,f.stage,soundTokens);
  const over=structuredClone(p);over.selected[0].endFrame=100;over.selected[0].clipFrames=41;
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,over),/frames invalid|outside/);
  const loud=structuredClone(p);loud.selected[0].volume=0.9;
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,loud),/subordinate/);
  const bad=structuredClone(p);bad.selected[0].staticSrc="../sfx/soft-cut.wav";
  assert.throws(()=>assertSoundKitRenderPlanMatches(f.episode,f.timeline,bad),/SHA-named/);
});
test("SILENCE-only is a valid P4 sound policy with zero staged assets",()=>{
  const f=fixture();f.p3.selected=[];
  const p=makeSoundKitRenderPlan(f.episode,f.timeline,f.p3,{},soundTokens);
  assert.equal(p.selected.length,0);
  assert.equal(assertSoundKitRenderPlanMatches(f.episode,f.timeline,p),true);
});
test("P4 does not accept unbound P3, wrong cue ownership or invalid volume policy",()=>{
  const f=fixture();
  f.p3.renderEnabled=true;
  assert.throws(()=>makeSoundKitRenderPlan(f.episode,f.timeline,f.p3,f.stage,soundTokens),/verified non-rendered/);
  f.p3.renderEnabled=false;
  assert.throws(()=>makeSoundKitRenderPlan(f.episode,f.timeline,f.p3,{},soundTokens),/staging missing/);
  assert.throws(()=>makeSoundKitRenderPlan(f.episode,f.timeline,f.p3,f.stage,{sceneCueVolume:4,beatCueVolume:4}),/safe SFX volume/);
});
