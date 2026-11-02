# HSK AI Content Studio — feedback cycle (2026-11-02)

## OBSERVATION — verified owned accounts, rolling publishedAt cohort

- GitHub main before branch: `bb9589ce2aa4a08599c2f728eda1bea40f51214b`; open feedback PRs: **0**. Previous report 2026-10-30 and immutable platform snapshots reviewed. Collected/observed at `2026-11-02T00:52:18.307Z` UTC. Hook Lab policy: rolling **30d** by actual publishedAt, cutoff `2026-10-03T00:52:18.307Z`; **24h** early signal and provider-exact **7d** primary. RU provider queries from `2026-10-03` to `2026-11-02` (inclusive date filter), 100/page, page 1. Query boundaries are not post-age metric windows.
- Connected live: RU Instagram `hskai.app` (`6a411e989d9472faae10a430`), RU YouTube `hskai_app` (`6ac96e053f8f4ffc10b0655f`), TJ Instagram `hskai.apptj` (`6ae0f16205fd6f5357f8503d`), TJ YouTube `hskai.app-tj` (`6ae160123787e4c71b522d64`). TikTok excluded: no current independently verified owned-video media evidence in this analysis.
- **RU Instagram Reels** [snapshot](../observations/instagram-2026-11-02.json): **16** Reels, **15** synced, **1** unavailable; synced rows **47,761 lifetime views**. Excluded **1** image/feed post. Top [Reel](https://www.instagram.com/reel/DeZkfCbDc3o/) **23,308 lifetime views**. **15** common synced native IDs versus Oct 30: aggregate cumulative difference **+2,471 lifetime views**; not fixed-age lift. Provider lastSync `2026-11-02T00:50:42.958Z`, staleAccountCount `0`, syncTriggered `false`.
- **TJ Instagram Reels:** **2** synced Reels, **988 lifetime views** combined ([29 Oct](https://www.instagram.com/reel/DfDyLszCKeW/) 419; [28 Oct](https://www.instagram.com/reel/DfB5BkXFWgV/) 569). Only Zernio post IDs and URLs returned, native platform IDs/syncedAt missing: kept in `unmappedProviderPosts`, excluded from analyzer comparisons.
- **RU YouTube short-form videos** [snapshot](../observations/youtube-2026-11-02.json): **8** synced videos, **5,482 lifetime views**. Top [video](https://www.youtube.com/watch?v=xN1OZkcVgHY) **1,213 lifetime views**. **8** common synced IDs versus Oct 30: **+30 cumulative lifetime views**. Provider lastSync `2026-11-02T00:50:42.958Z`. Provider video+short duration shown, but no explicit Shorts classification flag.
- **TJ YouTube:** **2** published short-form video URLs; **2** analytics pending. All metrics `null` (not zero); native IDs/syncedAt missing. See YouTube `unmappedProviderPosts`.
- Each RU row records native post/account ID, provider record ID, actual publishedAt, post URL, observedAt/collectedAt, sync/metric update timestamps, query endpoint, refresh, syncStatus, metric units. TJ rows retain provider Zernio post ID, account, URL, publishedAt, collectedAt, pending/synced state; unavailable native ID and sync timestamp remain `null`. All rows `window=lifetime`, no `source.windowEvidence` because provider-exact 24h/7d record ID + start/end not supplied. Unsupported metrics are null. `episodeId/hookFormat/hskLevel/effectStyle/creativeFormatId/storytellingPattern=null`: `content/feedback/publications.json#records` empty, no verified exact media/source binding. Real 7d creativeFormatId cohorts: **0**.

## HYPOTHESIS — not an observed performance result

A clear on-screen learner choice in the first two seconds might improve the proportion of viewers who save a Mandarin lesson compared with a generic explanation intro. Current lifetime observations do not identify the exact published Hook/creative source, so this is unverified and cannot be inferred from high-view Reels.

## EXPERIMENT — proposal only, not launched

`feedback-choice-intro-20261102-v1`: a separately authorized Calendar Reserve cycle could compare **only the opening 2s question framing** in otherwise matched RU or TJ lessons, with the same platform/account, HSK level, duration band, creativeFormatId, voice, CTA and audience window. Require verified published source/media mapping and provider-exact 7d start/end/record IDs. Hook Lab guardrails: >=3 posts per format, >=500 views per post, >=10% descriptive lift, savesPer1000Views and sharesPer1000Views not down >10%; owner decision required. No scripts, policy, calendar, CTA, voice or publishing changes here.

## DECISION — insufficient-evidence

Verified fixed-age 24h records: **0**; verified fixed-age 7d records: **0**; verified source-bound Hook/HSK/creative/story attribution: **0**; matched primary 7d comparisons: **0**. No viral or causal inference. TikTok/competitor benchmarking excluded, caption skill not applicable. No Zernio publish/DM.

## READ-ONLY MULTILINGUAL SOURCE READINESS / HANDOFF

Configured `ru` and `tg`. GitHub file existence verified for Nov 3 advertisement `campus-voice-rehearsal-20261103`, Nov 4 lesson `bi-comparison-height-20261104`, Nov 5 advertisement `shop-shirt-size-20261105`, Nov 6 lesson `ji-vs-duoshao-books-price-20261106` in both source and Tajik locale roots; calendar has these four future rows (minimum 3, target 4). Presence and recorded localization.sourceHash are not cryptographic hash verification, complete motion cues, actual TTS, MP4, final preview or publication. No confirmed missing date/ID/locale file in this checked 4-slot horizon; no Calendar Reserve handoff required. `content:feedback`, `content:viral-plan`, `content:buffer` CLI could not run in connector-only environment; repo analyzer/read-only policies inspected instead.

## GITHUB DELIVERY

Proposed data/report-only paths: `content/feedback/observations/instagram-2026-11-02.json`, `content/feedback/observations/youtube-2026-11-02.json`, `content/feedback/reports/2026-11-02-instagram-youtube-cycle.md`. Actual PR HEAD/CI/merge/main readback must be checked externally; this document is not evidence of merge.
