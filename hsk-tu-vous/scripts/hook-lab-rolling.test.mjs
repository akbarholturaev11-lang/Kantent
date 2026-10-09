import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarizeHookLab} from './hook-lab.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const original=JSON.parse(fs.readFileSync(path.join(root,'content/hook-lab.json'),'utf8'));
const asOf='2026-10-10T12:00:00.000Z';
function readback({id,format='question',window='7d',date='2026-10-01T12:00:00.000Z',metric=30}={}){
  return {episodeId:id,hookFormatId:format,platform:'instagram',
    window,publishedAt:date,capturedAt:'2026-10-09T12:00:00.000Z',
    primaryMetric:'average-watch-ratio',primaryMetricValue:metric,level:'HSK 1',
    durationBand:'30-35s',topic:'basic Mandarin',views:700,
    savesPer1000Views:20,sharesPer1000Views:12};
}
function base(){
 return {...original,readbacks:[],formats:original.formats,ownerCorrections:original.ownerCorrections};
}
test('old approved 7d readbacks stay historical but do not influence the current 30-day comparison',()=>{
 const lab=base();
 lab.readbacks=[
   ...[0,1,2].map(i=>readback({id:'b'+i})),
   ...[0,1,2].map(i=>readback({id:'c'+i,format:'scenario',metric:45})),
   readback({id:'old',format:'scenario',metric:100,date:'2026-08-01T12:00:00.000Z'}),
 ];
 const result=summarizeHookLab(lab,[],{asOf});
 assert.equal(result.historicalReadbacksExcluded,1);
 assert.equal(result.analysisWindow.publishedLookbackDays,30);
 const group=result.comparisons.find(c=>c.candidateFormatId==='scenario');
 assert.ok(group);
 assert.equal(group.baselinePosts,3);assert.equal(group.candidatePosts,3);
 assert.equal(group.relativeLiftPercent,50);
 assert.equal(group.decision,'eligible-for-owner-promotion');
});
test('24h alone cannot promote Hook, regardless of views or number of posts',()=>{
 const lab=base();
 lab.readbacks=[
   ...[0,1,2].map(i=>readback({id:'b'+i,window:'24h',metric:20})),
   ...[0,1,2].map(i=>readback({id:'c'+i,window:'24h',format:'scenario',metric:50})),
 ];
 const result=summarizeHookLab(lab,[],{asOf});
 assert.equal(result.earlyReadbacks,6);
 assert.deepEqual(result.comparisons,[]);
 assert.match(result.nextAction,/No eligible recent 7d evidence/);
});
test('old data cannot fill a missing sample threshold in the last 30 days',()=>{
 const lab=base();
 lab.readbacks=[
   ...[0,1].map(i=>readback({id:'b'+i})),
   ...[0,1,2].map(i=>readback({id:'c'+i,format:'scenario',metric:45})),
   readback({id:'old-baseline',date:'2026-08-01T12:00:00.000Z'}),
 ];
 const result=summarizeHookLab(lab,[],{asOf});
 assert.equal(result.historicalReadbacksExcluded,1);
 const row=result.comparisons.find(c=>c.candidateFormatId==='scenario');
 assert.equal(row.baselinePosts,2);
 assert.equal(row.decision,'keep-testing');
});
