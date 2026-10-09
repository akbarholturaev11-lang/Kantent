# Content feedback — MVP evidence boundary

This directory is reserved for **raw, sourced** Zernio observations and agent decision notes. It is not a second Hook Lab or CTA Lab. Existing canonical hook readbacks and approved CTA versions remain in `content/hook-lab.json` and `content/cta-lab.json`.

## Agent workflow (ChatGPT tasks configured separately; first unattended run not yet confirmed)

1. Inspect `content/calendar.json`, run `npm run content:buffer -- --json`, and read existing Hook/CTA rules **before** proposing new scenarios.
2. Inspect *actual* Zernio results through the already-connected ChatGPT Zernio connector; **no stand-alone Zernio API key** and no HSK AI user-data ingestion for MVP.
3. For each measurement keep: `platform`, `platformPostId`, `episodeId` if verifiably matched, `publishedAt`, `collectedAt`, `windowHours` (24, 72, or 168), metric names, units, numeric values or `null`, and the Zernio source. Do not substitute zero for unavailable metrics. Do not claim a view caused an app install.
4. Record observed measurements separately from **hypotheses** and from **decisions**. Follow `content/hook-lab.json#policy` to analyze posts **published in the last 30 days**; keep old observations immutable but out of current comparable cohorts. Compare real `24h` windows for early-only signals and actual `7d` windows for primary review, with verified episode mapping, minimum sample and matched platform/level/duration. A Zernio `lifetime` snapshot is never a fixed-day snapshot. Prefer testing one major variable per comparison.
5. Suggest improvements in the existing `content/HOOK_LAB.md` process. Only add or update unapproved future lesson plans in the calendar under the owning production rules. Never rewrite published/approved snapshots.
6. Never silently change a registered CTA, voice provider, published media, or production code. Final posting requires the owner's explicit approval of the exact preview.

## First-phase scope

Implemented: read-only buffer audit, validated Zernio snapshot format, one genuine Instagram readback and a deterministic local analyzer.

- `observations/*.json` holds source-stamped immutable collections. Run `npm run content:feedback` or `npm run content:feedback -- --json` to review.
- A snapshot uses `window: "lifetime"` unless an actual 24h, 72h or 7d readback was measured. Lifetime counts of posts of different ages are not comparable controlled experiments.
- Absent metrics are recorded as `null`, not zero. `avgWatchMs` is the Zernio Reel average-watch field in milliseconds.
- `episodeId`, `hookFormat`, `hskLevel`, `effectStyle` stay `null` until a match to production assets is verified. Date proximity alone is insufficient.
- New time-stamped snapshots should be added as new files rather than altering existing source measurements. The analyzer uses the newest snapshot per post + window; it never declares an automatic winner.
- `AGENT_PLAYBOOK.md` describes future ChatGPT ↔ Zernio ↔ GitHub orchestration.

Not yet validated: unattended Zernio/GitHub connector execution and automatic model-authored scenario replenishment. ChatGPT recurring tasks are configured outside the repository, but neither a native cloud daemon nor an API-key client was added. GitHub pre-render freshness is enforced only by the local Git CLI/MCP entry points. HSK AI user attribution and automatic publishing remain excluded. Existing approval gates remain unchanged.
