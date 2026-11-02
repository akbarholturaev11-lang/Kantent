import test from "node:test";
import assert from "node:assert/strict";
import {groupExactActionCaptions as pages} from "./action-caption-grouping.mjs";
import {groupTimedCaptions} from "./caption-utils.mjs";
const style={maxWordsPerPage:2,maxCharactersPerPage:32,maxPageDurationMs:1250,maxGapMs:250,holdAfterWordMs:100};
const c=[
  {text:"потом",startMs:1680,endMs:1950},
  {text:"чай",startMs:2200,endMs:2490},
  {text:"скачай",startMs:4300,endMs:4520},
  {text:"сейчас",startMs:4590,endMs:4830}
];
const sections=[{startMs:0,endMs:4000,styleId:"highlight"},{startMs:4000,endMs:6000,styleId:"ctaFooter"}];
const actions=[{from:0,durationFrames:120}];
const at=(items,time)=>items.find(p=>time>=p.startMs&&time<p.endMs)?.text??null;
test("legacy grouped subtitle can show later word before its exact cue",()=>{
  assert.equal(at(groupTimedCaptions(c,{...style,sections}),1800),"потом чай");
});
test("action subtitle never previews future word or changes voice word anchors",()=>{
  const ps=pages(c,style,sections,actions,30);
  assert.equal(at(ps,1800),"потом");
  assert.equal(at(ps,2150),null);
  assert.equal(at(ps,2200),"чай");
  assert.equal(ps.find(x=>x.text==="чай").startMs,2200);
  assert.equal(at(ps,4700),"скачай сейчас"); // CTA still grouped
});
test("scene with no action beats preserves original legacy captions",()=>{
  const baseline=groupTimedCaptions(c,{...style,sections});
  assert.deepEqual(pages(c,style,sections,[],30),baseline);
});
test("other locale content is not rewritten, no source mutation, invalid FPS rejects",()=>{
  const words=structuredClone(c),sects=structuredClone(sections);
  pages(c,style,sections,actions,30);
  assert.deepEqual(c,words);assert.deepEqual(sections,sects);
  assert.throws(()=>pages(c,style,sections,actions,0),/fps/);
});
