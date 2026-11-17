import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MEANING_VISUALS_BRIEF, MEANING_VISUALS_STAGE, assertMeaningVisualsCovered, meaningVisualPreflight, meaningVisualsBrief,
} from "./meaning-visual-preflight.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const beat = (id, hanzi, meaning = "") => ({ id, localFrame: 0, visual: { hanzi, pinyin: "", meaning, illustration: { layout: "board", images: ["x"] } } });
const lesson = (date, beats) => ({ id: "gate-test", date, motionDesignStyle: "explain-actions-v1", scenes: [{ id: "s", kind: "lesson", motionBeats: beats }] });

async function sandbox() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "meaning-gate-"));
  await fs.mkdir(path.join(root, "content"), { recursive: true });
  for (const file of ["visual-system.json", "meaning-visuals.json"])
    await fs.copyFile(path.join(ROOT, "content", file), path.join(root, "content", file));
  return root;
}

test("a professional-motion lesson with an uncovered slide stops before voice with the Codex build brief", async () => {
  const root = await sandbox();
  const episode = lesson("2026-12-01", [beat("a", "比"), beat("b", "护照", "паспорт")]);
  const result = await meaningVisualPreflight(episode, { root });
  assert.equal(result.ready, false);
  assert.equal(result.stage, MEANING_VISUALS_STAGE);
  assert.deepEqual(result.missing, ["s/b: 护照"]);
  const brief = await fs.readFile(path.join(root, "review", "gate-test", MEANING_VISUALS_BRIEF), "utf8");
  assert.match(brief, /\| s \| b \| \w+ \| 护照 \|  \| паспорт \|/u, "the brief names the form and its meaning");
  assert.match(brief, /MeaningIcons\.tsx/u);
  assert.match(brief, /meaning-visual-check\.mjs gate-test --strict/u);
  await assert.rejects(assertMeaningVisualsCovered(episode, { root }), /meaning-visuals-required: s\/护照/u, "render refuses it too");
});

test("covered lessons pass; lessons before the professional-motion date are not gated", async () => {
  const root = await sandbox();
  assert.deepEqual(await meaningVisualPreflight(lesson("2026-12-01", [beat("a", "比"), beat("b", "他比我高。")]), { root }),
    { required: true, ready: true, covered: 2 });
  assert.deepEqual(await meaningVisualPreflight(lesson("2026-11-01", [beat("b", "护照")]), { root }), { required: false, ready: true });
  await assertMeaningVisualsCovered(lesson("2026-12-01", [beat("a", "比")]), { root });
});

test("the brief is pure and lists every missing row", () => {
  const text = meaningVisualsBrief(lesson("2026-12-01", [beat("b", "护照", "паспорт")]),
    [{ sceneId: "s", beatId: "b", template: "hero", text: "护照", visual: null }]);
  assert.match(text, /^# Meaning visuals to build — gate-test/u);
  assert.match(text, /HSKAI-MeaningGallery/u);
  assert.match(text, /no people/u);
});
