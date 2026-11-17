/**
 * Meaning-visual gate of professional-motion lessons (owner 2026-11-17: when the
 * library has no fitting component, Codex builds it and adds it to the library;
 * content/WORKFLOW.md runbook, content/EDITING_SPEC.md#professional-motion-system).
 *
 * `meaningVisualPreflight` runs BEFORE paid voice in content:make and
 * prepare_today_video: when a slide form has no meaning visual it writes the
 * Codex brief review/<id>/meaning-visuals-codex-brief.md and returns stage
 * `meaning-visuals-required`. `assertMeaningVisualsCovered` is the render gate.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "./lib.mjs";
import { meaningCoverage } from "./meaning-visual-plan.mjs";
import { proMotionActive } from "./pro-motion-plan.mjs";

export const MEANING_VISUALS_STAGE = "meaning-visuals-required";
export const MEANING_VISUALS_BRIEF = "meaning-visuals-codex-brief.md";

const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

/** Coverage of the lesson's motion slides, or null when the lesson is not professional-motion. */
export async function lessonMeaningCoverage(episode, root = PROJECT_ROOT) {
  const proMotion = (await readJson(path.join(root, "content", "visual-system.json"))).proMotion;
  if (!proMotionActive(episode, proMotion)) return null;
  const lexicon = await readJson(path.join(root, "content", "meaning-visuals.json"));
  return meaningCoverage((episode.scenes ?? []).map((scene) => ({ id: scene.id, kind: scene.kind, beats: scene.motionBeats ?? [] })), lexicon);
}

const beatCopy = (episode, entry) => (episode.scenes ?? []).find((scene) => scene.id === entry.sceneId)
  ?.motionBeats?.find((beat) => beat.id === entry.beatId)?.visual ?? {};

/** The Codex brief for the forms the library cannot show yet (pure; tested). */
export function meaningVisualsBrief(episode, missing) {
  const rows = missing.map((entry) => {
    const copy = beatCopy(episode, entry);
    return `| ${entry.sceneId} | ${entry.beatId} | ${entry.template} | ${entry.text} | ${copy.pinyin ?? ""} | ${copy.meaning ?? ""} |`;
  });
  return `# Meaning visuals to build — ${episode.id}

These motion-slide forms have no meaning visual in the library. Build each one, add it to the
library so every later lesson can reuse it, and rerun preparation. Rules:
content/EDITING_SPEC.md#professional-motion-system (item 3) and content/WORKFLOW.md (runbook).

| Scene | Beat | Slide | Form | Pinyin | Meaning |
|---|---|---|---|---|---|
${rows.join("\n")}

## How (in this order, smallest change that shows the meaning)

1. **An existing icon or stage fits** → add the word to \`content/meaning-visuals.json\`
   (\`objects\`/\`icons\` for a thing or word, \`comparisons\` for an adjective with a
   component and illustrative values, \`roles\` for a person = an HSK AI cast member,
   \`positions\`, \`measures\`, \`modals\`, \`degrees\`, \`times\`).
2. **No icon shows it** → draw a new original animated icon in
   \`src/pro-motion/MeaningIcons.tsx\` (100×100 grid, frame-driven motion on \`age\`, the
   palette constants there) and add its kind to \`MEANING_ICON_KINDS\` in
   \`scripts/meaning-visual-plan.mjs\` and \`scripts/meaning-visual-plan.d.mts\`; then map the word to it.
3. **The sentence pattern is new** (no stage tells its meaning) → add the pattern to
   \`sentenceMeaning\` in \`scripts/meaning-visual-plan.mjs\` (+ its type in the .d.mts), draw its
   animated stage in \`src/pro-motion/MeaningStages.tsx\` (values count up from zero, things
   move into place, the narrated word lights its part) and add a test case in
   \`scripts/meaning-visual-plan.test.mjs\`.

Only original drawings: no downloaded or copied assets, no people — a person is always an
HSK AI cast member (panda, dragon, crane, monkey, rabbit). Never change saved voice or frames.

## Done when

- \`node scripts/meaning-visual-check.mjs ${episode.id} --strict\` exits 0;
- \`node --test scripts/meaning-visual-plan.test.mjs scripts/pro-motion-plan.test.mjs\`,
  \`npx tsc --noEmit -p . --types web --lib es2023,dom\` and \`npx eslint src/pro-motion\` pass;
- a sample of each new form is in \`SAMPLES\` of \`src/pro-motion/MeaningGallery.tsx\`, the gallery is
  rendered (\`npx remotion render src/index.ts HSKAI-MeaningGallery review/meaning-gallery.mp4 --scale 0.5\`)
  and you LOOKED at each new visual: it shows the meaning, nothing overlaps the formula or
  chips, motion is smooth;
- then rerun preparation. Commit the library change with the lesson.
`;
}

/** Production preflight, run BEFORE paid voice. */
export async function meaningVisualPreflight(episode, { root = PROJECT_ROOT } = {}) {
  const coverage = await lessonMeaningCoverage(episode, root);
  if (!coverage) return { required: false, ready: true };
  if (!coverage.missing.length) return { required: true, ready: true, covered: coverage.covered.length };
  const file = path.join(root, "review", episode.id, MEANING_VISUALS_BRIEF);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, meaningVisualsBrief(episode, coverage.missing));
  const briefPath = path.relative(root, file);
  return { required: true, ready: false, stage: MEANING_VISUALS_STAGE, briefPath,
    missing: coverage.missing.map((entry) => `${entry.sceneId}/${entry.beatId}: ${entry.text}`),
    nextAgentAction: `Codex task: build every meaning visual listed in ${briefPath} (lexicon entry, new animated icon or new sentence stage), add it to the library, pass node scripts/meaning-visual-check.mjs ${episode.id} --strict and the tests, render and LOOK at HSKAI-MeaningGallery, then rerun preparation.` };
}

/** Render gate: every motion slide of a professional-motion lesson has its meaning visual. */
export async function assertMeaningVisualsCovered(episode, { root = PROJECT_ROOT } = {}) {
  const coverage = await lessonMeaningCoverage(episode, root);
  if (coverage?.missing.length)
    throw new Error(`${MEANING_VISUALS_STAGE}: ${coverage.missing.map((entry) => `${entry.sceneId}/${entry.text}`).join(", ")} ` +
      `have no meaning visual. Build them (node scripts/meaning-visual-check.mjs ${episode.id}; content/WORKFLOW.md) before render.`);
}
