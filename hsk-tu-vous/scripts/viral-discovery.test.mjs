import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateDiscovery} from './viral-discovery.mjs';
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
