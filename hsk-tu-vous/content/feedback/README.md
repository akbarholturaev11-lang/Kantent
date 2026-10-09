# Content feedback — MVP evidence boundary

This directory is reserved for **raw, sourced** Zernio observations and agent decision notes. It is not a second Hook Lab or CTA Lab. Existing canonical hook readbacks and approved CTA versions remain in `content/hook-lab.json` and `content/cta-lab.json`.

## Agent workflow (not yet scheduled)

1. Inspect `content/calendar.json`, run `npm run content:buffer -- --json`, and read existing Hook/CTA rules **before** proposing new scenarios.
2. Inspect *actual* Zernio results through the already-connected ChatGPT Zernio connector; **no stand-alone Zernio API key** and no HSK AI user-data ingestion for MVP.
3. For each measurement keep: `platform`, `platformPostId`, `episodeId` if verifiably matched, `publishedAt`, `collectedAt`, `windowHours` (24, 72, or 168), metric names, units, numeric values or `null`, and the Zernio source. Do not substitute zero for unavailable metrics. Do not claim a view caused an app install.
4. Record observed measurements separately from **hypotheses** and from **decisions**. Compare comparable posts within the same platform and measurement window; note sample sizes. Prefer testing one major variable per comparison.
5. Suggest improvements in the existing `content/HOOK_LAB.md` process. Only add or update unapproved future lesson plans in the calendar under the owning production rules. Never rewrite published/approved snapshots.
6. Never silently change a registered CTA, voice provider, published media, or production code. Final posting requires the owner's explicit approval of the exact preview.

## First-phase scope

Implemented: read-only buffer audit and validation tests.

Not yet implemented: automatic Zernio collection, analytics persistence, AI-driven scenario drafting, cloud schedules, GitHub sync before render, HSK AI user attribution, automatic publication. No analytics examples in this directory are presented as actual results.
