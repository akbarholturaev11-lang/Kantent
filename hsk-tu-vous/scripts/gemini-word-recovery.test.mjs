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
test("an interleaved locale+Mandarin gap is one mixed clip; unknown language mixes still fail",()=>{
  // Real 2026-11-08 RU take: "с 比 или с 很" dropped between verified words.
  const words=expected(["по","locale"],["с","locale"],["比","zh"],["или","locale"],["с","locale"],["很","zh"],["посмотрите","locale"]);
  const original=[block("по",["по"],2500,3400),block("посмотрите",["посмотрите"],5900,6500)];
  const plan=buildRecoveryPlan(words,original,8000);
  assert.deepEqual(plan.gaps.map(g=>[g.language,g.startMs,g.endMs,g.tokens]),[["mixed",3400,5900,["с","比","или","с","很"]]]);
  assert.throws(()=>buildRecoveryPlan([{text:"x",language:"en"},{text:"有",language:"zh"}],[],2000),/mixes languages/);
});
test("a provided matcher accepts verified spellings in original and recovered blocks",()=>{
  const words=expected(["бо","locale"],["比","zh"]);
  const match=(wanted,heard)=>wanted===heard||(wanted==="比"&&heard==="би");
  const plan=buildRecoveryPlan(words,[block("бо",["бо"],0,300),block("би",["би"],300,600)],1000,{match});
  assert.equal(plan.gaps.length,0);
  assert.equal(buildRecoveryPlan(words,[block("бо",["бо"],0,300),block("би",["би"],300,600)],1000).gaps.length,1,
    "without a matcher the default stays strict");
  assert.deepEqual(selectRecoveredBlocks(["比"],[block("би",["би"],10,200)],{match}).map(b=>b.text),["би"]);
});
test("discard extra unverified words, never use them to fill missing tokens",()=>{
  const words=expected(["а","locale"],["这","zh"],["贵","zh"]);
  const original=[block("а",["а"],100,300),block("hallucinated",["hallucinated"],350,450)];
  const p=buildRecoveryPlan(words,original,1800);
  assert.equal(p.matches.length,1);
  assert.deepEqual(p.gaps[0].tokens,["这","贵"]);
});
test("split recognizer words cover one written word, as one merged annotation",()=>{
  const words=expected(["ман","locale"],["қадбаландтар","locale"],["аст","locale"]);
  const original=[block("ман",["ман"],0,500),block("қад",["қад"],500,700),block("баландтар",["баландтар"],700,1300),block("аст",["аст"],1300,1600)];
  const plan=buildRecoveryPlan(words,original,2000);
  assert.equal(plan.gaps.length,0);
  assert.deepEqual(plan.matches.map(m=>[m.from,m.to,m.blockCount]),[[0,1,1],[1,2,2],[2,3,1]]);
  const merged=mergeRecoveredBlocks(words,original,plan,[]);
  assert.deepEqual(merged.map(b=>[b.text,b.startMs,b.endMs]),[["ман",0,500],["қадбаландтар",500,1300],["аст",1300,1600]]);
  // Concatenation must be exact: a different second half is not accepted.
  const wrong=[block("ман",["ман"],0,500),block("қад",["қад"],500,700),block("баланд",["баланд"],700,1300),block("аст",["аст"],1300,1600)];
  assert.equal(buildRecoveryPlan(words,wrong,2000).gaps.length,1);
});
test("X-10: single-hint language passes over the same audio fill what the mixed pass dropped",()=>{
  // Real TG chunk 2 shape: the mixed-hint pass returned only the Mandarin.
  const words=expected(["дуруст","locale"],["他","zh"],["比","zh"],["我","zh"],["高","zh"],["ӯ","locale"],["аз","locale"],["ман","locale"]);
  const mixedPass=[block("他",["他"],900,1100),block("比",["比"],1100,1300),block("我",["我"],1300,1500),block("高",["高"],1500,1800)];
  const localePass=[block("Дуруст",["дуруст"],200,800),block("би",["би"],1100,1300),block("Ӯ",["ӯ"],2000,2200),block("аз",["аз"],2200,2400),block("ман",["ман"],2400,2800)];
  const zhPass=[block("他",["他"],900,1100),block("比",["比"],1100,1300),block("我",["我"],1300,1500),block("高",["高"],1500,1800)];
  assert.ok(buildRecoveryPlan(words,mixedPass,3000).gaps.length>0,"the mixed pass alone has gaps");
  const combined=[...mixedPass,...localePass,...zhPass].sort((a,b)=>a.startMs-b.startMs||a.endMs-b.endMs);
  const plan=buildRecoveryPlan(words,combined,3000);
  assert.equal(plan.gaps.length,0);
  const merged=mergeRecoveredBlocks(words,combined,plan,[]);
  assert.deepEqual(merged.map(b=>b.text),["Дуруст","他","比","我","高","Ӯ","аз","ман"]);
  assert.ok(merged.every((b,i)=>i===0||b.startMs>=merged[i-1].startMs),"time ordered");
});
