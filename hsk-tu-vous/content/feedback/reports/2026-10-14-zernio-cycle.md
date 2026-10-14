# HSK AI Content Studio — feedback cycle (2026-10-14)

## OBSERVATION — source-backed facts

- GitHub canonical rules inspected at `main` `001969aa1ecab74d52b6781d536ffdef084bb419`; `hsk-tu-vous/AGENTS.md`, `AI_RULES.md`, `content/calendar.json`, `content/hook-lab.json`, `content/cta-lab.json`, `content/feedback/AGENT_PLAYBOOK.md` and `content/feedback/README.md` read.
- `content/hook-lab.json#policy` is the **only** analysis horizon/window source: `analysisLookbackDays=30` by actual `publishedAt`, `earlySignalWindow=24h`, `primaryDecisionWindow=7d`. Captured at `2026-10-14T00:32:57.278Z`. Cohort lower bound `2026-09-14T00:32:57.278Z`. No fixed-window source result was supplied.
- Read-only Zernio `analytics_get_analytics(platform=instagram, from_date=2026-09-14, to_date=2026-10-14)` returned **13** published Instagram posts (10 videos, 3 carousels) for `hskai.app`; provider sync `2026-10-14T00:21:30.424Z`. The returned earliest Instagram `publishedAt` is `2026-09-22T17:18:15.000Z`, meaning full 30-day history coverage is **not proven**.
- Append-only [sourced snapshot](../observations/zernio-2026-10-14.json) retains real platform post IDs, URLs, timestamps, metric units (counts / milliseconds / percent / seconds), Zernio record identifiers, source endpoint and last metric refresh. Every IG metric is an **unequal-age lifetime** cumulative total, not 24h or 7d.
- Highest returned Instagram Reel: [18112275989167272](https://www.instagram.com/reel/DeZkfCbDc3o/), published `2026-10-12T15:36:48.000Z`, **10916 lifetime views** at provider sync. This does not establish a successful hook or 7-day result.
- Zernio `posts_list` identifies four posts as published with TikTok in their platform set; individual `analytics_get_analytics(post_id=...)` returned four TikTok **platform post IDs** and a shared Zernio record `publishedAt` timestamp, but TikTok platform-specific analytics, TikTok URLs and usernames are absent, with `syncStatus=pending`. The separately retrieved `analytics_get_analytics(platform=tiktok)` returned **0 records**, which is **not zero views**. These are metadata-only records, excluded from numerical observation comparisons.

| Verified TikTok platform post ID | Zernio post-level publishedAt (UTC, not verified platform exact) | Sync status | TikTok URL / metrics |
|---|---|---|---|
| `7693871521714031924` | 2026-10-07T10:31:12.355Z | `pending` | unknown / null |
| `7692758410441297172` | 2026-10-04T10:31:40.329Z | `pending` | unknown / null |
| `7692410869250051329` | 2026-10-03T12:03:04.325Z | `pending` | unknown / null |
| `7690662285085330706` | 2026-09-28T18:57:37.877Z | `pending` | unknown / null |

- `analytics_get_post_timeline` returned daily, date-bucketed cumulative snapshots for selected Instagram posts. It does **not** establish elapsed-age exact 24h or 7d windows. We did not relabel it as either.
- Post ID → episode ID → Hook format, HSK level, effects and creative package cannot be independently mapped from these results; unverified mapping fields are `null`.
- Calendar planning buffer is `minimumFutureEpisodes=3`, `targetFutureEpisodes=4`; **4 planned future dated entries** strictly after Oct 14 (2026-10-16, 2026-10-19, 2026-10-21, 2026-10-23), so no autonomous draft replenishment was needed.

## HYPOTHESIS — unverified

A clearer first-two-second beginner problem/payoff might improve attention; older videos, topics, audiences, content types and durations differ. Lifetime performance cannot isolate the Hook's causal effect.

## EXPERIMENT — proposal only, not launched

Preregister a single hook variation in future unapproved episodes only, while holding platform, HSK level, duration band, current CTA, approved voice and major creative treatment stable. Recover verified platform-media-to-episode matches and genuine provider-labelled 24h snapshots for early hypotheses and 7d snapshots for the primary decision.

## DECISION — `insufficient-evidence`

The 7d comparison groups required by the canonical Hook Lab are **not established**. A defensible primary decision requires the same platform, `7d` window, metric definition, HSK level and duration band; >=3 posts/format, each with >=500 views; >=10% relative lift; and no larger than 10% drop for saves/shares per 1000 views, plus owner approval. The present records are lifetime totals with unknown creative mapping. No winner, no hook promotion, no scenario rewrite and no automatic social publication.

## SOURCE COVERAGE & QA

- Sources: connected Zernio `accounts_list`, `posts_list`, `analytics_get_analytics`, `analytics_get_post_timeline`; canonical GitHub rules listed above; full post-level evidence in the append-only JSON file.
- Gaps: unproven Sept 14–22 Instagram coverage; TikTok currently not in connected account list, pending platform analytics and URLs; exact elapsed-post-age 24h/7d windows; verified episode/Hook/level mapping; platform-comparable intent metrics; app install attribution.
- Feedback JSON checked after GitHub branch write for unique platform IDs, timestamps, source provenance, metric shapes and intentionally null TikTok/creative data. Repository CI outcome is external to this report and must be checked on the PR exact HEAD.
- No change to approved or published videos, central CTA, voice, Remotion, publication controls, API keys or HSK AI application user data. No automated post or auto-merge.
