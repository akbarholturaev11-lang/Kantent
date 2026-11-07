import assert from "node:assert/strict";
import test from "node:test";
import { withLanguage } from "./language-context.mjs";
import { getCalendarItem, getPlannedEpisode } from "./lib.mjs";
import { readCtaLab, validateCtaEpisode } from "./cta-lab.mjs";

const expected = {
  ru: {
    "known-book-zai-20261101": "known-book-zai-20261101-ru-cta-v1",
    "zhuozi-you-book-20261031": "zhuozi-you-book-20261031-ru-cta-v1",
    "haishi-vs-huozhe-tea-20261102": "haishi-vs-huozhe-tea-20261102-ru-cta-v2",
  },
  tg: {
    "known-book-zai-20261101": "known-book-zai-20261101-tg-cta-v1",
    "zhuozi-you-book-20261031": "zhuozi-you-book-20261031-tg-cta-v1",
    "haishi-vs-huozhe-tea-20261102": "haishi-vs-huozhe-tea-20261102-tg-cta-v2",
  },
};

for (const [language, episodes] of Object.entries(expected)) {
  for (const [id, registrationId] of Object.entries(episodes)) {
    test(`${language} ${id} uses a valid registration for current CTA copy and lesson context`, async () => {
      await withLanguage(language, async () => {
        const item = await getCalendarItem(id);
        const { episode } = await getPlannedEpisode(item.date);
        const lab = await readCtaLab();
        const validation = validateCtaEpisode(episode, lab);
        assert.equal(validation.valid, true, validation.errors.join("\n"));
        assert.equal(episode.ctaExperiment?.id, registrationId);
        assert.equal(episode.scenes.filter((scene) => scene.kind === "cta").length, 1);
        assert.equal(episode.scenes.at(-1)?.kind, "cta");
      });
    });
  }
}
