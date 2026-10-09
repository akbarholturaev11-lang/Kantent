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
 const r=analyzeObservations([o,n]);assert.equal(r.observationCount,2);assert.equal(r.distinctPostWindows,1);assert.equal(r.posts[0].views,800);
});
test('lifetime results cannot produce comparability verdicts',()=>{
 const o=source();o.hookFormat='question';o.hskLevel='HSK 1';
 const r=analyzeObservations([o]);assert.equal(r.comparableGroups.length,0);assert.equal(r.decision,'no-automatic-winner');
});
test('fixed-window cohorts keep HSK level separate',()=>{
 const a=source();a.window='24h';a.hookFormat='question';a.hskLevel='HSK 1';
 const b=structuredClone(a);b.platformPostId='17961571305238268';b.hskLevel='HSK 2';
 const r=analyzeObservations([a,b]);assert.equal(r.comparableGroups.length,2);assert.ok(r.comparableGroups.every(x=>x.readiness==='insufficient-sample'));
});
test('provider watch time is milliseconds',()=>{
 const m=deriveMetrics(source());assert.equal(m.averageWatchSeconds,5.266);assert.equal(m.averageWatchRatio,0.1549);assert.equal(m.savesPer1000Views,16.64);assert.equal(durationBand(22),'under-25s');
});
