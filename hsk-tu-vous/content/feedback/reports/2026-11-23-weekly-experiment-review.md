# Weekly content experiment review — 2026-11-23 (Asia/Shanghai)

## OBSERVATION — verified, lifetime only

Fresh main baseline: `5b6db9a5974479d7719ab739815f440f1fee1b3c`. Current connected Zernio_RU: Instagram RU `6a411e989d9472faae10a430`, YouTube RU `6ac96e053f8f4ffc10b0655f`. Current connected Zernio TJ: Instagram `6ae0f16205fd6f5357f8503d`, YouTube `6ae160123787e4c71b522d64`. Both Zernio TJ accounts report connected. No open PRs. The 2026-11-19 RU Instagram photo-news post was excluded from video comparison. Historical video attribution uses the approved `content/feedback/publications.json` ledger, exact account, platform, native ID where present and media hashes; no date/title joins.

Provider RU `analytics_get_analytics` requested 2026-11-12–2026-11-23; provider `lastSync=2026-11-22T23:49:34.160Z`, `staleAccountCount=0`. Source observations are **cumulative lifetime**, not post-age 24h or 7d. Verified video rows:

| Locale/platform | Published (UTC) | Zernio post | Provider record | Views | Comments | Comments / 1000 views | Other |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| RU Instagram lesson A | 2026-11-18 13:04:50 | `6afc246cd73ed4914daf08f2` | `6afda36a5755a71f1cac5ee8` | 477 | 0 | 0.00 | reach 296, saves 10, 63s; updated 2026-11-22T23:49:26Z |
| RU YouTube lesson A | 2026-11-18 13:00:09 | `6afc24fe17fc71d17cf0fdb4` | `6afdc9c80df787860bd658bd` | 48 | 0 | 0.00 | 64s; updated 2026-11-22T23:00:39Z |
| RU Instagram lesson | 2026-11-17 13:03:34 (provider) | `6afbc4294a8ecfab59d2fdd2` | `6afc69c955ed69cd705c61ec` | 373 | 4 | 10.72 | reach 224, saves 6; updated 2026-11-22T23:49:26Z |
| RU YouTube lesson | 2026-11-17 13:00:11 (provider) | `6afbc4ae86f07caca87ae669` | `6afc6bc7c459cb0187332ba0` | 136 | 0 | 0.00 | updated 2026-11-22T23:00:39Z |
| RU Instagram lesson | 2026-11-14 14:03:29 (provider) | `6af7df6f60f43b40f930b1a6` | `6af89657e68f4105b581a2f0` | 1125 | 4 | 3.56 | reach 730, saves 47; updated 2026-11-22T12:13:20Z |
| RU YouTube lesson | 2026-11-14 14:00:25 (provider) | `6af7dfe90acc2e26cd09cbde` | `6af896e6e780823870cc87cb` | 72 | 0 | 0.00 | updated 2026-11-22T11:21:15Z |

Zernio TJ `get_post_analytics` live `sync_status=synced`: Instagram lesson 2026-11-17 `6afbc565660b23b40d686cd7` 281 views, 3 comments (10.68 per 1000), reach 159, saves 5; YouTube lesson `6afbc5bfd0ac7be2b45a693d` 75 views, 0 comments (0.00 per 1000); Instagram lesson 2026-11-14 `6af7e061109932a603fe34c2` 568 views, 0 comments (0.00 per 1000), reach 353. TJ connector returns no independently certified post-age window and no provider metric-update timestamp in these responses. Its displayed zeros for reach/clicks on YouTube are **not** independently proven conversion or unique reach measurements. Actual app signups, installs, link requests, post follows, ad recall and exact fixed-window attribution: **unknown**.

## EXPERIMENT — lesson-opening-v1

Current owner-approved `content/experiments.json`: active lesson experiment `lesson-opening-v1`, treatment A = challenge → answer → practice; B = common mistake → correction → practice. Recorded assignments: 2026-11-18 A, 2026-11-20 B, 2026-11-23 A, 2026-11-25 B, 2026-11-27 A. **Only the 2026-11-18 RU Instagram/YouTube A publication has verified active-test published readbacks in the checked ledger.** No B publication readback was independently verified in this run; no retrospective matching. The 2026-11-23 A RU scheduled records `6b02d541ce7c17eb705a3843` and `6b02d70df2e81344204f9500` remain scheduled at the morning readback; RU Zernio_RU confirms the Instagram one scheduled for 2026-11-23 13:00 UTC. TJ `get_post` of those RU IDs returned Unauthorized as expected for the wrong account. Do not treat scheduled items as published.

**Primary metric**: lesson `commentsPer1000Views` is a proxy for link-request intent, not installs. **Exact 7d eligible observations: 0.** The first A videos are not yet 168 hours old. No certified `source.windowEvidence` for the active test; no matched B cohort. Minimum 3 independent posts per arm, 500 views per post, 10% lift and guardrails are not satisfied. RU/TJ and Instagram/YouTube are distinct cohorts; reused localized media is correlated, not independent. Current verdict: **INSUFFICIENT-EVIDENCE / KEEP TESTING**. No lift, winner or policy promotion. Next directional lifetime readback for first A: 2026-11-25 at 13:00–2026-11-26 13:00 UTC (168–192h after YouTube), explicitly not exact 7d. Seek provider-certified 168h post-age data separately if available.

## HYPOTHESIS — owner handoff only

At most one next hypothesis, **not an experimental reassignment**: keep the registered B opening as the only manipulated factor (real learner mistake corrected immediately), holding topic difficulty, platform, language, duration band, CTA, voice and posting time as close as feasible. Calendar Reserve should preserve the already approved balanced A/B assignments; obtain verified B published receipts and fixed-window observations before suggesting any replacement. Test KPI: lesson comments per 1000 views on provider-certified exact 7d windows. Topic, weekday and the initial office-vs-metro setting are confounders. Do not infer downloads from comments.

## DECISION / EVIDENCE LIMITS

Ad `ad-brand-demo-v1` and series `serial-micro-drama-v1` are queued, not active: no ad-recall or follower-growth claims; no cross-type winner. The paused visual-variety experiment stays paused. Existing published TJ Instagram Reel shortcodes are URL identities, not numeric native platform IDs; missing numeric IDs remain null. The existing ledger has 30 records at the checked main baseline, including scheduled records; status is not proof of published media. Exact 7d observations: 0 in the current verified readbacks; experiment arm B verified published rows: 0; Instagram TJ numeric IDs: unknown. No observation JSON created because the exact current `scripts/feedback-analyzer.mjs#validateDataset` was not executable in this connector-only run; mandatory validation gate is not bypassed. This report is a factual read-only analysis written under the report-only authorization, not a raw provider snapshot. No source scripts, schedules, experiments, policy, published media or old observations changed.
