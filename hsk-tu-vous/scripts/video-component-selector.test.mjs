import test from "node:test";
import assert from "node:assert/strict";
import {MOTION_COMPONENTS,selectVideoComponents} from "./video-component-selector.mjs";
const episode={id:"example-20261115",scenes:[
  {id:"hook",kind:"hook",narration:"Сегодня учим простое слово"},
  {id:"context",kind:"context",narration:"Этот пример объясняет значение"},
  {id:"example",kind:"example",narration:"Сейчас пример"},
  {id:"cta",kind:"cta",narration:"Approved CTA preserved"},
]};
test("selection is deterministic, serializable and cannot touch the central CTA",()=>{
  const before=structuredClone(episode);
  const p=selectVideoComponents(episode,{contentType:"advertisement"});
  assert.deepEqual(selectVideoComponents(episode,{contentType:"advertisement"}),p);
  assert.deepEqual(episode,before);
  assert.equal(p.status,"advisory-preview-only");
  assert.equal(p.productionReady,false);
  assert.equal(p.cueSource,"not-bound");
  assert.deepEqual(p.skippedCtaScenes,["cta"]);
  assert.equal(p.scenes.length,3);
  assert.equal(p.scenes.every(s=>s.verifiedCueRequired),true);
  assert.deepEqual(JSON.parse(JSON.stringify(p)),p);
});
test("lesson never adds a second teaching card or app dashboard HUD",()=>{
  const p=selectVideoComponents(episode,{contentType:"lesson"});
  assert.deepEqual(p.sequence,["type-reveal","type-reveal","type-reveal"]);
});
test("series can select varied complete sequences when history contains last choice",()=>{
  const old=selectVideoComponents(episode,{contentType:"series-part"});
  const next=selectVideoComponents(episode,{contentType:"series-part",recentSequences:[old.sequence]});
  assert.notDeepEqual(next.sequence,old.sequence);
  assert.deepEqual(next,selectVideoComponents(episode,{contentType:"series-part",recentSequences:[old.sequence]}));
});
test("every selected component is from the vetted register and compatible with content",()=>{
  for(const contentType of ["lesson","advertisement","series-part"]){
    const p=selectVideoComponents(episode,{contentType});
    for(const s of p.scenes){
      const entry=MOTION_COMPONENTS.find(c=>c.id===s.componentId);
      assert(entry);
      assert(entry.formats.includes(contentType));
      assert(entry.sceneKinds.includes(s.sceneKind));
    }
  }
});
test("malformed episode IDs, missing narration, duplicate scenes and untyped content fail closed",()=>{
  assert.throws(()=>selectVideoComponents(episode,{contentType:"unknown"}),/canonical content type/);
  assert.throws(()=>selectVideoComponents({...episode,id:"../oops"},{contentType:"lesson"}),/identifier/);
  assert.throws(()=>selectVideoComponents({...episode,scenes:[episode.scenes[0],episode.scenes[0]]},{contentType:"lesson"}),/Duplicate scene/);
  assert.throws(()=>selectVideoComponents({...episode,scenes:[{id:"bad",kind:"hook",narration:""}]},{contentType:"lesson"}),/narration/);
  assert.throws(()=>selectVideoComponents({...episode,scenes:[]},{contentType:"lesson"}),/authored scenes/);
  assert.throws(()=>selectVideoComponents(episode,{contentType:"lesson",recentSequences:"no"}),/recentSequences/);
});
test("unknown or CTA-only scenes never invent a cue or a component",()=>{
  const p=selectVideoComponents({...episode,scenes:[{id:"cta",kind:"cta",narration:"Do not modify"}]},{contentType:"advertisement"});
  assert.deepEqual(p.sequence,[]);
  const q=selectVideoComponents({...episode,scenes:[{id:"unknown",kind:"unclassified",narration:"Hello"}]},{contentType:"advertisement"});
  assert.deepEqual(q.sequence,[]);
});
