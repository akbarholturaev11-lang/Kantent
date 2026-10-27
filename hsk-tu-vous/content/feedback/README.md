# Content feedback — MVP evidence boundary

This directory is reserved for **raw, sourced** Zernio observations and agent decision notes. It is not a second Hook Lab or CTA Lab. Existing canonical hook readbacks and approved CTA versions remain in `content/hook-lab.json` and `content/cta-lab.json`.

## Agent workflow (external scheduled ChatGPT task; historical runs confirmed, next run not guaranteed)

1. Inspect `content/calendar.json` and existing Hook/CTA rules for **context only**. The Feedback agent does not author, reserve, repair or publish lessons; pass future-script gaps to Calendar Reserve. `npm run content:buffer -- --json` audits all configured production languages and reports missing/stale locale drafts; it is still **source readiness**, not real audio/render QA.
2. Inspect *actual* Zernio results through the already-connected ChatGPT Zernio connector; **no stand-alone Zernio API key** and no HSK AI user-data ingestion for MVP.
3. For each measurement keep: `platform`, `platformPostId`, `episodeId` if verifiably matched, `publishedAt`, `observedAt`, `collectedAt`, `window` (`lifetime`, `24h`, `72h` or `7d`), metric names, units, numeric values or `null`, and the Zernio source. Do not substitute zero for unavailable metrics. Do not claim a view caused an app install.
4. Record observed measurements separately from **hypotheses** and from **decisions**. Follow `content/hook-lab.json#policy` to analyze posts **published in the last 30 days**; keep old observations immutable but out of current comparable cohorts. Compare real `24h` windows for early-only signals and actual `7d` windows for primary review, with verified episode mapping, minimum sample and matched platform/level/duration. A Zernio `lifetime` snapshot is never a fixed-day snapshot. Prefer testing one major variable per comparison.
5. Record testable improvement **hypotheses** using the existing `content/HOOK_LAB.md` process, not automatic winners or production changes. Only Calendar Reserve or a separately owner-invoked author may change unapproved future lessons. Never rewrite published/approved snapshots.
6. Never silently change a registered CTA, voice provider, published media, or production code. Final posting requires the owner's explicit approval of the exact preview.

## First-phase scope

Implemented: read-only buffer audit, validated source-stamped Instagram and YouTube Zernio snapshots (including 2026-10-26), and a deterministic local analyzer. These are historical observations, not a guarantee that the provider's current connection or 24h/7d coverage is available.

- `observations/*.json` holds source-stamped immutable collections. Run `npm run content:feedback` or `npm run content:feedback -- --json` to review.
- A snapshot uses `window: "lifetime"` unless actual post-age 24h, 72h or 7d provider-fixed metrics are available with `source.windowEvidence: {kind:"provider-exact-post-age", window, startAt, endAt, providerRecordId}` and a genuinely exact-period endpoint. `analytics_get_analytics`, `analytics_get_daily_metrics`, and `analytics_get_post_timeline` do not alone certify that window. The validator rejects fixed-day labels without this evidence; post age alone is not proof. Lifetime counts of posts of different ages are not comparable controlled experiments.
- Absent metrics are recorded as `null`, not zero. `avgWatchMs` is the Zernio Reel average-watch field in milliseconds.
- `episodeId`, `hookFormat`, `hskLevel`, `effectStyle` stay `null` until a match to production assets is verified. Date proximity alone is insufficient.
- Optional `creativeFormatId` is allowed **only** after the published post-to-episode mapping and the associated hook/HSK level are independently verified. It must match a format in `content/creative-formats.json`. Missing tags are unknown, not failure or a zero metric.
- `npm run content:viral-plan -- --json` reads these snapshots and suggests compatible packaging of **future unapproved** lessons without changing anything. Its baseline target is aspirational; it cannot measure HSK AI downloads or lesson starts without verified external funnel instrumentation.
- New time-stamped snapshots should be added as new files rather than altering existing source measurements. The analyzer uses the newest snapshot per post + window; it never declares an automatic winner.
- `AGENT_PLAYBOOK.md` is the active external ChatGPT ↔ Zernio ↔ GitHub task contract; the analytics run writes **only** immutable observations and dated feedback reports.

A recorded scheduled Feedback run on 2026-10-26 successfully produced a reviewed data/report-only merge; historical success must not be presented as proof of the next run. The separate Calendar Reserve is the only scheduled scenario writer. Neither a native background daemon nor an extra standalone API client exists in this repository. Live GitHub/Zernio connector availability and complete multilingual source readiness still require checks each run. Git pre-render freshness is enforced at the local CLI/MCP entry points. HSK AI learner attribution and automatic publishing remain excluded. The owner-preview gate remains unchanged.
