# HSK AI Content Studio — source-checked feedback (2026-10-19)

## OBSERVATION — connected platforms, fixed policy and real source provenance

- Repository `main` checked at start: `a23b7219aa57d5dd076389cad0bbadc3345f7344`. Zernio `accounts_list` verified exactly two connected accounts: **Instagram hskai.app** (`6a411e989d9472faae10a430`) and **YouTube hskai_app** (`6ac96e053f8f4ffc10b0655f`). **TikTok NOT connected; old TikTok post metadata was not treated as current analytics.**
- Canonical `content/hook-lab.json#policy`: `analysisLookbackDays=30` by actual `publishedAt` relative to collection, `earlySignalWindow=24h` exploratory only, `primaryDecisionWindow=7d` primary, `missingPrimaryWindowDecision=insufficient-evidence`. Query platform-specific connected account IDs from 2026-09-19 through 2026-10-19, page 1, limit 100. All saved post timestamps are within 30 rolling days at collection.
- **Instagram** [sourced snapshot](../observations/instagram-2026-10-19.json): **17 verified connected-account published posts**, **37,908 summed lifetime views** (unequal ages; *not* a 7d or 24h measure). Highest video: [18112275989167272](https://www.instagram.com/reel/DeZkfCbDc3o/), `2026-10-12T15:36:48.000Z`, **18,197 lifetime views**. Collected `2026-10-19T00:42:24.971Z`; Zernio lastSync `2026-10-19T00:27:18.544Z`.
- **YouTube** [sourced snapshot](../observations/youtube-2026-10-19.json): **4 verified connected-account published videos**, **2,772 summed lifetime views** (unequal ages, not fixed window). Highest: [d_tEjT35RDE](https://www.youtube.com/watch?v=d_tEjT35RDE), `2026-10-12T15:42:37.000Z`, **914 lifetime views**. Collected `2026-10-19T00:42:28.329Z`; lastSync `2026-10-19T00:27:18.544Z`.
- Instagram Oct 16 preceding snapshot had 14 posts and 31,588 summed lifetime views; Oct 19 has 17 posts (including three not present Oct 16). YouTube preceding snapshot had 3 posts and 1,884 lifetime views; Oct 19 has 4. **Differences cannot be interpreted as same-cohort view growth or experiments** because both age and the set of posts changed. For post-by-post refresh comparisons, read paired IDs and actual collection times without renaming these measurements as 24h/7d.
- Each record includes exact platform post ID and URL, account ID, `publishedAt`, `observedAt`, metric units, Zernio source endpoint, account filter, sync timestamp and provider `lastUpdated` (timezone unverified). Source `window` is `lifetime`. `episodeId`, `hookFormat`, `hskLevel`, `effectStyle`, `creativeFormatId` are null pending independent published-video mapping. Unverified YouTube zero-default metrics (reach/shares/saves/retention/funnel) are null, not asserted to be measured zeros.
- Future scenario reserve after 2026-10-19: three calendar entries (Oct 21, 23, 26); `minimumFutureEpisodes=3`, `targetFutureEpisodes=4`. One below target; this data-only feedback PR adds **no scenario** because it cannot validate a complete new Chinese lesson and its source bibliography here. Separate Calendar Reserve task owns creation and QA.

## HYPOTHESIS — testable but unproven

A specific beginner mistake or clear immediate payoff in the first two seconds might improve retention in Russian-language HSK 1–2 Reels/Shorts. Current lifetime views are confounded by publication age, topic, length, distribution and audience. They cannot establish lift or causal improvements.

## EXPERIMENT — proposal only, NOT launched

Preregister a hook-format A/B comparison only for future unapproved lessons after verifying each published post → canonical episode → hook tag. Hold same platform, observed fixed post-age window, metric definition, HSK level, duration band, voice and central CTA. For primary `7d` results require at least **3 posts per format**, **500+ views each**, **10%+ relative lift**, and **no >10% fall** in intent guardrails (saves/shares per 1,000 views). `24h` only early signal. Owner decision required for promotion. No production or publishing change approved.

## DECISION — `insufficient-evidence`

No source-verified fixed age-based 7d comparison, verified Hook/episode mapping, or controlled cohorts. Declare **no winning format** and make **no CTA, voice, renderer, content production or publication change**. Do not treat provider lifetime snapshots as 24h/7d. No new API keys, automated social post or HSK AI user data were used.

## SOURCE COVERAGE GAP / QA

1. Sources: Zernio connected accounts via `accounts_list`; `analytics_get_analytics` for `instagram` and `youtube` with each exact connected `account_id`. Timestamped query, syncedAt, provider metric refresh, IDs, post links, units and caveats live in the immutable JSON snapshots. Account sources independently checked for both destinations; **TikTok excluded**.
2. Window gap: Instagram returns posts as early as 2026-09-22T17:18:15.000Z vs rolling Sep 19, and YouTube as early as 2026-10-09T22:11:05.000Z. Full 30-day feed completeness cannot be proven from provider page alone. Neither platform provides certified per-post fixed 24h/7d readbacks here. For YouTube, provider default zero fields and absent intent data cannot be interpreted as zero.
3. Review and CI: verify each file on the exact topic branch, compare only three new feedback-only paths in PR diff, inspect PR HEAD CI and `main` baseline; disclose a pre-existing unrelated failure explicitly if applicable, never call red CI passing. After merge independently fetch latest `main` SHA plus all three files. No published or approved lesson/video modified.
