import test from "node:test";
import assert from "node:assert/strict";
import {resolveContentType,sourceRelativePath,asSelectorEpisode,previewVideoComponentPlan} from "./preview-video-component-plan.mjs";
const calendar={weeklySchedule:{effectiveFromDate:"2026-10-27",days:[
 {weekday:"MO",contentType:"lesson"},{weekday:"TU",contentType:"advertisement"},
 {weekday:"WE",contentType:"lesson"},{weekday:"TH",contentType:"advertisement"},
 {weekday:"FR",contentType:"lesson"},{weekday:"SA",contentType:"series-part"},
 {weekday:"SU",contentType:"series-part"}]}};
test("calendar explicitly owns video type, with weekday fallback only when policy effective",()=>{
 assert.equal(resolveContentType({id:"a",date:"2026-11-17"},calendar),"advertisement");
 assert.equal(resolveContentType({id:"a",date:"2026-11-18"},calendar),"lesson");
 assert.equal(resolveContentType({id:"a",date:"2026-11-21"},calendar),"series-part");
 assert.equal(resolveContentType({id:"a",date:"2026-09-20",contentType:"advertisement"},calendar),"advertisement");
 assert.throws(()=>resolveContentType({id:"old",date:"2026-09-20"},calendar),/Historical/);
});
test("source path cannot escape content directory or impersonate unrelated files",()=>{
 assert.equal(sourceRelativePath({id:"a",promoFile:"promos/real-source.json"}),"promos/real-source.json");
 assert.throws(()=>sourceRelativePath({id:"a",episodeFile:"../../.env"}),/safe/);
 assert.throws(()=>sourceRelativePath({id:"a",episodeFile:"episodes/abc.ts"}),/safe/);
});
test("real promo beats map to explicit storyboard scenes without inventing timestamps",()=>{
 const item={id:"promo"},source={id:"promo",beats:[{id:"stage-one",role:"situation",narration:"Real authored description"}]};
 assert.deepEqual(asSelectorEpisode(item,source,"advertisement"),{id:"promo",scenes:[
  {id:"stage-one",kind:"promo",narration:"Real authored description"}
 ]});
 assert.throws(()=>asSelectorEpisode(item,{...source,id:"wrong"},"advertisement"),/Source ID/);
});
test("actual registered future advertisement produces advisory plan from current repo",async()=>{
 const p=await previewVideoComponentPlan("shop-shirt-size-20261117");
 assert.equal(p.plan.contentType,"advertisement");
 assert.equal(p.plan.episodeId,"shop-shirt-size-20261117");
 assert.equal(p.plan.productionReady,false);
 assert.equal(p.sourcePath,"promos/shop-shirt-size-20261117.json");
 assert.equal(p.plan.scenes.length,6);
});
test("real future lesson remains guarded against UI intrusion",async()=>{
 const p=await previewVideoComponentPlan("ji-vs-duoshao-books-price-20261118");
 assert.equal(p.plan.contentType,"lesson");
 assert.equal(p.plan.productionReady,false);
 assert(p.plan.sequence.every(c=>c==="type-reveal"));
});
