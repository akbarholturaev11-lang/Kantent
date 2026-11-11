# HSK AI Feedback — 2026-11-11 (Zernio RU video evidence)

## OBSERVATION
- Collection: 2026-11-11T00:25:10Z UTC; rolling publication cohort 2026-10-12T00:25:10Z through 2026-11-11T00:25:10Z. Provider last sync: 2026-11-10T23:41:08.004Z. Source: connected Zernio_RU `analytics_get_analytics`, `from_date=2026-10-12&to_date=2026-11-11`, actual account IDs and post IDs in the linked append-only observations.
- Instagram RU [@hskai.app](https://www.instagram.com/hskai.app/), account `6a411e989d9472faae10a430`: **11 video/Reels, 43,779 lifetime views**. 2 non-video feed images excluded. [Raw observation](../observations/instagram-2026-11-11.json).
- YouTube RU [@hskai_app](https://www.youtube.com/@hskai_app), account `6ac96e053f8f4ffc10b0655f`: **6 videos, 4,515 lifetime views**. [Raw observation](../observations/youtube-2026-11-11.json).
- Current connection lists only these two RU video accounts; TJ Instagram/YouTube and TikTok/Facebook video-account analytics **not verified by this connection**. Provider coverage is limited to available returned records, not proof of complete platform history.
- Exact post-age **24h: 0; 7d: 0**; all observations `window=lifetime` and `source.windowEvidence=null`. No fixed-window experiment or comparable lift is established. Instagram provider reports follows as null for Reels; YouTube generic zero-filled reach/follows/watch/saves/shares are **unsupported/unknown**, not confirmed zero.
- Durable publication registry `content/feedback/publications.json#records` is empty. **Verified source/media-to-post attribution: 0/17**. All contentType, lesson/advertisement/series-part, language-specific source identity, series part, episodeId, HSK, Hook, creativeFormatId and storytellingPattern remain unverified/null. RU account language is known, but that alone does not prove a specific authored source or video.
- This is a new provider readback since 2026-11-09 (new metric timestamps through 2026-11-10). Pending [PR #57](https://github.com/akbarholturaev11-lang/Kantent/pull/57) contains older 2026-11-06 evidence; it is not a replacement for this append-only readback.

## HYPOTHESIS
- The content-type goal policy in `content/creative-formats.json#contentGoals` distinguishes **lesson/direct-acquisition** (comments per 1,000 views as link-request proxy, sourced clicks/signups preferred), **advertisement/brand-recall** (reach and average watch as exposure proxies, not measured recall) and **series-part/audience-growth** (provider post follows per 1,000 views; continuation ratio descriptive only). These goals **cannot be evaluated per type** on this cohort without verified media/source mapping and exact 7d provider windows. Lifetime totals cannot establish winner or causality.

## EXPERIMENT
- Test ID: `feedback-20261111-content-type-evidence-readiness`; owner for any future source test: Calendar Reserve **after owner review**.
- Baseline: this readback, lifetime only; candidate: same platform/account/language/type/series-part/duration/format cohort with independently verified native post/media/source identity and provider-exact 7d records. Primary metrics by type follow `contentGoals`; supporting watch/saves/shares and attribution must be provider-backed.
- Confounders: differing post ages, distribution, creative type and unlinked media; unverified clicks/installs/recall/follows; YouTube metric placeholders. No automatic scenario patch is authorized. Next readback: next scheduled Feedback cycle, conditional on provider sync.

## DECISION
- **insufficient-evidence / unproven; keep testing.** Do not promote a Hook, CTA, visual-variety arm, storytelling pattern or content type; do not claim app installs, actual brand recall or new followers.
- Handoff suggestion only: the publishing operator should preserve exact approved media SHA, native platformPostId and source content identity in the durable mapping after a verified publication; Calendar Reserve may separately review source reserve gaps. This Feedback agent did not modify publication mappings, scenarios, calendars, video or social posts.
- Confidence: **high** for the displayed provider lifetime snapshots and account IDs; **none** for causal or content-type performance attribution. No exact 24h/7d window was obtained.
