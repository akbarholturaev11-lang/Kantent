import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { resolveTodayVideo } from "./resolve-production-date.mjs";
import { verifiedPublishedRecords, confirmedPublishedIds, confirmedPublishedFor, confirmedPublishedInAllLanguages, assertNotPreviouslyPublished } from "./published-evidence.mjs";
import { withLanguage } from "./language-context.mjs";
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

test("legacy publication evidence protects only the Russian version",()=>{
  const records=[{...verified[0]}];
  delete records[0].language;
  withLanguage("ru",()=>{
    assert.equal(confirmedPublishedFor("zai-location",records).length,1);
    assert.deepEqual([...confirmedPublishedIds(records)],["zai-location"]);
    assert.throws(()=>assertNotPreviouslyPublished("zai-location",records),/already has externally VERIFIED/);
  });
  withLanguage("tg",()=>{
    assert.equal(confirmedPublishedFor("zai-location",records).length,0);
    assert.equal(confirmedPublishedIds(records).size,0);
    assert.doesNotThrow(()=>assertNotPreviouslyPublished("zai-location",records));
  });
  assert.equal(records[0].language,undefined,"reading history must not rewrite it");
});

test("explicit Tajik publications protect Tajik without blocking Russian",()=>{
  const records=[{...verified[0],episodeId:"tajik-only",language:"tg"}];
  withLanguage("ru",()=>assert.doesNotThrow(()=>assertNotPreviouslyPublished("tajik-only",records)));
  withLanguage("tg",()=>{
    assert.deepEqual([...confirmedPublishedIds(records)],["tajik-only"]);
    assert.throws(()=>assertNotPreviouslyPublished("tajik-only",records),/already has externally VERIFIED/);
  });
  // Explicit record arguments and language selection remain usable by callers.
  assert.equal(confirmedPublishedFor("tajik-only",records,"tg").length,1);
  assert.equal(confirmedPublishedFor("tajik-only",records,"ru").length,0);
});

test("bilingual calendar skips only episodes published in all requested languages",()=>{
  const records=[
    {...verified[0],episodeId:"ru-only"},
    {...verified[0],episodeId:"both",language:"ru"},
    {...verified[0],episodeId:"both",language:"tg"},
    {...verified[0],episodeId:"tg-only",language:"tg"},
  ];
  withLanguage("tg",()=>{
    assert.deepEqual([...confirmedPublishedInAllLanguages(["ru","tg"],records)],["both"]);
    assert.deepEqual([...confirmedPublishedInAllLanguages(["ru"],records)],["ru-only","both"]);
  });
  assert.throws(()=>confirmedPublishedInAllLanguages([],records),/At least one/);
  assert.throws(()=>confirmedPublishedInAllLanguages(["uz"],records),/Language must be/);
});

test("publication evidence rejects unknown languages and duplicate provider IDs across languages",()=>{
  const record={...verified[0],language:"uz"};
  assert.throws(()=>verifiedPublishedRecords({schemaVersion:1,records:[record]}),/Unverified/);
  assert.throws(()=>verifiedPublishedRecords({schemaVersion:1,records:[
    {...verified[0],language:"ru"},
    {...verified[0],language:"tg"},
  ]}),/Duplicate published post ID/);
});
