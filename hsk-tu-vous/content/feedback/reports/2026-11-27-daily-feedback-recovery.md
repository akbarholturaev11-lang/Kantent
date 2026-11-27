# Daily Feedback recovery — 2026-11-27 (Asia/Shanghai)

## OBSERVATION — verified source readback
Manual owner-requested completion of incomplete daily runs. Baseline main `b2f7b35d25ec7bcd42d0b1f85e75480ee4faee76`; observation-readback HEAD `528f8fbcf111098e4bc91a48f2b6375c341ddbad`. Connected RU/TG Instagram, YouTube, TikTok and shared Facebook (TG receipts only for attribution); Telegram and photo posts excluded. Exact approved Zernio IDs/account/platform were queried; no caption/date joins or re-publication. 48 approved ledger records; 37 initially required status/native-ID readback. 16 scheduled records became provider-confirmed published (RU IG 4, RU YT 4, RU TikTok 6, TG YT 1, TG FB 1). A further 16 native-ID fields were independently confirmed (TG Instagram 3, RU/TG TikTok 9, TG Facebook 4) via exact authenticated account native post records, cross-checked exact provider permalinks (tracking-query only removed for TikTok). FB analytics permalink cross-check matches the native endpoint; existing receipt URL preserved. The newly published TG YouTube video ID was first URL-derived under owner exception, subsequently confirmed by native account posts. No approval, video, content, CTA or creative hashes changed. Final ledger: 36 published, 12 scheduled (27–28 November); no published native ID missing. All 48 records passed exact current reconciliation/mapping validation and duplicate-key checks. RU TikTok was reachable using the correct connected credential group.

Six immutable snapshot files (all checked using the exact current source validateDataset function and dependencies; each re-fetched and validated again):
- [RU Instagram](../observations/instagram-2026-11-27-ru.json): 12, 8 attributed.
- [RU YouTube](../observations/youtube-2026-11-27-ru.json): 11, 8 attributed.
- [TG Instagram](../observations/instagram-2026-11-27-tg.json): 6, 3 attributed.
- [TG YouTube](../observations/youtube-2026-11-27-tg.json): 7, 4 attributed.
- [TikTok RU/TG](../observations/tiktok-2026-11-27.json): 12, 9 attributed.
- [Facebook](../observations/facebook-2026-11-27.json): 5, 4 attributed.

53 genuine video readings, 36 exact approved content mappings, 17 unlinked (content type, language attribution, hook, HSK, format and storytelling not inferred). One additional TG Instagram reel on 23 Nov was confirmed in the native account list but no exact Zernio publication join was returned; its dashboard views were not attributed or saved as a mapped result. No new series-part publication was verified. Rolling 30-day publication lookback, collection 2026-11-27 approximately 03:24–03:29 UTC. All saved windows are lifetime, not certified 24h or 7d; RU provider metric timestamps retained; other connector observations use collection time and explicitly platform-scoped dashboard dataAsOf, with unknown per-post refresh timestamp. No unsupported follows, clicks, signups, installs or recall inferred. HSK and creative format are unknown where exact approved source cannot prove them, and storytellingPattern is null throughout. Photos excluded.

Attributed lesson results (aggregated lifetime views/comments are descriptive only, not a common post-age cohort):

| Account | Lessons | Views | Comments | Comments / 1000 views |
| --- | ---: | ---: | ---: | ---: |
| Instagram RU | 6 | 3883 | 12 | 3.09 |
| YouTube RU | 6 | 1027 | 0 | 0 |
| Instagram TG | 3 | 1439 | 5 | 3.47 |
| YouTube TG | 4 | 95 | 0 | 0 |
| TikTok RU | 5 | 2869 | 1 | 0.35 (descriptive; new TikTok CTA does not ask for comments) |
| TikTok TG | 2 | 171 | 0 | 0 (descriptive) |
| Facebook TG | 4 | 353 | 0 | 0 |

Ads (reach primary, per post; not unique reach across posts): RU Instagram Nov 24 reach 573, Nov 26 reach 269; RU TikTok Nov 24 reach 140, Nov 26 unknown; RU YouTube Nov 24/26 reach unknown. No brand recall or conversion claim. Serial follow KPI unmeasured.

## HYPOTHESIS / EXPERIMENT — daily status only
No new weekly hypothesis or policy change. Current `lesson-opening-v1` registry and exact ledger prompt hashes confirm A on Nov 18 and 23 and B on Nov 25 (RU IG, YT, TikTok published; A Nov 23 additionally TG YT and FB). The 20 Nov B assignment has no verified publication mapping. The 27 Nov A remains scheduled. Nov 25 RU IG B lifetime 752 views / 1 comment; Nov 23 RU IG A 431 / 1; Nov 18 RU IG A 529 / 0. Not matched post-age observations. Zero exact 24h/7d evidence. The missed 168–192h window for Nov 18 cannot be recovered by relabelling the current older lifetime readback. Continue scheduled collection; next near-week ages for Nov 23 and 25 are Nov 30 and Dec 2 respectively, with exact times relative to each actual publish time. No winner; INSUFFICIENT-EVIDENCE. Minimum 3 independent posts/arm and 500 views/post plus guardrails not established. Reused localized/platform versions are correlated.

## DECISION — operational audit
Actual Actions push runs retrieved from branch=main endpoint (PR-only wrapper returned no runs). Baseline already had a failed run [45212322096](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/45212322096). Post-write runs [45934035051](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/45934035051), [45934185692](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/45934185692), [45934276891](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/45934276891) failed the same `scripts/experiments.test.mjs:34` assertion: tie should return arm A (opposite of latest B) but actual arm B. Consistency jobs passed; the first failing test is pre-existing, not evidence of a new observation schema error. Latest observation push run [45934467285](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/45934467285) was in progress at report creation. Do not claim green CI. Engineering repair requires separate owner-authorized Claude Code task; Feedback did not edit tests, registry or production. Full npm diagnostic commands were not executable in the connector runtime; the actual pure validation functions from current main were executed with their exact source bodies and dependencies, not a handwritten approximation. No PR created; #57 closed, no open PRs. No social publish or DM performed.
