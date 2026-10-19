---
name: ig-reel-planning
description: HSK-specific Instagram Reel hook and editorial beat planning, before the existing Hook Lab and Remotion production.
---

# Instagram Reel planning — HSK AI editorial advisor

**Scope:** planning for an explicit Instagram HSK lesson. This is an *advisory phase*, not another renderer, TTS engine, Hook Lab or automatic episode author.

## Canonical sources (read first)
1. `AI_RULES.md`, `content/HOOK_LAB.md`, `content/hook-lab.json` active corrections and `content/creative-formats.json`.
2. The actual dated `content/calendar.json` episode and `content/episodes/<id>.json`; if no date/ID is provided, propose a concept without claiming a canonical slot exists.
3. `content/EPISODE_SCHEMA.md`, `content/EDITING_SPEC.md`, `content/SEMANTIC_VISUAL_SCHEMA.md` for storyboards and cue-matched shots.

## Procedure
1. Identify one **verified** HSK 1–2 Chinese teaching fact for the current Russian-speaking series (Hanzi + tone-marked pinyin + Russian meaning). Reject invented usage examples, app results and statistics.
2. Propose **three genuinely different** first-line hook ideas from the currently approved Hook Lab formats; never replace its registered `hookExperiment` or promote an unmeasured alternative. Note the specific beginner problem, the accurate payoff, and what *visual event* would appear immediately.
3. Screen each hook for clarity, specificity, truthfulness, relevance to the one teaching point and consistency with the scene. These are editorial checks, **not predictive scores or promised virality**.
4. Produce a short beat-by-beat **proposal**: spoken Russian text, a corresponding visual action, Chinese text with pinyin, and a final payoff. Keep current HSK AI CTA *outside* this lesson proposal; central `cta-lab.json` assembles it later.
5. For real production, hand the selected treatment to existing `auto-storyboard`, approved `content/episodes` flow and Remotion. Use actual Gemini word timestamps to validate semantic movement and subtitles; rough planning durations are not cue timestamps. Do not rewrite approved/published lessons.

## Output
Three candidate hooks with editorial weaknesses; one recommended hook **for owner review**; beat/storyboard suggestion compatible with existing scene fields; list of Chinese sources and unresolved uncertainties. No MP3/MP4, unapproved edits, CTA replacements or social posting.

## Provenance
Selectively adapted editorial method from [instagram-agent-skill/ig-reel](https://github.com/Jakeschincariol/instagram-agent-skill/tree/main/skills/ig-reel) (MIT). The original 26-formula list, Python heuristic scorer and target-duration prescriptions are intentionally **not** installed: the local Hook Lab and word-cue validators remain authoritative.
