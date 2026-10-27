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

## Adaptive Storytelling: practical lesson writing

This adviser supplies *scriptwriting technique*, not another writing model or production pipeline. The authoritative editorial sequence and acceptance criteria are in `content/WORKFLOW.md` → **Adaptive Storytelling — scenario writing procedure**.

When the existing Codex/Claude Code agent writes or repairs a **future unapproved HSK 1–2** Russian script:

1. **Write a full spoken script** instead of a list of labels: open with one believable learner problem, give the first truthful Chinese answer early, show one source-backed consequence/contrast and finish with active recall. Preserve verified Mandarin phrases, pinyin, meaning and the required registered opening.
2. **Make each transition earn its place.** Prefer a concrete spoken question such as “А как теперь попросить сделать дешевле?” to “А теперь следующий пункт”. Avoid hollow suspense (“Секрет узнаете в конце”), repeated topic announcements and formulaic eight-beat pacing.
3. **Use re-hooks selectively.** After the first answer, a second question is warranted only if the viewer must solve a *different* useful learner task. Write the later exact answer before adding the question. An immediately answered rhetorical question does not qualify as a delayed re-hook. If the distinction is already clear, choose `direct`. Never sacrifice accuracy to fit `single-rehook` or `layered`.
4. **Critique the actual narration.** Read the Russian script aloud; remove filler, check scene-to-scene causality, pronunciation-bearing Hanzi, tone-marked pinyin and faithful meaning on each existing teaching card. Source uncertainty is a blocker, not permission to improvise grammar rules.
5. Use `npm run content:storytelling-plan -- <episode-id>` only for optional read-only structural hints, which are lexical and cannot prove quality. For a finished source-bound edit, optional `content:storytelling-generate -- <episode-id> --validate <proposal.json>` checks structural safety **without writing narration**. Do not introduce a Gemini text model, parallel agent, new canonical schema or CTA in the lesson.

The result is a **finished scene-by-scene Russian lesson scenario** with one learning outcome and an honest, complete payoff—not a generic hook score, a new render command or guaranteed viral format. Do not change voiced, owner-approved or published episodes.


## Output
Three candidate hooks with editorial weaknesses; one recommended hook **for owner review**; beat/storyboard suggestion compatible with existing scene fields; list of Chinese sources and unresolved uncertainties. No MP3/MP4, unapproved edits, CTA replacements or social posting.

## Provenance
Selectively adapted editorial method from [instagram-agent-skill/ig-reel](https://github.com/Jakeschincariol/instagram-agent-skill/tree/main/skills/ig-reel) (MIT). The original 26-formula list, Python heuristic scorer and target-duration prescriptions are intentionally **not** installed: the local Hook Lab and word-cue validators remain authoritative.
