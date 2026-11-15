import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {cueTimelineSource} from "./cue-timeline.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {resolvePromoCue} from "./promo-visual.mjs";
import {authoredSoundEvents,validateCodexSoundKitDecision} from "./codex-soundkit-selection.mjs";
import {compileSoundKitCuePlan} from "./sound-kit-cue-plan.mjs";

const sha=x=>createHash("sha256").update(x).digest("hex");
const silence=(id)=>({sceneId:id,soundId:"SILENCE",
  reason:"Keep the imported spoken words and the start/ending of the video free from gratuitous effects.",
  eventId:null,visualEvidence:null,narrationEvidence:null,assetSha256:null,gainPreset:"none"});

function fixture({promo=false,locale="ru-RU",platform="shared"}={}) {
  // Fixtures deliberately contain SYNTHETIC bytes and timing, NOT real Gemini proof.
  // Production CLI must separately load actual imported source file bytes.
  const audioBytes=Buffer.from("SYNTHETIC-P3-METADATA-TEST-"+locale+"-"+platform);
  const scenes=promo ?[
    {id:"hook",kind:"hook",narration:"Inside a shop",startMs:0,endMs:1000,
      promoVisual:{type:"illustration",action:"Show original shop",cueText:"Inside",graphic:{nodes:[]}}},
    {id:"demo",kind:"context",narration:"This is our feature",startMs:1000,endMs:2700,
      promoVisual:{type:"illustration",action:"Hand reveals a real illustrative change",cueText:"feature",graphic:{nodes:[]}}},
    {id:"cta",kind:"cta",narration:"Download now",startMs:2700,endMs:4000},
  ]:[
    {id:"hook",kind:"hook",narration:"Start now",startMs:0,endMs:1000,
      motionBeats:[{id:"intro",kind:"meaning",cueText:"Start",
        visual:{title:"intro",graphic:{nodes:[]}}}]},
    {id:"example",kind:"example",narration:"We show first and then next",startMs:1000,endMs:3500,
      motionBeats:[
        {id:"drawn-change",kind:"meaning",cueText:"show",
          visual:{title:"Meaningful new example",graphic:{nodes:[]}}},
        {id:"new-state",kind:"meaning",cueText:"next",
          visual:{title:"Next visible state",graphic:{nodes:[]}}},
      ]},
    {id:"cta",kind:"cta",narration:"Download now",startMs:3500,endMs:4700},
  ];
  const cues=promo?[
    ["Inside",100,300],["a",320,410],["shop",450,700],
    ["This",1150,1320],["is",1350,1470],["our",1500,1680],
    ["feature",1800,2090],["Download",2820,3150],["now",3220,3590],
  ]:[
    ["Start",100,300],["now",400,700],
    ["We",1130,1230],["show",1500,1690],["first",1780,1970],
    ["and",2150,2250],["then",2360,2540],["next",2750,3010],
    ["Download",3630,3920],["now",4080,4410],
  ];
  const captions=cues.map(([text,startMs,endMs])=>({text,startMs,endMs}));
  const episode={id:"synthetic-soundkit-test",languageCode:locale,
    kind:promo?"advertisement":"lesson",audioSrc:"generated/test.mp3",
    audioSha256:sha(audioBytes),
    audioDurationMs:promo?4000:4700,
    captionSource:"gemini-word-timestamps",
    motionDesign:!promo,motionDesignStyle:promo?"minimalist-promo-v1":"le-context-v1",
    scenes,captions};
  episode.voiceTextHash=sha(scenes.map(s=>s.narration.trim()).join("\n\n")+"\n");
  const timeline={
    schemaVersion:1,episodeId:episode.id,languageCode:locale,fps:30,
    voiceTextHash:episode.voiceTextHash,audioSha256:episode.audioSha256,
    wordCues:structuredClone(captions),cueSource:cueTimelineSource(episode),
    scenes:scenes.map(scene=>({
      sceneId:scene.id,startMs:scene.startMs,endMs:scene.endMs,
      motionBeats:promo?[]:resolveMotionBeats(scene,captions,30,locale),
      promoCue:promo&&scene.kind!=="cta"?resolvePromoCue(scene,captions,30,locale):null,
    })),
  };
  const body=scenes.filter(s=>s.kind!=="cta");
  const sound={
    id:"kenney-interface-sounds/select_001.wav",
    role:"gentle-illustration-reveal",file:"assets/sound-library/kenney-interface-sounds/select_001.wav",
    sha256:"d".repeat(64),gainPreset:"under-voice-subtle-proposal",
    license:"CC0-1.0",durationSeconds:0.15,testReferenceOnly:true,
    productionReady:false,
  };
  const brief={
    schemaVersion:1,mode:"TEST_ONLY",productionEffectsEnabled:false,
    externalSelectionApi:null,episodeId:episode.id,
    language:locale==="tg-TJ"?"tg":"ru",languageCode:locale,
    contentType:promo?"advertisement":"lesson",
    sourceSha256:"a".repeat(64),librarySha256:"b".repeat(64),
    policySha256:"c".repeat(64),
    scenes:body.map(scene=>{
      const visualEvents=authoredSoundEvents(
        promo?{...scene,visual:scene.promoVisual}:scene,
        promo?"advertisement":"lesson",
      );
      return {sceneId:scene.id,sceneKind:scene.kind,
        narration:scene.narration,visualEvents,
        firstSceneProtected:scene.id==="hook",
        candidates:scene.id==="hook"?[{id:"SILENCE"}]:[{id:"SILENCE"},sound]};
    }),
  };
  const decision={
    schemaVersion:1,mode:"TEST_ONLY",chosenBy:"Codex",
    episodeId:brief.episodeId,language:brief.language,languageCode:brief.languageCode,
    contentType:brief.contentType,sourceSha256:brief.sourceSha256,
    librarySha256:brief.librarySha256,policySha256:brief.policySha256,
    productionEffectsEnabled:false,
    scenes:body.map(scene=>silence(scene.id)),
  };
  const idx=1,chosen=decision.scenes[idx],event=brief.scenes[idx].visualEvents[0];
  Object.assign(chosen,{
    soundId:sound.id,
    eventId:event.eventId,visualEvidence:event.visualEvidence,
    narrationEvidence:promo?"feature":"show",
    assetSha256:sound.sha256,gainPreset:sound.gainPreset,
    reason:"One quiet verified visual transition on the exact spoken cue; require real audio listening before use.",
  });
  const assetHashes={[sound.id]:sound.sha256};
  return {episode,timeline,brief,decision,assetHashes,audioBytes,platform};
}
function bind(f){
  assert.equal(validateCodexSoundKitDecision(f.decision,f.brief),true);
  return compileSoundKitCuePlan(f.episode,f.timeline,f);
}

test("SYNTHETIC fixture: scene-aligned lesson word cue binds to real timeline fields, CTA silent",()=>{
  const f=fixture();
  const p=bind(f);
  assert.equal(p.mode,"TEST_ONLY");
  assert.equal(p.phase,"P3_EXACT_CUE_BINDING");
  assert.equal(p.renderEnabled,false);
  assert.equal(p.audioMixProduced,false);
  assert.equal(p.selected.length,1);
  assert.equal(p.selected[0].startMs,1500);
  assert.equal(p.selected[0].startFrame,45);
  assert.equal(p.selected[0].captionIndex,3);
  assert.equal(p.selected[0].eventId,"drawn-change");
  assert.equal(p.selected[0].timingSource,"verified-imported-gemini-word-cue");
  assert.equal(p.selected.some(c=>c.sceneId==="cta"),false);
  assert.equal(p.report[0].status,"SILENCE");
  assert.equal(p.audioSha256,f.episode.audioSha256);
  assert.equal(p.voiceSourceUnmodified,true);
  assert.deepEqual(bind(f),p);
});

test("SYNTHETIC fixture: promo chooses exact promoCue, never fake click/CTA",()=>{
  const f=fixture({promo:true});
  const p=bind(f);
  assert.equal(p.selected[0].startMs,1800);
  assert.equal(p.selected[0].startFrame,54);
  assert.equal(p.selected[0].eventId,"demo-visual");
  assert.equal(p.selected.length,1);
  assert.equal(p.platform,"shared");
  assert.equal(p.excludedCta,true);
});

test("SYNTHETIC: TikTok must use its own different imported voice SHA, cue timing and CTA",()=>{
  const shared=fixture();
  const tiktok=fixture({platform:"tiktok"});
  const standard=bind(shared),special=bind(tiktok);
  assert.notEqual(standard.audioSha256,special.audioSha256);
  assert.equal(special.platform,"tiktok");
  assert.throws(()=>compileSoundKitCuePlan(shared.episode,shared.timeline,{
    ...shared,audioBytes:tiktok.audioBytes,platform:"tiktok"
  }),/voice.*SHA-256/);
});

test("SYNTHETIC: source voice bytes, episode hash and word captions cannot drift",()=>{
  const f=fixture();
  assert.throws(()=>compileSoundKitCuePlan(f.episode,f.timeline,{
    ...f,audioBytes:Buffer.from("modified source voice")
  }),/audio SHA-256/);
  const e=structuredClone(f.episode);e.captions[3].startMs+=1;
  assert.throws(()=>compileSoundKitCuePlan(e,f.timeline,{...f,episode:e}),/timeline/);
  const t=structuredClone(f.timeline);t.wordCues[3].startMs+=20;
  assert.throws(()=>compileSoundKitCuePlan(f.episode,t,{...f,timeline:t}),/timeline/);
  const changed=structuredClone(f.episode);changed.scenes[1].narration="changed";
  assert.throws(()=>compileSoundKitCuePlan(changed,f.timeline,{...f,episode:changed}),/timeline|narration/);
});

test("SYNTHETIC: stale resolved speech frames and mismatching source events fail closed",()=>{
  const f=fixture();
  const altered=structuredClone(f.timeline);
  altered.scenes[1].motionBeats[0].startFrame++;
  assert.throws(()=>compileSoundKitCuePlan(f.episode,altered,{...f,timeline:altered}),/stale\/forged/);
  const changed=structuredClone(f.episode);
  changed.scenes[1].motionBeats[0].visual.title="new unapproved image";
  const t=structuredClone(f.timeline);
  t.cueSource=cueTimelineSource(changed);
  t.scenes[1].motionBeats=resolveMotionBeats(changed.scenes[1],changed.captions,30,changed.languageCode);
  assert.throws(()=>compileSoundKitCuePlan(changed,t,{...f,episode:changed,timeline:t}),/visual events drifted/);
});

test("SYNTHETIC: tampered selected CC0 asset bytes and stale P2 hashes reject selection",()=>{
  const f=fixture();
  const assets={...f.assetHashes,[f.decision.scenes[1].soundId]:"f".repeat(64)};
  assert.throws(()=>compileSoundKitCuePlan(f.episode,f.timeline,{...f,assetHashes:assets}),/asset bytes/);
  const d=structuredClone(f.decision);d.sourceSha256="f".repeat(64);
  assert.throws(()=>compileSoundKitCuePlan(f.episode,f.timeline,{...f,decision:d}),/stale/);
});

test("SYNTHETIC: forbidden hook injection and CTA relocation fail",()=>{
  const f=fixture();
  f.decision.scenes[0].soundId="kenney-interface-sounds/select_001.wav";
  assert.throws(()=>compileSoundKitCuePlan(f.episode,f.timeline,f),/not in exact licensed/);
  const f2=fixture();
  f2.episode.scenes[2].kind="example";
  const t2=structuredClone(f2.timeline);t2.cueSource=cueTimelineSource(f2.episode);
  assert.throws(()=>compileSoundKitCuePlan(f2.episode,t2,{...f2,timeline:t2}),/scenes differ|CTA|episode/);
});

test("SYNTHETIC: silence-only remains a valid zero-sound plan",()=>{
  const f=fixture();
  f.decision.scenes[1]=silence("example");
  const p=bind(f);
  assert.equal(p.selected.length,0);
  assert(p.report.every(x=>x.status==="SILENCE"));
});

test("SYNTHETIC: missing audio/duration, unsupported FPS and invalid time boundaries never produce plan",()=>{
  const f=fixture();
  assert.throws(()=>compileSoundKitCuePlan(f.episode,f.timeline,{...f,audioBytes:null}),/audio bytes/);
  const invalid=structuredClone(f.episode);delete invalid.audioDurationMs;
  assert.throws(()=>compileSoundKitCuePlan(invalid,f.timeline,{...f,episode:invalid}),/duration|timeline/);
  const fps=structuredClone(f.timeline);fps.fps=60;
  assert.throws(()=>compileSoundKitCuePlan(f.episode,fps,{...f,timeline:fps}),/30 fps/);
  const crossing=structuredClone(f.episode);
  crossing.scenes[1].endMs=3900;
  const t2=structuredClone(f.timeline);t2.cueSource=cueTimelineSource(crossing);
  t2.scenes[1].endMs=3900;
  assert.throws(()=>compileSoundKitCuePlan(crossing,t2,{...f,episode:crossing,timeline:t2}),/overlapping/);
});

test("SYNTHETIC: all 3 modes remain local data-only outputs",()=>{
  for(const spec of [{},{promo:true},{locale:"tg-TJ"}]){
    const f=fixture(spec),p=bind(f);
    assert.equal(p.audioMixProduced,false);
    assert.equal(p.renderEnabled,false);
    assert.equal(p.selectedBy,"Codex");
    assert.equal(p.voiceSourceUnmodified,true);
  }
});
