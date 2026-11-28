# Daily Feedback — 2026-11-28 (Asia/Shanghai)

## OBSERVATION
Baseline main `18fd8efb330a6577effd6c636063b481c9dc407d`. All four credential groups and seven video accounts checked; Telegram excluded. All 12 pending approved receipts queried by exact Zernio ID. Six 27 November lesson publications verified and reconciled, six 28 November series-part receipts still scheduled. Complete ledger (48 records: 42 published, 6 scheduled) passed current reconciliation and mapping validation. No missing native ID on published records. No account, approval, source, video, CTA or creative assignment changed. Commit `e575d728606a04bde61364a60ec3a4138716f7c5`.

Collection 2026-11-28 approximately 00:15–00:19 UTC. Rolling 30 days by publishedAt; 56 verified video analytics readings, 23 duplicate/unchanged readings skipped, three RU IG non-Reel/photo/other excluded. 33 new lifetime observations validated by exact current main validateDataset/validateObservation and dependencies; 28 have exact approved content attribution, 5 remain unknown. Seven new append-only files:
- [Instagram RU](../observations/instagram-2026-11-28-ru.json): 10 (8 mapped).
- [YouTube RU](../observations/youtube-2026-11-28-ru.json): 9 (8 mapped).
- [Instagram TG](../observations/instagram-2026-11-28-tg.json): 3 (3 mapped).
- [YouTube TG](../observations/youtube-2026-11-28-tg.json): 1 (1 mapped).
- [TikTok](../observations/tiktok-2026-11-28.json): 8 (7 mapped).
- [Facebook](../observations/facebook-2026-11-28.json): 1 (1 mapped).
- [Unmapped Instagram TG](../observations/instagram-2026-11-28-tg-unmapped-001833.json): 1 (0 mapped). Native ID 17928968709205236 explicitly returned by authenticated account posts; exact native-ID analytics lookup returned analytics record 6b048a6c7d18294ed6448160, 301 views, 193 reach, 0 comments. No approved Zernio publication receipt, so all content attribution remains null; analytics record ID not used as a scheduled Zernio ID.

All observations re-fetched and validated. Current observation HEAD `c2ff94d02d8c3192afdcc0770e73cc3f2ab3bd21`. RU metrics carry actual provider metric update timestamp; other connectors provide platform-scoped dashboard dataAsOf only; per-post refresh time unknown, observedAt is collection time. All windows lifetime, zero certified 24h/7d. No inferred link requests, installations, follows or recall.

27 November lesson (lifetime; different post ages):
| Account | Views | Comments | Reach |
| --- | ---: | ---: | ---: |
| Instagram RU | 226 | 1 | 120 |
| YouTube RU | 80 | 0 | unknown |
| Instagram TG | 125 | 0 | 85 |
| YouTube TG | 20 | 0 | unknown |
| TikTok RU | 88 | 0 | unknown |
| Facebook TG | 40 | 0 | 38 |

Other actionable readings: RU IG Nov 25 B lesson 780 views/1 comment, Nov 23 A 449/1, Nov 18 A 532/0. RU YouTube Nov 25 B 286/0. RU TikTok Nov 25 B 362/2 (new CTA does not ask for comments; acquisition unmeasured). Ads reach primary: RU IG Nov 24 588 and Nov 26 620; RU TikTok Nov 24 307 and Nov 26 unknown; RU YouTube reach unknown. No actual recall measure. TJ TikTok three verified videos unchanged, no new snapshot. Series part 1 scheduled, no native post follows or part continuation evidence.

## HYPOTHESIS / EXPERIMENT
Daily status only (Saturday). No new weekly hypothesis or champion promotion. Stored lesson-opening-v1 assignments confirmed by existing approved ledger. Nov 27 A now published on six destinations, Nov 25 B already published; no verified Nov 20 B receipt. Zero exact 7d windows; independent matched samples insufficient. Next directional near-week collection for Nov 23 starts Nov 30 at each post's actual published time; not an exact 7d window. Keep testing; no winner.

## DECISION
Completed daily readback and validated append-only collection, not a full weekly review. PR #57 closed, no open PR. No production, publishing, calendar, policy or test code changes. Full npm diagnostics unavailable in connector-only runtime; exact pure validation functions executed from current source, not a rewritten validator. Current main already had failing run 45934657125 (and a later successful run 45954528571); post-write push run [46087073790](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/46087073790) completed failure. Actual failed job logs: consistency job 140799031466, viral-plan.test.mjs:46 synthetic fixture conflicts with episodeId; semantic-foundation job 140799031732, experiments.test.mjs:34 expects A but receives B. Same known failures as 27 November audit; no new observation schema failure established. Do not weaken validation or rewrite historical snapshots. Final CI status must be checked after report push. Engineering repair remains separate from Feedback authorization.
