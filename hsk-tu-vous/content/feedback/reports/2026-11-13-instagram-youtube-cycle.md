# HSK AI Feedback — 2026-11-13 (Zernio RU video evidence)

## OBSERVATION
- Collection: 2026-11-13T00:17:42Z UTC; rolling 30-day publication cohort 2026-10-14T00:17:42Z through 2026-11-13T00:17:42Z. Provider last sync 2026-11-13T00:13:26.086Z; account syncTriggered=true, staleAccountCount=1. Source: Zernio_RU analytics_get_analytics, account IDs and exact native post IDs in append-only files.
- Instagram RU [@hskai.app](https://www.instagram.com/hskai.app/): **12 Reels, 23,093 cumulative lifetime views**. 3 non-Reels records (images and Story) excluded. [Observation](../observations/instagram-2026-11-13.json).
- YouTube RU [@hskai_app](https://www.youtube.com/@hskai_app): **6 videos, 3,601 cumulative lifetime views**. [Observation](../observations/youtube-2026-11-13.json).
- Only RU Instagram and YouTube are verified on the available Zernio_RU connection; TJ and TikTok/Facebook analytics are not verified here. This is a provider-limited snapshot, not proof of complete platform coverage.
- All 18 video records have window=lifetime and source.windowEvidence=null: **0 exact 24h; 0 exact 7d**. Lifetime is not a matched fixed-age window. Instagram Reel follows are unavailable; YouTube reach/watch/follows/saves/shares are unsupported zero-filled fields and stored null. Provider syncTriggered/staleness means some post-level timestamps are older than collection.
- Durable publication registry content/feedback/publications.json#records is empty: **0/18 independently verified approved-media/source-to-post mappings**. All contentType/series/episodeId/hook/HSK/creativeFormatId/storytellingPattern remain null. RU account locale is not a verified creative source identity.
- Pending [PR #57](https://github.com/akbarholturaev11-lang/Kantent/pull/57) contains older evidence and was not merged or overwritten.

## HYPOTHESIS
- Per content/creative-formats.json#contentGoals, lesson/direct-acquisition uses commentsPer1000Views as a link-request **proxy** (not signups), advertisement/brand-recall uses reach and watch proxies (not recall), and series-part/audience-growth uses provider-post followsPer1000Views or descriptive continuation (not proven follows). With 0 verified contentType mappings and 0 provider-exact 7d records, **none of these type goals can be compared or evaluated on this sample**. High lifetime views do not establish a winning creative treatment.

## EXPERIMENT
- Test ID: feedback-20261113-content-type-evidence-readiness; owner for any future authoring: Calendar Reserve after owner review.
- Baseline: source-stamped lifetime counts above; candidate: post/media/source hash mapping plus actual provider-exact 7d observations, compared within the same platform/account/language/type/series part/duration/format/hook. Require Hook Lab >=3 posts per format, >=500 views per post, >=10% relative lift and <=10% secondary intent drop before even considering owner-reviewed promotion; these thresholds are not proof of causality.
- Confounders: unequal ages, content mix, provider refresh, missing attribution, unavailable actual app acquisition, recall and post follows. Next readback: next Feedback cycle after provider sync. No automatic script or policy patch.

## DECISION
- **insufficient-evidence / unproven; keep testing.** No automatic promotion of Hook, CTA, storytelling, visual-variety arm or content format. Confidence high for provider-returned cumulative counters and native IDs; none for type-specific effectiveness or causality.
- Handoff suggestion only: publishing operator should preserve independently verified approved media SHA, source identity/hash and native platformPostId in durable publication mapping; Calendar Reserve may separately audit future source gaps. This agent did not edit mapping, calendar, source, video or publication.
