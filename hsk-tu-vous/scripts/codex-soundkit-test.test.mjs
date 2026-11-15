import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  buildCodexSoundKitTestBrief,soundKitTestPaths
} from "./codex-soundkit-test.mjs";
import {
  SOUNDKIT_SILENCE,soundCandidatesForScene,validateCodexSoundKitDecision
} from "./codex-soundkit-selection.mjs";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const policy=JSON.parse(readFileSync(path.join(ROOT,"content/sound-design.json"),"utf8"));
const lib=JSON.parse(readFileSync(path.join(ROOT,"content/sound-library.json"),"utf8"));

const silentDecision=brief=>({
  schemaVersion:1,mode:"TEST_ONLY",chosenBy:"Codex",
  episodeId:brief.episodeId,language:brief.language,languageCode:brief.languageCode,
  contentType:brief.contentType,sourceSha256:brief.sourceSha256,
  librarySha256:brief.librarySha256,policySha256:brief.policySha256,
  productionEffectsEnabled:false,
  scenes:brief.scenes.map(row=>({
    sceneId:row.sceneId,soundId:"SILENCE",reason:"Keep spoken Chinese examples clearly audible; there is no verified audible UI action.",
    eventId:null,visualEvidence:null,narrationEvidence:null,assetSha256:null,gainPreset:"none"
  }))
});
function firstNonSilent(brief){
  for(const scene of brief.scenes){
    for(const candidate of scene.candidates){
      if(candidate.id===SOUNDKIT_SILENCE)continue;
      const event=scene.visualEvents.find(e=>
        candidate.role==="gentle-illustration-reveal"&&
        ["illustration","authored-lesson-art"].includes(e.visualType)||
        candidate.role==="verified-product-screen-reveal"&&e.realProductCapture||
        candidate.role==="real-ui-press"&&e.provenTap||
        candidate.role==="verified-success-state"&&e.provenSuccess);
      if(event)return {scene,candidate,event};
    }
  }
  throw Error("No source-authored experimental sound event exists");
}

test("registered real RU/TJ lesson and ad generate per-language TEST brief without API",async()=>{
  for(const key of ["known-book-zai-20261115","shop-shirt-size-20261117","ji-vs-duoshao-books-price-20261118","library-pronunciation-20261119"]){
    for(const language of ["ru","tg"]){
      const brief=await buildCodexSoundKitTestBrief(key,{language});
      assert.equal(brief.mode,"TEST_ONLY");
      assert.equal(brief.episodeId,key);
      assert.equal(brief.language,language);
      assert.equal(brief.languageCode,language==="ru"?"ru-RU":"tg-TJ");
      assert.equal(brief.catalogueSize,151);
      assert.equal(brief.productionEffectsEnabled,false);
      assert.equal(brief.externalSelectionApi,null);
      assert.equal(brief.requiresNewApiKey,false);
      assert.equal(brief.allAssetsEligibleForProduction,false);
      assert(brief.scenes.length>2);
      assert(brief.scenes.every(x=>x.candidates[0].id===SOUNDKIT_SILENCE));
      assert(brief.scenes.every(x=>x.candidates.every(c=>c.productionReady===false)));
      assert.equal(brief.scenes[0].candidates.length,1);
      assert.equal(validateCodexSoundKitDecision(silentDecision(brief),brief),true);
    }
  }
});

test("source-bound RU/TJ decisions and paths never share hashes or scene narration",async()=>{
  const id="shop-shirt-size-20261117";
  const ru=await buildCodexSoundKitTestBrief(id,{language:"ru"});
  const tg=await buildCodexSoundKitTestBrief(id,{language:"tg"});
  assert.notEqual(ru.sourceSha256,tg.sourceSha256);
  assert.notEqual(ru.scenes[1].narration,tg.scenes[1].narration);
  assert.notEqual(soundKitTestPaths(id,"ru").decisionFile,soundKitTestPaths(id,"tg").decisionFile);
  assert.match(tg.sourcePath,/content\/locales\/tg\/promos\//);
  assert.throws(()=>validateCodexSoundKitDecision(silentDecision(ru),tg),/wrong language|stale/);
  assert.throws(()=>soundKitTestPaths("../../secret","ru"),/safe registered/);
});

test("actual localized illustration transition can have a justified test-only reference choice",async()=>{
  const brief=await buildCodexSoundKitTestBrief("ji-vs-duoshao-books-price-20261118",{language:"ru"});
  const {scene,candidate,event}=firstNonSilent(brief);
  assert.equal(candidate.license,"CC0-1.0");
  assert.match(candidate.sha256,/^[0-9a-f]{64}$/);
  const decision=silentDecision(brief);
  decision.scenes.find(x=>x.sceneId===scene.sceneId).soundId=candidate.id;
  const choice=decision.scenes.find(x=>x.sceneId===scene.sceneId);
  Object.assign(choice,{
    eventId:event.eventId,visualEvidence:event.visualEvidence,
    narrationEvidence:scene.narration.slice(0,20),
    assetSha256:candidate.sha256,gainPreset:candidate.gainPreset,
    reason:"Codex TEST reference for the drawn teaching change; must still compare against intentional silence in a real audio A/B."
  });
  assert.equal(validateCodexSoundKitDecision(decision,brief),true);
  choice.narrationEvidence="invented phrase not in source";
  assert.throws(()=>validateCodexSoundKitDecision(decision,brief),/narration evidence/);
  choice.narrationEvidence=scene.narration.slice(0,20);
  choice.visualEvidence="fabricated UI event";
  assert.throws(()=>validateCodexSoundKitDecision(decision,brief),/visual event/);
  choice.visualEvidence=event.visualEvidence;
  choice.assetSha256="e".repeat(64);
  assert.throws(()=>validateCodexSoundKitDecision(decision,brief),/source, license/);
});

test("genuine screenshot entrance may suggest a reveal, never fake click, payment or confirmation",async()=>{
  const brief=await buildCodexSoundKitTestBrief("shop-shirt-size-20261117",{language:"tg"});
  const scene=brief.scenes.find(x=>x.sceneId==="real-ai-voice");
  assert(scene);
  assert.equal(scene.visualEvents[0].realProductCapture,true);
  assert.equal(scene.visualEvents[0].provenTap,false);
  assert.equal(scene.visualEvents[0].provenSuccess,false);
  assert(scene.candidates.some(x=>x.role==="verified-product-screen-reveal"));
  assert(!scene.candidates.some(x=>["real-ui-press","verified-success-state"].includes(x.role)));
  const decision=silentDecision(brief);
  decision.scenes.find(x=>x.sceneId===scene.sceneId).soundId="kenney-ui-audio/click2.wav";
  assert.throws(()=>validateCodexSoundKitDecision(decision,brief),/not in exact licensed/);
});

test("first scene and hook cannot be given effects even with visual evidence",()=>{
  const scene={id:"hook",kind:"hook",narration:"This begins the program",
    motionBeats:[{id:"first",cueText:"This",visual:{title:"Intro",graphic:{nodes:[{id:"a"}]}}}]};
  const row=soundCandidatesForScene(scene,"lesson",policy,lib,0);
  assert.deepEqual(row.candidates.map(x=>x.id),["SILENCE"]);
  assert.equal(row.firstSceneProtected,true);
});

test("stale sound library or sound policy must invalidate old decisions",async()=>{
  const brief=await buildCodexSoundKitTestBrief("ji-vs-duoshao-books-price-20261118");
  const d=silentDecision(brief);
  assert.equal(validateCodexSoundKitDecision(d,brief),true);
  d.librarySha256="1".repeat(64);
  assert.throws(()=>validateCodexSoundKitDecision(d,brief),/stale/);
  d.librarySha256=brief.librarySha256;
  d.policySha256="a".repeat(64);
  assert.throws(()=>validateCodexSoundKitDecision(d,brief),/stale/);
  d.policySha256=brief.policySha256;
  d.chosenBy="hash algorithm";
  assert.throws(()=>validateCodexSoundKitDecision(d,brief),/not Codex/);
});

test("silence has to be an intentional, evidence-free documented choice",async()=>{
  const brief=await buildCodexSoundKitTestBrief("shop-shirt-size-20261117");
  const d=silentDecision(brief);
  d.scenes[0].eventId="fake-interaction";
  assert.throws(()=>validateCodexSoundKitDecision(d,brief),/deliberate silence/);
  d.scenes[0].eventId=null;
  d.scenes[0].reason="ok";
  assert.throws(()=>validateCodexSoundKitDecision(d,brief),/rationale/);
});

test("a test brief does not silently assign sounds and has no generated choice",async()=>{
  const brief=await buildCodexSoundKitTestBrief("shop-shirt-size-20261117");
  assert.equal(brief.status,"Codex decision required; source-scoped SOUND INTENT only");
  assert.equal(brief.selectionOwner,"Codex existing video-production agent");
  assert.equal(brief.scenes.every(scene=>scene.candidates[0].id==="SILENCE"),true);
  assert.equal(Object.hasOwn(brief,"decision"),false);
  assert.equal(Object.hasOwn(brief,"selectedSounds"),false);
});

test("catalogue cannot opt into production or quietly swap source ID",()=>{
  const row={id:"quiet-illustration",kind:"example",narration:"Original",
    motionBeats:[{id:"state-one",cueText:"Original",visual:{title:"Real visual",graphic:{nodes:[]}}}]};
  const invalid=structuredClone(lib);
  invalid.automaticallyUsedInProduction=true;
  assert.throws(()=>soundCandidatesForScene(row,"lesson",policy,invalid,1),/disabled raw audio catalog/);
  const altered=structuredClone(lib);
  const chosen=altered.assets.find(x=>x.id==="kenney-interface-sounds/select_001.wav");
  chosen.sha256="invalid";
  assert.throws(()=>soundCandidatesForScene(row,"lesson",policy,altered,1),/no longer matches/);
});
