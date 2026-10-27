import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeAdaptiveBrief, evaluateAdaptiveCandidate } from "./storytelling-generator.mjs";
import { askGeminiForCandidate, executeAdaptive } from "./storytelling-gemini.mjs";
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

test("non-AI preview is read-only and incurs zero model calls",async()=>{
  const result=await executeAdaptive(load(),{runAi:false,http:()=>{throw Error("Should not execute network")}});
  assert.equal(result.status,"brief-only-no-api-charge");
  assert.equal(result.brief.scenes.length,5);
});

test("Gemini API requires explicit opt-in and does not leak an API key in errors",async()=>{
  const b=makeAdaptiveBrief(load());
  await assert.rejects(()=>askGeminiForCandidate(b,{env:{GEMINI_API_KEY:"top-secret"},
    http:()=>{throw Error("should not call")}}),/opt-in/);
  const fake=async(_url, options)=>{
    assert.equal(options.headers["x-goog-api-key"],"top-secret");
    return {ok:false,status:429,text:async()=>"{truncated}"};
  };
  await assert.rejects(()=>askGeminiForCandidate(b,{env:{GEMINI_API_KEY:"top-secret",HSK_AI_ALLOW_GEMINI_SCRIPT:"true"},http:fake}),e=>{
    assert.match(e.message,/HTTP 429/);
    assert.equal(e.message.includes("top-secret"),false);
    return true;
  });
});

test("mocked Gemini returns a candidate; only reviewed proposal goes forward",async()=>{
  const p=proposal();
  const http=async(_url,options)=>{
    assert.equal(options.method,"POST");
    return {ok:true,text:async()=>JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(p)}]}}]})};
  };
  const result=await executeAdaptive(load(),{
    runAi:true,env:{GEMINI_API_KEY:"test-key",HSK_AI_ALLOW_GEMINI_SCRIPT:"true"},http
  });
  assert.equal(result.status,"requires-source-review-and-owner-preview");
  assert.equal(result.narrationChanged,true);
  assert.equal(result.draft.storytelling.pattern,"single-rehook");
  assert.equal(result.draft.cta,undefined);
});
