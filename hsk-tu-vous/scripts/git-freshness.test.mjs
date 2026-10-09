import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyFetchedMain} from './git-freshness.mjs';
const main='1'.repeat(40),local='2'.repeat(40),feature='3'.repeat(40);
function simulate({branch='feature-hsk',staleMain=false,staleFeature=false,networkDown=false}={}){
  const calls=[];let lastFetch='main';
  const run=(_cmd,args)=>{
    calls.push(args.join(' '));
    if(args[0]==='rev-parse' && args.at(-1)==='HEAD')return {status:0,stdout:local+'\n'};
    if(args[0]==='symbolic-ref')return {status:0,stdout:branch+'\n'};
    if(args[0]==='fetch') {
      if(networkDown)return {status:128,stderr:'offline'};
      lastFetch=args.at(-1).endsWith('/main')?'main':'feature';
      return {status:0,stdout:''};
    }
    if(args[0]==='rev-parse' && args.at(-1)==='FETCH_HEAD')return {status:0,stdout:(lastFetch==='main'?main:feature)+'\n'};
    if(args[0]==='merge-base') {
      const target=args[2];
      return {status:(target===main&&staleMain)||(target===feature&&staleFeature)?1:0,stdout:''};
    }
    return {status:1,stderr:'unexpected'};
  };
  return {calls,run};
}
test('fetches remote main and active branch, then verifies both ancestors',()=>{
  const s=simulate(),out=verifyFetchedMain({run:s.run,cwd:'/tmp'});
  assert.equal(out.remoteMainSha,main);assert.equal(out.remoteBranchSha,feature);
  assert.equal(out.currentBranch,'feature-hsk');
  assert.equal(s.calls.filter(x=>x.startsWith('fetch')).length,2);
  assert.equal(s.calls.filter(x=>x.startsWith('merge-base')).length,2);
});
test('blocks if remote main is newer than checkout',()=>{
  assert.throws(()=>verifyFetchedMain({run:simulate({staleMain:true}).run,cwd:'/tmp'}),/stale against remote main/);
});
test('blocks if source branch changed on GitHub although main did not',()=>{
  assert.throws(()=>verifyFetchedMain({run:simulate({staleFeature:true}).run,cwd:'/tmp'}),/stale against remote feature-hsk/);
});
test('refuses to reuse cached checkout when offline',()=>{
  const s=simulate({networkDown:true});
  assert.throws(()=>verifyFetchedMain({run:s.run,cwd:'/tmp'}),/freshness check blocked/);
});
test('on main only one GitHub fetch is necessary',()=>{
  const s=simulate({branch:'main'}),out=verifyFetchedMain({run:s.run,cwd:'/tmp'});
  assert.equal(out.remoteBranchSha,main);
  assert.equal(s.calls.filter(x=>x.startsWith('fetch')).length,1);
});
test('does not run on detached HEAD',()=>{
  const s=simulate({branch:''});
  assert.throws(()=>verifyFetchedMain({run:s.run,cwd:'/tmp'}),/Invalid or detached/);
  assert.equal(s.calls.filter(x=>x.startsWith('fetch')).length,0);
});
