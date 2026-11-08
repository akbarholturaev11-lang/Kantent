import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyFetchedMain,describeSourceTree} from './git-freshness.mjs';
const main='1'.repeat(40),local='2'.repeat(40),feature='3'.repeat(40);
function simulate({branch='feature-hsk',staleMain=false,staleFeature=false,networkDown=false,porcelain=''}={}){
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
    if(args[0]==='status')return {status:0,stdout:porcelain};
    if(args[0]==='rev-parse' && args[1]==='--show-toplevel')return {status:0,stdout:'/repo\n'};
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

test('X-14: a clean project tree is recorded as clean without hashing anything',()=>{
  const s=simulate(),out=verifyFetchedMain({run:s.run,cwd:'/tmp',readFile:()=>{throw Error('must not read');}});
  assert.equal(out.sourceTreeClean,true);
  assert.equal(out.dirtyPaths,undefined);
  assert.ok(s.calls.includes('status --porcelain=v1 -z --untracked-files=normal -- .'),'scoped to this project, ignored files excluded');
});
test('X-14: uncommitted tracked/untracked files are disclosed with a content hash, not blocked',()=>{
  const files={'/repo/hsk-tu-vous/content/cta-lab.json':'ledger v2','/repo/hsk-tu-vous/scripts/new.mjs':'x','/repo/hsk-tu-vous/scripts/b.mjs':'renamed'};
  const readFile=(p)=>{ if(p in files) return Buffer.from(files[p]); throw Object.assign(Error('gone'),{code:'ENOENT'}); };
  // modified, deleted, untracked and a rename (whose source path follows it)
  const porcelain=' M hsk-tu-vous/content/cta-lab.json\0 D hsk-tu-vous/old.png\0?? hsk-tu-vous/scripts/new.mjs\0R  hsk-tu-vous/scripts/b.mjs\0hsk-tu-vous/scripts/a.mjs\0';
  const warn=console.warn; const warnings=[]; console.warn=(m)=>warnings.push(m);
  let out;
  try { out=verifyFetchedMain({run:simulate({porcelain}).run,cwd:'/tmp',readFile}); } finally { console.warn=warn; }
  assert.equal(out.sourceTreeClean,false);
  assert.deepEqual(out.dirtyPaths,['hsk-tu-vous/content/cta-lab.json','hsk-tu-vous/old.png','hsk-tu-vous/scripts/b.mjs','hsk-tu-vous/scripts/new.mjs']);
  assert.equal(out.dirtyPathCount,4);
  assert.match(out.dirtySourceSha256,/^[0-9a-f]{64}$/);
  assert.match(warnings[0],/SOURCE_TREE_DIRTY/);
  files['/repo/hsk-tu-vous/content/cta-lab.json']='ledger v3';
  const changed=describeSourceTree({run:simulate({porcelain}).run,cwd:'/tmp',readFile});
  assert.notEqual(changed.dirtySourceSha256,out.dirtySourceSha256,'the hash follows file contents');
});
test('X-14: a huge dirty tree keeps an exact count but a bounded path list',()=>{
  const porcelain=Array.from({length:150},(_,i)=>' M hsk-tu-vous/f'+String(i).padStart(3,'0')+'.json').join('\0')+'\0';
  const out=describeSourceTree({run:simulate({porcelain}).run,cwd:'/tmp',readFile:()=>Buffer.from('x')});
  assert.equal(out.dirtyPathCount,150);
  assert.equal(out.dirtyPaths.length,100);
});
