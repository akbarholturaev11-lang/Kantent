import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { suggestSemanticShots } from "./semantic-shot-adviser.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>JSON.parse(fs.readFileSync(path.join(root,"content",file),"utf8"));
const pool=()=>read("episodes/hui-vs-neng-pool-20261028.json");

test("pool distinction proposes the authored location and closed access, not imaginary swimming motions",()=>{
  const before=pool();
  const raw=JSON.stringify(before);
  const plan=suggestSemanticShots(before);
  assert.equal(JSON.stringify(before),raw);
  assert.equal(plan.mode,"suggestions-only");
  assert.equal(plan.productionEnabled,false);
  assert.equal(plan.autoApplied,false);
  assert.equal(plan.scenes.length,5);
  const hook=plan.scenes.find(s=>s.sceneId==="hook");
  assert.equal(hook.proposedShot.environmentId,"pool");
  assert.deepEqual(hook.proposedShot.actorIds,[]);
  assert.ok(hook.actionCandidates.some(a=>a.proposedAction==="show-blocked" && a.proposedCueText==="закрыт"));
  assert.ok(hook.actionCandidates.every(a=>a.status==="proposal-only-unverified-by-transcript"));
  const skill=plan.scenes.find(s=>s.sceneId==="skill");
  assert.ok(skill.unsupportedConcepts.some(x=>x.includes("Swimming")));
  assert.ok(plan.scenes.every(s=>s.requiresOwnerReview));
});

test("direction verbs produce opposite physical motion proposals, grounded in narration and correct Hanzi",()=>{
  const episode={id:"test-lai-qu",date:"2026-11-02",topic:"Как идти",scenes:[{
    id:"movement",kind:"example",narration:"На улице человек приходит и уходит.",
    headline:"来 и 去",
    visualBeats:[{hero:"来"},{hero:"去"}]
  }]};
  const plan=suggestSemanticShots(episode);
  const scene=plan.scenes[0];
  assert.equal(scene.proposedShot.environmentId,"street");
  assert.deepEqual(scene.proposedShot.actorIds,["traveler"]);
  assert.equal(scene.proposedShot.cameraStyle,"follow");
  assert.deepEqual(scene.actionCandidates.map(x=>[x.proposedAction,x.proposedCueText,x.suggestedBeatIndex]),
   [["approach-camera","приходит",0],["move-away","уходит",1]]);
  assert.equal(scene.actionCandidates.every(x=>x.reviewRequired.some(t=>t.includes("Gemini"))),true);
});

test("no action is invented for a negated direction",()=>{
 const episode={id:"test-negative",scenes:[{id:"one",kind:"example",narration:"Он не приходит домой.",visualBeats:[{hero:"来"}]}]};
 const plan=suggestSemanticShots(episode);
 assert.deepEqual(plan.scenes[0].actionCandidates,[]);
 assert.match(plan.scenes[0].warnings.join(" "),/Negated/);
});

test("no student is added to text-only or abstract grammar shot",()=>{
 const lesson={id:"test-abstract",scenes:[{id:"one",kind:"context",narration:"Эта частица меняет грамматический смысл.",visualBeats:[{hero:"了"}]},
 {id:"two",kind:"example",narration:"Сравните два предложения.",visualBeats:[{hero:"了"}]}]};
 const plan=suggestSemanticShots(lesson);
 assert.deepEqual(plan.scenes.map(x=>x.proposedShot.actorIds),[[],[]]);
 assert.equal(plan.scenes[0].proposedShot.environmentId,"neutral");
 assert.notEqual(plan.scenes[0].proposedShot.shotType,plan.scenes[1].proposedShot.shotType);
});

test("ambiguous repeated spoken words stay review-only; never invent timing",()=>{
 const lesson={id:"test-repeat",scenes:[{id:"one",kind:"example",narration:"Он приходит, ещё приходит.",
 visualBeats:[{hero:"来"}]}]};
 const action=suggestSemanticShots(lesson).scenes[0].actionCandidates;
 assert.equal(action.length,2);
 assert.ok(action.every(a=>a.cueOccurrenceNeedsReview));
 assert.ok(action.every(a=>a.proposedCueText==="приходит"));
 assert.ok(action.every(a=>a.status.includes("unverified")));
});

test("CTA is always excluded from proposals",()=>{
 const episode=pool();episode.scenes.push({id:"cta",kind:"cta",narration:"Скачайте HSK AI.",headline:"HSK",visualBeats:[{hero:"HSK"}]});
 assert.ok(suggestSemanticShots(episode).scenes.every(s=>s.kind!=="cta"));
});

test("published or approved episodes return no proposals, including when otherwise planned",()=>{
 const episode=pool();
 for(const state of ["owner-approved-for-zernio-publishing","zernio-published","rendered-pending-owner-approval"]){
  const plan=suggestSemanticShots(episode,{eligibility:state});
  assert.equal(plan.eligible,false);assert.deepEqual(plan.scenes,[]);
 }
 episode.publishingStatus="published";
 assert.equal(suggestSemanticShots(episode).eligible,false);
});

test("canonical CLI reads planned lesson without mutating sources",()=>{
 const id="hui-vs-neng-pool-20261028";
 const sourcePath=path.join(root,"content/episodes/"+id+".json");
 const before=fs.readFileSync(sourcePath,"utf8");
 const result=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts/preview-semantic-shots.mjs"),id],
  {cwd:root,encoding:"utf8"}));
 assert.equal(result.episodeId,id);
 const statusFile=path.join(root,'review',id,'status.json');
 const stage=fs.existsSync(statusFile)?JSON.parse(fs.readFileSync(statusFile,'utf8')).stage:'planned';
 assert.equal(result.eligible,['planned','plan-ready'].includes(stage));
 if(result.eligible)assert.equal(result.scenes[0].proposedShot.environmentId,"pool");
 else {assert.deepEqual(result.scenes,[]);assert.match(result.reason,/Protected/);}
 assert.equal(fs.readFileSync(sourcePath,"utf8"),before);
});
