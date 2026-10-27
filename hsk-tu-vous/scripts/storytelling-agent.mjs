import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeAdaptiveBrief, evaluateAdaptiveCandidate } from "./storytelling-generator.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Codex/Claude Code own editorial authoring and critical review.
 * This bridge is entirely local: no text-model request, voice request or file write.
 */
export function prepareAgentStorytellingBrief(episode) {
  return {
    status: "editorial-brief-for-codex-or-claude-code",
    brief: makeAdaptiveBrief(episode),
    instructions: [
      "The interactive Codex or Claude Code agent authors and independently reviews the lesson; Gemini is reserved for voice TTS and word-timing transcription.",
      "Check learning facts against genuine sources and check Russian naturalness before accepting any candidate.",
      "Do not invent Mandarin claims or Chinese characters; preserve the existing Hook Lab hook and central CTA.",
      "If no genuine additional learner question exists, select the direct storytelling pattern.",
      "Do not modify any canonical episode, review package, approval or published content as a side effect of this read-only command."
    ]
  };
}

export function validateAgentStorytellingProposal(episode, proposal) {
  const evaluated = evaluateAdaptiveCandidate(episode, proposal);
  if (!evaluated.valid) return evaluated;
  return {
    ...evaluated,
    status: "requires-agent-source-review-and-owner-preview",
    note: "Structural validation is not editorial approval. Codex/Claude Code must check language and factual sources; a changed narration requires fresh Gemini TTS, word timing and video review."
  };
}

function cli() {
  const [id, flag, proposalPath, ...extra] = process.argv.slice(2);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id ?? "") ||
      extra.length || (flag !== undefined && flag !== "--validate") ||
      (flag === "--validate" && !proposalPath)) {
    throw Error("Usage: npm run content:storytelling-generate -- <episode-id> [--validate <local-proposal.json>]");
  }
  const source = JSON.parse(fs.readFileSync(path.join(root, "content", "episodes", id + ".json"), "utf8"));
  if (source.id !== id) throw Error("Episode ID mismatch");
  const result = flag === "--validate"
    ? validateAgentStorytellingProposal(source, JSON.parse(fs.readFileSync(path.resolve(proposalPath), "utf8")))
    : prepareAgentStorytellingBrief(source);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.valid === false) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
