import assert from "node:assert/strict";
import test from "node:test";
import { withLanguage } from "./language-context.mjs";
import { CALENDAR_PATH, getPlannedEpisode, readJson } from "./lib.mjs";
import { readCtaLab, validateCtaEpisode } from "./cta-lab.mjs";

// Data-driven since the owner's 2026-11-10 reschedule renamed planned items:
// every planned item dated under the current CTA rules (from
// contentTypeEndings.effectiveFromDate) that already has a CTA registration
// must compose to a valid, registered single trailing CTA scene. Older planned
// rows keep the registration of their own era (owner action A5).
for (const language of ["ru", "tg"]) {
  test(`${language} planned items with a CTA registration compose to a valid registered CTA`, async () => {
    await withLanguage(language, async () => {
      const lab = await readCtaLab();
      const registered = new Set(Object.values(lab.experiments ?? {}).flat()
        .filter((entry) => entry && typeof entry === "object").map((entry) => entry.episodeId));
      const calendar = await readJson(CALENDAR_PATH);
      const from = lab.contentTypeEndings?.effectiveFromDate ?? "0000-00-00";
      for (const item of calendar.items.filter((row) => row.status === "planned" && row.date >= from && registered.has(row.id))) {
        const { episode } = await getPlannedEpisode(item.date);
        if (episode.id !== item.id) continue;
        const validation = validateCtaEpisode(episode, lab);
        assert.equal(validation.valid, true, `${item.id}: ${validation.errors.join("\n")}`);
        assert.equal(episode.ctaExperiment?.episodeId ?? item.id, item.id);
        assert.equal(episode.scenes.filter((scene) => scene.kind === "cta").length, 1, item.id);
        assert.equal(episode.scenes.at(-1)?.kind, "cta", item.id);
      }
    });
  });
}
