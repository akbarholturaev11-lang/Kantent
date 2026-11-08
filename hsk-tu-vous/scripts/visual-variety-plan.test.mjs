import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { armFor, planVariety, readVarietyResults } from "./visual-variety-plan.mjs";

const policy = JSON.parse(readFileSync(new URL("../content/visual-variety.json", import.meta.url), "utf8"));
const lesson = (id, date, narration) => ({ id, date, scenes: [{ narration }] });

test("the script chooses the supporting character and layout; the panda stays the coach", () => {
  const plan = planVariety({ episode: lesson("cmp", "2026-11-04", "Он выше меня: 他比我高"), history: [], policy });
  assert.deepEqual([plan.coach, plan.supportingCharacter, plan.pattern], ["panda", "crane", "two-subject"]);
  assert.equal(planVariety({ episode: lesson("dlg", "2026-11-04", "Спроси и ответь"), history: [], policy }).supportingCharacter, "monkey");
  assert.equal(planVariety({ episode: lesson("warn", "2026-11-04", "Запомни: не путай"), history: [], policy }).supportingCharacter, "rabbit");
});

test("recent settings, characters and patterns are not repeated", () => {
  const history = [
    { episodeId: "a", date: "2026-11-01", variety: { setting: "hutong-street", supportingCharacter: "monkey", pattern: "single-coach" } },
    { episodeId: "b", date: "2026-11-02", variety: { setting: "park-lake", supportingCharacter: "rabbit", pattern: "single-coach" } },
  ];
  const plan = planVariety({ episode: lesson("c", "2026-11-03", "Привет"), history, policy });
  assert.ok(!["hutong-street", "park-lake"].includes(plan.setting), plan.setting);
  assert.ok(!["monkey", "rabbit"].includes(plan.supportingCharacter), plan.supportingCharacter);
});

test("A/B arms are stable, settings follow the arm, and results need the minimum sample", () => {
  const experiment = policy.experiments[0];
  assert.equal(armFor(experiment, "x-20261111"), armFor(experiment, "x-20261111"));
  const plan = planVariety({ episode: lesson("x-20261111", "2026-11-11", "Привет"), history: [], policy });
  const group = experiment.arms[plan.experiment.arm];
  assert.equal(policy.settings.find((s) => s.id === plan.setting).group, group);
  const history = ["e1", "e2", "e3", "e4", "e5", "e6"].map((id, i) => ({ episodeId: id, variety: { experiment: { id: experiment.id, arm: i < 3 ? "A" : "B" } } }));
  const obs = (id, ratio, window = "7d") => ({ episodeId: id, window, platform: "instagram", metrics: { views: 100, avgWatchMs: ratio * 40000, durationSeconds: 40, shares: 1 } });
  const few = readVarietyResults({ history, observations: [obs("e1", .5), obs("e4", .6)], policy })[0];
  assert.equal(few.decision, "insufficient-evidence");
  const lifetimeIgnored = readVarietyResults({ history, observations: history.map((h) => obs(h.episodeId, .5, "lifetime")), policy })[0];
  assert.equal(lifetimeIgnored.arms.A.n, 0, "only the fixed-age window counts");
  const full = readVarietyResults({ history, observations: [obs("e1", .4), obs("e2", .4), obs("e3", .4), obs("e4", .6), obs("e5", .6), obs("e6", .6)], policy })[0];
  assert.match(full.decision, /^leader B/);
});

test("reserve readiness rejects an illustrated draft whose variety record is missing or hand-picked", async () => {
  const fsMod = await import("node:fs");
  const os = await import("node:os");
  const pathMod = await import("node:path");
  const { inspectDraftReadiness } = await import("./self-improvement-check.mjs");
  const root = fsMod.mkdtempSync(pathMod.join(os.tmpdir(), "vv-"));
  const real = (await import("node:url")).fileURLToPath(new URL("..", import.meta.url));
  for (const rel of ["content/languages.json", "content/visual-system.json", "content/visual-variety.json"]) {
    fsMod.mkdirSync(pathMod.dirname(pathMod.join(root, rel)), { recursive: true });
    fsMod.copyFileSync(pathMod.join(real, rel), pathMod.join(root, rel));
  }
  // A dated lesson without its lesson-art manifest is not reserve-ready.
  const report = inspectDraftReadiness(root, { id: "x-20261120", date: "2026-11-20", episodeFile: "episodes/x-20261120.json" });
  assert.equal(report.ready, false);
  fsMod.rmSync(root, { recursive: true, force: true });
});
