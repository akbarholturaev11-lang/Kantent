import assert from 'node:assert/strict';
import test from 'node:test';
import {validateObservation,validateDataset,deriveMetrics,analyzeObservations,durationBand} from './feedback-analyzer.mjs';
const source=()=>({
 platform:'instagram',platformPostId:'17961571305238269',accountUsername:'hskai.app',
 publishedAt:'2026-10-07T10:31:38.000Z',observedAt:'2026-10-09T20:11:11.872Z',window:'lifetime',
 postUrl:'https://www.instagram.com/reel/DeMJlaMAOQc/',
 episodeId:null,hookFormat:null,hskLevel:null,effectStyle:null,
 source:{provider:'Zernio',endpoint:'analytics_get_analytics',syncedAt:'2026-10-09T20:11:11.872Z'},
 metrics:{views:721,reach:674,likes:24,comments:3,saves:12,shares:9,avgWatchMs:5266,skipRatePercent:70.6,durationSeconds:34}
});
test('requires provenance and all metric fields',()=>{
 const o=source();delete o.source;delete o.metrics.saves;assert.match(validateObservation(o).join(' '),/provenance/);assert.match(validateObservation(o).join(' '),/saves/);
});
test('null for absent metrics is not zero',()=>{
 const o=source();o.metrics.saves=null;o.metrics.avgWatchMs=null;
 assert.deepEqual(validateObservation(o),[]);assert.equal(deriveMetrics(o).savesPer1000Views,null);assert.equal(deriveMetrics(o).averageWatchRatio,null);
});
test('rejects inflated percentages and negative values',()=>{
 const o=source();o.metrics.skipRatePercent=101;o.metrics.views=-3;
 assert.match(validateObservation(o).join(' '),/out of bounds/);assert.match(validateObservation(o).join(' '),/views/);
});
test('rejects duplicate snapshot',()=>{
 assert.throws(()=>validateDataset({schemaVersion:1,observations:[source(),source()]}),/Duplicate/);
});
test('new snapshot updates a post, does not count it twice',()=>{
 const o=source(),n=structuredClone(o);n.observedAt='2026-10-10T20:11:11.872Z';n.metrics.views=800;
 const r=analyzeObservations([o,n], {}, {asOf:'2026-10-11T00:00:00.000Z'});assert.equal(r.observationCount,2);assert.equal(r.distinctPostWindows,1);assert.equal(r.posts[0].views,800);
});
test('lifetime results cannot produce comparability verdicts',()=>{
 const o=source();o.hookFormat='question';o.hskLevel='HSK 1';
 const r=analyzeObservations([o]);assert.equal(r.comparableGroups.length,0);assert.equal(r.decision,'no-automatic-winner');
});
test('fixed-window cohorts keep HSK level separate',()=>{
 const a=source();a.window='24h';a.hookFormat='question';a.hskLevel='HSK 1';a.episodeId='sample-hsk1';
 const b=structuredClone(a);b.platformPostId='17961571305238268';b.hskLevel='HSK 2';b.episodeId='sample-hsk2';
 const r=analyzeObservations([a,b]);assert.equal(r.comparableGroups.length,2);assert.ok(r.comparableGroups.every(x=>x.readiness==='insufficient-sample'));
});
test('provider watch time is milliseconds',()=>{
 const m=deriveMetrics(source());assert.equal(m.averageWatchSeconds,5.266);assert.equal(m.averageWatchRatio,0.1549);assert.equal(m.savesPer1000Views,16.64);assert.equal(durationBand(22),'under-25s');
});

const asOf = '2026-10-10T20:11:11.872Z';
function fixed({id='17961571305238269',date='2026-10-01T10:31:38.000Z',window='7d',format='question',level='HSK 1'}={}){
 const o=source();o.platformPostId=id;o.publishedAt=date;o.window=window;
 o.episodeId='episode-'+id;o.hookFormat=format;o.hskLevel=level;
 return o;
}
test('rolling 30 days filters by publication date, not Zernio collection date',()=>{
 const included=fixed({id:'17961571305238269',date:'2026-09-12T10:31:38.000Z'});
 const old=fixed({id:'17961571305238268',date:'2026-09-09T10:31:38.000Z'});
 const r=analyzeObservations([included,old],{analysisLookbackDays:30},{asOf});
 assert.equal(r.posts.length,1);assert.equal(r.posts[0].postId,included.platformPostId);
 assert.equal(r.historicalPostWindowsExcluded,1);assert.equal(r.analysisWindow.publishedLookbackDays,30);
});
test('exact cutoff is inclusive, future snapshots do not leak into asOf',()=>{
 const cutoff=fixed({id:'17961571305238269',date:'2026-09-10T20:11:11.872Z'});
 const future=structuredClone(cutoff);future.observedAt='2026-10-12T20:11:11.872Z';
 const r=analyzeObservations([cutoff,future],{analysisLookbackDays:30},{asOf});
 assert.equal(r.posts.length,1);assert.equal(r.futureSnapshotsExcluded,1);
});
test('24h cohorts can only be early signals, even with three eligible posts',()=>{
 const arr=['17961571305238269','17961571305238268','17961571305238267']
   .map(id=>fixed({id,window:'24h'}));
 const r=analyzeObservations(arr,{analysisLookbackDays:30,minimumPostsPerFormat:3,minimumViewsPerPost:500},{asOf});
 assert.equal(r.comparableGroups[0].readiness,'early-signal-only');
 assert.equal(r.performanceChangeEvidence,'insufficient-evidence');
});
test('three matched 7d posts allow only owner-review evidence, never auto-winner',()=>{
 const arr=['17961571305238269','17961571305238268','17961571305238267']
   .map(id=>fixed({id}));
 const r=analyzeObservations(arr,{analysisLookbackDays:30,minimumPostsPerFormat:3,minimumViewsPerPost:500},{asOf});
 assert.equal(r.comparableGroups[0].phase,'primary');
 assert.equal(r.comparableGroups[0].readiness,'descriptive-only-owner-review');
 assert.equal(r.performanceChangeEvidence,'owner-review-required');
 assert.equal(r.decision,'no-automatic-winner');
});
test('fixed 7d window cannot be labelled for a two-day-old post',()=>{
 const r=fixed({date:'2026-10-07T10:31:38.000Z'});
 assert.match(validateObservation(r).join(' '),/claimed before required post age/);
});
test('lifetime engagement never becomes 7d evidence in the last 30 days',()=>{
 const r=analyzeObservations([source()],{analysisLookbackDays:30},{asOf});
 assert.equal(r.recentPostWindows,1);
 assert.equal(r.performanceChangeEvidence,'insufficient-evidence');
});
test('missing episode mapping prevents format comparison',()=>{
 const r=fixed();r.episodeId=null;
 const out=analyzeObservations([r],{analysisLookbackDays:30},{asOf});
 assert.equal(out.comparableGroups.length,0);
});

test('YouTube lifetime posts accept absent reach/skip fields without inventing data', () => {
 const o=source();
 o.platform='youtube';
 o.platformPostId='d_tEjT35RDE';
 o.postUrl='https://www.youtube.com/watch?v=d_tEjT35RDE';
 delete o.metrics.reach;
 delete o.metrics.skipRatePercent;
 o.metrics.saves=null;
 o.metrics.shares=null;
 o.metrics.avgWatchMs=null;
 assert.deepEqual(validateObservation(o),[]);
 const metrics=deriveMetrics(o);
 assert.equal(metrics.skipRatePercent,null);
 assert.equal(metrics.averageWatchRatio,null);
 assert.equal(metrics.savesPer1000Views,null);
 assert.equal(analyzeObservations([o],{}, {asOf:'2026-10-11T00:00:00.000Z'}).comparableGroups.length,0);
 const invalid=structuredClone(o);
 invalid.postUrl='https://example.org/watch?id=fake';
 assert.match(validateObservation(invalid).join(' '),/invalid postUrl/);
 delete invalid.metrics.likes;
 assert.match(validateObservation(invalid).join(' '),/invalid metric likes/);
});
