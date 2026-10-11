import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { resolveTodayVideo } from "./resolve-production-date.mjs";
import { verifiedPublishedRecords, confirmedPublishedIds, confirmedPublishedFor, assertNotPreviouslyPublished } from "./published-evidence.mjs";
const calendar=JSON.parse(fs.readFileSync(new URL("../content/calendar.json",import.meta.url),"utf8"));
const verified=verifiedPublishedRecords();

test("12 October posts have provider-confirmed published status, IDs and scheduled time",()=>{
  assert.equal(verified.length,2);
  assert.deepEqual(verified.map(x=>x.platform).sort(),["instagram","youtube"]);
  assert.ok(verified.every(x=>x.episodeId==="zai-location" && x.calendarDate==="2026-10-12"));
  assert.ok(verified.every(x=>x.zernioStatus==="published" && x.creativeFormatVerified===false));
  assert.ok(verified.every(x=>x.scheduledFor==="2026-10-10T13:00:00Z"));
});
test("today's video bypasses published 12 Oct and selects new 13 Oct pilot",()=>{
 const result=resolveTodayVideo(calendar,new Date("2026-10-11T03:30:00Z"),
  {confirmedPublishedEpisodeIds:confirmedPublishedIds()});
 assert.equal(result.requestedDate,"2026-10-11");
 assert.equal(result.selectedDate,"2026-10-13");
 assert.equal(result.episodeId,"zai-location-cinematic-v2");
 assert.deepEqual(result.skippedPublished,[{date:"2026-10-12",episodeId:"zai-location"}]);
});
test("when the published date is today it is skipped too",()=>{
 const result=resolveTodayVideo(calendar,new Date("2026-10-12T02:00:00Z"),
  {confirmedPublishedEpisodeIds:confirmedPublishedIds()});
 assert.equal(result.selectedDate,"2026-10-13");
});
test("manual specific-date video cannot accidentally overwrite verified publications",()=>{
 assert.throws(()=>assertNotPreviouslyPublished("zai-location"),/already has externally VERIFIED published post/);
 assert.doesNotThrow(()=>assertNotPreviouslyPublished("ji-vs-duoshao"));
});
test("scheduled, approved or unverified entries cannot count as published",()=>{
 const changed={schemaVersion:1,records:[{...verified[0],zernioStatus:"scheduled"}]};
 assert.throws(()=>verifiedPublishedRecords(changed),/Unverified/);
 changed.records[0].zernioStatus="published";
 changed.records[0].creativeFormatVerified="assumed";
 assert.throws(()=>verifiedPublishedRecords(changed),/Unverified/);
 assert.equal(confirmedPublishedFor("ji-vs-duoshao").length,0);
});
test("when all future episodes are published, no stale episode is repeated",()=>{
 const ids=new Set(calendar.items.filter(item=>item.date>="2026-10-11").map(item=>item.id));
 assert.throws(()=>resolveTodayVideo(calendar,new Date("2026-10-11T03:30:00Z"),{confirmedPublishedEpisodeIds:ids}),/no upcoming planned video/);
});
