import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateSeriesCalendar, proposeSeries, validateSerialArc, serialReadbacks} from './series-plan.mjs';
import {runCli} from './scenario-buffer-plan.mjs';
import {auditPlanningBuffer} from './self-improvement-check.mjs';

const calendar = () => ({timezone:'Asia/Shanghai',planningWeekdays:['MO','WE','FR'],cadencePerWeek:3,
  planningBuffer:{minimumFutureEpisodes:3,targetFutureEpisodes:4},items:[],
  seriesPolicy:{schemaVersion:1,continuationGapDays:1,
    allowContinuationOutsidePlanningWeekdays:true,requireCompleteDraftSet:true}});
const request = {seriesId:'life-in-china',startDate:'2026-10-30',totalParts:2,today:'2026-10-27'};
const complete = () => {
  const c = calendar();
  c.items = proposeSeries(c, request).propose.map((item, i) =>
    ({...item,id:'lesson-'+i,episodeFile:'episodes/lesson-'+i+'.json'}));
  return c;
};

test('Friday continuation is Saturday, with no cadence gap or calendar mutation', () => {
  const c = calendar(), before = JSON.stringify(c);
  const result = proposeSeries(c, request);
  assert.deepEqual(result.propose.map(x=>x.date), ['2026-10-30','2026-10-31']);
  assert.deepEqual(result.propose.map(x=>x.series.part), [1,2]);
  assert.equal(JSON.stringify(c), before);
  assert.equal(result.proposalsAreScripts, false);
  assert.equal(result.publicationAuthorized, false);
  assert.equal(result.requiresCompleteDraftSet, true);
  assert.deepEqual(validateSeriesCalendar(complete()), []);
});

test('consecutive dates cross months, years and leap days correctly', () => {
  for (const [startDate, expected] of [
    ['2026-10-30',['2026-10-30','2026-10-31','2026-11-01']],
    ['2026-12-30',['2026-12-30','2026-12-31','2027-01-01']],
    ['2028-02-28',['2028-02-28','2028-02-29','2028-03-01']],
  ]) {
    assert.deepEqual(proposeSeries(calendar(),{...request,startDate,totalParts:3}).propose.map(x=>x.date),expected);
  }
});

test('occupied dates are reported without shifting existing episodes or skipping a day', () => {
  const c = calendar();
  c.items.push({id:'other',date:'2026-10-31'});
  const before = JSON.stringify(c);
  assert.throws(()=>proposeSeries(c,request), /occupied/);
  assert.equal(JSON.stringify(c),before);
});

test('gaps and incomplete future series block reserve planning', () => {
  const c = complete();
  c.items[1].date = '2026-11-02';
  assert.match(validateSeriesCalendar(c).join(' '), /expected next consecutive date 2026-10-31/);
  assert.throws(()=>auditPlanningBuffer(c,{today:request.today}), /consecutive date/);
  c.items.pop();
  assert.match(validateSeriesCalendar(c).join(' '), /complete/);
});

test('duplicate parts, conflicting totals and collisions are refused', () => {
  let c = complete();
  c.items[1].series.part = 1;
  assert.match(validateSeriesCalendar(c).join(' '), /uniquely numbered/);
  c = complete();c.items[1].series.totalParts = 3;
  assert.match(validateSeriesCalendar(c).join(' '), /complete/);
  c = complete();c.items.push({id:'unrelated',date:'2026-10-31'});
  assert.match(validateSeriesCalendar(c).join(' '), /conflicts/);
  assert.throws(()=>proposeSeries(complete(),{...request,startDate:'2026-11-06'}), /already exists/);
});

test('serial metadata needs supported policy, real dates and regular first weekday', () => {
  const c = complete();delete c.seriesPolicy;
  assert.match(validateSeriesCalendar(c).join(' '), /seriesPolicy/);
  assert.throws(()=>proposeSeries(calendar(),{...request,startDate:'2026-10-31'}), /regular planning weekday/);
  assert.throws(()=>proposeSeries(calendar(),{...request,startDate:'2026-02-30'}), /Invalid calendar date/);
  assert.throws(()=>proposeSeries(calendar(),{...request,today:'2026-10-30'}), /future/);
  assert.throws(()=>proposeSeries(calendar(),{...request,totalParts:1}), /parts/);
  assert.throws(()=>proposeSeries(calendar(),{...request,seriesId:'Bad ID'}), /series ID/);
  assert.deepEqual(validateSeriesCalendar({items:[]}), []);
});

test('one missing source makes the remaining serial draft set unready', () => {
  const c = complete();
  const audit = auditPlanningBuffer(c,{today:request.today,episodeIsReady:item=>item.id!=='lesson-1'});
  assert.equal(audit.readyFutureEpisodes,0);
  assert.equal(audit.missing.length,2);
  assert.ok(audit.missing.every(item=>item.reason.includes('series draft set incomplete')));
  assert.equal(auditPlanningBuffer(c,{today:'2026-10-30'}).readyFutureEpisodes,1);
});

test('series CLI is read-only and requires an explicit complete request', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'hsk-series-'));
  const previousLog = console.log;
  const output = [];
  console.log = value=>output.push(value);
  try {
    fs.mkdirSync(path.join(dir,'content'));
    const file=path.join(dir,'content/calendar.json'), original=JSON.stringify(calendar());
    fs.writeFileSync(file,original);
    assert.equal(runCli(['--date',request.today,'--series-id',request.seriesId,
      '--start-date',request.startDate,'--parts','2','--json'],dir),0);
    assert.equal(JSON.parse(output[0]).propose[1].date,'2026-10-31');
    assert.equal(fs.readFileSync(file,'utf8'),original);
    assert.deepEqual(fs.readdirSync(path.join(dir,'content')),['calendar.json']);
    assert.throws(()=>runCli(['--date',request.today,'--series-id',request.seriesId],dir), /parts/);
  } finally {console.log=previousLog;fs.rmSync(dir,{recursive:true,force:true});}
});

const arcPolicy={effectiveFromDate:'2026-11-30',families:[{id:'mystery-clue'}]};
const arcCommon={familyId:'mystery-clue',premise:'A missing ticket',stakes:'Miss the show',unresolvedQuestion:'Who has the ticket?',payoffPlan:'The friend kept it safe'};
const firstArc={storytelling:{serialArc:{...arcCommon,opening:{sceneId:'a',cueText:'The ticket is gone'},progress:{sceneId:'a',cueText:'I asked for help'},cliffhanger:{sceneId:'b',cueText:'Who took the ticket?'}}},scenes:[{id:'a',narration:'The ticket is gone. I asked for help'},{id:'b',narration:'Who took the ticket?'}]};
const secondArc={storytelling:{serialArc:{...arcCommon,opening:{sceneId:'a',cueText:'Who took the ticket?'},progress:{sceneId:'a',cueText:'I asked my friend'},resolution:{sceneId:'b',cueText:'My friend kept it safe'}}},scenes:[{id:'a',narration:'Who took the ticket? I asked my friend'},{id:'b',narration:'My friend kept it safe'}]};
const part=(n)=>({id:'part-'+n,date:'2026-12-0'+(4+n),series:{id:'test-story',part:n,totalParts:2}});
test('new serial pair binds the actual narrative opening, final cliffhanger and resolution',()=>{
 assert.deepEqual(validateSerialArc(part(1),firstArc,arcPolicy,secondArc),[]);
 assert.deepEqual(validateSerialArc(part(2),secondArc,arcPolicy,firstArc),[]);
 const falseTeaser=structuredClone(firstArc);falseTeaser.storytelling.serialArc.cliffhanger.cueText='Tomorrow a new grammar rule';
 assert.match(validateSerialArc(part(1),falseTeaser,arcPolicy,secondArc).join(),/final non-CTA/);
 const wrongPayoff=structuredClone(secondArc);wrongPayoff.storytelling.serialArc.payoffPlan='A stranger kept it';
 assert.match(validateSerialArc(part(2),wrongPayoff,arcPolicy,firstArc).join(),/same planned narrative/);
 assert.deepEqual(validateSerialArc({...part(1),date:'2026-11-28'},{},arcPolicy,{}),[]);
});
test('series readbacks use matching-age verified posts, never turn missing follows into zero',()=>{
 const h='a'.repeat(64);
 const p=(n)=>({content:{id:'part-'+n,type:'series-part',language:'ru',sourceHash:h,series:{id:'test-story',part:n,totalParts:2}},platform:'instagram',accountId:'ig',accountUsername:'test',platformPostId:'native-'+n,zernioPostId:'zernio-'+n,status:'published',publishedAt:'2026-12-0'+(4+n)+'T00:00:00Z',verifiedAt:'2026-12-07T00:00:00Z',approvedAt:'2026-12-04T00:00:00Z',videoSha256:h,approvedVideoSha256:h,source:{provider:'Zernio',endpoint:'receipt'},creative:{serialFamilyId:'mystery-clue'}});
 const a=p(1),b=p(2);
 const obs=(p,views,follows)=>{const at=new Date(Date.parse(p.publishedAt)+80*3600000).toISOString();return {content:p.content,platform:p.platform,accountId:p.accountId,accountUsername:p.accountUsername,platformPostId:p.platformPostId,zernioPostId:p.zernioPostId,publishedAt:p.publishedAt,observedAt:at,window:'lifetime',source:{provider:'Zernio',endpoint:'analytics_get_analytics',syncedAt:at},metrics:{views,follows,reach:null,likes:null,comments:null,saves:null,shares:null,avgWatchMs:null,skipRatePercent:null,durationSeconds:30}}};
 const run=observations=>serialReadbacks({publications:[a,b],observations,asOf:new Date('2026-12-12T00:00:00Z')})[0];
 const x=run([obs(a,5000,25),obs(b,3500,null)]);
 assert.equal(x.partContinuationRatio,.7);assert.equal(x.firstPartFollowsPer1000Views,5);assert.equal(x.parts[2].near.follows,null);
 assert.equal(run([obs(a,5000,25),{...obs(b,3500,null),accountId:'other'}]).partContinuationRatio,null);
 assert.equal(run([obs(a,5000,null)]).firstPartFollowsPer1000Views,null);
});
