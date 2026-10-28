---
name: ig-reel-planning
description: HSK-specific Instagram Reel hook and editorial beat planning, before the existing Hook Lab and Remotion production.
---

# Instagram Reel planning — HSK AI editorial advisor

**Scope:** planning for an explicit Instagram HSK lesson. This is an *advisory phase*, not another renderer, TTS engine, Hook Lab or automatic episode author.

## Canonical sources (read first)
1. `AI_RULES.md`, `content/HOOK_LAB.md`, `content/hook-lab.json` active corrections and `content/creative-formats.json`.
2. The actual dated `content/calendar.json` episode and `content/episodes/<id>.json`; if no date/ID is provided, propose a concept without claiming a canonical slot exists.
3. `content/EPISODE_SCHEMA.md`, `content/EDITING_SPEC.md`, `content/GRAPHIC_SCENES.md` and `content/visual-system.json#lessonPresentation` for current cue-driven `motionBeats`, original drawings and visible-state limits. `content/SEMANTIC_VISUAL_SCHEMA.md` applies only to eligible older/legacy visual plans.

## Procedure
1. Identify one **verified** HSK 1–2 Chinese teaching fact for the selected audience language from `content/languages.json` (Hanzi + tone-marked pinyin + that audience's meaning). Reject invented usage examples, app results and statistics.
2. Propose **three genuinely different** first-line hook ideas from the currently approved Hook Lab formats; never replace its registered `hookExperiment` or promote an unmeasured alternative. Note the specific beginner problem, the accurate payoff, and what *visual event* would appear immediately.
3. Screen each hook for clarity, specificity, truthfulness, relevance to the one teaching point and consistency with the scene. These are editorial checks, **not predictive scores or promised virality**.
4. Produce a short beat-by-beat **proposal**: spoken text in the selected explanation language, a corresponding visual action, Chinese text with pinyin, and a final payoff. Keep current HSK AI CTA *outside* this lesson proposal; central `cta-lab.json` assembles it later.
5. For a lesson under the active `lessonPresentation` policy, hand the chosen Hook treatment to the owner-authorized scenario agent to author **source JSON and each language's exact spoken `cueText` + drawable `motionBeats`**; original objects/actions need real `visual.graphic` nodes/tracks, not a generic storyboard caption. `auto-storyboard` remains an eligible **legacy-only** path, not the default for current action lessons. Actual Gemini word timestamps validate motion and subtitles during production; advisory durations are not real cues. Never write approved/published lessons or generate media from this advisory skill.

## Topic-based story selection (future, unapproved scripts)

After verifying one teachable HSK fact and checking the three hook proposals, inspect the relevant episode's existing narrative beats with `npm run content:storytelling-plan -- <episode-id>` when a canonical episode exists. Its re-hook hints are lexical, not semantic proof or a pattern choice. Read `content/creative-formats.json#storytellingPolicy` and use the topic-based authoring procedure and context fields in `content/WORKFLOW.md` / `content/EPISODE_SCHEMA.md`; never choose from duration or punctuation alone. Series timing is separately owned by `content/calendar.json#seriesPolicy`. Do not force a question or hide the first answer. These annotations are not an alternative Hook Lab. Never add a re-hook to voiced, approved or published artifacts.


## Output
Three candidate hooks with editorial weaknesses; one recommended hook **for owner review**; meaning-linked beat/action-frame suggestions compatible with the active scene schema and each configured language; list of Chinese sources and unresolved uncertainties. No MP3/MP4, unapproved edits, CTA replacements or social posting.

## Provenance
Selectively adapted editorial method from [instagram-agent-skill/ig-reel](https://github.com/Jakeschincariol/instagram-agent-skill/tree/main/skills/ig-reel) (MIT). The original 26-formula list, Python heuristic scorer and target-duration prescriptions are intentionally **not** installed: the local Hook Lab and word-cue validators remain authoritative.
