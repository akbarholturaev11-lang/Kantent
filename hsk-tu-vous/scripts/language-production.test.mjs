import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  activeLanguage, withLanguage, generatedVoicePath, languageSettings,
  lessonSourceHash, assertLocalizedLessonSource, languageEnvironment,
} from "./language-context.mjs";
import { requestedLanguages, prepareLanguagePackages } from "./bilingual-production.mjs";
import { PROJECT_ROOT, getPlannedEpisode, readVoiceProfile, reviewDir, invalidateReviewArtifacts, normalizeEpisode } from "./lib.mjs";
import { readCtaLab, validateCtaEpisode } from "./cta-lab.mjs";
import { validateActionLesson } from "./action-design-plan.mjs";
import { resolveMotionBeats } from "./motion-design-plan.mjs";
import { createServer } from "./mcp-server.mjs";

test("default preparation requests both languages and reports a failed language without hiding a ready one", async () => {
  assert.deepEqual(requestedLanguages(), ["ru", "tg"]);
  assert.deepEqual(requestedLanguages("tg"), ["tg"]);
  assert.throws(() => requestedLanguages("xx"), /Language/);
  const scopes = [];
  const result = await prepareLanguagePackages(requestedLanguages(), async language => {
    scopes.push(activeLanguage());
    if (language === "tg") throw new Error("sample model decision required");
    return { stage: "ready-for-review", files: { video: "real-ru.mp4" } };
  });
  assert.deepEqual(scopes, ["ru", "tg"]);
  assert.equal(result.complete, false);
  assert.equal(result.stage, "partial");
  assert.match(result.variants.tg.error, /model decision/);
  assert.equal(result.variants.ru.files.video, "real-ru.mp4");
  const blocked = await prepareLanguagePackages(["tg"], () => ({ stage: "action-plan-required" }));
  assert.equal(blocked.complete, false);
  assert.equal(blocked.stage, "blocked");
});

test("concurrent MCP scopes select independent profiles, paths, labs and child environments", async () => {
  const result = await Promise.all(["ru", "tg"].map(language => withLanguage(language, async () => {
    await new Promise(resolve => setImmediate(resolve));
    return { language: activeLanguage(), folder: reviewDir("language-test"), assets: generatedVoicePath("language-test"),
      profile: await readVoiceProfile(), lab: await readCtaLab(), env: languageEnvironment().HSK_CONTENT_LANGUAGE };
  })));
  assert.equal(result[0].profile.locale, "ru-RU");
  assert.equal(result[1].profile.locale, "tg-TJ");
  assert.equal(result[1].language, "tg");
  assert.equal(result[1].env, "tg");
  assert.notEqual(result[0].lab.offer.id, result[1].lab.offer.id);
  assert.notEqual(result[0].folder, result[1].folder);
  assert.ok(!result[1].assets.startsWith(result[0].assets + "/"));
  assert.equal(activeLanguage(), process.env.HSK_CONTENT_LANGUAGE ?? "ru");
});

test("invalidating Russian audio or exports cannot remove Tajik artifacts", async () => {
  const id = `language-isolation-${process.pid}`;
  const ru = await withLanguage("ru", () => reviewDir(id));
  const tg = await withLanguage("tg", () => reviewDir(id));
  const assets = Object.fromEntries(["ru", "tg"].map(language => [language, path.join(PROJECT_ROOT, "public", generatedVoicePath(id, language))]));
  try {
    for (const folder of [ru, tg, assets.ru, assets.tg]) {
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(path.join(folder, "video.mp4"), "isolation sentinel");
    }
    await withLanguage("ru", () => invalidateReviewArtifacts(id, { narrationChanged: true }));
    await fs.access(path.join(tg, "video.mp4"));
    await fs.access(path.join(assets.tg, "video.mp4"));
    await assert.rejects(fs.access(assets.ru), { code: "ENOENT" });
  } finally {
    await fs.rm(ru, { recursive: true, force: true });
    await fs.rm(assets.ru, { recursive: true, force: true });
    await fs.rm(assets.tg, { recursive: true, force: true });
  }
});

test("translation source binding rejects changed lessons and never fills Tajik fields from Russian", () => {
  const canonical = { id: "source-test", date: "2026-10-26", title: "Shared lesson" };
  const localized = { ...canonical, languageCode: "tg-TJ", localization: { language: "tg", sourceEpisodeId: canonical.id, sourceHash: lessonSourceHash(canonical) } };
  assert.doesNotThrow(() => assertLocalizedLessonSource(localized, canonical, "tg"));
  assert.throws(() => assertLocalizedLessonSource(localized, { ...canonical, title: "Changed" }, "tg"), /LOCALIZATION_REQUIRED/);
  const missing = normalizeEpisode({ languageCode: "tg-TJ", titleRu: "Russian-only title", scenes: [{ narrationRu: "Russian-only voice" }] });
  assert.equal(missing.title, undefined);
  assert.equal(missing.scenes[0].narration, undefined);
});

test("localized upcoming lessons have complete actions with exact translated cues and valid central CTA", async () => {
  await withLanguage("tg", async () => {
    for (const date of ["2026-10-26", "2026-10-28"]) {
      const { episode } = await getPlannedEpisode(date);
      assert.equal(episode.languageCode, "tg-TJ");
      assert.ok(validateActionLesson(episode).actionCount >= 10);
      const source = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "content/episodes", episode.id + ".json"), "utf8"));
      const hanzi = value => value.join(" ").match(/\p{Script=Han}+/gu);
      assert.deepEqual(hanzi(episode.examples), hanzi(source.examples));
      for (const scene of episode.scenes.filter(scene => scene.kind !== "cta")) {
        const tokens = scene.narration.match(/[\p{L}\p{M}\p{N}]+/gu);
        const testCues = tokens.map((text, i) => ({ text, startMs: i * 200, endMs: i * 200 + 180 }));
        assert.equal(resolveMotionBeats({ ...scene, startMs: 0, endMs: tokens.length * 200 }, testCues, 30, "tg-TJ").length, scene.motionBeats.length);
      }
      // Synthetic cues above test authored matching only, never production audio.
      assert.equal(validateCtaEpisode(episode, await readCtaLab(), { requireRegistration: false }).valid, true);
    }
  });
});

test("Tajik motion cues preserve ё instead of matching another letter", () => {
  const scene = { id: "tajik-cue", startMs: 0, endMs: 1000, motionBeats: [{ id: "cue", kind: "phrase", cueText: "ёд" }] };
  assert.throws(() => resolveMotionBeats(scene, [{ text: "ед", startMs: 100, endMs: 300 }], 30, "tg-TJ"), /missing/);
  assert.equal(resolveMotionBeats(scene, [{ text: "ёд", startMs: 100, endMs: 300 }], 30, "tg-TJ")[0].startFrame, 3);
});

test("MCP exposes both-language production and separately scoped read/approval schemas", async () => {
  const server = createServer();
  try {
    const tools = server._registeredTools;
    assert.ok(tools.prepare_today_video.inputSchema.safeParse({ language: "all" }).success);
    assert.ok(tools.prepare_video_for_date.inputSchema.safeParse({ date: "2026-10-26", language: "all" }).success);
    const results = await Promise.all(["ru", "tg"].map(language => tools.get_voice_profile.handler({ language })));
    assert.equal(results[0].structuredContent.profile.locale, "ru-RU");
    assert.equal(results[1].structuredContent.profile.locale, "tg-TJ");
    const tgProfile = results[1].structuredContent.profile;
    assert.equal(results[1].structuredContent.sampleAudioPath, tgProfile.sampleAudio ? path.join(PROJECT_ROOT, tgProfile.sampleAudio) : null);
    assert.equal(tools.approve_voice_profile.inputSchema.safeParse({ language: "all", confirmation: "Tasdiqlayman" }).success, false);
  } finally { await server.close(); }
});
