import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeAdaptiveBrief, evaluateAdaptiveCandidate } from "./storytelling-generator.mjs";
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

test("local brief contains only author-verified learner facts and keeps Hook/CTA separate",()=>{
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

function tajikProposal() {
  const source=JSON.parse(fs.readFileSync(path.join(root,'content/locales/tg/episodes/er-vs-liang-cafe-20261026.json'),'utf8'));
  const brief=makeAdaptiveBrief(source);
  const narration=source.scenes.find(scene=>scene.id==='numeral').narration.replace('Аммо бист','Аммо дар таркиби адад бист');
  return {source,brief,proposal:{schemaVersion:1,episodeId:source.id,languageCode:'tg-TJ',originalSha256:brief.originalSha256,
    narrationEdits:[{sceneId:'numeral',narration}],storytelling:{schemaVersion:1,pattern:'single-rehook',
      firstPayoff:{sceneId:'hook',cueText:'Ҷавоби дуруст — 两.'},reHooks:[{
        sceneId:'numeral',cueText:'Аммо дар таркиби адад бист — 二十.',
        payoffSceneId:'recap',payoffCueText:'Ду пиёла — 两杯茶.',
        reason:'Ҳамон фарқро дар таркиби адад ва миқдори пиёлаҳо нишон медиҳад.'}]}}};
}

test('adaptive briefs and source-bound proposals support Tajik narration and its actual contrast cues',()=>{
  const {source,brief,proposal}=tajikProposal(),before=JSON.stringify(source);
  assert.equal(brief.language,'tg');
  assert.equal(brief.languageCode,'tg-TJ');
  assert.match(brief.lessonLanguage,/Тоҷикӣ/);
  assert.ok(brief.candidateSceneIds.includes('numeral'));
  assert.ok(!brief.constraints.some(rule=>rule.includes('only Russian')));
  const result=evaluateAdaptiveCandidate(source,proposal);
  assert.equal(result.valid,true,result.errors.join('; '));
  assert.equal(result.draft.languageCode,'tg-TJ');
  assert.match(result.draft.scenes.find(scene=>scene.id==='numeral').narration,/таркиби адад/);
  assert.equal(JSON.stringify(source),before);
});

test('Tajik proposals cannot borrow Russian language identity or add a Tajik in-lesson CTA',()=>{
  const {source,proposal}=tajikProposal();
  proposal.languageCode='ru-RU';
  assert.match(evaluateAdaptiveCandidate(source,proposal).errors.join(' '),/languageCode/);
  delete proposal.languageCode;
  assert.match(evaluateAdaptiveCandidate(source,proposal).errors.join(' '),/languageCode/);
  proposal.languageCode='tg-TJ';
  proposal.narrationEdits[0].narration+=' Ба профил даро ва HSK AI-ро боргирӣ кун!';
  assert.match(evaluateAdaptiveCandidate(source,proposal).errors.join(' '),/CTA/);
});
