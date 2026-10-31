import test from "node:test";
import assert from "node:assert/strict";
import {planSilenceClips} from "./silence-clip-plan.mjs";
test("measured pauses split a 47s take without invented word times",()=>{
  const pauses=[4.2,6.3,9.1,12.8,16.7,19.0,22.4,25.1,29.9,34.2,38.5,42.7]
    .map(s=>({startMs:s*1000-250,endMs:s*1000+250}));
  const clips=planSilenceClips(47280,pauses);
  assert.equal(clips[0].startMs,0);
  assert.equal(clips.at(-1).endMs,47280);
  assert.ok(clips.length<=8);
  assert.ok(clips.every(c=>c.endMs-c.startMs<=12000));
  for(let i=1;i<clips.length;i++)assert.equal(clips[i-1].endMs,clips[i].startMs);
  assert.ok(clips.slice(0,-1).every(c=>pauses.some(p=>c.endMs>p.startMs && c.endMs<p.endMs)));
});
test("fail closed if cut would be inside spoken audio",()=>{
  assert.throws(()=>planSilenceClips(25000,[]),/No measured silent/);
});
test("reject corrupt metadata and excessive clip counts",()=>{
  assert.throws(()=>planSilenceClips(-1,[]),/Measured source/);
  assert.throws(()=>planSilenceClips(50000,[{startMs:1,endMs:2}]),/No measured silent/);
  const p=Array.from({length:20},(_,i)=>({startMs:(i+1)*5000-200,endMs:(i+1)*5000+200}));
  assert.throws(()=>planSilenceClips(105000,p,{maxClips:4}),/clip budget/);
});
