import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDate, recommendCreativeFormats } from './viral-plan.mjs';
import { validateObservation, deriveMetrics, loadObservations } from './feedback-analyzer.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>JSON.parse(fs.readFileSync(path.join(root,'content',p),'utf8'));
const calendar=read('calendar.json');
const registry=read('creative-formats.json');
const policy=read('hook-lab.json').policy;
const episodes=Object.fromEntries(calendar.items
  .filter((item)=>item.episodeFile && fs.existsSync(path.join(root,'content',item.episodeFile)))
  .map((item)=>[item.episodeFile,read(item.episodeFile)]));
const emptyFeedback={posts:[],caveats:['No verified fixed-day readbacks']};

test('uses canonical China timezone for planning',()=>{
  assert.equal(localDate(new Date('2026-10-11T16:01:00.000Z'),'Asia/Shanghai'),'2026-10-12');
});
test('four distinct pilot formats compatible with existing hooks',()=>{
  const result=recommendCreativeFormats({
    calendar,episodeByFile:episodes,registry,feedback:emptyFeedback,policy,date:'2026-10-11'
  });
  const regular = result.upcoming.filter(p=>p.episodeId!=="zai-location-cinematic-v2");
  assert.equal(result.upcoming.find(p=>p.episodeId==="zai-location-cinematic-v2").creativeFormatId,"street-situation");
  assert.deepEqual(regular.slice(0,4).map((p)=>p.creativeFormatId),
    ['street-situation','speed-quiz','micro-series','problem-fix']);
  assert.deepEqual(regular.slice(0,4).map((p)=>p.currentHookFormat),
    ['scenario','question','scenario','contrast']);
  assert.equal(result.evidenceStatus,'insufficient-evidence');
  assert.equal(result.productFunnel.verifiedNewLessonStarts,null);
  assert.equal(result.publishingAuthorized,false);
  assert.equal(result.formatPromotionAuthorized,false);
});
test('does not change or assign reviewed/published episodes',()=>{
  const protectedEpisode={...episodes[calendar.items.find((i)=>i.status==='planned').episodeFile],publishingStatus:'approved'};
  const item=calendar.items.find((i)=>i.status==='planned');
  const future={...episodes,[item.episodeFile]:protectedEpisode};
  const plan=recommendCreativeFormats({calendar,episodeByFile:future,registry,feedback:emptyFeedback,policy,date:item.date});
  assert.equal(plan.upcoming[0].creativeFormatId,null);
  assert.equal(plan.upcoming[0].status,'existing-approval-state-protected');
  assert.equal(episodes[item.episodeFile].publishingStatus,'pending-owner-review');
});
test('refuses format attribution without verified mapping',()=>{
  const obs=structuredClone(loadObservations()[0]);
  obs.creativeFormatId='speed-quiz';
  assert.match(validateObservation(obs).join(';'),/verified episode/);
  obs.episodeId='confirmed-episode';obs.hookFormat='question';obs.hskLevel='HSK 1';
  assert.deepEqual(validateObservation(obs),[]);
  assert.equal(deriveMetrics(obs).creativeFormatId,'speed-quiz');
});
test('published legacy post never becomes a new-format win, even if someone tags it with the new format',()=>{
  const oldRecord={
    creativeFormatId:'street-situation',window:'7d',postId:'old-post',platform:'instagram',
    episodeId:'zai-location',hookFormat:'scenario',hskLevel:'HSK 1',
    durationBand:'25-29s',views:63000,averageWatchRatio:0.99
  };
  const result=recommendCreativeFormats({
    calendar,episodeByFile:episodes,registry,policy,date:'2026-10-11',
    feedback:{posts:[oldRecord],caveats:[]}
  });
  assert.deepEqual(result.evidence,[]);
  assert.equal(result.evidenceStatus,'insufficient-evidence');
  assert.equal(result.productFunnel.verifiedNewLessonStarts,null);
});

test('lifetime tagged data is never treated as evidence and no winner is auto-picked',()=>{
  const summary=recommendCreativeFormats({
    calendar,episodeByFile:episodes,registry,policy,date:'2026-10-11',
    feedback:{posts:[{creativeFormatId:'speed-quiz',window:'lifetime',
      platform:'instagram',episodeId:'verified-one',hookFormat:'question',
      hskLevel:'HSK 1',durationBand:'25-29s',views:100000,
      averageWatchRatio:0.95}],caveats:[]}
  });
  assert.equal(summary.evidence.length,0);
  assert.equal(summary.evidenceStatus,'insufficient-evidence');
});
test('requires three comparable verified 7d posts for review, not promotion',()=>{
  const posts=['a','b','c'].map((v)=>({
    creativeFormatId:'speed-quiz',window:'7d',postId:v,platform:'instagram',
    episodeId:'verified-'+v,hookFormat:'question',hskLevel:'HSK 1',
    durationBand:'25-29s',views:1000,averageWatchRatio:0.51
  }));
  const result=recommendCreativeFormats({
    calendar,episodeByFile:episodes,registry,policy,date:'2026-10-11',
    feedback:{posts,caveats:[]}
  });
  assert.equal(result.evidence[0].readiness,'eligible-for-owner-comparison');
  assert.equal(result.evidenceStatus,'owner-review-required');
  assert.equal(result.formatPromotionAuthorized,false);
});
test('rejects invalid and duplicate registry IDs',()=>{
  const broken={...registry,formats:[registry.formats[0],registry.formats[0]]};
  assert.throws(()=>recommendCreativeFormats({
    calendar,episodeByFile:episodes,registry:broken,feedback:emptyFeedback,policy,date:'2026-10-11'
  }),/duplicate/);
});
