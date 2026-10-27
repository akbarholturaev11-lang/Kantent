# Adaptive Storytelling v1 — implementation contract (2026-10-27)

## Baseline (read-only)
- Source: `main` @ `01523dac540ab0ea8d9d589e43ecdf7f45821ce6`.
- Existing model: CTA-free dated lesson scenes, registered Hook Lab, central platform CTA hydration, Gemini word-timed narration, semantic Remotion and owner-approved social publishing.
- Examples dated 2026-10-26, 10-28, 10-30 and 11-02 are five-scene lessons (roughly 31–32 seconds). This is NOT evidence that viewers lose attention in the middle.
- Existing `main` Actions run 40250723465 failed its **consistency** job, at `Test timezone-aware today-video selection and verified published deduplication`; `semantic-foundation` succeeded. New PR checks must be compared with this pre-existing failure.
- Hook Lab has no eligible verified 7d comparable readbacks. Oct 26 provider observations contain lifetime-only measurements and unverified episode attribution; YouTube watch ratio is unavailable. Do not infer a baseline retention lift.

## Scope and canonical ownership
- Preserve `AI_RULES.md`, `HOOK_LAB.md`, `cta-lab.json`, the calendar, voice profile and existing approval/publication artifacts.
- The **single** configurable adaptive editorial policy lives in `content/creative-formats.json#storytellingPolicy`, not a second CTA/Hook registry. The original four creative format IDs remain supported.
- Optional `episode.storytelling` fields annotate only newly authored, unapproved CTA-free lessons. Legacy episodes without this field stay valid.
- Planner is a **read-only heuristic / advisory report**. It must not generate narration, fabricate re-hooks or rewrite source JSON.
- Stage v1 changes editorial planning, validation and tests. No TTS, Remotion, CTA or publishing behavior changes in this PR.
- Any future automatic prose drafting must be separately reviewed and must be grounded in the Chinese teaching fact and approved voice script.

## Story structure options
- `direct`: hook, early answer, context/recall; suitable when another re-hook would be filler.
- `single-rehook`: early payoff, a distinct later question/contrast, and a genuine later payoff.
- `layered`: at most two justified distinct later questions, each resolved within the lesson. Never a forced 8-block template.
- Short (~15–20 s), standard (~20–35 s) and longer (35+ s) are **advisory duration bands**, not caps or automatic requirements.

## Optional metadata contract
```json
{
  "storytelling": {
    "schemaVersion": 1,
    "pattern": "single-rehook",
    "firstPayoff": {
      "sceneId": "hook",
      "cueText": "Правильный выбор — 两."
    },
    "reHooks": [
      {
        "sceneId": "numeral",
        "cueText": "Но двадцать — 二十.",
        "payoffSceneId": "recap",
        "payoffCueText": "Две чашки — 两杯茶.",
        "reason": "A meaningful additional distinction, not the opening repeated"
      }
    ]
  }
}
```
All cues must appear verbatim in the existing narration. A re-hook cannot refer to the CTA or an earlier/identical scene. Metadata is editorial evidence, not a new rendered scene and not verified word-level timing. An exact opening payoff is preferred; when evidence is missing the validator reports an issue instead of manufacturing the answer.

## Gates and deliverables
1. **Preflight:** record SHA, open PRs, existing CI conclusion, frozen public/approved sources.
2. **Editorial:** single policy; no duplicated Hook/CTA wording; instructional answer supplied early; no cliffhanger that withholds a useful answer.
3. **Schema:** optional, backward-compatible metadata with no `scene.kind` changes; validation refuses invalid scene IDs, missing cues, CTA hooks, reverse-order payoff, duplicate re-hook IDs and unsupported patterns.
4. **Tests:** valid/invalid metadata, all existing lessons without metadata, read-only CLI, no modification to narration or central CTA. CI must run `node --test scripts/storytelling-plan.test.mjs`.
5. **Pilot:** three unapproved future draft ideas are reviewed side-by-side before any new narration/audio. Existing approved/published versions are immutable.
6. **Measurement:** owner-approved experiment; source-confirmed `postId → episodeId → hook + storytelling version` mapping; same-platform, same window, level, comparable duration, central CTA and voice controls. Verify exact 7d post-age windows and absent-data handling. At least three valid posts per format with 500 views each is a screening requirement, not statistical proof. Report 7d average-watch-ratio, saves/shares per 1,000 views where supported, and limitations.
7. **Rollout:** no auto-winner or publishing; explicit owner approval to promote a pattern. Feature can be disabled by declining metadata on new plans. Roll back code/config without rewriting immutable reviews.

## Acceptance
- `npm run check:consistency`, project tests, `npm run lint`, new planner tests and render smoke (when used) pass or each pre-existing unrelated failure is clearly attributed.
- Read-only commands leave canonical files byte-identical.
- Instagram/YouTube lesson and CTA version integrity remain intact; no TikTok publishing.
- No automatic modification of `main`, existing voice assets, scheduled/published content, approvals or analytics history as a side effect of planning.

## Architecture correction and revised delivery plan (2026-10-27)

**Owner clarification supersedes the earlier Gemini text-drafting approach.** In this project, **Codex or Claude Code is the agent** that creates, evaluates and finalizes an eligible video's lesson script. The owner requests today's video from that agent. Gemini is reserved exclusively for the approved voice TTS and exact speech-to-word-timestamp transcription. The prior proposal for two Gemini text API calls (draft + AI critic), a dedicated text-model configuration and a second scenario agent was an architectural mistake.

### Canonical runtime responsibility map

| Responsibility | Existing owner | Corrected operation |
| --- | --- | --- |
| Today's date, episode selection, review execution | MCP `preview_today_video_selection` (read-only) + `get_production_plan`, followed by unchanged `prepare_today_video` production, calendar, `scripts/mcp-server.mjs` | Same shared `resolveTodayVideo` rules; agent inspects selected script before voice/render; preserve strict date/published-dedup rules |
| Fact-checked lesson writing, adaptive pattern selection, Russian narration and independent editorial review | The invoking **Codex/Claude Code agent** under `AGENTS.md`, `AI_RULES.md`, `content/WORKFLOW.md` | No added Gemini text-generation model or service |
| Hook/CTA policy and immutable registration | Existing Hook Lab, CTA Lab and episode assembler | Preserve as sole authorities; no in-lesson CTA |
| Storytelling heuristics / source-bound proposal guardrails | `storytelling-plan.mjs`, **existing** `storytelling-generator.mjs` | Local-only brief and offline validation, agent decides editorial content |
| Approved voice and word-level caption timestamps | `generate-voice-gemini.mjs` + `content/voice-profile.json` | Gemini API for **TTS + transcription**, exactly matching approved narration |
| Storyboard, semantic cues and visual export | Existing auto-storyboard + Remotion | Optional story annotations, never parallel video engine |
| Preview, publication and experiment readback | Owner's exact package sign-off + Zernio and Hook/CTA labs | Unchanged; measured 7d windows only |

### Delivery reconciliation

1. **Restore architecture (this correction PR):** remove unused Gemini text drafter/critic and model configuration; avoid duplicate `storytelling-agent.mjs`; expose read-only agent brief + local proposal validator through the existing storytelling module; update package command, workflow, tests, documentation and policy ownership; do not touch episodes, calendar, TTS settings, tokens or published snapshots.
2. **Editorial phase (Codex/Claude Code, no extra provider):** for genuinely new/eligible episodes, the invoking agent verifies Chinese teaching references, chooses `direct` or a genuinely useful re-hook, authors Russian script and optional annotations, critically reviews factual/narrative quality, then applies the local checksum/scene validator. The existing three dated pilot ideas remain *examples*, not automatically modified content.
3. **Established production phase:** using the normal MCP date tool and reviewed source only, Gemini produces approved MP3 and word timestamps; exact-token validator, storytelling cue timing and semantic Remotion execute as before. Re-render on any narration change and require owner preview approval. No new automation or independent agent service is planned.
4. **Feedback phase:** only verified attributed same-age seven-day Instagram and YouTube post windows may be compared by pattern. No measured lift claim until actual compatible observations exist, no silently promoted winners.

### Verification gates

- `node --check` for changed modules; `node --test scripts/storytelling-generator.test.mjs scripts/storytelling-plan.test.mjs scripts/storytelling-timing.test.mjs`.
- `npm run check:consistency`, `npm run lint`, all CI steps including Remotion real MP4 smoke and legacy episode compatibility.
- Negative tests for edited opening Hook, mismatched source checksum, fabricated Chinese characters, CTA contamination, duplicate edits and altered published/voiced sources.
- Confirm no `HSK_AI_ALLOW_GEMINI_SCRIPT`, Gemini text model, `storytelling-gemini.mjs` or duplicate agent entry point is invoked. A hypothetical user instruction to author narration must be handled by Codex/Claude Code, not by a newly billed API call.
- No real Gemini voice synthesis, publishing or owner-preview endorsement is claimed from synthetic CI fixtures alone.

## Proposed cost envelope
The agent-driven editorial review and pure Node.js planning/validation require no additional Gemini text-model calls, agent server or database. Authoring a changed narration later still requires new Gemini audio/timestamps, render and owner review. No quantitative reach/ROI claim is defensible until fixed-window comparable outcomes exist.
