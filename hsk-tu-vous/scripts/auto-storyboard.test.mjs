import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decorateFutureLesson, decorateCanonicalLesson, authoredQuizChoices, compareAuthorialContent } from "./auto-storyboard.mjs";
import { getPlannedEpisode, synchronizeAutoStoryboard } from "./lib.mjs";
import { validateStoryboardEpisode } from "./storyboard-validation.mjs";
import { validateCtaEpisode } from "./cta-lab.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(p)=>JSON.parse(fs.readFileSync(path.join(root,"content",p),"utf8"));
const calendar=read("calendar.json");
const registry=read("creative-formats.json");
const ctaLab=read("cta-lab.json");
const byFile=Object.fromEntries(calendar.items
  .filter(i=>i.episodeFile && fs.existsSync(path.join(root,"content",i.episodeFile)))
  .map(i=>[i.episodeFile,read(i.episodeFile)]));
const baseline=(id)=>byFile[calendar.items.find(i=>i.id===id).episodeFile];
const decorate=(id)=>decorateFutureLesson(baseline(id),{calendar,registry,episodeByFile:byFile});

test("all upcoming planned episodes are auto-formatted consistently from the same calendar anchor",()=>{
  const ids=["zai-location","ji-vs-duoshao","xiang-vs-yao","time-word-order"];
  const result=ids.map(id=>decorate(id));
  assert.deepEqual(result.map(e=>e.creativeFormatId),
    ["street-situation","speed-quiz","micro-series","problem-fix"]);
  assert.ok(result.every(e=>validateStoryboardEpisode(e)));
  assert.ok(result.every(e=>e.scenes.every(s=>s.storyboard?.formatId===e.creativeFormatId)));
  assert.equal(result[2].scenes.every(s=>s.storyboard.character==="student"),true);
  assert.equal(result[1].scenes[0].storyboard.options.length,2);
  assert.deepEqual(result[1].scenes[0].storyboard.options,["几","多少"]);
  assert.ok(result[1].scenes.slice(1).every(s=>s.storyboard.options===undefined));
});
test("dated production loader gets auto storyboard BEFORE central CTA, without changing its registered copy",async()=>{
  for(const date of ["2026-10-12","2026-10-14","2026-10-16","2026-10-19","2026-10-21","2026-10-23"]){
    const {episode}=await getPlannedEpisode(date);
    assert.ok(episode.creativeFormatId, date);
    assert.equal(episode.scenes.at(-1).kind,"cta");
    assert.equal(episode.scenes.at(-1).storyboard,undefined);
    assert.equal(episode.scenes.filter(s=>s.kind==="cta").length,1);
    assert.equal(episode.autoStoryboard.status,"generated-for-review");
    assert.equal(episode.voiceProvider, baseline(episode.id).voiceProvider,
      "Hydration must preserve the episode's authored voice provider");
    const registration = validateCtaEpisode(episode, ctaLab);
    if (episode.ctaExperiment) {
      assert.equal(registration.valid, true,
        "Only a snapshot matching current copy, context and owner policy may stay registered");
    } else {
      assert.equal(registration.valid, false);
      assert.ok(registration.errors.some(error => error.includes("Register this CTA")),
        "Old CTA snapshots must not be silently reused after owner policy changes");
    }
    assert.ok(episode.scenes.filter(s=>s.kind!=="cta").every(s=>s.storyboard?.formatId===episode.creativeFormatId));
  }
});
test("owner-authorized recut is a distinct street situation pilot without changing original",()=>{
  const old=baseline("zai-location");
  const recut=decorate("zai-location-cinematic-v2");
  assert.equal(recut.id,"zai-location-cinematic-v2");
  assert.equal(recut.date,"2026-10-13");
  assert.equal(recut.pilotRemakeOfEpisodeId,"zai-location");
  assert.equal(recut.originalCalendarDate,"2026-10-12");
  assert.equal(recut.creativeFormatId,"street-situation");
  assert.equal(recut.scenes[0].storyboard.setting,"street");
  assert.notEqual(recut.scenes[0].narration,old.scenes[0].narration);
  assert.equal(recut.cta,undefined);
  assert.equal(recut.ctaExperiment,undefined);
  assert.equal(recut.scenes.length,4);
  const quiz=decorate("ji-vs-duoshao");
  assert.equal(quiz.creativeFormatId,"speed-quiz");
});

test("canonical lesson files remain unchanged and animation planning is idempotent",()=>{
  const raw=baseline("xiang-vs-yao");
  const snapshot=JSON.stringify(raw);
  assert.equal(decorateCanonicalLesson(raw).creativeFormatId,"micro-series");
  assert.equal(JSON.stringify(raw),snapshot);
  assert.deepEqual(decorate("xiang-vs-yao"),decorateFutureLesson(decorate("xiang-vs-yao"),{calendar,registry,episodeByFile:byFile}));
});
test("refuse fake speed-quiz choices; use non-quiz format instead when terms unavailable",()=>{
  const updated=structuredClone(baseline("ji-vs-duoshao"));
  updated.scenes=updated.scenes.filter(s=>s.id==="hook"||s.id==="example1");
  assert.equal(authoredQuizChoices(updated),null);
  const modified={...byFile,"episodes/ji-vs-duoshao.json":updated};
  const output=decorateFutureLesson(updated,{calendar,registry,episodeByFile:modified});
  assert.equal(output.creativeFormatId,"problem-fix");
  assert.equal(output.autoStoryboard.reason,"missing-authored-quiz-options-fallback");
  assert.ok(output.scenes.every(s=>s.storyboard.formatId==="problem-fix"));
});
test("safe-sync only clean, pre-voice review; never clobber published/owner-edited copy",async()=>{
  const desired=(await getPlannedEpisode("2026-10-14")).episode;
  const stale=structuredClone(desired);
  delete stale.creativeFormatId;
  delete stale.autoStoryboard;
  for(const s of stale.scenes) delete s.storyboard;
  assert.equal(compareAuthorialContent(stale,desired),true);
  assert.deepEqual(synchronizeAutoStoryboard(stale,desired,{stage:"plan-ready"}),desired);
  const edited=structuredClone(stale);
  edited.scenes[0].narration+=" (owner changed)";
  assert.throws(()=>synchronizeAutoStoryboard(edited,desired,{stage:"plan-ready"}),/review copy differs/i);
  assert.throws(()=>synchronizeAutoStoryboard({...stale,audioSrc:"voice.mp3"},desired,{stage:"plan-ready"}),/review copy differs/i);
  assert.throws(()=>synchronizeAutoStoryboard(stale,desired,{stage:"rendered-pending-owner-approval"}),/review copy differs/i);
  assert.strictEqual(synchronizeAutoStoryboard(desired,desired,{stage:"rendered-pending-owner-approval"}),desired);
});
test("opt-in rehook annotates existing storyboard mood without editing narration or cards",()=>{
  const base=baseline("youdianr-vs-yidianr-price-20261030");
  const episode=structuredClone(base);
  episode.storytelling={schemaVersion:1,pattern:"single-rehook",
    firstPayoff:{sceneId:"hook",cueText:"这个有点儿贵。"},
    reHooks:[{sceneId:"request",cueText:"Теперь просьба продавцу:",
      payoffSceneId:"contrast",payoffCueText:"便宜一点儿 — просим чуть дешевле.",
      reason:"A distinct request to bargain after the initial price evaluation"}]};
  const source=JSON.stringify(episode);
  const copy=decorateFutureLesson(episode,{calendar,registry,episodeByFile:byFile});
  assert.equal(JSON.stringify(episode),source);
  assert.equal(copy.scenes.find(s=>s.id==="request").storyboard.mood,"question");
  assert.equal(copy.scenes.find(s=>s.id==="contrast").storyboard.mood,"answer");
  assert.deepEqual(copy.scenes.map(s=>s.narration),episode.scenes.map(s=>s.narration));
});

test("explicit approval and legacy videos remain unmodified",()=>{
  const old=baseline("name-question");
  assert.deepEqual(decorateCanonicalLesson(old),old);
  const published={...baseline("xiang-vs-yao"), publishingStatus:"published"};
  assert.deepEqual(decorateFutureLesson(published,{calendar,registry,episodeByFile:byFile}),published);
});
