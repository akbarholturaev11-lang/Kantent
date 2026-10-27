import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUNCTUATION = /[\s.,!?;:«»"'“”‘’—–-]+/gu;

function word(value) {
  return typeof value === "string" ? value.toLocaleLowerCase("ru").replace(PUNCTUATION, "") : "";
}

function hasExactCue(scene, cue) {
  return typeof cue === "string" && cue.trim().length > 0 &&
    typeof scene?.narration === "string" && scene.narration.includes(cue);
}

export function readStorytellingPolicy(root = ROOT) {
  const registry = JSON.parse(fs.readFileSync(
    path.join(root, "content", "creative-formats.json"), "utf8"
  ));
  const policy = registry.storytellingPolicy;
  if (policy?.schemaVersion !== 1 ||
      !Array.isArray(policy.allowedPatterns) ||
      !["direct", "single-rehook", "layered"].every(x => policy.allowedPatterns.includes(x)) ||
      !Number.isInteger(policy.maxRehooks) || policy.maxRehooks < 1 ||
      typeof policy.firstPayoffLatestRatio !== "number" ||
      policy.firstPayoffLatestRatio <= 0 || policy.firstPayoffLatestRatio >= 1) {
    throw Error("Missing/invalid content/creative-formats.json#storytellingPolicy");
  }
  return policy;
}

function teachingScenes(episode) {
  return Array.isArray(episode?.scenes)
    ? episode.scenes.filter(scene => scene?.kind !== "cta")
    : [];
}

function seconds(scene) {
  if (typeof scene?.durationFrames === "number" && scene.durationFrames > 0) {
    return scene.durationFrames / 30;
  }
  return Number.isFinite(scene?.durationSec) && scene.durationSec > 0
    ? scene.durationSec : null;
}

export function inspectStorytelling(episode, policy = readStorytellingPolicy()) {
  const scenes = teachingScenes(episode);
  const total = scenes.reduce((sum, s) => sum + (seconds(s) ?? 0), 0);
  const useExplicitTimes = scenes.length > 0 && scenes.every(s => seconds(s) !== null);
  let cursor = 0;
  const timeline = scenes.map((scene, index) => {
    const startSec = cursor;
    cursor += seconds(scene) ?? 0;
    return { id: scene.id, kind: scene.kind, index, startSec,
      endSec: cursor, hasChinese: /[\u3400-\u9fff]/u.test(scene.narration ?? "") };
  });
  const candidates = timeline.filter((p, index) => index > 0 && index < timeline.length - 1 &&
    /(?:\?|？|почему|но |а теперь|сравните|а как|что если|однако)/iu.test(scenes[index].narration ?? ""));
  const shortMax = policy.durationHintsSec?.shortMax ?? 20;
  const standardMax = policy.durationHintsSec?.standardMax ?? 35;
  const suggestedPattern = !useExplicitTimes || total <= shortMax || candidates.length === 0
    ? "direct" : total > standardMax && candidates.length >= 2 ? "layered" : "single-rehook";
  const firstChineseScene = timeline.find(p => p.hasChinese);
  const errors = validateStorytellingEpisode(episode, policy);
  return {
    episodeId: episode?.id ?? null,
    mode: "read-only-editorial-advice",
    durationSec: useExplicitTimes ? +total.toFixed(2) : null,
    durationBand: useExplicitTimes ? (total <= shortMax ? "short" : total <= standardMax ? "standard" : "long") : "unknown",
    suggestedPattern,
    possibleRehookSceneIds: candidates.map(p => p.id),
    firstChineseSceneId: firstChineseScene?.id ?? null,
    firstChineseSceneStartRatio: firstChineseScene && total
      ? +(firstChineseScene.startSec / total).toFixed(3) : null,
    authoredMetadataPresent: episode?.storytelling != null,
    validationErrors: errors,
    limits: [
      "Scene text heuristics are not a model of viewer retention or semantic correctness.",
      "Chinese characters do not prove that the correct answer was delivered.",
      "A candidate re-hook is not approved until an editor checks novelty, payoff and instructional truth.",
      "Scene boundaries are approximate; only imported Gemini word cues prove final spoken timing.",
      "No narration, scene, CTA, voice, canonical file or publication has been changed."
    ]
  };
}

export function validateStorytellingEpisode(episode, policy = null) {
  const info = episode?.storytelling;
  if (info == null) return []; // Backwards compatibility with every historical plan.
  const rules = policy ?? readStorytellingPolicy();
  const errors = [];
  const scenes = teachingScenes(episode);
  const ids = scenes.map(s => s.id);
  const getIndex = (id) => ids.indexOf(id);
  const cue = (sceneId, text) => hasExactCue(scenes[getIndex(sceneId)], text);
  if (info.schemaVersion !== 1) errors.push("storytelling.schemaVersion must be 1");
  if (!rules.allowedPatterns.includes(info.pattern)) errors.push("storytelling.pattern is unsupported");
  if (!info.firstPayoff || getIndex(info.firstPayoff.sceneId) < 0 ||
      !cue(info.firstPayoff.sceneId, info.firstPayoff.cueText)) {
    errors.push("storytelling.firstPayoff must reference an existing teaching scene and verbatim narration cue");
  }
  const firstIndex = getIndex(info.firstPayoff?.sceneId);
  if (firstIndex >= 0 && scenes.every(s => seconds(s) != null)) {
    const total = scenes.reduce((sum, s) => sum + seconds(s), 0);
    const firstSceneStart = scenes.slice(0, firstIndex).reduce((sum, s) => sum + seconds(s), 0);
    if (total && firstSceneStart / total > rules.firstPayoffLatestRatio) {
      errors.push("storytelling.firstPayoff scene starts after the early-payoff advisory boundary");
    }
  }
  if (!Array.isArray(info.reHooks)) {
    errors.push("storytelling.reHooks must be an array");
    return errors;
  }
  if (info.reHooks.length > rules.maxRehooks) errors.push("storytelling has too many reHooks");
  if (info.pattern === "direct" && info.reHooks.length !== 0) errors.push("direct pattern cannot include reHooks");
  if (["single-rehook", "layered"].includes(info.pattern) && info.reHooks.length === 0) errors.push("re-engagement pattern needs a real reHook");
  if (info.pattern === "single-rehook" && info.reHooks.length !== 1) errors.push("single-rehook requires exactly one reHook");
  const used = new Set();
  let lastIndex = firstIndex;
  for (const [n, item] of info.reHooks.entries()) {
    const prefix = "storytelling.reHooks[" + n + "]";
    const index = getIndex(item?.sceneId);
    const payoffIndex = getIndex(item?.payoffSceneId);
    if (index < 0 || payoffIndex < 0 || index <= firstIndex || payoffIndex <= index) {
      errors.push(prefix + ": order must be first payoff, later teaching reHook, later teaching payoff");
    }
    if (index <= lastIndex) errors.push(prefix + ": reHooks must be ordered and distinct");
    if (n > 0 && getIndex(info.reHooks[n - 1]?.payoffSceneId) >= index) {
      errors.push(prefix + ": resolve the previous reHook before opening the next one");
    }
    if (used.has(item?.sceneId)) errors.push(prefix + ": duplicate reHook scene");
    used.add(item?.sceneId);
    if (!cue(item?.sceneId, item?.cueText)) errors.push(prefix + ": cueText must be verbatim narration");
    if (!cue(item?.payoffSceneId, item?.payoffCueText)) errors.push(prefix + ": payoffCueText must be verbatim narration");
    if (typeof item?.reason !== "string" || item.reason.trim().length < 15) {
      errors.push(prefix + ": meaningful editorial reason is required");
    }
    const hookNarration = scenes[0]?.narration ?? "";
    if (word(item?.cueText) && word(hookNarration).includes(word(item.cueText))) {
      errors.push(prefix + ": cannot recycle the original hook cue");
    }
    lastIndex = index;
  }
  return errors;
}

function main() {
  const id = process.argv[2];
  if (!id || !/^[a-z0-9-]+$/.test(id)) throw Error("Usage: npm run content:storytelling-plan -- <episode-id>");
  const file = path.join(ROOT, "content", "episodes", id + ".json");
  const episode = JSON.parse(fs.readFileSync(file, "utf8"));
  if (episode.id !== id) throw Error("Episode ID does not match file");
  const plan = inspectStorytelling(episode);
  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
  if (plan.validationErrors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
