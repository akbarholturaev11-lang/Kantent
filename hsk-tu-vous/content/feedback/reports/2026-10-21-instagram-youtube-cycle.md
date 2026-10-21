# HSK AI Content Studio — feedback cycle (2026-10-21)

## OBSERVATION — connected accounts, publishedAt lookback and measurements

- Starting GitHub `main` SHA: `16c53c701a6d43ee0e7d867ac6b9e322bc42391a`; no open feedback PR. Existing `feedback/zernio-20261021-instagram-youtube` branch was identical to `main` and contained no Oct 21 files; reused without duplicate branch or overwriting historical snapshots.
- Zernio `accounts_list` confirmed exactly Instagram **hskai.app** (account `6a411e989d9472faae10a430`) and YouTube **hskai_app** (account `6ac96e053f8f4ffc10b0655f`). **TikTok not connected; no TikTok analytics interpreted or fetched.**
- Canonical `content/hook-lab.json#policy`: `analysisLookbackDays=30` (actual `publishedAt`, rolling from collection time); `earlySignalWindow=24h` preliminary only, `primaryDecisionWindow=7d` decisive; missing fixed 7d is `insufficient-evidence`. Filtered source `analytics_get_analytics` independently per connected account for 2026-09-21 through 2026-10-21; one page returned for each.
- **Instagram:** [immutable platform snapshot](../observations/instagram-2026-10-21.json) with **18 published posts** (15 video, 3 carousels); **42,405 raw provider lifetime views**, including 1 unsynced post. **42,141 source-synced lifetime views across 17 posts**; unsynced post(s) retained as identity/provenance with metric values null, not zero. Largest synced Reel [18112275989167272](https://www.instagram.com/reel/DeZkfCbDc3o/), published `2026-10-12T15:36:48.000Z`: **19,129 lifetime views**. Collection `2026-10-21T01:25:53.388Z`, provider lastSync `2026-10-21T01:20:50.566Z`.
- **YouTube:** [immutable platform snapshot](../observations/youtube-2026-10-21.json) with **5 videos**, **3,207 lifetime views** across 5 source-synced posts. Highest [d_tEjT35RDE](https://www.youtube.com/watch?v=d_tEjT35RDE), published `2026-10-12T15:42:37.000Z`: **916 lifetime views**. Collection `2026-10-21T01:25:58.353Z`, provider lastSync `2026-10-21T01:20:50.566Z`. Default/unsupported YouTube reach, shares, saves, watch and completion zeros remain **null**, not zero.
- Relative to append-only 2026-10-19 snapshots: 16 matched Instagram IDs changed by **+2859 provider views** measured between two differently timed cumulative snapshots, and 1 new IG ID(s) were detected. 4 matched YouTube IDs changed by **+30 provider views**, with 1 new YouTube ID(s). These are **not** 24h/7d post-age window metrics or controlled lift.
- Individual snapshots preserve account IDs, platform post ID, exact platform URL, original `publishedAt`, `observedAt` / `collectedAt`, metric units, `window=lifetime`, provider endpoint, exact query, lastSync, `lastUpdated` and sync status. `episodeId`, `hookFormat`, `hskLevel`, `effectStyle`, `creativeFormatId` remain **null** pending independently verified production mapping.
- Remaining scheduled reserve strictly after Oct 21: **3 planned episodes** (2026-10-23, 2026-10-26, 2026-10-28), `minimumFutureEpisodes=3`, `targetFutureEpisodes=4`. This feedback-only cycle does not author new lessons or change existing plans. A separate Calendar Reserve workflow owns any target refill and Chinese source verification.

## HYPOTHESIS — not performance evidence

A concrete beginner-language misconception and immediate visual payoff in the first seconds of a Russian-language HSK 1–2 video might reduce early skipping. Lifetime differences are confounded by audience, publication age, topics and duration; no post-to-Hook mapping or causal benefit is proven.

## EXPERIMENT — proposal only, NOT launched

For future unapproved lessons, preregister an isolated Hook contrast with matched platform, measured fixed-window unit, HSK level, duration band and creative controls. Hold voice and central CTA constant. Require >=3 posts **per format**, >=500 source-grounded views **per post**, >=10% lift and <=10% secondary intent loss (saves/shares per 1,000 views). Fixed `24h` is early signal only; true provider-verified `7d` is required for primary assessment. Owner approval needed for any adoption.

## DECISION — `insufficient-evidence`

No provider-labelled fixed 7-day post-age measurement, verified episode/Hook/level mapping, matched comparable group, or complete secondary-intent guardrail. No winning Hook, causal efficiency claim or content-production change. No CTAs, voice, renderer, publishing controls, approved media or app user data changed.

## COVERAGE GAP / QA

- The 30-day source query returned Instagram posts only back to `2026-09-22T17:18:15.000Z`; YouTube to `2026-10-09T22:11:05.000Z`. Full historical completeness cannot be inferred. Provider sync statuses vary per Instagram post; unsynced count 1. Provider `lastUpdated` strings carry no verified timezone; no fabricated normalization to UTC.
- Snapshot totals are not per-post fixed post-age 24h/7d; counts of missing metrics are null. Provider does not establish link clicks, downloads or downstream sales. Externally mapped post IDs alone do not prove canonical episode ID/Hook experiment.
- Files validated for unique IDs, publishedAt cutoff, source/account, source links and required analyzer metrics. GitHub review should verify all 3 branch contents, exact PR diff, CI vs updated `main` baseline, then merge **only if CI passes** (or a provably identical unrelated historical data-only exception) and fetch all 3 files from new `main` afterward.
