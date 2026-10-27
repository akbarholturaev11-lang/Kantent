# Adaptive Storytelling v1 — implementation contract (2026-10-27)

**Historical planning snapshot, not current agent instructions.** The `main` SHA below records the original baseline only; for active workflow and current code see `AGENTS.md`, `content/WORKFLOW.md` and `content/creative-formats.json`.

## Baseline (read-only)
- Source: `main` @ `01523dac540ab0ea8d9d589e43ecdf7f45821ce6`.
- Existing model: CTA-free dated lesson scenes, registered Hook Lab, central platform CTA hydration, Gemini word-timed narration, semantic Remotion and owner-approved social publishing.
- Examples dated 2026-10-26, 10-28, 10-30 and 11-02 are five-scene lessons (roughly 31–32 seconds). This is NOT evidence that viewers lose attention in the middle.
- Existing `main` Actions run 40250723465 failed its **consistency** job, at `Test timezone-aware today-video selection and verified published deduplication`; `semantic-foundation` succeeded. New PR checks must be compared with this pre-existing failure.
- Hook Lab has no eligible verified 7d comparable readbacks. Oct 26 provider observations contain lifetime-only measurements and unverified episode attribution; YouTube watch ratio is unavailable. Do not infer a baseline retention lift.

## Scope and canonical ownership
- Preserve `AI_RULES.md`, `HOOK_LAB.md`, `cta-lab.json`, the calendar, voice profile and existing approval/publication artifacts.
- The **single** configurable adaptive editorial policy lives in `content/creative-formats.json#storytellingPolicy`, not a second CTA/Hook registry. The original four creative format IDs remain supported.
- For new agent-authored, unapproved CTA-free lessons, use `episode.storytelling` as documented in `content/EPISODE_SCHEMA.md`; existing episodes without it remain valid. The current selection policy lives in `content/creative-formats.json#storytellingPolicy`.
- Planner is a **read-only heuristic / advisory report**. It must not generate narration, fabricate re-hooks or rewrite source JSON.
- Stage v1 changes editorial planning, validation and tests. No TTS, Remotion, CTA or publishing behavior changes in this PR.
- The scenario-authoring agent and current reserve authority are defined in `content/WORKFLOW.md`; no separate text-model service is used. All prose must be grounded in verified Chinese facts.

## Story structure options
- `direct`: hook, early answer, context/recall; suitable when another re-hook would be filler.
- `single-rehook`: early payoff, a distinct later question/contrast, and a genuine later payoff.
- `layered`: exactly two justified distinct later questions, each resolved within the lesson. Never a forced 8-block template. Choose by teaching content, not length alone.
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
7. **Rollout:** no auto-winner or publishing; explicit owner approval to promote a pattern. Legacy unannotated records remain supported; the agent follows the current authoring policy for new plans. Roll back code/config without rewriting immutable reviews.

## Acceptance
- `npm run check:consistency`, project tests, `npm run lint`, new planner tests and render smoke (when used) pass or each pre-existing unrelated failure is clearly attributed.
- Read-only commands leave canonical files byte-identical.
- Instagram/YouTube lesson and CTA version integrity remain intact; no TikTok publishing.
- No automatic modification of `main`, existing voice assets, scheduled/published content, approvals or analytics history as a side effect of planning.

## Current implementation scope

Scenario prose and frame plans are authored by the agent under `content/WORKFLOW.md`, including the existing Calendar Reserve workflow. The separate Gemini text-author/critic bridge is removed. `storytelling-generator.mjs` retains pure source-bound briefing/validation functions, and `content:storytelling-plan` remains a read-only advisory command.

Exact verified Chinese examples, Hook/CTA separation, legacy-compatible narrative metadata and the real-word timing contract remain. New life-context/selection annotations and consecutive-part planning follow the current canonical sources. `scripts/series-plan.mjs` provides read-only date proposals and calendar validation; no social posts are scheduled. The approved Gemini voice/transcription, bilingual localization, Remotion, calendar and publication gates are unchanged. A mechanical editorial check is not evidence of improved retention.

## Proposed cost envelope
Pure Node.js planning/validation adds no per-episode LLM call, server, database or render. Authoring a changed narration later still requires new Gemini audio/timestamps, render and owner review. No quantitative reach/ROI claim is defensible until fixed-window comparable outcomes exist.
