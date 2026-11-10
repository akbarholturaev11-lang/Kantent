import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withLanguage } from "./language-context.mjs";
import { getCalendarItem, getPlannedEpisode, narrationHash, PROJECT_ROOT } from "./lib.mjs";
import { sha256 } from "./voice-checkpoint.mjs";
import { createCtaExperiment, ctaExperimentMetadata, getActiveCtaCorrections } from "./cta-lab.mjs";

test("direct voice generation reuses an intact imported take before loading API credentials", { timeout: 30_000 }, async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-voice-reuse-"));
  try {
    await fs.cp(path.join(PROJECT_ROOT, "scripts"), path.join(fixture, "scripts"), {
      recursive: true,
      filter: (source) => !source.endsWith(".test.mjs"),
    });
    await fs.cp(path.join(PROJECT_ROOT, "content"), path.join(fixture, "content"), { recursive: true });
    await fs.symlink(path.join(PROJECT_ROOT, "node_modules"), path.join(fixture, "node_modules"));
    await fs.writeFile(path.join(fixture, "scripts/git-freshness.mjs"), "export function requireFreshGitMain(){return {remoteMainSha:'fixture'}};\n");
    await fs.writeFile(path.join(fixture, "scripts/published-evidence.mjs"), "export function assertNotPreviouslyPublished(){return []};\n");

    const item = await getCalendarItem("youdianr-vs-yidianr-price-20261111");
    let episode;
    await withLanguage("ru", async () => { episode = (await getPlannedEpisode(item.date)).episode; });
    // The imported take carries a registered CTA; register it in the fixture
    // lab only, so the test does not depend on a production registration.
    const labPath = path.join(fixture, "content/cta-lab.json");
    const lab = JSON.parse(await fs.readFile(labPath, "utf8"));
    const record = createCtaExperiment({
      lab, episode, id: `${episode.id}-voice-reuse-fixture`,
      hypothesis: "Fixture registration for the voice-reuse integration test.",
      acknowledgedCorrectionIds: getActiveCtaCorrections(lab, { episodeId: episode.id, formatId: "benefit-profile-link-download" }).map((rule) => rule.id),
    });
    lab.experiments.push(record);
    await fs.writeFile(labPath, `${JSON.stringify(lab, null, 2)}\n`);
    episode.ctaExperiment = ctaExperimentMetadata(record);
    const profile = JSON.parse(await fs.readFile(path.join(fixture, "content/voice-profile.json"), "utf8"));
    const bytes = Buffer.from("verified first take");
    Object.assign(episode, {
      voiceProvider: profile.provider,
      voiceProfileId: profile.profileId,
      voiceLocale: profile.locale,
      audioSrc: `generated/${episode.id}/voice.mp3`,
      audioSha256: sha256(bytes),
      captionSource: "gemini-word-timestamps",
      captions: [{ text: episode.scenes[0].narration.split(/\s+/)[0], startMs: 0, endMs: 200 }],
    });
    episode.voiceTextHash = narrationHash(episode);
    const review = path.join(fixture, "review", episode.id);
    await fs.mkdir(review, { recursive: true });
    await fs.writeFile(path.join(review, "episode.json"), `${JSON.stringify(episode, null, 2)}\n`);
    await fs.writeFile(path.join(review, "status.json"), JSON.stringify({ stage: "voice-and-captions-imported" }));
    const audioPath = path.join(fixture, "public", episode.audioSrc);
    await fs.mkdir(path.dirname(audioPath), { recursive: true });
    await fs.writeFile(audioPath, bytes);

    const result = spawnSync(process.execPath, [path.join(fixture, "scripts/generate-voice-gemini.mjs"), episode.id], {
      cwd: fixture,
      encoding: "utf8",
      env: { ...process.env, HSK_CONTENT_LANGUAGE: "ru", OPENROUTER_API_KEY: "", GEMINI_API_KEY: "" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /reusing the first take without TTS\/STT calls/);
    assert.deepEqual(await fs.readFile(audioPath), bytes);
    await assert.rejects(fs.access(path.join(review, "gemini-production")), { code: "ENOENT" });
    await assert.rejects(fs.access(path.join(review, "tts-input.txt")), { code: "ENOENT" });
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
