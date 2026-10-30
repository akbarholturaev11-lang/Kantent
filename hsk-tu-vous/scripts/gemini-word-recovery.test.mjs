import test from "node:test";
import assert from "node:assert/strict";
import {selectExactBlocks,buildRecoveryPlan,selectRecoveredBlocks,mergeRecoveredBlocks} from "./gemini-word-recovery.mjs";

const expected=(...pairs)=>pairs.map(([text,language])=>({text,language}));
const block=(text,tokens,startMs,endMs)=>({text,tokens,startMs,endMs});

test("recover suffix Mandarin only with real source audio boundaries",()=>{
  const words=expected(["представьте","locale"],["как","locale"],["这","zh"],["个","zh"],["贵","zh"]);
  const original=[block("Представьте",["представьте"],100,500),block("как",["как"],600,900)];
  const plan=buildRecoveryPlan(words,original,2800);
  assert.equal(plan.gaps.length,1);
  assert.deepEqual(plan.gaps[0],{from:2,to:5,startMs:900,endMs:2800,language:"zh",tokens:["这","个","贵"]});
  const clip=[block("这个贵",["这","个","贵"],1100,2300)];
  const recovered=selectRecoveredBlocks(plan.gaps[0].tokens,clip);
  const merged=mergeRecoveredBlocks(words,original,plan,[recovered]);
  assert.equal(merged.length,3);
  assert.deepEqual(merged.map(x=>x.text),["Представьте","как","这个贵"]);
});
test("recover Tajik prefix using measured next word start, not estimated position",()=>{
  const words=expected(["дар","locale"],["бозор","locale"],["这","zh"],["个","zh"]);
  const original=[block("这",["这"],1200,1400),block("个",["个"],1400,1600)];
  const plan=buildRecoveryPlan(words,original,1900);
  assert.deepEqual(plan.gaps[0],{from:0,to:2,startMs:0,endMs:1200,language:"locale",tokens:["дар","бозор"]});
  const recovered=selectRecoveredBlocks(plan.gaps[0].tokens,[block("Дар",["дар"],100,420),block("бозор",["бозор"],450,950)]);
  const merged=mergeRecoveredBlocks(words,original,plan,[recovered]);
  assert.deepEqual(merged.map(x=>x.text),["Дар","бозор","这","个"]);
});
test("recover internal Mandarin span with two real provider anchors",()=>{
  const words=expected(["это","locale"],["有","zh"],["点","zh"],["贵","zh"],["дальше","locale"]);
  const original=[block("это",["это"],100,390),block("дальше",["дальше"],1750,2150)];
  const p=buildRecoveryPlan(words,original,2450);
  assert.deepEqual([p.gaps[0].startMs,p.gaps[0].endMs],[390,1750]);
  const good=selectRecoveredBlocks(p.gaps[0].tokens,[block("有点贵",["有","点","贵"],400,1700)]);
  assert.equal(mergeRecoveredBlocks(words,original,p,[good]).length,3);
});
test("do not invent or interpolate a word when model omits one",()=>{
  assert.throws(()=>selectRecoveredBlocks(["有","点","儿","贵"],[
    block("有",["有"],100,230),block("点",["点"],230,400),block("贵",["贵"],430,600),
  ]),/did not exactly/);
});
test("do not accept a recovered clip out of time sequence",()=>{
  const words=expected(["a","locale"],["b","locale"]);
  const orig=[];
  const p=buildRecoveryPlan(words,orig,2000);
  assert.throws(()=>selectRecoveredBlocks(p.gaps[0].tokens,[
    block("a",["a"],900,1100),block("b",["b"],200,500),
  ]),/moves backwards/);
});
test("cannot transcribe across a language boundary without verified anchor",()=>{
  const words=expected(["дар","locale"],["有","zh"]);
  assert.throws(()=>buildRecoveryPlan(words,[],2000),/mixes languages/);
});
test("discard extra unverified words, never use them to fill missing tokens",()=>{
  const words=expected(["а","locale"],["这","zh"],["贵","zh"]);
  const original=[block("а",["а"],100,300),block("hallucinated",["hallucinated"],350,450)];
  const p=buildRecoveryPlan(words,original,1800);
  assert.equal(p.matches.length,1);
  assert.deepEqual(p.gaps[0].tokens,["这","贵"]);
});
