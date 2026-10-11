import { getPlannedEpisode } from "./lib.mjs";
import { createCtaExperiment, getActiveCtaCorrections, readCtaLab } from "./cta-lab.mjs";

// Read-only owner-authorized registration preview for one unique re-cut.
// Run before committing the single immutable CTA entry to cta-lab.json.
// Never registers/publishes a CTA automatically.
const episodeId="zai-location-cinematic-v2";
const {episode}=await getPlannedEpisode("2026-10-13");
if(episode.id!==episodeId || episode.pilotRemakeOfEpisodeId!=="zai-location" ||
   episode.creativeFormatId!=="street-situation" ||
   episode.scenes.filter(s=>s.kind==="cta").length!==1)
  throw Error("Recut source/format/central CTA mismatch");
const lab=await readCtaLab();
const existing=lab.experiments.filter(e=>e.episodeId===episodeId).at(-1);
if(existing && episode.ctaExperiment?.id===existing.id) {
  console.log("RECUT_CTA_REGISTRATION_ALREADY_VALID");
} else {
  const formatId="benefit-profile-link-download";
  const acknowledgedCorrectionIds=getActiveCtaCorrections(lab,{
    episodeId,formatId
  }).map(c=>c.id);
  const record=createCtaExperiment({
    lab, episode, id:existing ? "zai-location-cinematic-v2-cta-profile-link-v2" : "zai-location-cinematic-v2-cta-profile-link-v1",
    formatId,
    hypothesis:"Distinct Cinematic Street Situation recut retains the pre-approved profile-link website download CTA; no changes to copy, screens or placement.",
    changedVariable:"baseline",
    comparisonGroupId:"hsk-profile-link-download-v1",
    acknowledgedCorrectionIds,
    registeredAt:existing ? "2026-10-11T04:20:00.000Z" : "2026-10-11T03:30:00.000Z",
    supersedes:existing?.id ?? null
  });
  console.log("RECUT_CTA_JSON="+JSON.stringify(record));
}
