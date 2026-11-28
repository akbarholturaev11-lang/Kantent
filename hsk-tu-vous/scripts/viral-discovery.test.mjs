import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateDiscovery,planDiscoveryWeek,discoveryWeekCutoff,makeDiscoveryFreezeRecord,freezeDiscoveryCalendar,discoveryDraftErrors} from './viral-discovery.mjs';
const h='a'.repeat(64), date='2026-11-01T00:00:00Z', end='2026-11-05T00:00:00Z';
const destinations={videoDestinations:{ru:{platforms:{instagram:{zernioPublishingAuthorized:true,verifiedAccountId:'ig'},youtube:{zernioPublishingAuthorized:true,verifiedAccountId:'yt'},facebook:{zernioPublishingAuthorized:false,verifiedAccountId:'fb'}}}}};
function receipt(id,platform){
 const accountId=platform==='instagram'?'ig':'yt';
 return {content:{id,type:'lesson',language:'ru',sourceHash:h},platform,accountId,accountUsername:accountId,
 zernioPostId:id+'-'+accountId,platformPostId:'native-'+id+'-'+accountId,videoSha256:h,approvedVideoSha256:h,
 status:'published',publishedAt:date,approvedAt:date,verifiedAt:date,source:{provider:'Zernio',endpoint:'receipt'},
 creative:{discoveryFormatId:'mistake-fix'}};
}
function observation(p,views,at=end){
 return {platform:p.platform,accountId:p.accountId,accountUsername:p.accountUsername,platformPostId:p.platformPostId,
 zernioPostId:p.zernioPostId,content:p.content,videoSha256:h,publishedAt:p.publishedAt,observedAt:at,window:'lifetime',
 source:{provider:'Zernio',endpoint:'analytics_get_analytics',syncedAt:at,providerMetricUpdatedAt:at,syncStatus:'synced'},
 metrics:{views,reach:null,likes:null,comments:null,saves:null,shares:null,avgWatchMs:null,skipRatePercent:null,durationSeconds:null}};
}
function run(publications,observations){return evaluateDiscovery({publications,observations,destinations,
 policy:{minimumViews:3000,minimumAgeHours:72},asOf:new Date('2026-11-10T00:00:00Z')});}
const one=[receipt('lesson-one','instagram'),receipt('lesson-one','youtube')];
const two=[receipt('lesson-two','instagram'),receipt('lesson-two','youtube')];
test('one shared episode is one trial; first complete miss gets retry',()=>{
 const g=run(one,one.map(p=>observation(p,100))).families[0];
 assert.equal(g.attempts.length,1);assert.equal(g.state,'retry');assert.equal(g.nextAction,'retry-new-topic');
});
test('single platform hit gets retry, second all-miss retains the hit platform',()=>{
 const g=run([...one,...two],[observation(one[0],3000),observation(one[1],20),...two.map(p=>observation(p,30))]).families[0];
 assert.equal(g.state,'platform-hit');assert.equal(g.platforms.instagram.hits,1);assert.equal(g.platforms.youtube.hits,0);
});
test('two distinct complete misses retire; late verified hit revives',()=>{
 const all=[...one,...two], obs=all.map(p=>observation(p,100));
 assert.equal(run(all,obs).families[0].state,'retired');
 const g=run(all,[...obs,observation(one[0],10000,'2026-11-08T00:00:00Z')]).families[0];
 assert.equal(g.state,'platform-hit');assert.equal(g.attempts[0].platforms.instagram.first.views,100);
});
test('missing or early data never counts as failure; pending repeat blocks third retry',()=>{
 const obs=[...one.map(p=>observation(p,100)),observation(two[0],100,'2026-11-02T00:00:00Z')];
 const g=run([...one,...two],obs).families[0];
 assert.equal(g.attempts[1].complete,false);assert.equal(g.nextAction,'await-existing-attempt');
});
test('two independent wins are repeat hit; crossposts do not inflate trial count',()=>{
 const all=[...one,...two],g=run(all,all.map(p=>observation(p,5000))).families[0];
 assert.equal(g.state,'repeat-hit');assert.equal(g.attempts.length,2);
});
test('wrong account or conflicting native ID cannot attach a hit',()=>{
 const o={...observation(one[0],8000),accountId:'other'};
 const x=run(one,[o,{...observation(one[0],9000),platformPostId:'wrong-native'}]);
 assert.equal(x.families[0].state,'pending');assert.equal(x.unattributedHits.length,2);
});
test('stale post update cannot mature because collected later',()=>{
 const o=observation(one[0],100);o.source.providerMetricUpdatedAt='2026-11-02T00:00:00Z';
 assert.equal(run(one,[o]).families[0].attempts[0].platforms.instagram.status,'pending');
});
test('legacy arm is diagnostic only; no assignment or publication permission',()=>{
 const rows=one.map(p=>({...p,creative:{experimentId:'lesson-opening-v1',arm:'A'}}));
 const x=run(rows,rows.map(p=>observation(p,4000)));
 assert.equal(x.families[0].actionable,false);assert.equal(x.assignmentAuthorized,false);
 assert.equal(x.publicationAuthorized,false);
});


test('one known hit can trigger a retry even when another platform has no data',()=>{
 const g=run(one,[observation(one[0],3000)]).families[0];
 assert.equal(g.state,'retry');assert.equal(g.nextAction,'retry-new-topic');
});
test('wins on different platforms are not repeat success on one platform',()=>{
 const all=[...one,...two];const g=run(all,[observation(one[0],4000),observation(one[1],10),observation(two[0],10),observation(two[1],4000)]).families[0];
 assert.equal(g.state,'cross-platform-hit');
});
test('a late-collected snapshot cannot enter the frozen cutoff',()=>{
 const o=observation(one[0],10000);o.collectedAt='2026-11-12T00:00:00Z';
 assert.equal(run(one,[o]).families[0].state,'pending');
});
const calendar={weeklySchedule:{effectiveFromDate:'2026-10-01',days:['MO','TU','WE','TH','FR','SA','SU'].map((weekday,i)=>({weekday,contentType:i>=5?'series-part':i%2?'advertisement':'lesson',...(i>=5?{part:i-4}:{})}))},items:[]};
const registry={discoveryFamilies:['mistake-fix','new-one','new-two','new-three'].map(id=>({id,hookFormat:'contrast',brief:'Verified lesson distinction'}))};
const today='2026-11-08',now=new Date('2026-11-08T06:00:00Z');
function weekly(discovery,extra={}){return planDiscoveryWeek({calendar,registry,discovery:{...discovery,asOf:'2026-11-08T00:00:00Z'},today,now,...extra});}
test('weekly plan preserves 7 typed slots, chooses retry and fills other slots with exploration',()=>{
 const discovery=run(one,one.map(p=>observation(p,100)));
 const p=weekly(discovery);
 assert.equal(p.slots.length,7);assert.equal(p.weekStart,'2026-11-09');
 assert.equal(p.slots.filter(s=>s.contentType==='lesson').length,3);
 assert.equal(p.slots.filter(s=>s.action==='retry').length,1);
 assert.equal(p.slots.filter(s=>s.action==='explore').length,2);
 assert.equal(p.slots.filter(s=>s.action==='unchanged').length,4);
 assert.equal(p.cutoff,'2026-11-08T00:00:00.000Z');
});
test('already booked, pending and retired families are not forced into new slots',()=>{
 const all=[...one,...two];const retired=run(all,all.map(p=>observation(p,100)));
 const p=weekly(retired,{calendar:{...calendar,items:[{date:'2026-11-09',id:'existing',contentType:'lesson',discoveryFormatId:'new-one'}]},publications:[{status:'scheduled',content:{type:'lesson'},creative:{discoveryFormatId:'new-two'}}]});
 assert.equal(p.slots[0].action,'preserve-existing');
 assert.equal(p.slots[0].contentId,'existing');
 assert.equal(p.slots.filter(s=>s.action==='author-new-family').length,1);
 assert.ok(p.slots.every(s=>s.discoveryFormatId!=='mistake-fix'&&s.discoveryFormatId!=='new-two'));
});
test('a Sunday plan cannot use future evidence and a Saturday preview cannot see Sunday data',()=>{
 assert.throws(()=>planDiscoveryWeek({calendar,registry,discovery:{families:[],asOf:'2026-11-08T01:00:00Z'},today,now}),/cutoff/);
 assert.equal(discoveryWeekCutoff('2026-11-07',new Date('2026-11-07T12:00:00Z')).cutoff.toISOString(),'2026-11-07T12:00:00.000Z');
});


test('historical reports before the typed calendar do not invent a weekly schedule',()=>{
 const p=weekly({families:[]},{calendar:{...calendar,weeklySchedule:{...calendar.weeklySchedule,effectiveFromDate:'2026-12-01'}}});
 assert.equal(p.status,'before-typed-calendar');assert.equal(p.slots.length,0);
});

test('freeze is idempotent, requires the cutoff and cannot silently reassign a date',()=>{
 const policy={enabled:true,mode:'active',activeFrom:'2026-11-09'};
 const p=weekly({families:[]});
 const record=makeDiscoveryFreezeRecord(p,{calendar,registry,policy,now});
 assert.equal(record.slots.length,7);
 const next=freezeDiscoveryCalendar(calendar,record,registry);
 assert.equal(freezeDiscoveryCalendar(next,record,registry),next);
 assert.throws(()=>freezeDiscoveryCalendar(next,{...record,slots:record.slots.map((s,i)=>i===0?{...s,discoveryFormatId:'new-two'}:s)},registry),/already frozen/);
 assert.equal(makeDiscoveryFreezeRecord(p,{calendar,registry,policy,now:new Date('2026-11-07T23:00:00Z')}),null);
 const slot=record.slots[0], item={id:'fresh-lesson',date:slot.date,contentType:'lesson'};
 const rules={calendar:next,registry,policy};
 assert.deepEqual(discoveryDraftErrors(rules,item,{hookExperiment:{discoveryFormatId:slot.discoveryFormatId,formatId:slot.hookFormat}}),[]);
 assert.match(discoveryDraftErrors(rules,item,{hookExperiment:{discoveryFormatId:'different',formatId:slot.hookFormat}}).join(),/frozen family/);
 assert.match(discoveryDraftErrors({...rules,calendar},item,{}).join(),/freeze/);
 assert.deepEqual(discoveryDraftErrors(rules,{...item,contentType:'advertisement'},{}),[]);
});
test('later cumulative breakout remains the peak, not only the first threshold crossing',()=>{
 const g=run(one,[observation(one[0],3100),observation(one[0],100000,'2026-11-08T00:00:00Z'),observation(one[1],3000)]).families[0];
 assert.equal(g.attempts[0].platforms.instagram.hit.views,3100);
 assert.equal(g.attempts[0].platforms.instagram.peak.views,100000);
});


test('one mature miss with an unavailable platform permits the second attempt but never declares two incomplete attempts failures',()=>{
 const first=run(one,[observation(one[0],100)]).families[0];
 assert.equal(first.nextAction,'retry-new-topic');assert.equal(first.attempts[0].complete,false);
 const second=run([...one,...two],[observation(one[0],100),observation(two[0],150)]).families[0];
 assert.equal(second.nextAction,'await-existing-attempt');assert.notEqual(second.state,'retired');
});
