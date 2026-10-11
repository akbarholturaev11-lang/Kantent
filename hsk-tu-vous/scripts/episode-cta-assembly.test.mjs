import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCtaLab, validateCtaEpisode } from "./cta-lab.mjs";
import { assertCanonicalLessonSource, composeLessonCta } from "./episode-cta-assembly.mjs";
import { getPlannedEpisode, validateEpisode } from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lab = await readCtaLab();
const future = [
  ["2026-10-09", "zhe-na-ge"],
  ["2026-10-12", "zai-location"],
  ["2026-10-14", "ji-vs-duoshao"],
  ["2026-10-16", "xiang-vs-yao"],
  ["2026-10-19", "time-word-order"],
  ["2026-10-21", "bu-vs-mei"],
  ["2026-10-23", "le-first-look"],
];

for (const [date, id] of future) {
  test("planned " + id + " is CTA-free in source and loads central CTA on demand", async () => {
    const source = JSON.parse(await fs.readFile(
      path.join(root, "content/episodes", id + ".json"), "utf8",
    ));
    assert.doesNotThrow(() => assertCanonicalLessonSource(source, lab));
    assert.equal("cta" in source, false);
    assert.equal("ctaExperiment" in source, false);
    assert.ok(source.scenes.every((scene) => scene.kind !== "cta"));
    const { episode } = await getPlannedEpisode(date);
    assert.equal(episode.cta, lab.offer.canonicalRussian);
    assert.equal(episode.ctaPlatform, "instagram");
    assert.equal(episode.scenes.filter((scene) => scene.kind === "cta").length, 1);
    assert.equal(episode.scenes.at(-1).narration, lab.offer.canonicalRussian);
    assert.deepEqual(episode.scenes.at(-1).visualBeats,
      lab.platformVariants.instagram.sceneTemplate.visualBeats);
    validateEpisode(episode);
    const ctaValidation = validateCtaEpisode(episode, lab);
    if (id === "le-first-look") {
      assert.equal(ctaValidation.valid, false,
        "Edited narration/cards must invalidate the previously registered CTA snapshot");
    } else {
      assert.equal(ctaValidation.valid, true,
        "Unchanged lesson should retain its registered central CTA snapshot");
    }
    const after = JSON.parse(await fs.readFile(
      path.join(root, "content/episodes", id + ".json"), "utf8",
    ));
    assert.deepEqual(after, source, "Loading must never overwrite the lesson plan");
  });
}

test("an unregistered new CTA text is populated from central source but needs fresh registration", async () => {
  const source = JSON.parse(await fs.readFile(
    path.join(root, "content/episodes", "zhe-na-ge.json"), "utf8",
  ));
  const modified = structuredClone(lab);
  modified.offer.canonicalRussian =
    "Попробуй HSK AI. Зайди в профиль, открой ссылку, а затем скачай приложение с сайта.";
  const assembled = composeLessonCta(source, modified);
  assert.equal(assembled.cta, modified.offer.canonicalRussian);
  assert.equal(assembled.ctaExperiment, undefined, "never reuse stale registration");
  assert.equal(validateCtaEpisode(assembled, modified).valid, false);
});

test("pending TikTok cannot assemble, while approved YouTube uses the canonical CTA and replaced frames", async () => {
  const source = JSON.parse(await fs.readFile(
    path.join(root, "content/episodes", "zhe-na-ge.json"), "utf8",
  ));
  assert.throws(() => composeLessonCta(source, lab, { platform: "tiktok" }), /not approved/);
  const assembled = composeLessonCta(source, lab, { platform: "youtube" });
  assert.equal(assembled.cta, lab.offer.canonicalRussian);
  assert.equal(assembled.ctaPlatform, "youtube");
  const scene = assembled.scenes.find((item) => item.kind === "cta");
  assert.equal(scene.narration, lab.offer.canonicalRussian);
  assert.equal(scene.visualBeats[1].screenImage, "cta/youtube-telegram-profile.jpg");
  assert.equal(scene.visualBeats[2].screenImage, "cta/youtube-open-link-browser.jpg");
  assert.equal(validateCtaEpisode(assembled, lab, { requireRegistration: false }).errors
    .some((error) => error.includes("CTA visuals")), false);
});

test("old registered source keeps its historical CTA snapshot", async () => {
  const old = JSON.parse(await fs.readFile(
    path.join(root, "content/episodes", "xiexie-20261001.json"), "utf8",
  ));
  const assembled = composeLessonCta(old, lab);
  assert.deepEqual(assembled, old);
  assert.notEqual(assembled, old);
});

test("a stray CTA value without a CTA scene fails rather than masking stale state", async () => {
  const source = JSON.parse(await fs.readFile(
    path.join(root, "content/episodes", "zhe-na-ge.json"), "utf8",
  ));
  source.cta = "old independent CTA";
  assert.throws(() => composeLessonCta(source, lab), /stale CTA metadata/);
});

test("future source with hand-written CTA fails the canonical source guard", async () => {
  const source = JSON.parse(await fs.readFile(
    path.join(root, "content/episodes", "zhe-na-ge.json"), "utf8",
  ));
  source.cta = lab.offer.canonicalRussian;
  assert.throws(() => assertCanonicalLessonSource(source, lab), /must not embed CTA/);
  delete source.cta;
  source.scenes.push({ id: "cta", kind: "cta" });
  assert.throws(() => assertCanonicalLessonSource(source, lab), /must not embed CTA/);
});

test("older legacy lesson source remains exempt from future source guard", async () => {
  const source = JSON.parse(await fs.readFile(
    path.join(root, "content/episodes", "xiexie-20261001.json"), "utf8",
  ));
  assert.doesNotThrow(() => assertCanonicalLessonSource(source, lab));
});
