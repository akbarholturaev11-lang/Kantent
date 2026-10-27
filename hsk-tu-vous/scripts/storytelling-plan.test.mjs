import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectStorytelling, validateStorytellingEpisode, readStorytellingPolicy } from "./storytelling-plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const getEpisode = id => JSON.parse(fs.readFileSync(path.join(root, "content", "episodes", id + ".json"), "utf8"));
const fixture = () => getEpisode("er-vs-liang-cafe-20261026");
const annotated = () => {
  const e = fixture();
  e.storytelling = {
    schemaVersion: 1,
    pattern: "single-rehook",
    firstPayoff: { sceneId: "hook", cueText: "Правильный выбор — 两." },
    reHooks: [{
      sceneId: "numeral", cueText: "Но двадцать — 二十.",
      payoffSceneId: "recap", payoffCueText: "Две чашки — 两杯茶.",
      reason: "Explain the distinct ordinal/cardinal context after the tea order."
    }]
  };
  return e;
};

test("policy is read from the sole creative format registry", () => {
  const p = readStorytellingPolicy();
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.maxRehooks, 2);
  assert.equal(p.firstPayoffLatestRatio, .3);
});

test("all existing dated lessons remain valid with no storytelling metadata", () => {
  for (const id of [
    "er-vs-liang-cafe-20261026",
    "hui-vs-neng-pool-20261028",
    "youdianr-vs-yidianr-price-20261030",
    "haishi-vs-huozhe-tea-20261102",
    "bi-comparison-height-20261104"
  ]) assert.deepEqual(validateStorytellingEpisode(getEpisode(id)), [], id);
});

test("true authored rehook: later, verbatim, distinct, and resolved", () => {
  const e = annotated();
  assert.deepEqual(validateStorytellingEpisode(e), []);
  assert.equal(inspectStorytelling(e).durationSec, 32);
  assert.ok(inspectStorytelling(e).possibleRehookSceneIds.includes("numeral"));
});

test("direct lessons do not need invented or forced rehooks", () => {
  const e = fixture();
  e.storytelling = {
    schemaVersion: 1, pattern: "direct",
    firstPayoff: {sceneId:"hook",cueText:"Правильный выбор — 两."}, reHooks:[]
  };
  assert.deepEqual(validateStorytellingEpisode(e), []);
});

test("reject rehook after payoff, duplicate, or hook reused", () => {
  const e = annotated();
  e.storytelling.reHooks[0].payoffSceneId = "classifier";
  assert.match(validateStorytellingEpisode(e).join(" "), /order must be/);
  e.storytelling.reHooks[0].payoffSceneId = "recap";
  e.storytelling.reHooks.push({...e.storytelling.reHooks[0]});
  assert.match(validateStorytellingEpisode(e).join(" "), /duplicate|ordered/);
  e.storytelling.reHooks = [{
    sceneId:"classifier",cueText:"В кафе нужны две чашки чая.",
    payoffSceneId:"recap",payoffCueText:"Две чашки — 两杯茶.",
    reason:"Try to reuse the beginning as a second question."
  }];
  assert.match(validateStorytellingEpisode(e).join(" "), /verbatim/);
});

test("reject invented cues, unsupported structure, missing proof and CTA rehooks", () => {
  const e = annotated();
  e.storytelling.reHooks[0].cueText = "Unspoken claim";
  assert.match(validateStorytellingEpisode(e).join(" "), /verbatim/);
  e.storytelling.reHooks[0].cueText = "Но двадцать — 二十.";
  e.storytelling.pattern = "viral-magic";
  assert.match(validateStorytellingEpisode(e).join(" "), /unsupported/);
  e.storytelling.pattern = "single-rehook";
  e.storytelling.reHooks[0].payoffSceneId = "cta";
  assert.match(validateStorytellingEpisode(e).join(" "), /order must be/);
});

test("first payoff cannot start after first 30% of lesson", () => {
  const e = annotated();
  e.storytelling.firstPayoff = { sceneId: "order", cueText: "Можно сказать: 我要两杯茶。" };
  assert.match(validateStorytellingEpisode(e).join(" "), /early-payoff/);
});

test("read-only advisor does not mutate narration, scenes, CTA, or source JSON", () => {
  const e = fixture();
  const before = JSON.stringify(e);
  const result = inspectStorytelling(e);
  assert.equal(JSON.stringify(e), before);
  assert.equal(result.authoredMetadataPresent, false);
  assert.equal(result.validationErrors.length, 0);
  assert.equal(result.mode, "read-only-editorial-advice");
  assert.equal(e.cta, undefined);
  assert.ok(result.limits.some(x => x.includes("not a model of viewer retention")));
});

test("opt-in metadata is not part of scene kinds or measured watch performance", () => {
  const e = annotated();
  assert.deepEqual(e.scenes.map(s => s.kind),
    fixture().scenes.map(s => s.kind));
  const v = inspectStorytelling(e);
  assert.equal(v.firstChineseSceneId, "hook");
  assert.equal(Object.hasOwn(v, "predictedRetention"), false);
});
