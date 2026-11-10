import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "./lib.mjs";
import { validateVisualStateIntent } from "./action-design-plan.mjs";

const files = [
  "./content/episodes/haishi-vs-huozhe-tea-20261113.json",
  "./content/locales/tg/episodes/haishi-vs-huozhe-tea-20261113.json",
];

for (const file of files) {
  test(`${file} preserves both accepted drinks in every later options pose`, async () => {
    const episode = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, file.slice(2)), "utf8"));
    const scene = episode.scenes.find((entry) => entry.id === "options");
    for (const beatId of ["options-action-2", "options-action-3"]) {
      const beat = scene.motionBeats.find((entry) => entry.id === beatId);
      const nodeIds = new Set(beat.visual.graphic.nodes.map((node) => node.id));
      assert.ok(nodeIds.has("tick-tea"), `${beatId} must mark tea as accepted`);
      assert.ok(nodeIds.has("tick-coffee"), `${beatId} must mark coffee as accepted`);
    }
    assert.equal(validateVisualStateIntent(episode), true);

    const broken = structuredClone(episode);
    const later = broken.scenes.find((entry) => entry.id === "options").motionBeats.find((entry) => entry.id === "options-action-3");
    later.visual.graphic.nodes = later.visual.graphic.nodes.filter((node) => node.id !== "tick-coffee");
    assert.throws(() => validateVisualStateIntent(broken), /missing one or more accepted-option cues/);
  });
}
