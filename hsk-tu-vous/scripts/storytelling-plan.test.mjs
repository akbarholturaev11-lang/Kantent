import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
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

test("overlapping open loops and recycled opening cues are refused", () => {
  const repeated = annotated();
  repeated.scenes[0].narration += " Но двадцать — 二十.";
  assert.match(validateStorytellingEpisode(repeated).join(" "), /recycle the original hook/);
  const e = annotated();
  e.storytelling.pattern = "layered";
  e.storytelling.reHooks.push({
    sceneId: "recap", cueText: "Две чашки — 两杯茶.",
    payoffSceneId: "recap", payoffCueText: "Две чашки — 两杯茶.",
    reason: "Try to stack another suspense loop before the first resolves."
  });
  assert.match(validateStorytellingEpisode(e).join(" "), /resolve the previous reHook|order must be/);
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

test("duration or question count never chooses a narrative pattern", () => {
  for (const durationSec of [2, 25]) {
    const e = fixture();
    for (const scene of e.scenes) {
      scene.durationSec = durationSec;
      scene.narration += " А почему? Что если?";
    }
    const result = inspectStorytelling(e);
    assert.equal(result.suggestedPattern, null);
    assert.equal(result.patternSource, "author-decision-required");
    assert.ok(result.authoringGaps.length > 0);
    e.storytelling = {schemaVersion:1,pattern:"direct",
      firstPayoff:{sceneId:"hook",cueText:"Правильный выбор — 两."},reHooks:[],
      situation:{setting:"Кафе",learnerGoal:"Заказать два чая",obstacle:"Две формы числительного"},
      selectionReason:"The one practical distinction is complete without another question."};
    const authored = inspectStorytelling(e);
    assert.equal(authored.suggestedPattern, "direct");
    assert.equal(authored.patternSource, "authored-topic-decision");
    assert.deepEqual(authored.authoringGaps, []);
  }
});

test("layered requires two independently justified and resolved later questions", () => {
  const e = {scenes:[
    {id:"hook",kind:"hook",narration:"First useful answer.",durationSec:2},
    {id:"q-one",kind:"context",narration:"First new question?",durationSec:2},
    {id:"a-one",kind:"example",narration:"Answer one.",durationSec:2},
    {id:"q-two",kind:"context",narration:"Second new question?",durationSec:2},
    {id:"a-two",kind:"example",narration:"Answer two.",durationSec:2},
  ],storytelling:{schemaVersion:1,pattern:"layered",
    firstPayoff:{sceneId:"hook",cueText:"First useful answer."},reHooks:[
      {sceneId:"q-one",cueText:"First new question?",payoffSceneId:"a-one",payoffCueText:"Answer one.",reason:"Apply the same learning point to the first practical complication."},
      {sceneId:"q-two",cueText:"Second new question?",payoffSceneId:"a-two",payoffCueText:"Answer two.",reason:"Resolve another genuinely distinct complication of the same point."},
    ]}};
  assert.deepEqual(validateStorytellingEpisode(e), []);
  assert.equal(inspectStorytelling(e).suggestedPattern, "layered");
  e.storytelling.reHooks.pop();
  assert.match(validateStorytellingEpisode(e).join(" "), /exactly two/);
});

test("incomplete life context and empty selection reasons cannot pass as authored evidence", () => {
  const e = annotated();
  e.storytelling.selectionReason = "filler";
  e.storytelling.situation = {setting:"Кафе",learnerGoal:"Заказать чай",obstacle:""};
  assert.match(validateStorytellingEpisode(e).join(" "), /selectionReason/);
  assert.match(validateStorytellingEpisode(e).join(" "), /situation/);
  assert.equal(inspectStorytelling(e).suggestedPattern, null);
});

test("strict new-draft CLI reports missing authoring decisions without rewriting a legacy plan", () => {
  const id = "er-vs-liang-cafe-20261026";
  const file = path.join(root,"content/episodes",id+".json");
  const before = fs.readFileSync(file,"utf8");
  const result = spawnSync(process.execPath,[path.join(root,"scripts/storytelling-plan.mjs"),id,"--new-draft"],{encoding:"utf8"});
  assert.equal(result.status,1,result.stderr);
  assert.ok(JSON.parse(result.stdout).authoringGaps.length > 0);
  assert.equal(fs.readFileSync(file,"utf8"),before);
});
