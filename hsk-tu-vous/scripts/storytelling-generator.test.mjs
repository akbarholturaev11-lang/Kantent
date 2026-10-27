import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeAdaptiveBrief, evaluateAdaptiveCandidate } from "./storytelling-generator.mjs";
import { prepareAgentStorytellingBrief, validateAgentStorytellingProposal } from "./storytelling-agent.mjs";
import { validateStorytellingEpisode } from "./storytelling-plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = () => JSON.parse(fs.readFileSync(path.join(root, "content/episodes/youdianr-vs-yidianr-price-20261030.json"),"utf8"));
const proposal = () => {
  const e = load();
  const b = makeAdaptiveBrief(e);
  return {
    schemaVersion:1, episodeId:e.id, originalSha256:b.originalSha256,
    narrationEdits:[{sceneId:"request",
      narration:"А как вежливо попросить сделать чуть дешевле? 便宜一点儿，可以吗？ Это значит: «Можно немного дешевле?»"}],
    storytelling:{
      schemaVersion:1,pattern:"single-rehook",
      firstPayoff:{sceneId:"hook",cueText:"这个有点儿贵。"},
      reHooks:[{
        sceneId:"request",cueText:"А как вежливо попросить сделать чуть дешевле?",
        payoffSceneId:"contrast",payoffCueText:"便宜一点儿 — просим чуть дешевле.",
        reason:"Learner goes from a price evaluation to a genuinely new request"
      }]
    }
  };
};

test("AI brief contains only author-verified learner facts and keeps Hook/CTA separate",()=>{
  const e=load();
  const snapshot=JSON.stringify(e);
  const b=makeAdaptiveBrief(e);
  assert.equal(b.episodeId,e.id);
  assert.equal(b.scenes[0].kind,"hook");
  assert.equal(b.scenes[0].narration,e.scenes[0].narration);
  assert.ok(b.referenceFacts.length>0);
  assert.ok(b.sourceReceipts.length>0);
  assert.equal(JSON.stringify(e),snapshot);
});

test("valid Russian request rehook may be proposed without changing original content",()=>{
  const e=load();
  const initial=JSON.stringify(e);
  const result=evaluateAdaptiveCandidate(e,proposal());
  assert.equal(result.valid,true,result.errors.join("; "));
  assert.equal(result.status,"requires-source-review-and-owner-preview");
  assert.equal(result.draft.scenes[0].narration,e.scenes[0].narration);
  assert.deepEqual(result.draft.scenes.map(s=>s.cards),e.scenes.map(s=>s.cards));
  assert.equal(result.draft.scenes[2].narration.startsWith("А как"),true);
  assert.deepEqual(validateStorytellingEpisode(result.draft),[]);
  assert.equal(JSON.stringify(e),initial);
});

test("tampered hash, hook edits and new Chinese teaching phrases fail closed",()=>{
  const e=load(), p=proposal();
  p.originalSha256="wrong";assert.equal(evaluateAdaptiveCandidate(e,p).valid,false);
  p.originalSha256=makeAdaptiveBrief(e).originalSha256;
  p.narrationEdits[0].sceneId="hook";
  assert.match(evaluateAdaptiveCandidate(e,p).errors.join(" "),/hook/);
  p.narrationEdits[0].sceneId="request";
  p.narrationEdits[0].narration="А теперь произнесите: 我不喜欢你。";
  assert.match(evaluateAdaptiveCandidate(e,p).errors.join(" "),/Chinese/);
});

test("duplicate edits and in-script CTA are forbidden",()=>{
  const p=proposal(),e=load();
  p.narrationEdits.push({...p.narrationEdits[0]});
  assert.match(evaluateAdaptiveCandidate(e,p).errors.join(" "),/duplicate/);
  p.narrationEdits.pop();
  p.narrationEdits[0].narration+=" Скачайте приложение!";
  assert.match(evaluateAdaptiveCandidate(e,p).errors.join(" "),/CTA/);
});

test("approved, voiced or CTA-filled sources are never eligible",()=>{
  const e=load();
  for(const field of [{publishingStatus:"published"},{audioSrc:"voice.mp3"},{cta:"fake"}]){
    assert.throws(()=>makeAdaptiveBrief({...e,...field}),/unapproved CTA-free/);
  }
});

test("agent brief is read-only and requires no Gemini text-model calls",()=>{
  const e=load(),before=JSON.stringify(e);
  const result=prepareAgentStorytellingBrief(e);
  assert.equal(result.status,"editorial-brief-for-codex-or-claude-code");
  assert.equal(result.brief.scenes.length,5);
  assert.match(result.instructions.join(" "),/Gemini is reserved for voice TTS/);
  assert.equal(JSON.stringify(e),before);
});

test("Codex or Claude Code candidate passes only source-bound structural gates",()=>{
  const e=load(),before=JSON.stringify(e);
  const result=validateAgentStorytellingProposal(e,proposal());
  assert.equal(result.valid,true,result.errors.join("; "));
  assert.equal(result.status,"requires-agent-source-review-and-owner-preview");
  assert.equal(result.draft.storytelling.pattern,"single-rehook");
  assert.equal(result.draft.cta,undefined);
  assert.equal(JSON.stringify(e),before);
});

test("agent review rejects invalid source hash and unauthorized hook edits",()=>{
  const e=load(),p=proposal();
  p.originalSha256="wrong";
  assert.equal(validateAgentStorytellingProposal(e,p).valid,false);
  p.originalSha256=makeAdaptiveBrief(e).originalSha256;
  p.narrationEdits[0].sceneId="hook";
  assert.equal(validateAgentStorytellingProposal(e,p).valid,false);
});
