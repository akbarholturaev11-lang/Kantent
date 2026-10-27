import test from 'node:test';
import assert from 'node:assert/strict';
import {contentIdentity,validatePublicationMapping,applyPublicationMappings} from './content-attribution.mjs';
import {analyzeObservations,validateObservation} from './feedback-analyzer.mjs';
const identity=(type='lesson',language='ru',part=1)=>contentIdentity({id:'test-video',contentType:type,...(type==='series-part'?{series:{id:'weekend',part,totalParts:2}}:{})},{language,source:{title:'test'}});
const observation=(content,id='native01')=>({platform:'instagram',platformPostId:id,accountUsername:'hskai.app',publishedAt:'2026-10-01T00:00:00Z',observedAt:'2026-10-09T00:00:00Z',window:'7d',episodeId:content.type==='advertisement'?null:content.id,content,hookFormat:content.type==='advertisement'?null:'scenario',hskLevel:content.type==='advertisement'?null:'HSK 1',creativeFormatId:'life-situation',source:{provider:'Zernio',endpoint:'native-fixed-insights',syncedAt:'2026-10-09T00:00:00Z',windowEvidence:{kind:'provider-exact-post-age',window:'7d',startAt:'2026-10-01T00:00:00Z',endAt:'2026-10-08T00:00:00Z',providerRecordId:'receipt01'}},metrics:{views:900,reach:800,likes:20,comments:4,saves:12,shares:8,avgWatchMs:24000,skipRatePercent:25,durationSeconds:50}});
test('content identity binds every type/language/source revision without fabricating a post',()=>{
 const a=identity('advertisement','tg');assert.equal(a.type,'advertisement');assert.equal(a.language,'tg');assert.equal(a.sourceHash.length,64);
 assert.throws(()=>identity('series-part','ru',3),/series/);
 const b=contentIdentity({id:a.id,contentType:a.type},{language:a.language,source:{title:'revision'}});assert.notEqual(b.sourceHash,a.sourceHash);
});
test('RU/TG, standalone/serial/ad, series part and account remain separate cohorts',()=>{
 const entries=[identity(),identity('lesson','tg'),identity('advertisement'),identity('series-part','ru',1),identity('series-part','ru',2)].map((c,i)=>observation(c,'native0'+i));
 const other=observation(identity(),'native06');other.accountUsername='other';entries.push(other);
 for(const o of entries)assert.deepEqual(validateObservation(o),[]);
 const report=analyzeObservations(entries,{minimumPostsPerFormat:2},{asOf:'2026-10-10T00:00:00Z'});
 assert.equal(report.comparableGroups.length,6);assert.ok(report.comparableGroups.every(g=>g.readiness==='insufficient-sample'));
});
test('new observations cannot conflict with recorded identity',()=>{
 const o=observation(identity());o.episodeId='wrong';assert.match(validateObservation(o).join(' '),/conflicts/);
});
test('mapping requires a verified Zernio result and exact approved video hash',()=>{
 const content=identity('advertisement');const m={content,platform:'instagram',accountId:'account-1',accountUsername:'hskai.app',platformPostId:'native01',status:'scheduled',videoSha256:'a'.repeat(64),approvedVideoSha256:'a'.repeat(64),approvedAt:'2026-10-01T00:00:00Z',verifiedAt:'2026-10-01T01:00:00Z',source:{provider:'Zernio',endpoint:'posts_get'}};
 assert.deepEqual(validatePublicationMapping(m),[]);
 const original=observation(content);delete original.content;
 assert.deepEqual(applyPublicationMappings([original],[m])[0].content,content);assert.equal(original.content,undefined);
 const wrong=structuredClone(m);wrong.approvedVideoSha256='b'.repeat(64);assert.ok(validatePublicationMapping(wrong).length);
 assert.throws(()=>applyPublicationMappings([original],[m,m]),/Duplicate/);
 const unknown={...original,accountUsername:'different'};assert.equal(applyPublicationMappings([unknown],[m])[0].content,undefined);
});
