# HSK AI Content Studio — feedback cycle (2026-10-16)

## OBSERVATION — verified connected-account metadata and provider measurements

- **Verified at run start:** Zernio `accounts_list` returned **2 connected accounts**: Instagram `hskai.app` (account ID `6a411e989d9472faae10a430`), YouTube `hskai_app` (account ID `6ac96e053f8f4ffc10b0655f`). **TikTok is not connected and was not queried.** Legacy Zernio posts referencing TikTok are not live verified analytics.
- Canonical review rules: `content/hook-lab.json#policy`, fetched from `main` at `342c2899ff2e2558d9c39462816feae6b318070f`: rolling `analysisLookbackDays=30` relative to each collection's `collectedAt` using actual `publishedAt`; `earlySignalWindow=24h` only exploratory and `primaryDecisionWindow=7d` primary. Queries on each platform used `from_date=2026-09-16, to_date=2026-10-16`, `limit=100`, `page=1`, and collected observations within their exact rolling 30-day cutoff.
- **Instagram** [append-only source snapshot](../observations/instagram-2026-10-16.json): **14 returned published posts (11 videos, 3 carousels)**; **31,588 total lifetime views summed over unequal-age posts**. Zernio `lastSync=2026-10-16T00:07:53.769Z`, collection `2026-10-16T00:18:04.857Z`. Highest returned Reel: [18112275989167272](https://www.instagram.com/reel/DeZkfCbDc3o/), published `2026-10-12T15:36:48.000Z`, **15,589 lifetime views**. The same post was **10,916** in the separate Oct 14 *lifetime* snapshot; change between provider snapshots **4,673**. It is not a provider 24h or 7d window, nor a causal Hook improvement.
- **YouTube** [append-only source snapshot](../observations/youtube-2026-10-16.json): **3 videos**, **1,884 summed lifetime views** across unequal-age published videos, Zernio `lastSync=2026-10-16T00:07:53.769Z`, collection `2026-10-16T00:18:31.613Z`. Highest video [d_tEjT35RDE](https://www.youtube.com/watch?v=d_tEjT35RDE) had **913 lifetime views**, versus **819 lifetime views** in the Oct 14 snapshot. Difference **94** is between snapshot times, **not** an exact age-based measurement window.
- YouTube raw provider zero-default unsupported reach/impressions/retention/saves/shares are stored as `null`, not interpreted as measured zero. Positive source `videoDurationSeconds` is reported with units; this does not verify HSK level, Hook experiment or post-to-episode mapping.

| YouTube actual publishedAt (UTC) | Video ID and source URL | Lifetime views (count) | Likes (count) | Provider duration (seconds) | Window |
|---|---|---:|---:|---:|---|
| 2026-10-12T15:42:37.000Z | [d_tEjT35RDE](https://www.youtube.com/watch?v=d_tEjT35RDE) | 913 | 6 | 31 | lifetime |
| 2026-10-10T13:00:05.000Z | [B23HMNI60FQ](https://www.youtube.com/watch?v=B23HMNI60FQ) | 468 | 2 | 31 | lifetime |
| 2026-10-09T22:11:05.000Z | [MZV5luCu5YE](https://www.youtube.com/watch?v=MZV5luCu5YE) | 503 | 3 | 33 | lifetime |

- Source post IDs, platform/account IDs, platform URLs, `publishedAt`, `observedAt`, metric units, provider sync/metric refresh timestamps, source endpoint and query are stored for each record. `episodeId`, `hookFormat`, `hskLevel`, `effectStyle` are **null**, because the published video-to-production source mapping was not independently verified.
- `calendar.json#planningBuffer` is `minimumFutureEpisodes=3`, `targetFutureEpisodes=4`. **3 planned entries** strictly after Oct 16 (2026-10-19, 2026-10-21, 2026-10-23), below target, but at minimum. **This feedback-data-only cycle did not generate/modify scripts**. Any refill is a separate canonical Calendar Reserve task requiring complete verified Chinese sources, distinct Hook, CTA-free draft and own review/tests; never generate placeholders.

## HYPOTHESIS — not a demonstrated benefit

Clearer beginner problem or payoff in the first seconds of a Russian-language HSK 1–2 video might improve early attention. The observed unequal-age lifetime view differences can be driven by topic, audience and age; they do not establish which hook format is better.

## EXPERIMENT — proposal only (not launched)

For an as-yet-unapproved future lesson, preregister one Hook A/B change with the same platform, same HSK level, similar topic difficulty, same provider-measured video duration band, unchanged central CTA, approved voice and visual packaging. Measure real provider-labelled fixed `24h` only for exploratory signals and real provider-labelled fixed `7d` for the primary outcome. Do not conflate Instagram and YouTube metrics, and do not reconstruct fixed-post-age windows from lifetime totals or day buckets. Independently verify post → episode → Hook mapping before comparing.

## DECISION — `insufficient-evidence`

- Neither platform returned a reliable fixed `7d` comparison group (or verified Hook/episode mapping). **No winning Hook and no production/content change is authorized from these totals**.
- Per `content/hook-lab.json#policy` compare only same platform/window/metric/HSK level/duration band; require **>=3 posts per format**, each with **>=500 views**, **>=10% relative lift**, **<=10% decline** on secondary saves/shares per 1,000 views, plus explicit owner decision before promotion.

## SOURCE COVERAGE / GAP / QA

1. Provider: connected Zernio `accounts_list`, `analytics_get_analytics(platform=instagram)`, `analytics_get_analytics(platform=youtube)`; exact source attribution is embedded in the above append-only JSON files. Provider results: `Instagram=14`, `YouTube=3`, one page each. None is asserted to be the entire 30-day post history.
2. **Coverage gaps:** Instagram source returned published posts only Sept 22 onward (vs rolling Sept 16 start); YouTube only Oct 9 onward. Full provider historical completeness unproven. Exact 24h/7d provider post-age analytics not available; verified episode/Hook level mapping missing; comparable secondary intent metrics for YouTube unavailable. Unavailable ≠ zero.
3. **QA:** The append-only source files and this report should be independently re-read after GitHub writes, with row count, duplicate IDs, timestamps, URLs, units, source stamps and null creative fields validated; PR diff should contain only these 3 feedback files. Tests/CI outcome must be assessed on exact PR HEAD and compared with current `main` baseline, disclosing any pre-existing unrelated CTA preview CI failure.
4. No approved/published videos, CTA registry, voice, renderer, social publishing, keys or HSK AI app-user data were changed. No automated post.
