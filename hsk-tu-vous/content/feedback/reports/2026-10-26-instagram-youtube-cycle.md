# HSK AI Content Studio — feedback cycle (2026-10-26)

## OBSERVATION — connected accounts and rolling publishedAt cohort

- Baseline GitHub `main`: `58dc42eb3754ee44640004771fc9cc38b23be977`; no open feedback PR. Prior immutable cycle: [2026-10-21](./2026-10-21-instagram-youtube-cycle.md). This is a new source collection, not a replacement of older files.
- Current Zernio `accounts_list`: **Instagram hskai.app** (`6a411e989d9472faae10a430`) and **YouTube hskai_app** (`6ac96e053f8f4ffc10b0655f`) only. **TikTok unconnected**, excluded. No external competitor dataset was supplied or independently verified.
- Hook Lab `policy`: rolling `30` days by real `publishedAt`, cutoff `2026-09-26T00:37:22.664Z`; early signal `24h`, primary decision `7d`. Provider query: `analytics_get_analytics`, per account, `from_date=2026-09-26`, `to_date=2026-10-26`, `limit=100`, `page=1`; provider `lastSync=2026-10-26T00:25:31.058Z`. All pages returned (`pages=1` each). Provider collection times are in the linked snapshots.
- **Instagram Reels:** [immutable 2026-10-26 snapshot](../observations/instagram-2026-10-26.json): `17` returned posts in the cohort, `16` source-synced and `1` unavailable/unsynced. **51,013 provider-synced lifetime views**, with `51,277` raw including unavailable source values; unsynced metrics stored as `null`. Highest synced Reel [18112275989167272](https://www.instagram.com/reel/DeZkfCbDc3o/) published `2026-10-12T15:36:48.000Z`: **21,534 lifetime views**. 2 newly seen post ID(s) since 2026-10-21: `18070572521786850`, `18138426436645293`.
- **YouTube Shorts:** [immutable 2026-10-26 snapshot](../observations/youtube-2026-10-26.json): `6` synced videos, **4,468 lifetime views**. Highest [xN1OZkcVgHY](https://www.youtube.com/watch?v=xN1OZkcVgHY) published `2026-10-24T02:00:20.000Z`: **1,208 lifetime views**. 1 newly seen ID(s) since 2026-10-21: `xN1OZkcVgHY`.
- Historical same-ID cumulative changes since Oct 21 (different collection ages, NOT post-age windows): Instagram `14` comparable *identity* matches, summed lifetime-view difference `+3364`; YouTube `5` matches, `+53`. Cohort totals cannot be compared directly because the publication cutoff and membership changed.
- The source-labelled per-post records preserve post ID, URL, `publishedAt`, account, `observedAt`/`collectedAt`, metric units, `window=lifetime`, sync status, provider metric update, query and provider refresh. `episodeId`, `hookFormat`, `hskLevel`, `effectStyle`, `creativeFormatId` remain `null` until separately verified from actual production artifacts.
- Additional read-only Zernio checks: `analytics_get_post_timeline` for Instagram Reel `18070572521786850` and YouTube Short `xN1OZkcVgHY`, plus `analytics_get_daily_metrics(attribution=received)` per platform. Timelines are **UTC calendar-day cumulative** observations; they do not certify exact 24h/7d *elapsed-post-age* results. Instagram timeline Oct 26 displayed 853 lifetime views while `analytics_get_analytics` row was 849 (provider freshness mismatch). The snapshot uses **only** the stated source query and does not silently splice different endpoints/times.

## HYPOTHESIS — exploratory, not causal

A specific beginner mistake and immediate visual payoff may correlate with lower Reel skip rate than generic openings. No verified creative-to-Hook mapping, fixed-age measurement or matched control establishes this. The largest lifetime-view Reel is a descriptive outlier only, not proof of virality or a winning Hook.

## EXPERIMENT — proposal only; not launched

A future, separately approved and preregistered Hook contrast should keep platform, exact 7d window, metric definitions, HSK level, duration band, voice and central CTA matched while changing one Hook variable. Hook Lab requires at least `3` posts per format, at least `500` views per post, at least `10%` relative lift and no more than `10%` decline in secondary intent (saves/shares per 1,000 views); owner decides promotion. No future caption was drafted, so `ig-caption-quality` is not invoked. No authorized competitor metrics, so `ig-competitor-research` is not invoked.

## DECISION — `insufficient-evidence`

No verified fixed post-age 7d provider readback, episode-to-Hook/level attribution or minimum matched groups. No Hook winner, virality proof, performance-caused production change, CTA modification or publishing. No Instagram caption, SRT, Gemini voice, renderer or already-published media changed. No TikTok metrics, scraping or automated DM.

## COVERAGE / QA

- The Instagram provider query's oldest returned `publishedAt` was `2026-09-28T07:56:34.000Z`; YouTube oldest `2026-10-09T22:11:05.000Z`. These do **not** prove complete historical coverage of the 30-day rolling window. Absent fields and unavailable sync rows are `unknown`/`null`, not zero.
- Current `content/calendar.json#planningBuffer` minimum `3`, target `4`. Future planned dates strictly after Oct 26 are Oct 28, Oct 30 and Nov 2 (3); refill to target belongs to the separate Calendar Reserve task, **not** this data/report-only PR.
- Repository scope: **only** two append-only platform observations and this dated report. Source files, historical snapshots, central CTA, voice, renderer, calendar, approved/published content and publishing controls unchanged. GitHub PR/CI/merge status must be checked after commit; do not interpret this document as proof of successful CI or merge.
