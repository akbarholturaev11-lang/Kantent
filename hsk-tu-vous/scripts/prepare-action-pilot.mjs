import fs from "node:fs/promises";
import path from "node:path";
import {getPlannedEpisode, reviewDir, writeJson, writeStatus, validateEpisode} from "./lib.mjs";
import {requireFreshGitMain} from "./git-freshness.mjs";
import {assertNotPreviouslyPublished} from "./published-evidence.mjs";
import {readCtaLab,writeCtaLab,createCtaExperiment,ctaExperimentMetadata,getActiveCtaCorrections} from "./cta-lab.mjs";
import {validateActionLesson} from "./action-design-plan.mjs";

const planFile = process.argv[2];
if (!planFile) throw Error("Provide an owner-authorized pilot plan JSON path.");
const plan = JSON.parse(await fs.readFile(planFile,"utf8"));
const sourceRevision = requireFreshGitMain();
const {episode} = await getPlannedEpisode(plan.date);
if (episode.id !== plan.episodeId) throw Error("Pilot does not match the canonical calendar.");
assertNotPreviouslyPublished(episode.id);
const folder = reviewDir(episode.id);
try { await fs.access(path.join(folder,"episode.json")); throw Error("Existing working copy must be reviewed explicitly; pilot preparation never overwrites it."); }
catch (error) { if(error.code!=="ENOENT") throw error; }
episode.motionDesign = true;
episode.motionDesignStyle = "explain-actions-v1";
for (const scene of episode.scenes.filter(s=>s.kind!=="cta")) {
  const planned=plan.scenes.find(s=>s.sceneId===scene.id);
  if(!planned) throw Error("Missing pilot scene "+scene.id);
  if(planned.narration) scene.narration=planned.narration;
  scene.motionBeats=planned.beats;
  scene.captionStyleId="highlight";
  scene.editPlan=planned.editPlan;
}
const coverage=validateActionLesson(episode);
episode.actionPilot={planFile,stage:"review-only",defaultRolloutApproved:false};
const lab=await readCtaLab();
delete episode.ctaExperiment;
const registration=createCtaExperiment({lab,episode,id:episode.id+"-cta-action-pilot-v1",
  hypothesis:"Owner-authorized reusable meaning-linked action pilot. Preserve the central CTA; inspect the real review video before any default rollout or publication.",
  acknowledgedCorrectionIds:getActiveCtaCorrections(lab,{episodeId:episode.id,formatId:"benefit-profile-link-download"}).map(c=>c.id)});
episode.ctaExperiment=ctaExperimentMetadata(registration);
lab.experiments.push(registration);
validateEpisode(episode);
await writeCtaLab(lab);
await writeJson(path.join(folder,"episode.json"),episode);
await writeStatus(episode.id,{stage:"plan-ready",sourceRevision,updatedAt:new Date().toISOString()});
await writeJson(path.join(folder,"action-pilot-plan.json"),{...plan,coverage});
console.log(JSON.stringify({episodeId:episode.id,coverage,voiceWords:episode.scenes.map(s=>s.narration).join(" ").split(/\s+/).length}));
