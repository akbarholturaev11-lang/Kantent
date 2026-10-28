import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScheduledContent,futureContentSlots,weeklyCoverage} from './content-schedule.mjs';
import {auditPlanningBuffer} from './self-improvement-check.mjs';
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
