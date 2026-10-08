# Content planning guide

The live production calendar is **`calendar.json`**. It owns dates, episode IDs, per-date topics, the timezone and publishing cadence. Do not mirror its rows or hard-code episode counts here.

For each scheduled episode, maintain the single canonical scenario at `episodes/<episode-id>.json`. Apply the current global rules (`../AI_RULES.md`), active hook corrections (`HOOK_LAB.md` and `hook-lab.json`), and current CTA configuration (`cta-lab.json`).

A plan should specify one learner problem, source-checked examples, a topic-specific opening, scene/edit cues, exact voice narration, and a relevant closing action. Production and approval steps are in `WORKFLOW.md`.

If the owner modifies the schedule or a theme, edit `calendar.json` and the affected canonical episode in the same task. This guide must not become a second calendar.
