# HSK AI Content Studio — Instagram + YouTube feedback (2026-10-14)

## OBSERVATION — directly supported by connected sources

- **Verified connected Zernio accounts** (at analysis time): Instagram `hskai.app`, account ID `6a411e989d9472faae10a430`; YouTube `hskai_app`, account ID `6ac96e053f8f4ffc10b0655f`. **TikTok was NOT connected** and is excluded. Older Zernio cross-platform records are not live TikTok analytics.
- Canonical policy source: `content/hook-lab.json#policy`. Its `analysisLookbackDays=30` covers records by actual `publishedAt`; `earlySignalWindow=24h` is exploratory only and `primaryDecisionWindow=7d` requires genuine per-post fixed-window metrics. The query requested the calendar dates 2026-09-14 through 2026-10-14; exact rolling start and collection times are preserved separately in the snapshots.
- Sourced, append-only Instagram [observation snapshot](../observations/instagram-2026-10-14.json) contains **13 posts** (10 Reels and 3 carousels). Platform post ID, actual `publishedAt`, URL, source endpoint, sync and metric refresh times and metric units are captured. Provider sync: `2026-10-14T00:21:30.424Z`.
- Instagram's highest-view Reel among returned records is [18112275989167272](https://www.instagram.com/reel/DeZkfCbDc3o/): **10,916 lifetime views**, not 7-day views. Unequal-age snapshots are not a controlled experiment.
- Sourced, append-only YouTube [observation snapshot](../observations/youtube-2026-10-14.json) has **3 published videos** on connected YouTube account `hskai_app`. Provider sync: `2026-10-14T01:26:32.637Z`. The Zernio source includes YouTube IDs, URLs, publication times, views and likes. Duration was unavailable and cannot be assumed.

| YouTube publishedAt (UTC) | Actual YouTube video | Views (count) | Likes (count) | Comments (count; null if not validated) | Measured period |
|---|---|---:|---:|---:|---|
| 2026-10-12T15:42:37.000Z | [d_tEjT35RDE](https://www.youtube.com/watch?v=d_tEjT35RDE) | 819 | 5 | unknown | `lifetime` |
| 2026-10-10T13:00:05.000Z | [B23HMNI60FQ](https://www.youtube.com/watch?v=B23HMNI60FQ) | 468 | 2 | unknown | `lifetime` |
| 2026-10-09T22:11:05.000Z | [MZV5luCu5YE](https://www.youtube.com/watch?v=MZV5luCu5YE) | 503 | 3 | 1 | `lifetime` |

- YouTube returned **1790 summed lifetime views across 3 unequal-age posts**. This is a descriptive sum only; do not attribute it to one Hook or infer relative platform efficiency from it.
- YouTube source `analytics_get_analytics(platform=youtube)` returned zero defaults for some unsupported metric fields (impressions, retention, shares etc.); **we did not treat them as observed zeros**. The snapshot uses `null` for unsupported/unverified fields.
- Current calendar reserve: **4** future planned episodes (2026-10-16, 2026-10-19, 2026-10-21, 2026-10-23) and target `4`. Therefore do not auto-create another episode.
- No evidence-supported post → episode → hook format/HSK level/creative format matching was proven from live post analytics; such fields remain `null`.

## HYPOTHESIS — not measured as improvement

For future Russian-language beginner HSK videos, an immediately recognisable concrete question in the first seconds could improve audience retention. This hypothesis needs genuinely measured retention and fixed-window intent metrics; view counts alone do not prove it.

## EXPERIMENT — proposed, not applied

For unapproved future scripts, register a single Hook A/B difference while holding the *same platform*, HSK level, duration band, voice, canonical CTA, topic difficulty and visual style stable. For each platform, collect provider-labelled `24h` only for an early signal and provider-labelled `7d` for the primary readback. Never blend Instagram and YouTube results or infer 24h/7d from cumulative totals or daily buckets.

## DECISION — `insufficient-evidence`

- **No Hook format is a verified winner.** No usable fixed `7d` evidence, no verified episode-level Hook mapping, and YouTube videos have missing duration/intent measurements.
- Canonical `hook-lab.json#policy` guardrails: matched platform/window/metric/HSK level/duration band; >=3 posts per format, each with >=500 views; >=10% relative lift; secondary saves/shares per 1000 views no more than 10% worse; explicit owner approval before promotion.
- No edits to approved/published videos, CTA, voice, renderer or posting. No auto-post, new API keys, HSK AI server user data or fabricated statistics.

## SOURCE COVERAGE GAPS / VALIDATION

1. Zernio connected sources: `accounts_list`, `analytics_get_analytics(platform=instagram)`, `analytics_get_analytics(platform=youtube)`; saved source provenance in immutable observation files.
2. The provider returned Instagram published posts only from September 22 onward and YouTube posts only from October 9 onward. **Full 30-day history coverage is unverified**; missing records cannot be called zero posts for the entire period.
3. No provider-defined fixed `24h` / `7d` readback; unequal-age lifetime observations cannot establish lift. YouTube watch duration, comparably measured save/share intent and full retention data unavailable.
4. CI must be verified separately against the PR exact HEAD. Baseline `main` already showed an unrelated `preview-recut-cta.mjs` duplicate-experiment-ID failure; do not silently alter central CTA or claim green CI.

The linked snapshots preserve actual Zernio account, post IDs, URLs, `publishedAt`, `observedAt`, metric count units and original provider refresh timestamps.
