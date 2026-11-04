# HSK AI Content Studio — feedback cycle 2026-11-04

## OBSERVATION

- GitHub main at collection: `32b9180063389477431b4636460fdad190da5e54`. Connected accounts verified from Zernio_RU accounts_list and Zernio list_social_accounts. Collection: `2026-11-04T00:52:46.956Z` UTC. Rolling publishedAt cohort: `2026-10-05T00:52:46.956Z`–`2026-11-04T00:52:46.956Z` (30 days). Exact 24h early / exact 7d primary per Hook Lab policy. Query inclusive date boundaries are not post-age windows.
- INSTAGRAM RU @hskai.app: 14 videos, 13 rows with provider views, 1 unknown; 45510 **lifetime** views; provider sync 2026-11-03T22:09:01.625Z, stale accounts 1.
- YOUTUBE RU @hskai_app: 8 videos, 8 rows with provider views, 0 unknown; 5484 **lifetime** views; provider sync 2026-11-03T22:09:01.625Z, stale accounts 1.
- INSTAGRAM TG @hskai.apptj: 2 videos, 0 rows with provider views, 2 unknown; unknown **lifetime** views; provider sync unknown, stale accounts unknown.
- YOUTUBE TG @hskai.app-tj: 2 videos, 0 rows with provider views, 2 unknown; unknown **lifetime** views; provider sync unknown, stale accounts unknown.
- Sources: Zernio_RU `analytics_get_analytics` (RU) and Zernio `list_posts` (TJ). TJ list_posts does not supply verified native media ID or synced metric values; no assumption of zero. Provider record IDs, URLs, exact publish time, collection time, units, refresh and sync status in append-only snapshots.
- Provider-exact 24h records: **0**. Provider-exact 7d records: **0**. Verified media-to-source creative-version mappings: **0**. Matched 7d creativeFormatId cohorts: **0**. YouTube videos are short duration but native Shorts classification is not proven by the available endpoint. No TikTok included.

## HYPOTHESIS

A concrete learner choice/question in the first two seconds might increase saves per 1000 views versus a generic explanatory intro. This is an unverified proposal, not a measured effect.

## EXPERIMENT — proposed, not launched

For a separately approved future Calendar Reserve experiment, match platform, locale, HSK level, duration band, creativeFormatId and all other major variables. Verify exact published creative/media identity and provider-exact 7d window start/end/provider record ID. Minimum 3 posts per format, 500 views each, >=10% descriptive lift and saves/shares per 1000 views guardrails (not down >10%). No automatic script, CTA, calendar, video or publication changes.

## DECISION

**insufficient-evidence**: lifetime views are not fixed-age outcomes; missing native IDs for TJ, exact windows and source binding block causal or viral claims. A fresh lifetime snapshot is not a 7d test. No owner-approved policy change.

## Provenance / delivery

Instagram: `observations/instagram-2026-11-04.json`; YouTube: `observations/youtube-2026-11-04.json`. Observations preserve all missing metrics as null, with no `source.windowEvidence` because none is established. Prior snapshots immutable. Read-only CLI `content:feedback`, `content:viral-plan`, `content:buffer` not executed through connector environment; no claim of actual TTS/MP4 readiness. No publication/DM. PR/CI/merge status must be verified from GitHub independently.
