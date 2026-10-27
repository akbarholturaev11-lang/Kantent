import { createHash } from "node:crypto";
import { readStorytellingPolicy, inspectStorytelling, validateStorytellingEpisode } from "./storytelling-plan.mjs";

const clone = (value) => structuredClone(value);
const hanzi = (value) => [...String(value ?? "").matchAll(/[\u3400-\u9fff]+/gu)].map(m => m[0]);
const checksum = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function hasSources(episode) {
  return Array.isArray(episode?.learningFactSources) &&
    episode.learningFactSources.length > 0 &&
    episode.learningFactSources.every(s => typeof s.url === "string" &&
      /^https:\/\//u.test(s.url) && /^\d{4}-\d{2}-\d{2}$/u.test(s.checkedAt ?? "") &&
      typeof s.supports === "string" && s.supports.trim().length > 0);
}

function eligible(episode) {
  const blocked = ["published", "scheduled", "owner-approved-for-zernio-publishing"];
  return episode?.publishingStatus === "pending-owner-review" &&
    Array.isArray(episode?.scenes) && episode.scenes.length >= 3 &&
    episode.scenes[0]?.kind === "hook" &&
    !episode.scenes.some(s => s.kind === "cta") &&
    !Object.hasOwn(episode, "cta") && !Object.hasOwn(episode, "ctaExperiment") &&
    !episode.audioSrc && !episode.voiceTextHash && !(episode.captions?.length) &&
    !blocked.includes(episode.publishingStatus) && hasSources(episode) &&
    typeof episode.hookExperiment?.id === "string" &&
    typeof episode.learningOutcome === "string" &&
    typeof episode.audienceProblem === "string";
}

export function makeAdaptiveBrief(source, policy = readStorytellingPolicy()) {
  if (!eligible(source)) throw Error("Adaptive AI draft requires a complete, unvoiced, unapproved CTA-free and source-receipted episode");
  const summary = inspectStorytelling(source, policy);
  const scenes = source.scenes.map(s => ({
    sceneId: s.id, kind: s.kind, durationSec: s.durationSec ?? null,
    narration: s.narration,
    verifiedChineseCards: (s.cards ?? []).map(x => ({
      hanzi: x.hanzi, pinyin: x.pinyin, meaning: x.meaning
    }))
  }));
  return {
    schemaVersion: 1, episodeId: source.id, originalSha256: checksum(source),
    lessonLanguage: "Russian Cyrillic with verified Hanzi and tone-marked pinyin",
    learningOutcome: source.learningOutcome, audienceProblem: source.audienceProblem,
    referenceFacts: source.learningFacts, verifiedExamples: source.examples,
    sourceReceipts: source.learningFactSources,
    suggestedPattern: summary.suggestedPattern,
    candidateSceneIds: summary.possibleRehookSceneIds,
    constraints: [
      "One accurate HSK 1-2 learning outcome; no novel Chinese claims, testimonials, product features or fabricated statistics.",
      "Preserve the entire hook narration and hookExperiment registration verbatim.",
      "Preserve all Chinese character runs in the same order, scene by scene.",
      "May reword only Russian narration in existing non-hook scenes; no new/deleted/reordered scenes.",
      "Preserve each exact Chinese spoken example and learning fact; never invent a new Chinese teaching claim.",
      "First real answer must be in the first 30 percent of the teaching video.",
      "An optional later rehook must be meaningfully distinct and resolved in a subsequent teaching scene.",
      "The output MUST reference exact verbatim firstPayoff, reHooks and payoffCueText in the proposed narration.",
      "No CTA or requests for comments, app downloads or external publication within lesson narration.",
      "Do not modify Gemini voice, source identity, Chinese cards, visuals, calendar, duration or metadata other than storytelling.",
      "If an honest rehook adds no learning value, choose direct with reHooks [].",
      "This output is an editorial proposal, never automatically publishable or author-approved."
    ],
    scenes
  };
}

export function evaluateAdaptiveCandidate(source, proposal, policy = readStorytellingPolicy()) {
  const errors = [];
  if (!eligible(source)) errors.push("Source episode is ineligible or lacks checked language sources");
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return { valid: false, errors: [...errors, "Invalid AI response: expected object"], draft: null };
  }
  if (proposal.schemaVersion !== 1 || proposal.episodeId !== source?.id)
    errors.push("Proposal version or episode identity mismatch");
  if (proposal.originalSha256 !== checksum(source))
    errors.push("Proposal must bind to the exact original scenario hash");
  if (!Array.isArray(proposal.narrationEdits))
    errors.push("narrationEdits must be an array");
  if (proposal.storytelling?.schemaVersion !== 1)
    errors.push("storytelling metadata is required");
  if (errors.length) return { valid: false, errors, draft: null };
  const draft = clone(source);
  const changed = new Set();
  for (const edit of proposal.narrationEdits) {
    const i = draft.scenes.findIndex(s => s.id === edit?.sceneId);
    if (i <= 0 || changed.has(edit?.sceneId)) {
      errors.push("Invalid/duplicate edit or attempted hook/CTA rewrite: " + edit?.sceneId);
      continue;
    }
    changed.add(edit.sceneId);
    const old = draft.scenes[i].narration;
    const next = edit.narration;
    if (typeof next !== "string" || next.length > 1200 || next.trim().length < 18) {
      errors.push(edit.sceneId + ": missing, short, or overlong narration");
      continue;
    }
    if (!/[А-Яа-яЁё]{3,}/u.test(next))
      errors.push(edit.sceneId + ": lesson narration must remain Russian Cyrillic");
    if (JSON.stringify(hanzi(old)) !== JSON.stringify(hanzi(next)))
      errors.push(edit.sceneId + ": Chinese content/order changed without independent teaching verification");
    if (/скачайте|подписывайтесь|переходите по ссылке|напишите в комментариях/iu.test(next))
      errors.push(edit.sceneId + ": in-lesson CTA is forbidden");
    draft.scenes[i].narration = next;
  }
  draft.storytelling = clone(proposal.storytelling);
  errors.push(...validateStorytellingEpisode(draft, policy));
  if (JSON.stringify(draft.scenes.map(s => ({id:s.id,kind:s.kind,durationSec:s.durationSec,cards:s.cards,visualBeats:s.visualBeats}))) !==
      JSON.stringify(source.scenes.map(s => ({id:s.id,kind:s.kind,durationSec:s.durationSec,cards:s.cards,visualBeats:s.visualBeats})))) {
    errors.push("Protected scene, Chinese cards or visual content changed");
  }
  if (errors.length) return { valid: false, errors, draft: null };
  return {
    valid: true, errors: [],
    status: "requires-source-review-and-owner-preview",
    draft,
    sourceSha256: checksum(source),
    proposedSha256: checksum(draft),
    narrationChanged: draft.scenes.some((s,i) => s.narration !== source.scenes[i].narration),
    caveats: [
      "This gate cannot prove Mandarin grammar or Russian naturalness: editor must recheck sources.",
      "If narration changes, generate NEW Gemini MP3, exact word-aligned captions, MP4 and new owner preview; never reuse old approval.",
      "A changed hook, lesson or visual context may require fresh Hook/CTA registration; this tool does not register or approve.",
      "No evidence of retention improvement exists until matched provider-verified 7d observations."
    ]
  };
}
