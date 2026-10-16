import { getPlannedEpisode } from "./lib.mjs";
import { createCtaExperiment, getActiveCtaCorrections, readCtaLab, validateCtaEpisode } from "./cta-lab.mjs";

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
// The working episode may be bound to an older *valid* immutable version.
// Other platform registrations can appear later in the ledger, so the last
// experiment for the episode is not necessarily its active CTA registration.
const bound = lab.experiments.find(e =>
  e.episodeId === episodeId && e.id === episode.ctaExperiment?.id
);
if (bound) {
  const validation = validateCtaEpisode(episode, lab);
  if (!validation.valid) throw Error(validation.errors.join("\n"));
  console.log("RECUT_CTA_REGISTRATION_ALREADY_VALID");
} else {
  // Only preview a *new*, unused version. Never overwrite ledger history or
  // supersede a YouTube variant when previewing the default Instagram CTA.
  const formatId = "benefit-profile-link-download";
  const prefix = `${episodeId}-cta-profile-link-v`;
  const existing = [...lab.experiments].reverse().find(e =>
    e.episodeId === episodeId && /^zai-location-cinematic-v2-cta-profile-link-v\d+$/.test(e.id)
  );
  const usedIds = new Set(lab.experiments.map(e => e.id));
  let version = 1;
  while (usedIds.has(`${prefix}${version}`)) version++;
  const acknowledgedCorrectionIds = getActiveCtaCorrections(lab, {
    episodeId, formatId
  }).map(c => c.id);
  const record = createCtaExperiment({
    lab, episode, id: `${prefix}${version}`,
    formatId,
    hypothesis: "Distinct Cinematic Street Situation recut retains the pre-approved profile-link website download CTA; no changes to copy, screens or placement.",
    changedVariable: "baseline",
    comparisonGroupId: "hsk-profile-link-download-v1",
    acknowledgedCorrectionIds,
    registeredAt: new Date().toISOString(),
    supersedes: existing?.id ?? null
  });
  console.log("RECUT_CTA_JSON=" + JSON.stringify(record));
}
