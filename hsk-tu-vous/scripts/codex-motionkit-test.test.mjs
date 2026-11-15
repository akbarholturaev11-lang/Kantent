import test from "node:test";
import assert from "node:assert/strict";
import {allowedMotionKitCandidates,validateCodexMotionDecision} from "./codex-motionkit-selection.mjs";
import {buildCodexMotionKitTestBrief,motionKitTestPaths} from "./codex-motionkit-test.mjs";

const makeDecision=(brief)=>({
  schemaVersion:1,mode:"TEST_ONLY",chosenBy:"Codex",episodeId:brief.episodeId,
  contentType:brief.contentType,sourceSha256:brief.sourceSha256,
  scenes:brief.scenes.map(row=>({
    sceneId:row.sceneId,componentId:row.candidates[0].id,
    reason:"Chosen for the authored sentence meaning; avoids competing with spoken focus.",
    narrationEvidence:row.narration.slice(0,Math.min(20,row.narration.length))
  })),
});
test("every registered upcoming video gets an automatic Codex TEST brief; no API",async()=>{
 for(const id of ["shop-shirt-size-20261117","ji-vs-duoshao-books-price-20261118"]){
   const brief=await buildCodexMotionKitTestBrief(id);
   assert.equal(brief.episodeId,id);
   assert.equal(brief.mode,"TEST_ONLY");
   assert.equal(brief.selectionOwner,"Codex video-production agent");
   assert.equal(brief.externalSelectionApi,null);
   assert.equal(brief.requiresNewApiKey,false);
   assert.equal(brief.automaticBrief,true);
   assert.match(brief.label,/TEST ONLY/);
   assert(brief.scenes.length>0);
   assert(brief.scenes.every(s=>s.candidates.length>0 && typeof s.narration==="string"));
   assert.equal(validateCodexMotionDecision(makeDecision(brief),brief),true);
 }
});
test("lesson test candidates are artwork only, ads can choose concept UI safely",async()=>{
 const lesson=await buildCodexMotionKitTestBrief("ji-vs-duoshao-books-price-20261118");
 assert(lesson.scenes.every(s=>s.candidates.every(c=>["art-dissolve","art-drift"].includes(c.id))));
 const ad=await buildCodexMotionKitTestBrief("shop-shirt-size-20261117");
 assert(ad.scenes.some(s=>s.candidates.some(c=>c.id==="card-reveal")));
 assert.deepEqual(allowedMotionKitCandidates({kind:"cta"},"advertisement"),[]);
});
test("Codex has to choose; algorithm suggestion is not an AI decision",async()=>{
 const brief=await buildCodexMotionKitTestBrief("shop-shirt-size-20261117");
 const decision=makeDecision(brief);
 delete decision.chosenBy;
 assert.throws(()=>validateCodexMotionDecision(decision,brief),/match current TEST ONLY/);
 decision.chosenBy="Codex";
 decision.scenes[0].componentId="not-registered";
 assert.throws(()=>validateCodexMotionDecision(decision,brief),/disallowed/);
 decision.scenes[0].componentId=brief.scenes[0].candidates[0].id;
 decision.scenes[0].narrationEvidence="invented phrase absent from script";
 assert.throws(()=>validateCodexMotionDecision(decision,brief),/narration evidence/);
});
test("stale source, copied selection and CTA injection are rejected",async()=>{
 const brief=await buildCodexMotionKitTestBrief("ji-vs-duoshao-books-price-20261118");
 const decision=makeDecision(brief);
 decision.sourceSha256="a".repeat(64);
 assert.throws(()=>validateCodexMotionDecision(decision,brief),/current TEST ONLY/);
 decision.sourceSha256=brief.sourceSha256;
 decision.scenes.push({sceneId:"cta",componentId:"glass-info",reason:"Invented fake CTA screenshot",narrationEvidence:"CTA"});
 assert.throws(()=>validateCodexMotionDecision(decision,brief),/every eligible scene/);
 assert.throws(()=>motionKitTestPaths("../../secret"),/safe episode ID/);
});
