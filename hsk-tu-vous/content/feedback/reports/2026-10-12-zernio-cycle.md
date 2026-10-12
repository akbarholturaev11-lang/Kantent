# HSK AI Content Studio — feedback cycle (2026-10-12)

## OBSERVATION — verified provider records

- Rules: `content/hook-lab.json#policy`, from GitHub `main` at `1c4994e46b624ead7de67397c8dd959774d756b9`. Rolling `analysisLookbackDays=30` selected using the posts' actual `publishedAt`; `earlySignalWindow=24h` and `primaryDecisionWindow=7d`.
- Zernio call: `analytics_get_analytics`, platform `instagram`, published-date query `2026-09-12` through `2026-10-12`, limit 100, one returned page. Account: `hskai.app`; provider `lastSync=2026-10-12T00:46:08.382Z`; captured `2026-10-12T00:53:46.225Z`.
- Zernio returned **13 published Instagram items**, of which **10 videos (Reels) and 3 carousels**. Source-stamped records: [instagram-2026-10-12.json](../observations/instagram-2026-10-12.json). Earliest returned `publishedAt=2026-09-22T17:18:15.000Z`, latest `2026-10-10T13:03:20.000Z`. The query does **not prove** full historical coverage back to September 12.
- All 13 observations have provider-reported **lifetime cumulative** totals; metric units are identified in the snapshot. A provider metric reported as an integer `0` is different from missing `null`; neither proves a conversion event occurred.
- Highest returned Reel lifetime views: [September 28 Reel](https://www.instagram.com/reel/Dd0ssElIdqg/) — **4,384 views**. This is not a controlled 7d result, and the provider's output does not establish the hook/HSK-level mapping.
- TikTok: connected Zernio `analytics_get_analytics(platform=tiktok)` returned **0 analytics rows and 0 platform accounts**, not 0 views. The `posts_list(status=published)`/`posts_get` endpoints reported four Zernio post records with TikTok in the platform list: `6ac5c7a72191fad1efac07dd` (scheduled Oct 7), `6ac0beec338d29b5fcdbb848` (scheduled Oct 4), `6ac0eeeb0b60f50338e7461f` (scheduled Oct 3) and `6abab89a570fa5302c13492e` (scheduled Sep 28). **These scheduled timestamps are not verified `publishedAt` timestamps.** TikTok platform post IDs, URLs and performance metrics were not supplied by these calls, so no fabricated TikTok observations were appended. This is a provider coverage gap, not proof of no engagement.
- No post-to-`episodeId`/`hookFormat`/`hskLevel` mapping is independently verified from the published video and production review snapshot. Those fields remain **null**.
- Current calendar has six dated future planned items strictly after Oct 12 (Oct 13, 14, 16, 19, 21, 23) against `planningBuffer.targetFutureEpisodes=4`, so **no replenishment or scenario rewrite** is warranted.

## HYPOTHESIS — unproven

An opening that states a concrete beginner mistake or payoff more clearly might improve early attention. Lifetime reach/watch/skip disparities also reflect age, topic, audience and duration. The retrieved data cannot isolate an opening's causal contribution.

## EXPERIMENT — proposed only, not registered or launched

For future *unapproved* lessons, preregister a single hook-format change while holding platform, HSK level, duration band, voice, CTA and major packaging constant. Obtain verified post-to-episode mapping and provider-labelled `24h` measurements for preliminary signals, then provider-labelled `7d` for the primary decision. Avoid changing more than one material variable per comparison; no production or automatic posting is authorized here.

## DECISION — insufficient-evidence

`insufficient-evidence`: no source-verified primary 7d cohort. The Hook Lab requires a matched platform, level, duration band, metric definition, **at least 3 posts per format**, **at least 500 views per post**, **at least +10% relative lift**, and **no worse than -10% on secondary saves/shares-per-1000-views intent guardrails**. These criteria cannot be evaluated from unmatched lifetime totals. A real 24h window alone must never name a winner; adoption additionally requires owner decision.

No published/approved episodes, CTA, voice, rendering, code or publishing workflow were modified. No API key, HSK AI app-user data, synthetic statistic or automatic social post was used.

## SOURCE COVERAGE / VALIDATION

- Source files: `hsk-tu-vous/AGENTS.md`, `AI_RULES.md`, `content/calendar.json`, `content/hook-lab.json`, `content/cta-lab.json`, `content/feedback/AGENT_PLAYBOOK.md`, and `content/feedback/README.md` at the recorded GitHub main revision.
- Source verification: Zernio provider `analytics_get_analytics`, `accounts_list`, `posts_list` and `posts_get`; Instagram post URLs in the accompanying append-only dataset.
- Unresolved: full 30-day historical completeness, true fixed 24h/7d provider readbacks, platform TikTok media IDs/URLs/metrics, verified Hook mapping, comparable intention guardrails, conversion attribution.
- Tests/CI: pending PR and GitHub Actions run; a connector write alone is not a completed CI test.
