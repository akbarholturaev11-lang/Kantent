# Daily publication readback — 2026-11-18 (Asia/Shanghai)

## OBSERVATION

- Verified current Zernio_RU accounts: Instagram RU `6a411e989d9472faae10a430`, YouTube RU `6ac96e053f8f4ffc10b0655f`. Connected Zernio TJ Instagram `6ae0f16205fd6f5357f8503d` and YouTube `6ae160123787e4c71b522d64`.
- Approved `bi-comparison-height-20261116` video: four exact Zernio-post/account-matched readbacks verified **published** on 2026-11-17: RU Instagram (native `17992260648088162`), RU YouTube (native `MAiXTVtGlbg`), TG Instagram (native ID not returned), TG YouTube (native ID not returned). Only status, actual publish time, provider-supported URL/ID and source readback were updated in `content/feedback/publications.json`. No repost or schedule change.
- New immutable RU provider cumulative observations: [Instagram](../observations/instagram-2026-11-18.json): **11 Reels / 19,022 lifetime views / 3 matched approved publication records**; [YouTube](../observations/youtube-2026-11-18.json): **8 videos / 3,351 lifetime views / 3 matched approved publication records**. Cohort is actual publishedAt within 2026-10-19 00:52:35 UTC–2026-11-18 00:52:35 UTC, not an exact per-post 30-day measurement. Three non-Reels Instagram posts excluded. Provider lastSync: 2026-11-18 00:53:19 UTC, one account marked stale.
- **Provenance caveat:** the snapshots use the run's initial reference timestamp `2026-11-18T00:52:35Z` for `collection.collectedAt`, while the provider's refreshed `lastSync` is `00:53:19Z`. Thus that `collectedAt` field is an **early run-reference time**, not a certified end-of-fetch timestamp. Preserve the immutable raw files; use the provider's per-post `analytics.lastUpdated` for observedAt and `lastSync` for sync provenance. Do not infer precise ingestion latency from this pair.
- Published TG Instagram/YouTube native IDs were not explicitly returned by the connected `get_post` endpoint. URLs do **not** certify native IDs. TikTok TG readback returned Unauthorized; its scheduled ledger record was left untouched. Other unverified scheduled records likewise remain unchanged.

## HYPOTHESIS

No supported creative-performance hypothesis can be inferred from these cumulative readings. The active owner-approved `lesson-opening-v1` experiment has assignments A (2026-11-18) and B (2026-11-20), but no verified post-age 7d matched cohort; no winner or promotion.

## EXPERIMENT

Read-only review of the current `content/experiments.json`: `lesson-opening-v1` is active; `ad-brand-demo-v1` and `serial-micro-drama-v1` are queued; `vv-setting-group-v1` is paused. No retrospective assignment or arm comparison. The active experiment's first assigned video is not yet seven days old. No experiment registry edits.

## DECISION

**INSUFFICIENT-EVIDENCE.** Exact provider-certified 24h/7d post-age windows: **0** in this daily RU snapshot. Do not treat lifetime views, raw comments, reach or platform followers as proven app acquisition, brand recall or independent test lift. Lessons' primary proxy is comments per 1,000 views, ads' is reach, serials' is native post follows per 1,000 views; only verified content-type cohorts may be compared. Continue readbacks and obtain exact native IDs and provider-certified windows where supported. No creative/policy change, video publication or Monday-only experiment recommendation was performed.
