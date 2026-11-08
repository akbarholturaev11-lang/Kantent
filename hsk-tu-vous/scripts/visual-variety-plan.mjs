#!/usr/bin/env node
/**
 * Visual variety planner (owner decision 2026-11-09): illustrated lessons must
 * not keep one background, one character pair or one comparison layout.
 *
 * planVariety() reads the script (all scene narration) and the history of
 * earlier lessons' recorded choices (content/lesson-art/*.json#variety) and
 * proposes: a setting not used recently (from the active A/B arm's group), a
 * supporting HSK AI character by role (the panda is always the coach / "я"),
 * and a layout pattern. readVarietyResults() joins each lesson's recorded arm
 * with FIXED-AGE (7d) Zernio observations and reports per-arm metrics; a
 * winner is never declared below the minimum sample per arm.
 * Policy: content/visual-variety.json. Pure functions + a small CLI.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lower = (text) => String(text ?? "").toLocaleLowerCase("und");
const narrationOf = (episode) => lower((episode?.scenes ?? []).map((s) => s.narration ?? "").join(" "));
const hits = (text, keywords) => keywords.filter((k) => text.includes(lower(k))).length;

export function activeExperiment(policy, date) {
  return (policy.experiments ?? []).find((e) => e.status === "active" && (!e.startDate || date >= e.startDate)) ?? null;
}

/** Stable arm assignment from the episode id (no human cherry-picking). */
export function armFor(experiment, episodeId) {
  const arms = Object.keys(experiment.arms).sort();
  const n = parseInt(createHash("sha256").update(experiment.id + ":" + episodeId).digest("hex").slice(0, 8), 16);
  return arms[n % arms.length];
}

export function planVariety({ episode, history = [], policy }) {
  const text = narrationOf(episode);
  const earlier = history.filter((h) => h.episodeId !== episode.id && (!episode.date || !h.date || h.date < episode.date))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const recent = (key, n) => new Set(earlier.slice(0, n).map((h) => h.variety?.[key]).filter(Boolean));
  const lastUsed = (key, value) => earlier.findIndex((h) => h.variety?.[key] === value);
  const leastRecent = (values, key) => [...values].sort((a, b) => {
    const ia = lastUsed(key, a), ib = lastUsed(key, b);
    return (ia === -1 ? -Infinity : -ia) - (ib === -1 ? -Infinity : -ib);
  });

  const experiment = activeExperiment(policy, episode.date ?? "9999-12-31");
  const arm = experiment ? armFor(experiment, episode.id) : null;
  const group = experiment?.variable === "setting group" ? experiment.arms[arm] : null;
  const blockedSettings = recent("setting", policy.rotation.settingLookback);
  const pool = policy.settings.filter((s) => !group || s.group === group);
  const settingOptions = pool.filter((s) => !blockedSettings.has(s.id));
  const setting = leastRecent((settingOptions.length ? settingOptions : pool).map((s) => s.id), "setting")[0];

  // The supporting character follows the script's role; among equally
  // fitting roles the least recently used wins, and the last ones are avoided.
  const blockedChars = recent("supportingCharacter", policy.rotation.supportingCharacterLookback);
  const scored = policy.supportingCharacters.map((c) => ({ ...c, score: hits(text, c.keywords) }));
  const best = Math.max(...scored.map((c) => c.score));
  let candidates = scored.filter((c) => c.score === best && best > 0).map((c) => c.character);
  if (!candidates.length) candidates = scored.map((c) => c.character).filter((c) => !blockedChars.has(c));
  if (!candidates.length) candidates = scored.map((c) => c.character);
  const supportingCharacter = leastRecent(candidates, "supportingCharacter")[0];

  const patternScores = policy.patterns.map((p) => ({ id: p.id, score: hits(text, p.keywords) }));
  const blockedPatterns = recent("pattern", policy.rotation.patternLookback);
  const ranked = patternScores.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).map((p) => p.id);
  const pattern = ranked.find((p) => !blockedPatterns.has(p)) ?? ranked[0] ?? "single-coach";

  return {
    episodeId: episode.id, date: episode.date ?? null,
    setting, settingPrompt: policy.settings.find((s) => s.id === setting)?.prompt ?? null,
    coach: "panda", supportingCharacter, pattern,
    experiment: experiment ? { id: experiment.id, arm, variable: experiment.variable, value: experiment.arms[arm] } : null,
    reasons: {
      supportingCharacter: policy.supportingCharacters.find((c) => c.character === supportingCharacter)?.reason ?? "rotation",
      avoidedSettings: [...blockedSettings], avoidedCharacters: [...blockedChars],
    },
  };
}

/** Per-arm results from fixed-age observations; never a winner below the minimum sample. */
export function readVarietyResults({ history, observations, policy }) {
  return (policy.experiments ?? []).map((experiment) => {
    const byEpisode = new Map(history.filter((h) => h.variety?.experiment?.id === experiment.id)
      .map((h) => [h.episodeId, h.variety.experiment.arm]));
    const arms = Object.fromEntries(Object.keys(experiment.arms).map((arm) => [arm, []]));
    for (const o of observations) {
      const arm = byEpisode.get(o.episodeId);
      if (!arm || o.window !== experiment.window) continue;
      const m = o.metrics ?? {};
      arms[arm].push({
        episodeId: o.episodeId, platform: o.platform,
        views: m.views ?? null,
        averageWatchRatio: m.avgWatchMs != null && m.durationSeconds ? m.avgWatchMs / 1000 / m.durationSeconds : null,
        sharesPer1000Views: m.shares != null && m.views ? (1000 * m.shares) / m.views : null,
      });
    }
    const mean = (rows, key) => {
      const values = rows.map((r) => r[key]).filter((v) => typeof v === "number");
      return values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(4) : null;
    };
    const summary = Object.fromEntries(Object.entries(arms).map(([arm, rows]) => [arm,
      { n: rows.length, [experiment.primaryMetric]: mean(rows, experiment.primaryMetric),
        ...Object.fromEntries(experiment.secondaryMetrics.map((k) => [k, mean(rows, k)])) }]));
    const enough = Object.values(summary).every((s) => s.n >= experiment.minimumPerArm && s[experiment.primaryMetric] != null);
    let leader = null;
    if (enough) {
      const sorted = Object.entries(summary).sort((a, b) => b[1][experiment.primaryMetric] - a[1][experiment.primaryMetric]);
      leader = sorted[0][0];
    }
    return { id: experiment.id, window: experiment.window, primaryMetric: experiment.primaryMetric, arms: summary,
      decision: enough ? `leader ${leader} (owner decides whether to promote)` : "insufficient-evidence" };
  });
}

export function loadHistory(root = ROOT) {
  const dir = path.join(root, "content", "lesson-art");
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { /* none */ }
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .map((m) => ({ episodeId: m.episodeId, date: m.variety?.date ?? null, variety: m.variety ?? null }));
}

function main() {
  const args = process.argv.slice(2);
  const policy = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "visual-variety.json"), "utf8"));
  const history = loadHistory();
  if (args[0] === "--results") {
    const obsDir = path.join(ROOT, "content", "feedback", "observations");
    const observations = fs.readdirSync(obsDir).filter((f) => f.endsWith(".json"))
      .flatMap((f) => JSON.parse(fs.readFileSync(path.join(obsDir, f), "utf8")).observations ?? []);
    console.log(JSON.stringify(readVarietyResults({ history, observations, policy }), null, 2));
    return;
  }
  const [episodeId] = args;
  if (!episodeId) throw new Error("Use: node scripts/visual-variety-plan.mjs <episode-id> | --results");
  const episode = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "episodes", episodeId + ".json"), "utf8"));
  console.log(JSON.stringify(planVariety({ episode, history, policy }), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
