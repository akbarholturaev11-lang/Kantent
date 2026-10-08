import { ctaExperimentMetadata, validateCtaEpisode } from "./cta-lab.mjs";
import { getPlatformCtaStatus } from "./platform-cta.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Combine a CTA-free plan with the single canonical CTA Lab at the moment a
 * working episode is materialized. No canonical lesson or ledger is mutated.
 *
 * Previous registered CTA snapshots are reused ONLY if current copy, visual
 * beats, lesson context, corrections and rule version all still validate.
 * Otherwise explicit re-registration remains mandatory before TTS/render.
 */
export function composeLessonCta(baseEpisode, lab, { platform = "instagram" } = {}) {
  if (!baseEpisode || !Array.isArray(baseEpisode.scenes))
    throw new Error("CTA assembly needs a lesson with scenes.");
  const existing = baseEpisode.scenes.filter((scene) => scene.kind === "cta");
  if (existing.length > 1)
    throw new Error("Lesson has multiple CTA scenes; do not guess which version to use.");
  if (existing.length === 1) {
    // Legacy dated/published snapshots are never rewritten here.
    return clone(baseEpisode);
  }
  if (Object.prototype.hasOwnProperty.call(baseEpisode, "cta") ||
      Object.prototype.hasOwnProperty.call(baseEpisode, "ctaExperiment")) {
    throw new Error("CTA-free lesson contains stale CTA metadata. Remove it from the unapproved plan before assembling.");
  }
  const status = getPlatformCtaStatus(lab, platform);
  if (!status.readyForDraft)
    throw new Error(platform + " CTA is not approved: " + status.missing.join(", "));
  const variant = lab.platformVariants[platform];
  const template = variant.sceneTemplate;
  if (!template || template.kind !== "cta" || template.id !== "cta" ||
      !Array.isArray(template.visualBeats) || template.visualBeats.length === 0) {
    throw new Error(platform + " does not have a canonical CTA sceneTemplate.");
  }
  if ("narration" in template || "cta" in template || "ctaExperiment" in template)
    throw new Error("CTA template must not duplicate narration or immutable registration.");
  const episode = clone(baseEpisode);
  episode.cta = status.copy;
  episode.scenes.push({ ...clone(template), narration: status.copy });
  episode.ctaPlatform = platform;
  // CTA metadata is a concrete-version snapshot, not an editable CTA source.
  // Rebind to an identical existing preregistration when safe, without
  // changing any historical ledger entries.
  const candidates = [...lab.experiments].reverse()
    .filter((experiment) => experiment.episodeId === episode.id);
  for (const entry of candidates) {
    episode.ctaExperiment = ctaExperimentMetadata(entry);
    if (validateCtaEpisode(episode, lab).valid) return episode;
  }
  delete episode.ctaExperiment;
  return episode;
}
