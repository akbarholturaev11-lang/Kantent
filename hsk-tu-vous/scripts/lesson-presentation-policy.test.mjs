import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {applyLessonPresentationDefault, validateLessonPresentation} from "./lesson-presentation-policy.mjs";
import {getPlannedEpisode, synchronizeAutoStoryboard} from "./lib.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../content/visual-system.json", import.meta.url)));
const policy = config.lessonPresentation;
const plan = JSON.parse(fs.readFileSync(new URL("../content/pilots/quantity-cafe-20261026.json", import.meta.url)));
const source = {
  id: "future-lesson", date: "2026-10-26",
  scenes: plan.scenes.map(scene => ({id: scene.sceneId, kind: "example", motionBeats: scene.beats})),
};

test("new lesson defaults select the approved renderer without changing source or inventing actions", () => {
  const raw = {...source, scenes: [{id: "hook", kind: "hook"}]};
  const snapshot = structuredClone(raw);
  const draft = applyLessonPresentationDefault(raw, policy);
  assert.equal(draft.motionDesign, true);
  assert.equal(draft.motionDesignStyle, "explain-actions-v1");
  assert.equal(draft.scenes[0].captionStyleId, "highlight");
  assert.deepEqual(raw, snapshot);
  assert.throws(() => validateLessonPresentation(draft, policy), /at least two/);
});

test("production requires authored actions and rejects legacy or disabled rendering", () => {
  const draft = applyLessonPresentationDefault(source, policy);
  assert.equal(validateLessonPresentation(draft, policy).actionCount, 23);
  for (const patch of [{motionDesign: false}, {motionDesignStyle: "le-context-v1"}]) {
    assert.throws(() => validateLessonPresentation({...draft, ...patch}, policy), /approved lesson format/);
  }
  const incomplete = structuredClone(draft);
  delete incomplete.scenes[0].motionBeats[0].cueText;
  assert.throws(() => validateLessonPresentation(incomplete, policy), /exact spoken cue/);
});

test("earlier historical plans retain their layout while broken policy fails closed", () => {
  const historical = {...source, date: "2026-10-23"};
  assert.equal(applyLessonPresentationDefault(historical, policy), historical);
  assert.equal(validateLessonPresentation(historical, policy), null);
  assert.throws(() => validateLessonPresentation(source, undefined), /policy/);
});

test("normal dated loader selects the default and preserves an existing authored review", async () => {
  const {episode: planned} = await getPlannedEpisode("2026-10-26");
  assert.equal(planned.motionDesignStyle, policy.styleId);
  assert.equal(planned.motionDesign, true);
  const saved = structuredClone(planned);
  saved.scenes.filter(scene => scene.kind !== "cta").forEach((scene, i) => {
    scene.motionBeats = plan.scenes[i].beats;
  });
  saved.semanticVisual = {schemaVersion: 1, mode: "review-only"};
  saved.audioSrc = "generated/already-reviewed.mp3";
  assert.equal(synchronizeAutoStoryboard(saved, planned, {stage: "rendered-pending-owner-approval"}), saved);
});
