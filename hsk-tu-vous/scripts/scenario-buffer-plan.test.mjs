import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeBuffer} from './scenario-buffer-plan.mjs';
function calendar(dates){
 return {timezone:'Asia/Shanghai',cadencePerWeek:3,planningWeekdays:['MO','WE','FR'],
 planningBuffer:{minimumFutureEpisodes:3,targetFutureEpisodes:4},
 items:dates.map((date,i)=>({date,id:'e'+i,status:'planned',episodeFile:'episodes/e'+i+'.json'}))};
}
test('a two-scenario reserve generates next two Mon/Wed/Fri dates',()=>{
 const p=proposeBuffer(calendar(['2026-10-12','2026-10-14']),{today:'2026-10-10'});
 assert.deepEqual(p.propose.map(x=>x.date),['2026-10-16','2026-10-19']);
 assert.equal(p.buffer.shortfallToTarget,2);
});
test('readiness at four requires no new dates',()=>{
 const p=proposeBuffer(calendar(['2026-10-12','2026-10-14','2026-10-16','2026-10-19']),{today:'2026-10-10'});
 assert.equal(p.propose.length,0);
});
test('repair missing lesson before creating extra dates',()=>{
 const c=calendar(['2026-10-12','2026-10-14','2026-10-16']);
 const p=proposeBuffer(c,{today:'2026-10-10',episodeIsReady:x=>x.date!=='2026-10-14'});
 assert.equal(p.repair.length,1);
 assert.deepEqual(p.propose.map(x=>x.date),['2026-10-19']);
});
test('never retroactively fills past dates',()=>{
 const p=proposeBuffer(calendar(['2026-10-09']),{today:'2026-10-10'});
 assert.deepEqual(p.propose.map(x=>x.date),['2026-10-12','2026-10-14','2026-10-16','2026-10-19']);
});
test('rejects unsupported implicit publication weekdays',()=>{
 const c=calendar([]);delete c.planningWeekdays;
 assert.throws(()=>proposeBuffer(c,{today:'2026-10-10'}),/planningWeekdays/);
});
test('proposal never creates placeholder episodes in memory',()=>{
 const c=calendar(['2026-10-12']);const count=c.items.length;
 const result=proposeBuffer(c,{today:'2026-10-10'});
 assert.equal(c.items.length,count);
 assert.equal(result.proposalsAreScripts,false);
});
