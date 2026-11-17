/**
 * Meaning-visual coverage of one lesson (content/EDITING_SPEC.md#professional-motion-system):
 * lists every motion slide and the animated stage or icon it gets. Forms the
 * library cannot show yet are listed under `missing`; Codex builds them and adds
 * them to the library (brief: scripts/meaning-visual-preflight.mjs, content/WORKFLOW.md).
 *
 *   node scripts/meaning-visual-check.mjs <episode-id> [--strict]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { meaningCoverage } from "./meaning-visual-plan.mjs";

const [id] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!id) { console.error("Usage: node scripts/meaning-visual-check.mjs <episode-id> [--strict]"); process.exit(2); }
const root = fileURLToPath(new URL("..", import.meta.url));
const episode = JSON.parse(fs.readFileSync(path.join(root, "content/episodes", id + ".json"), "utf8"));
const lexicon = JSON.parse(fs.readFileSync(path.join(root, "content/meaning-visuals.json"), "utf8"));
const scenes = episode.scenes.map((scene) => ({ id: scene.id, kind: scene.kind, beats: scene.motionBeats ?? [] }));
const report = meaningCoverage(scenes, lexicon);
console.log(JSON.stringify(report, null, 2));
if (report.missing.length) {
  console.error(`${report.missing.length} slide form(s) have no meaning visual yet: build each one (lexicon entry, new animated icon or new sentence stage) and add it to the library; content:make writes the brief review/${id}/meaning-visuals-codex-brief.md.`);
  if (process.argv.includes("--strict")) process.exit(1);
}
