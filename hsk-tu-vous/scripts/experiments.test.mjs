import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  activeExperimentFor, assignItem, assignmentFor, checkFutureDrafts, draftExperimentErrors, experimentBrief,
  experimentResults, readExperiments, recordDecision, validateExperiments,
} from "./experiments.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const goals = read("content/creative-formats.json").contentGoals.byContentType;
const thresholds = read("content/hook-lab.json").policy;
const registry = readExperiments(ROOT);
const lesson = (id, date) => ({ id, date, contentType: "lesson" });

test("the canonical registry is valid: one active test, goals from contentGoals, the visual test paused", () => {
  assert.deepEqual(validateExperiments(registry, { goals, variety: read("content/visual-variety.json") }), []);
  assert.equal(registry.experiments.filter((exp) => exp.status === "active").length, 1);
  assert.equal(activeExperimentFor(registry, "lesson", "2026-11-18").id, "lesson-opening-v1");
  assert.equal(activeExperimentFor(registry, "lesson", "2026-11-17"), null, "nothing before the start date");
  assert.equal(activeExperimentFor(registry, "advertisement", "2026-11-19"), null, "the ad test is queued");
  const twoActive = structuredClone(registry);
  twoActive.experiments[1].status = "active";
  twoActive.experiments[1].startDate = "2026-11-18";
  assert.match(validateExperiments(twoActive, { goals }).join(" "), /only 1 test/u);
  assert.match(validateExperiments(registry, { goals, variety: { experiments: [{ id: "vv", status: "active" }] } }).join(" "), /only 1 test/u);
});

test("arms are balanced, stored once and never hand-picked; stories keep both parts in one arm", () => {
  assert.deepEqual(assignmentFor(registry, lesson("ji-vs-duoshao-books-price-20261118", "2026-11-18")), { experimentId: "lesson-opening-v1", arm: "A", stored: true });
  const next = assignmentFor(registry, lesson("new-lesson-20261123", "2026-11-23"));
  assert.deepEqual(next, { experimentId: "lesson-opening-v1", arm: "A", stored: false }, "tie → opposite of the latest (B)");
  const { registry: after } = assignItem(registry, lesson("new-lesson-20261123", "2026-11-23"), { today: "2026-11-17" });
  assert.equal(assignmentFor(after, lesson("new-lesson-20261125", "2026-11-25")).arm, "B", "fewer B → B");
  assert.throws(() => assignItem(registry, lesson("old-20261101", "2026-11-19"), { today: "2026-11-20" }), /past/u);

  const story = structuredClone(registry);
  const serial = story.experiments.find((exp) => exp.id === "serial-micro-drama-v1");
  Object.assign(serial, { status: "active", startDate: "2026-12-01" });
  story.experiments[0].status = "decided";
  const part = (id, partNo) => ({ id, date: "2026-12-05", contentType: "series-part", series: { id: "story-1", part: partNo, totalParts: 2 } });
  const { registry: stored } = assignItem(story, part("p1", 1), { today: "2026-12-01" });
  assert.equal(assignmentFor(stored, part("p2", 2)).arm, assignmentFor(stored, part("p1", 1)).arm);
  assert.equal(assignmentFor(stored, part("p2", 2)).stored, true, "part 2 shares the story's stored arm");
});

test("the writer brief names the goal, the one variable and the arm's own script brief", () => {
  const brief = experimentBrief(registry, lesson("ye-dou-placement-20261120", "2026-11-20"), goals);
  assert.match(brief, /direct-acquisition/u);
  assert.match(brief, /opening-structure/u);
  assert.match(brief, /Arm B \(candidate\): Mistake → Correction → Practice/u);
  assert.match(brief, /"mistake": "<sceneId>"/u);
});

test("a draft must carry its stored arm and map the steps to scenes in order", () => {
  const item = lesson("ye-dou-placement-20261120", "2026-11-20");
  const scenes = ["hook", "answer", "mistake", "dou", "recall"].map((id) => ({ id }));
  const ok = { scenes, experiment: { id: "lesson-opening-v1", arm: "B", structure: { mistake: "hook", correction: "answer", practice: "recall" } } };
  assert.deepEqual(draftExperimentErrors(registry, item, ok), []);
  assert.match(draftExperimentErrors(registry, item, { scenes }).join(), /must carry/u);
  assert.match(draftExperimentErrors(registry, item, { ...ok, experiment: { ...ok.experiment, arm: "A" } }).join(), /arm": "B"/u);
  assert.match(draftExperimentErrors(registry, item, { scenes, experiment: { ...ok.experiment, structure: { mistake: "answer", correction: "answer", practice: "recall" } } }).join(), /opening scene/u);
  assert.match(draftExperimentErrors(registry, item, { scenes, experiment: { ...ok.experiment, structure: { mistake: "hook", correction: "recall", practice: "answer" } } }).join(), /scene order/u);
  assert.match(draftExperimentErrors(registry, lesson("unassigned-20261123", "2026-11-23"), ok).join(), /no stored arm/u);
  assert.deepEqual(draftExperimentErrors(null, item, {}), [], "no registry → no experiment gate");
});

test("the current future drafts (RU and TG) carry their stored arms", () => {
  assert.deepEqual(checkFutureDrafts({ root: ROOT, today: "2026-11-17" }), []);
});

// --- results: only sourced first-week evidence; no forced winner
const exp = registry.experiments[0];
const pub = (n, arm, platform = "instagram") => ({ content: { id: `l${n}`, type: "lesson", language: "ru", sourceHash: "x" }, platform,
  zernioPostId: `z${platform}${n}`, creative: { experimentId: exp.id, arm } });
const obs = (n, { comments, views = 1000, ageHours = 180, window = "lifetime", platform = "instagram" }) => ({
  platform, zernioPostId: `z${platform}${n}`, platformPostId: `n${n}`, accountUsername: "hskai.app", window,
  publishedAt: "2026-11-01T00:00:00.000Z", observedAt: new Date(Date.parse("2026-11-01T00:00:00Z") + ageHours * 3600000).toISOString(),
  content: { id: `l${n}`, type: "lesson", language: "ru" },
  source: window === "7d" ? { provider: "Zernio", endpoint: "provider_exact_post_age_insights",
    windowEvidence: { kind: "provider-exact-post-age", window: "7d",
      startAt: "2026-11-01T00:00:00.000Z", endAt: "2026-11-08T00:00:00.000Z", providerRecordId: "verified-test-fixture" } }
    : { provider: "Zernio", endpoint: "analytics_get_analytics" },
  metrics: { views, comments, saves: 10, shares: 2, avgWatchMs: 15000, durationSeconds: 30, reach: 800 } });
const results = (publications, observations) => experimentResults(registry, exp, { publications, observations, goals, thresholds, asOf: "2026-11-20T00:00:00Z" });

test("missing or early data keeps the test running and is never filled in", () => {
  const r = results([pub(1, "A"), pub(2, "B")], [obs(1, { comments: 5, ageHours: 30 })]);
  assert.equal(r.recommendation, "keep-testing");
  assert.equal(r.posts[0].status, "no-first-week-snapshot", "a 30h lifetime snapshot is not a first-week result");
  assert.equal(r.posts[1].value, null);
  assert.equal(results([], []).reason, "No published video of this test yet. The test continues.");
  const late = results([pub(1, "A")], [obs(1, { comments: 5, ageHours: 300 })]);
  assert.equal(late.posts[0].status, "no-first-week-snapshot", "a 12.5-day snapshot is outside the first-week window");
  const few = results([pub(1, "A"), pub(2, "B")], [obs(1, { comments: 2 }), obs(2, { comments: 9 })]);
  assert.equal(few.cohorts[0].verdict, "insufficient-evidence");
  assert.equal(few.recommendation, "keep-testing", "one post per arm never declares a weekly winner");
  const small = results([pub(1, "A")], [obs(1, { comments: 2, views: 100, window: "7d" })]);
  assert.equal(small.posts[0].status, "below-minimum-views");
  const near = results([pub(1, "A")], [obs(1, { comments: 3, ageHours: 180 })]);
  assert.equal(near.posts[0].status, "directional-only");
  assert.equal(near.posts[0].evidenceQuality, "directional-not-7d");
  const after8d = results([pub(1, "A")], [obs(1, { comments: 3, ageHours: 193 })]);
  assert.equal(after8d.posts[0].status, "no-first-week-snapshot", "day-8+ lifetime is too old for even directional first-week data");
  const scheduled = results([{...pub(1, "A"), status: "scheduled", scheduledFor: "2026-11-18T00:00:00Z"}], []);
  assert.equal(scheduled.posts[0].publishedAt, null, "scheduling must not start the seven-day clock");
});

test("a clear, guarded lift proposes promotion to the owner; never promotes by itself", () => {
  const publications = [1, 2, 3].map((n) => pub(n, "A")).concat([4, 5, 6].map((n) => pub(n, "B")));
  const approximate = results(publications, [1, 2, 3].map((n) => obs(n, { comments: 2 })).concat([4, 5, 6].map((n) => obs(n, { comments: 4 }))));
  assert.equal(approximate.recommendation, "keep-testing", "six near-week lifetime posts cannot promote a style");
  assert.ok(approximate.posts.every((p) => p.status === "directional-only"));
  const better = results(publications, [1, 2, 3].map((n) => obs(n, { comments: 2, window: "7d" })).concat([4, 5, 6].map((n) => obs(n, { comments: 4, window: "7d" }))));
  assert.equal(better.cohorts[0].verdict, "candidate-better");
  assert.equal(better.recommendation, "propose-promotion");
  assert.equal(registry.experiments[0].status, "active", "results never change the registry");
  const worse = results(publications, [1, 2, 3].map((n) => obs(n, { comments: 4, window: "7d" })).concat([4, 5, 6].map((n) => obs(n, { comments: 2, window: "7d" }))));
  assert.equal(worse.recommendation, "propose-keep-current");
  const same = results(publications, [1, 2, 3, 4, 5, 6].map((n) => obs(n, { comments: 3, window: "7d" })));
  assert.equal(same.recommendation, "keep-testing");
  const exact = results([pub(1, "A")], [obs(1, { comments: 3, window: "7d", ageHours: 200 })]);
  assert.match(exact.posts[0].evidence, /provider-exact/u);
});

test("only the owner's recorded words decide; the next queued test then starts the next Monday", () => {
  assert.throws(() => recordDecision(registry, "lesson-opening-v1", { decision: "promote", ownerWords: "", today: "2026-12-10" }), /owner/u);
  assert.throws(() => recordDecision(registry, "ad-brand-demo-v1", { decision: "promote", ownerWords: "ha", today: "2026-12-10" }), /not the active/u);
  const next = recordDecision(registry, "lesson-opening-v1", { decision: "promote", ownerWords: "B asosiy bo'lsin", today: "2026-12-10" });
  const [lessonTest, adTest] = next.experiments;
  assert.equal(lessonTest.status, "decided");
  assert.equal(lessonTest.decision.promotedArm, "B");
  assert.equal(adTest.status, "active");
  assert.equal(adTest.startDate, "2026-12-14", "2026-12-10 is a Thursday → Monday 14th");
  assert.deepEqual(validateExperiments(next, { goals }), []);
});
