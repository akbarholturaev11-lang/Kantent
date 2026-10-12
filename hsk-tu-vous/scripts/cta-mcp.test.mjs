import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const write = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value));
};

// All writes happen in a fixture checkout; never alter the owner's ledger or media.
test(
  "stdio CTA tools preserve correction/version history and stop stale production",
  { timeout: 30000 },
  async () => {
    const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-cta-mcp-"));
    let child;
    try {
      await fs.cp(path.join(project, "scripts"), path.join(fixture, "scripts"), {
        recursive: true,
        filter: (source) => !source.endsWith(".test.mjs"),
      });
      // This isolated fixture has no GitHub remote; keep this test focused on
      // CTA invalidation rather than the separate live-remote freshness gate.
      await fs.writeFile(
        path.join(fixture, "scripts/git-freshness.mjs"),
        "export function requireFreshGitMain() { return { checkedAt: new Date().toISOString() }; }\n",
      );
      await fs.symlink(
        path.join(project, "node_modules"),
        path.join(fixture, "node_modules"),
      );
      const calendar = await read(path.join(project, "content/calendar.json"));
      const item = calendar.items[0];
      calendar.items = [item];
      const episode = await read(
        path.join(project, "content", item.episodeFile),
      );
      const cta = episode.scenes.find((scene) => scene.kind === "cta");
      cta.narration = "Сохраните урок и напишите ответ.";
      episode.cta = cta.narration;
      episode.voiceProvider = "text-to-speech-online";
      episode.voiceProfileId = "ru-dmitry-v1";
      delete episode.ctaExperiment;
      const lab = await read(path.join(project, "content/cta-lab.json"));
      Object.assign(lab, {
        revision: 0,
        experiments: [],
        readbacks: [],
        promotions: [],
      });
      await write(path.join(fixture, "content/calendar.json"), calendar);
      await write(path.join(fixture, "content", item.episodeFile), episode);
      await write(path.join(fixture, "content/cta-lab.json"), lab);
      await write(
        path.join(fixture, "content/voice-profile.json"),
        await read(path.join(project, "content/voice-profile.json")),
      );
      await write(
        path.join(fixture, "content/visual-system.json"),
        await read(path.join(project, "content/visual-system.json")),
      );
      const folder = path.join(fixture, "review", item.id);
      child = spawn(
        process.execPath,
        [path.join(fixture, "scripts/mcp-server.mjs")],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let sequence = 0;
      let buffer = "";
      let stderr = "";
      const pending = new Map();
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.stdout.on("data", (chunk) => {
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          if (!line.trim()) continue;
          const response = JSON.parse(line);
          const wait = pending.get(response.id);
          if (wait) {
            pending.delete(response.id);
            wait.resolve(response);
          }
        }
      });
      child.on("exit", () => {
        for (const wait of pending.values())
          wait.reject(new Error(`MCP exited: ${stderr}`));
      });
      const rpc = (method, params) =>
        new Promise((resolve, reject) => {
          const id = ++sequence;
          pending.set(id, { resolve, reject });
          child.stdin.write(
            `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
          );
        });
      await rpc("initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "cta-smoke", version: "1.0.0" },
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
      );
      const call = async (name, args = {}, expectedError = false) => {
        const response = await rpc("tools/call", { name, arguments: args });
        assert.equal(response.error, undefined, JSON.stringify(response.error));
        if (expectedError) {
          assert.equal(response.result.isError, true);
          return response.result.content[0].text;
        }
        assert.notEqual(
          response.result.isError,
          true,
          JSON.stringify(response.result),
        );
        return (
          response.result.structuredContent ??
          JSON.parse(response.result.content[0].text)
        );
      };
      const listed = (await rpc("tools/list", {})).result.tools.map(
        (tool) => tool.name,
      );
      for (const name of [
        "get_cta_learning_status",
        "record_cta_correction",
        "register_cta_experiment",
        "record_cta_analytics",
        "promote_cta_pattern",
      ])
        assert(listed.includes(name));
      const oldPlan = await call("get_production_plan", { date: item.date });
      assert.equal(oldPlan.ctaLearning.validation.valid, false);
      assert.match(
        await call("generate_voice", { date: item.date }, true),
        /CTA/,
      );
      assert.match(
        await call("get_production_plan", { date: "2000-01-01" }, true),
        /rejasi yo‘q/,
      );
      const edited = await call("update_production_plan", {
        date: item.date,
        cta: lab.offer.canonicalRussian,
        sceneEdits: [
          {
            sceneId: cta.id,
            narration: lab.offer.canonicalRussian,
            visualBeats: [
              { hero: "HSK AI", syncCueText: "Попробуй" },
              { hero: "ПРОФИЛЬ", screenImage: "cta/instagram-profile.png", syncCueText: "Зайди" },
              { hero: "ССЫЛКА", screenImage: "cta/instagram-links.png", syncCueText: "Открой" },
              { hero: "СКАЧАТЬ", screenImage: "cta/website-download.png", syncCueText: "скачай" },
            ],
          },
        ],
      });
      assert.equal(edited.narrationChanged, true);
      const active = (
        await call("get_cta_learning_status", { date: item.date })
      ).applicableCorrections.map((entry) => entry.id);
      const register = (id, supersedes) =>
        call("register_cta_experiment", {
          date: item.date,
          id,
          hypothesis:
            "The clear HSK keyword should increase qualified commenters.",
          acknowledgedCorrectionIds: active,
          supersedes,
        });
      const first = await register("smoke-cta-v1");
      assert.equal(first.ctaValidation.valid, true);
      const approvedAt = new Date().toISOString();
      await write(path.join(folder, "approvals/smoke-cta-v1.json"), {
        state: "approved-for-manual-publishing",
        ctaExperimentId: "smoke-cta-v1",
        ctaCopyHash: first.registration.copyHash,
        approvedAt,
      });
      await call("generate_voice", { date: item.date });
      const run = await read(path.join(folder, "episode.json"));
      assert(run.voiceTextHash);
      Object.assign(run, {
        audioSrc: `generated/${item.id}/voice.mp3`,
        audioDurationMs: 31000,
        captions: [{ text: "HSK", startMs: 100, endMs: 200 }],
        captionSource: "gemini-word-timestamps",
      });
      await write(path.join(folder, "episode.json"), run);
      for (const name of [
        "video.mp4",
        "captions.srt",
        "post.md",
        "approval.json",
      ])
        await fs.writeFile(path.join(folder, name), "stale");
      const visualEdit = await call("update_production_plan", {
        date: item.date,
        sceneEdits: [
          {
            sceneId: cta.id,
            visualBeats: [
              {
                hero: "",
                actionIcon: "direct-message",
                syncCueText: "директ",
                transitionStyle: "slide-match",
              },
            ],
          },
        ],
      });
      assert.equal(visualEdit.narrationChanged, false);
      assert.equal(visualEdit.episode.audioSrc, run.audioSrc);
      assert.equal(visualEdit.ctaValidation.valid, false);
      for (const name of [
        "video.mp4",
        "captions.srt",
        "post.md",
        "approval.json",
      ])
        await assert.rejects(fs.access(path.join(folder, name)), {
          code: "ENOENT",
        });
      assert.match(
        await call("register_cta_experiment", {
          date: item.date,
          id: "smoke-cta-v2",
          hypothesis: "The repaired screenshot sequence improves profile link visits.",
          acknowledgedCorrectionIds: active,
          supersedes: "smoke-cta-v1",
        }, true),
        /profile, profile links/,
      );
      const repaired = await call("update_production_plan", {
        date: item.date,
        sceneEdits: [
          {
            sceneId: cta.id,
            visualBeats: [
              { hero: "HSK AI", syncCueText: "Попробуй" },
              { hero: "ПРОФИЛЬ", screenImage: "cta/instagram-profile.png", syncCueText: "Зайди" },
              { hero: "ССЫЛКА", screenImage: "cta/instagram-links.png", syncCueText: "Открой" },
              { hero: "СКАЧАТЬ", screenImage: "cta/website-download.png", syncCueText: "скачай" },
            ],
          },
        ],
      });
      assert.equal(repaired.ctaValidation.valid, true);
      const second = await register("smoke-cta-v2", "smoke-cta-v1");
      assert.equal(second.ctaValidation.valid, true);
      const analytics = {
        experimentId: "smoke-cta-v1",
        platform: "instagram-reels",
        window: "24h",
        postReference: "owner-test-post",
        publishedAt: approvedAt,
        capturedAt: new Date().toISOString(),
        videoDurationSeconds: 31,
        metricDefinition:
          "Platform views; unique viewers who opened the profile link.",
        views: 1000,
        profileLinkClickers: 0,
        ownerConfirmedManuallyPublished: true,
      };
      const measured = await call("record_cta_analytics", analytics);
      assert.equal(measured.readback.primaryMetricValue, 0);
      assert.equal(measured.readback.downloads, null);
      assert.equal(
        measured.readback.experimentSnapshot.copySnapshot.scenes[0]
          .visualBeats[1].screenImage,
        "cta/instagram-profile.png",
      );
      assert.match(
        await call("record_cta_analytics", analytics, true),
        /snapshot.*exists/,
      );
      const replacement = await call("record_cta_analytics", {
        ...analytics,
        profileLinkClickers: 4,
        supersedes: measured.readback.id,
      });
      assert.equal(replacement.readback.primaryMetricValue, 4);
      assert.equal(replacement.learning.recordedSnapshots, 2);
      assert.equal(replacement.learning.activeSnapshots, 1);
      assert.match(
        await call(
          "record_cta_analytics",
          { ...analytics, experimentId: "smoke-cta-v2" },
          true,
        ),
        /no owner-approved package/,
      );
      assert.match(
        await call(
          "promote_cta_pattern",
          {
            candidateFormatId: "untested",
            changedVariable: "wording",
            evidenceReadbackIds: [replacement.readback.id],
            ownerWording: "Use this pattern",
            ownerConfirmed: true,
          },
          true,
        ),
        /No comparable evidence/,
      );
      const exact = "  HSK yozilganda ko‘rinsin!\nTuzatish  ";
      const correction = await call("record_cta_correction", {
        ownerWording: exact,
        rule: "Show HSK when the keyword is spoken.",
        scope: { type: "episode", episodeId: item.id },
      });
      assert.equal(correction.correction.ownerWording, exact);
      assert.equal(
        (await call("get_production_plan", { date: item.date })).ctaLearning
          .validation.valid,
        false,
      );
      for (const name of [
        "generate-voice-gemini.mjs",
        "render-episode.mjs",
        "approve-package.mjs",
      ]) {
        const args =
          name === "approve-package.mjs"
            ? [
                JSON.stringify({
                  mode: "now",
                  timezone: "Asia/Shanghai",
                  platforms: [
                    {
                      platform: "instagram",
                      accountId: "ig-test",
                      accountName: "Test",
                      caption: "Test caption",
                      instagramSettings: {
                        shareToFeed: false,
                        isAiGenerated: false,
                      },
                    },
                  ],
                }),
              ]
            : [];
        const result = spawnSync(
          process.execPath,
          [path.join(fixture, "scripts", name), item.id, ...args],
          { encoding: "utf8" },
        );
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /CTA rejasi/);
      }
      const revised = await call("update_production_plan", {
        date: item.date,
        sceneEdits: [
          {
            sceneId: cta.id,
            narration: lab.offer.canonicalRussian.replace(
              "Попробуй",
              "Попробовать",
            ),
          },
        ],
      });
      assert.equal(revised.needsNewVoiceAndCaptions, true);
      assert.equal(revised.episode.audioSrc, undefined);
      assert.equal(revised.episode.voiceTextHash, undefined);
      assert.deepEqual(revised.episode.captions, []);
      const snapshot = await read(path.join(fixture, "content/cta-lab.json"));
      assert.equal(snapshot.experiments.length, 2);
      assert.equal(snapshot.corrections.at(-1).ownerWording, exact);
      assert.equal(
        snapshot.experiments[0].copySnapshot.scenes[0].visualBeats[1]
          .screenImage,
        "cta/instagram-profile.png",
      );
      assert.equal(
        snapshot.experiments[1].copySnapshot.scenes[0].visualBeats[1]
          .screenImage,
        "cta/instagram-profile.png",
      );
    } finally {
      if (child && child.exitCode === null) {
        const ended = new Promise((resolve) => child.once("exit", resolve));
        child.kill();
        await ended;
      }
      await fs.rm(fixture, { recursive: true, force: true });
    }
  },
);
