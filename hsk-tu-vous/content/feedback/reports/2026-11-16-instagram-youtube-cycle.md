# HSK AI Feedback — 2026-11-16 (Zernio RU video evidence)

## OBSERVATION
- Collection 2026-11-16T00:54:24.308Z; rolling 30-day publishedAt cohort 2026-10-17T00:54:24.308Z to 2026-11-16T00:54:24.308Z. Source: connected Zernio_RU accounts_list and analytics_get_analytics, with native post IDs, source URLs and provider metric timestamps in append-only observations. Account lastSync 2026-11-15T22:19:21.112Z; staleAccountCount=1, syncTriggered=true. Some individual metrics predate the collection.
- Instagram RU [@hskai.app](https://www.instagram.com/hskai.app/): **12 Reels, 24,431 cumulative lifetime views**. Excluded 3 non-Reels (image/feed and Story) records. [Evidence](../observations/instagram-2026-11-16.json).
- YouTube RU [@hskai_app](https://www.youtube.com/@hskai_app): **8 videos, 4,164 cumulative lifetime views**. [Evidence](../observations/youtube-2026-11-16.json).
- Only these RU accounts were confirmed in the accessible Zernio_RU connection; TJ and TikTok/Facebook VIDEO accounts were not independently verified. A second Zernio connection was not available to this run.
- **0 exact provider 24h and 0 exact provider 7d records** among 20 videos; all are window=lifetime with source.windowEvidence=null. Zero-filled unsupported YouTube reach/watch/follows/saves/shares and Instagram Reels follows are null, not observed zeros.
- Publication mapping registry content/feedback/publications.json#records remains empty: **0/20 independently verified post-to-approved-media/source mappings**. Therefore all contentType, series, episodeId, hook, HSK, creativeFormatId, storytellingPattern are null; language is account locale, not independently verified creative locale. Content-type primary metric cohorts cannot be formed.
- Open [PR #57](https://github.com/akbarholturaev11-lang/Kantent/pull/57) contains earlier evidence; not merged or overwritten. Older immutable snapshots remain intact.

## HYPOTHESIS
- Current content/creative-formats.json#contentGoals: lesson/direct-acquisition uses commentsPer1000Views as **link-request proxy** (not observed app users); advertisement/brand-recall uses reach and averageWatchRatio proxies (not observed recall); series-part/audience-growth uses sourced post followsPer1000Views or descriptive partContinuationRatio (not proven new followers). Without verified type attribution and fixed-age 7d evidence, **no type-specific outcome or format winner is established**.

## EXPERIMENT
- ID: feedback-20261116-content-type-evidence-readiness. Future authoring owner: Calendar Reserve, subject to separate owner review. First obtain verified publication mapping with native platformPostId, approved media SHA-256, exact source identity/hash, language and contentType; then capture provider-exact post-age 7d records with startAt/endAt/providerRecordId. Compare only matched platform/account/language/type/series part/duration/format/hook and 7d windows, respecting Hook Lab minimum posts/views and secondary guardrails. No direct policy change.
- Confounders: unequal post ages, mixed types, missing attribution, stale provider refresh, unsupported counters, unobserved app installs/recall/follows. Next readback: next feedback cycle after provider sync.

## DECISION
- **insufficient-evidence / unproven; keep testing**. High confidence in source-stamped lifetime counters and native IDs, no supported confidence in creative effectiveness, causal uplift, app acquisition or recall. No script, calendar, Hook/CTA policy, video, publication or registry changes. Handoff suggestion: publishing operator should populate verified durable publication mapping; Calendar Reserve may separately inspect future source readiness.
