import test from "node:test";
import assert from "node:assert/strict";
import { findDuplicatedValues, validateFutureContentReadiness } from "./check-consistency.mjs";
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const settings = {
  voice: {
    voiceName: "Example Voice",
    serviceName: "example.test",
    provider: "example-provider",
    site: "https://example.test/",
    locale: "xx-YY",
  },
  cta: { offer: { canonicalRussian: "Пример призыва к действию." } },
};

test("a reference to a canonical JSON source is allowed", () => {
  assert.deepEqual(
    findDuplicatedValues("Read content/voice-profile.json and content/cta-lab.json", settings),
    [],
  );
});

test("literal duplicate voice and CTA rules are rejected", () => {
  const result = findDuplicatedValues(
    "Voice is Example Voice. CTA: Пример призыва к действию.",
    settings,
  );
  assert.equal(result.length, 2);
  assert.ok(result.some((error) => error.includes("voice.voiceName")));
  assert.ok(result.some((error) => error.includes("cta.offer.canonicalRussian")));
});

test("hard-coded calendar counts are rejected", () => {
  assert.deepEqual(
    findDuplicatedValues("Plan contains 12 episodes.", settings),
    ["hard-coded episode count; read content/calendar.json instead"],
  );
});

test('strict future readiness reports missing or unbound translations by episode ID', () => {
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hsk-consistency-languages-'));
 try {
  fs.mkdirSync(path.join(tmp,'content'),{recursive:true});
  fs.writeFileSync(path.join(tmp,'content/calendar.json'),JSON.stringify({
   timezone:'Asia/Shanghai',planningBuffer:{minimumFutureEpisodes:1,targetFutureEpisodes:2},
   items:[{id:'untranslated-future',date:'2026-11-03',status:'planned',
     episodeFile:'episodes/untranslated-future.json'}]
  }));
  const result=validateFutureContentReadiness(tmp,{today:'2026-10-28'});
  assert.equal(result.report.readyFutureEpisodes,0);
  assert.equal(result.errors.length,1);
  assert.match(result.errors[0],/untranslated-future/);
  assert.match(result.errors[0],/source\/configuration/);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
