import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ctaEndingFor, validateCtaEndings } from "./cta-endings.mjs";
import { composeLessonCta } from "./episode-cta-assembly.mjs";
import { preparePlatformCtaDraft, validatePlatformCtaConfig } from "./platform-cta.mjs";
import { validateCtaEpisode } from "./cta-lab.mjs";

const read = (rel) => JSON.parse(readFileSync(new URL("../" + rel, import.meta.url), "utf8"));
const labs = { ru: read("content/cta-lab.json"), tg: read("content/locales/tg/cta-lab.json") };
const lessons = { ru: read("content/episodes/ye-dou-placement-20261109.json"), tg: read("content/locales/tg/episodes/ye-dou-placement-20261109.json") };

test("both languages carry the owner-approved ad and serial endings (2026-11-09)", () => {
  for (const lab of Object.values(labs)) {
    assert.deepEqual(validateCtaEndings(lab), []);
    assert.deepEqual(validatePlatformCtaConfig(lab), []);
  }
  assert.equal(labs.ru.contentTypeEndings.endings.advertisement.copy, "HSK AI — китайский, когда он нужен.");
  assert.equal(labs.ru.contentTypeEndings.endings["series-final-part"].copy, "Подпишитесь — каждые выходные новая история на китайском.");
  assert.equal(labs.tg.contentTypeEndings.endings["series-next-part"].copy, "Обуна шавед, то қисми дуюмро аз даст надиҳед.");
});

test("the content type picks the ending; a serial part 1 of 2 promises part 2, the last part the weekend", () => {
  const lab = labs.ru;
  assert.equal(ctaEndingFor(lab, { contentType: "lesson" }), null);
  assert.equal(ctaEndingFor(lab, { contentType: "advertisement" }).kind, "advertisement");
  assert.equal(ctaEndingFor(lab, { contentType: "series-part", series: { id: "s", part: 1, totalParts: 2 } }).kind, "series-next-part");
  assert.equal(ctaEndingFor(lab, { contentType: "series-part", series: { id: "s", part: 2, totalParts: 2 } }).kind, "series-final-part");
  assert.throws(() => ctaEndingFor(lab, { contentType: "series-part", series: { id: "s", part: 2, totalParts: 3 } }), /promises part 2/);
  assert.throws(() => ctaEndingFor(lab, { contentType: "series-part" }), /series \{part,totalParts\}/);
  assert.equal(ctaEndingFor(lab, { contentType: "advertisement", date: "2026-11-05" }), null, "earlier items keep their registered CTA");
  assert.equal(ctaEndingFor(lab, { contentType: "advertisement", date: "2026-11-10" }).kind, "advertisement");
  const broken = structuredClone(lab);
  broken.contentTypeEndings.endings.advertisement.copy = "HSK AI — скачай по ссылке.";
  assert.throws(() => ctaEndingFor(broken, { contentType: "advertisement" }), /brand ending/);
});

test("lessons keep the platform CTA; ads and serial parts get their ending on every platform", () => {
  for (const [language, lab] of Object.entries(labs)) {
    const lesson = composeLessonCta(lessons[language], lab);
    assert.equal(lesson.cta, lab.offer.canonicalRussian);
    assert.equal(lesson.ctaEnding, undefined);

    for (const [contentType, series, kind] of [["advertisement", undefined, "advertisement"],
      ["series-part", { id: "s", part: 1, totalParts: 2 }, "series-next-part"],
      ["series-part", { id: "s", part: 2, totalParts: 2 }, "series-final-part"]]) {
      const episode = composeLessonCta(lessons[language], lab, { contentType, series });
      const ending = lab.contentTypeEndings.endings[kind];
      assert.equal(episode.ctaEnding, kind);
      assert.equal(episode.cta, ending.copy);
      assert.equal(episode.scenes.at(-1).narration, ending.copy);
      const check = validateCtaEpisode(episode, lab, { requireRegistration: false });
      assert.equal(check.valid, true, check.errors.join("\n"));
      for (const platform of ["youtube", "facebook", "tiktok"]) {
        const draft = preparePlatformCtaDraft(episode, lab, platform);
        assert.equal(draft.ctaPlatform, platform);
        assert.equal(draft.scenes.at(-1).narration, ending.copy, "the spoken ending and its voice are shared");
      }
      const tampered = structuredClone(episode);
      tampered.cta = tampered.scenes.at(-1).narration = lab.offer.canonicalRussian;
      assert.equal(validateCtaEpisode(tampered, lab, { requireRegistration: false }).valid, false);
    }
  }
});
