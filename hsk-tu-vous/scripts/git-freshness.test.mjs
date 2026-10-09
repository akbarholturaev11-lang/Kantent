import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyFetchedMain} from './git-freshness.mjs';
const main='1'.repeat(40), ahead='2'.repeat(40);
function simulate({stale=false, networkDown=false}={}){
  const calls=[];
  const run=(_cmd,args)=>{
    calls.push(args.join(' '));
    if(args[0]==='fetch') return networkDown?{status:128,stderr:'offline'}:{status:0,stdout:''};
    if(args[0]==='rev-parse') return {status:0,stdout:(args.at(-1)==='HEAD' ? ahead : main)+'\n'};
    if(args[0]==='merge-base')return {status:stale?1:0,stdout:''};
    return {status:1,stderr:'bad command'};
  };
  return {calls,run};
}
test('fetches origin main before production and records sha',()=>{
  const s=simulate();const out=verifyFetchedMain({run:s.run,cwd:'/tmp'});
  assert.equal(out.remoteMainSha,main);assert.equal(out.localHeadSha,ahead);
  assert.ok(s.calls[0].includes('fetch'));assert.equal(s.calls.length,4);
});
test('stale checkout must fail closed',()=>{
  const s=simulate({stale:true});
  assert.throws(()=>verifyFetchedMain({run:s.run,cwd:'/tmp'}),/stale/);
});
test('unreachable origin must fail closed, not silently run old code',()=>{
  const s=simulate({networkDown:true});
  assert.throws(()=>verifyFetchedMain({run:s.run,cwd:'/tmp'}),/freshness check blocked/);
  assert.equal(s.calls.length,1);
});
