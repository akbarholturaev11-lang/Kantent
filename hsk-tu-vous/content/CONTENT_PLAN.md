# Content planning guide

The live production calendar is **`calendar.json`**. It owns dates, episode IDs, per-date topics, the timezone and publishing cadence. Do not mirror its rows or hard-code episode counts here.

For each scheduled episode, maintain the single canonical scenario at `episodes/<episode-id>.json`. Apply the current global rules (`../AI_RULES.md`), active hook corrections (`HOOK_LAB.md` and `hook-lab.json`), and current CTA configuration (`cta-lab.json`).

A plan should specify one learner problem, source-checked examples, a topic-specific opening, scene/edit cues, exact voice narration, and a relevant closing action. Production and approval steps are in `WORKFLOW.md`.

For the owner-authorized daily future buffer replenishment, the agent may repair verified unapproved future CTA-free lessons and add new calendar dates + complete episode JSON **directly to `main` through the connected GitHub connector** when the buffer is below the target in `calendar.json`; no scenario PR is required. The exact scope and verification procedure are owned by `WORKFLOW.md` ("Automated scenario reserve — direct `main` delivery"). Use `planningWeekdays` and target from `calendar.json`, and `scripts/scenario-buffer-plan.mjs` as a read-only date proposal. For a shared Instagram Reels/YouTube Shorts lesson, read `.agents/skills/ig-reel-planning/SKILL.md` to advise on the hook/storyboard; `hook-lab.json` remains authoritative. Date proposals alone are not written scripts. Rendering must pass the existing voice/cue/review gates; the owner's approval of the exact final preview is mandatory **before publication**, not a blanket prohibition on preparing a review render. Do not rewrite old approved or published episodes.

If the owner modifies the schedule or a theme, edit `calendar.json` and the affected canonical episode in the same task. This guide must not become a second calendar.
