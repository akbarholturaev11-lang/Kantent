import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScheduledContent,futureContentSlots,weeklyCoverage,nextFullCalendarWeek} from './content-schedule.mjs';
import {auditPlanningBuffer,inspectDraftReadiness} from './self-improvement-check.mjs';
import {validateActionLesson} from './action-design-plan.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {proposeSeries} from './series-plan.mjs';
const calendar=()=>({timezone:'Asia/Shanghai',cadencePerWeek:7,planningWeekdays:['MO','TU','WE','TH','FR','SA','SU'],
 planningBuffer:{minimumFutureEpisodes:3,targetFutureEpisodes:4},seriesPolicy:{schemaVersion:1,continuationGapDays:1,allowContinuationOutsidePlanningWeekdays:true,requireCompleteDraftSet:true},
 weeklySchedule:{schemaVersion:1,effectiveFromDate:'2026-10-27',days:['lesson','advertisement','lesson','advertisement','lesson','series-part','series-part'].map((contentType,i)=>({weekday:['MO','TU','WE','TH','FR','SA','SU'][i],contentType,...(i>=5?{part:i-4}:{})}))},items:[]});
test('daily typed coverage ends with complete Saturday/Sunday set across month boundary',()=>{
 const c=calendar();const slots=futureContentSlots(c,{today:'2026-10-27',count:4});
 assert.deepEqual(slots.map(x=>[x.date,x.contentType,x.series?.part]),[['2026-10-28','lesson',undefined],['2026-10-29','advertisement',undefined],['2026-10-30','lesson',undefined],['2026-10-31','series-part',1],['2026-11-01','series-part',2]]);
 assert.equal(c.items.length,0);
});
test('distant ready lessons cannot conceal missing near advertisements',()=>{
 const c=calendar();c.items=[{id:'distant',date:'2026-11-04',episodeFile:'episodes/distant.json',status:'planned'}];
 const r=auditPlanningBuffer(c,{today:'2026-10-28'});assert.equal(r.readyFutureEpisodes,0);assert.equal(r.missing[0].contentType,'advertisement');
});
test('reject wrong weekday content and source path; preserve legacy dates',()=>{
 const c=calendar();c.items=[{id:'past',date:'2026-10-25'},{id:'wrong',date:'2026-10-29',episodeFile:'episodes/wrong.json'}];
 assert.match(validateScheduledContent(c).join(' '),/requires advertisement/);
 c.items[1]={id:'ad',date:'2026-10-29',contentType:'advertisement',promoFile:'promos/ad.json'};
 assert.deepEqual(validateScheduledContent(c),[]);
});
test('a detailed failed readiness result is false, never truthy coverage',()=>{
 const c=calendar();c.items=[{id:'ad',date:'2026-10-29',status:'planned',contentType:'advertisement',promoFile:'promos/ad.json'}];
 const r=weeklyCoverage(c,{today:'2026-10-28',count:1,itemIsReady:()=>({ready:false,reason:'tg missing'})});
 assert.equal(r[0].ready,false);assert.equal(r[0].reason,'tg missing');
});
test('weekly series must start Saturday; Sunday is the immediately following part',()=>{
 const c=calendar();const result=proposeSeries(c,{seriesId:'cafe',startDate:'2026-10-31',totalParts:2,today:'2026-10-28'});
 assert.deepEqual(result.propose.map(x=>x.date),['2026-10-31','2026-11-01']);
 assert.throws(()=>proposeSeries(c,{seriesId:'wrong',startDate:'2026-10-30',totalParts:2,today:'2026-10-28'}),/weekly/);
});
test('Sunday cannot invent a missing past first part',()=>{
 const r=weeklyCoverage(calendar(),{today:'2026-10-31',count:1});assert.equal(r[0].blocked,true);assert.match(r[0].reason,/past part/);
});

test('weekly reserve covers exactly next Monday through Sunday on Sunday morning',()=>{
  const c=calendar();
  c.planningBuffer={mode:'next-full-calendar-week',minimumFutureEpisodes:7,targetFutureEpisodes:7};
  assert.deepEqual(nextFullCalendarWeek('2026-11-22'), {
    startDate:'2026-11-23',endDate:'2026-11-29',anchorDate:'2026-11-22',
  });
  const r=auditPlanningBuffer(c,{today:'2026-11-22'});
  assert.equal(r.expectedFutureSlots,7);
  assert.deepEqual([r.targetWeekStart,r.targetWeekEnd,r.readyFutureEpisodes],['2026-11-23','2026-11-29',0]);
  assert.deepEqual(r.missing.map(x=>[x.date,x.contentType,x.series?.part]),[
    ['2026-11-23','lesson',undefined],
    ['2026-11-24','advertisement',undefined],
    ['2026-11-25','lesson',undefined],
    ['2026-11-26','advertisement',undefined],
    ['2026-11-27','lesson',undefined],
    ['2026-11-28','series-part',1],
    ['2026-11-29','series-part',2],
  ]);
});
test('weekly reserve never becomes an 8-day rolling plan between runs',()=>{
  const c=calendar();
  c.planningBuffer={mode:'next-full-calendar-week',minimumFutureEpisodes:7,targetFutureEpisodes:7};
  const monday=auditPlanningBuffer(c,{today:'2026-11-23'});
  const thursday=auditPlanningBuffer(c,{today:'2026-11-26'});
  assert.deepEqual([monday.targetWeekStart,monday.targetWeekEnd],['2026-11-30','2026-12-06']);
  assert.deepEqual([thursday.targetWeekStart,thursday.targetWeekEnd],['2026-11-30','2026-12-06']);
  assert.equal(monday.expectedFutureSlots,7);
  c.planningBuffer.targetFutureEpisodes=4;
  assert.throws(()=>auditPlanningBuffer(c,{today:'2026-11-22'}),/exactly 7/);
});

test('Nov 21–22 transition serial is truly ready in RU/TG and has drawable distinct action scenes',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const c=JSON.parse(fs.readFileSync(path.join(root,'content/calendar.json'),'utf8'));
  const dates=['2026-11-21','2026-11-22'];
  const parts=dates.map(date=>c.items.find(item=>item.date===date));
  assert.equal(parts.length,2);
  assert.ok(parts.every(Boolean),'both calendar entries required');
  assert.deepEqual(parts.map(p=>p.contentType),['series-part','series-part']);
  assert.equal(parts[0].series.id,parts[1].series.id);
  assert.deepEqual(parts.map(p=>p.series.part),[1,2]);
  assert.deepEqual(validateScheduledContent(c),[]);
  for(const item of parts){
    const ready=inspectDraftReadiness(root,item);
    assert.equal(ready.ready,true,JSON.stringify({date:item.date,readiness:ready}));
    assert.equal(ready.languages.ru?.ready,true);
    assert.equal(ready.languages.tg?.ready,true);
    for(const prefix of ['content/','content/locales/tg/']){
      const episode=JSON.parse(fs.readFileSync(path.join(root,prefix,item.episodeFile),'utf8'));
      assert.equal(episode.scenes.length,4);
      const validation=validateActionLesson(episode,{requireVisibleChange:true});
      assert.equal(validation.actionCount,8);
      assert.ok(!episode.cta && episode.scenes.every(s=>s.kind!=='cta'));
    }
  }
  assert.ok(parts[0].date < parts[1].date);
  const ru1=JSON.parse(fs.readFileSync(path.join(root,'content',parts[0].episodeFile),'utf8'));
  const ru2=JSON.parse(fs.readFileSync(path.join(root,'content',parts[1].episodeFile),'utf8'));
  assert.match(ru1.scenes.at(-1).narration,/две одинаковые двери/);
  assert.match(ru2.scenes[0].narration,/две двери/);
  assert.match(ru2.scenes.at(-1).narration,/История закончилась/);
});
