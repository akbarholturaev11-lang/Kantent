# HSK AI Content Studio — feedback cycle (2026-10-30)

## OBSERVATION — ўз аккаунтлар, rolling publishedAt cohort

- GitHub `main` (ёзишдан олдин қайта текширилди): `9c9382ed887031de58b0ef30b0f7e88380c6af68`; очиқ feedback PR: **0**. 2026-10-28 immutable snapshot'лар сақланди; 2026-10-30 учун янги маълумотлар қўшилди, эскиси overwrite қилинмади.
- **Connected accounts:** Zernio RU `accounts_list`: Instagram **hskai.app** (`6a411e989d9472faae10a430`) ва YouTube **hskai_app** (`6ac96e053f8f4ffc10b0655f`); иккинчи Zernio `list_social_accounts`: Instagram **hskai.apptj** (`6ae0f16205fd6f5357f8503d`) ва YouTube **hskai.app-tj** (`6ae160123787e4c71b522d64`). Ҳар бири алоҳида connection scope. TikTok далилли уланиш/media йўқ, таҳлилга киритилмади.
- **Policy:** `content/hook-lab.json#policy` — `publishedAt` бўйича rolling **30 кун**, cutoff `2026-09-30T00:13:31.585Z`, collectedAt `2026-10-30T00:13:31.585Z`; `24h` early, `7d` primary. RU `analytics_get_analytics` endpoint'и `from_date=2026-09-30`, `to_date=2026-10-30`, `limit=100`, `page=1`. Provider lastSync `2026-10-30T00:10:38.851Z` (Instagram) ва `2026-10-30T00:10:38.851Z` (YouTube). IG staleAccountCount `1`, YT `0`; баъзи individual metric updates эскироқ.
- **Instagram RU Reels:** [snapshot](../observations/instagram-2026-10-30.json) — **17** native-ID Reels, **16** synced, **1** unavailable, **47,063 lifetime views** (synced rows). **1** image/feed пост Reels ҳисобидан чиқарилди. Top: [18112275989167272](https://www.instagram.com/reel/DeZkfCbDc3o/) — **22,652 lifetime views**. 28 октябр билан бир хил **14** synced native ID учун йиғма lifetime фарқи **+1,238**; бу fixed-age performance lift эмас. Янги RU Reel IDs: `18098924936408111`, `18136730320642165`.
- **Instagram TJ Reels:** `hskai.apptj`да **2** published Reel ([28 октябр](https://www.instagram.com/reel/DfB5BkXFWgV/) — **498 lifetime views**; [29 октябр](https://www.instagram.com/reel/DfDyLszCKeW/) — **344 lifetime views**), иккаласи synced; йиғма **842 lifetime views**. Zernio `get_post_analytics` native `platformPostId` ва provider `syncedAt` қайтармаган; `unmappedProviderPosts`да `platformPostId:null`, `syncedAt:null` билан сақланди, analyzer cohort'ига киритилмади.
- **YouTube RU short-form video:** [snapshot](../observations/youtube-2026-10-30.json) — **8** provider video, **8** synced, **5,452 lifetime views**. Top: [xN1OZkcVgHY](https://www.youtube.com/watch?v=xN1OZkcVgHY) — **1,213 lifetime views**. 28 октябрдаги **6** бир хил native ID учун йиғма lifetime фарқи **+4**. Янги IDs: `g2Ghvf8PD-4`, `Kn2IeJkdhII`. Провайдер `mediaType=video` ва қисқа давомийликни берди, алоҳида Shorts classification flag йўқ.
- **YouTube TJ:** `hskai.app-tj`да **2** published video ([28 октябр](https://www.youtube.com/watch?v=F6RXCEEx3CQ), [29 октябр](https://www.youtube.com/watch?v=Va9a1AqDzVs)); `get_post_analytics` иккаласида `sync_status=pending`. Provider default `0` metrics **unknown/null**, ноль натижа эмас. Native `platformPostId` ва `syncedAt` йўқ; фақат `unmappedProviderPosts`да сақланди.
- **Provenance:** RU observation'лар `platformPostId`, `providerRecordId`, мавжуд `zernioPostId`, `postUrl`, actual `publishedAt`, `observedAt`, `collectedAt`, `source.syncedAt`, `source.providerMetricUpdatedAt`, `source.syncStatus`, query/endpoint ва metric unit'ни сақлайди. TJ Zernio post ID ва URL ҳақиқий, native ID ва sync timestamp `null`. Барчаси **`window=lifetime`**; exact `source.windowEvidence` **йўқ**. `episodeId/hookFormat/hskLevel/effectStyle/creativeFormatId/storytellingPattern=null`: `content/feedback/publications.json#records` бўш; actual video-to-sourceHash/media proof йўқ. Real 7d creativeFormatId cohorts: **0**.

## HYPOTHESIS — натижа эмас

Биринчи икки сониядаги аниқ Mandarin вазият/хатонинг визуал намойиши умумий intro'га қараганда Instagram Reel skip-rate'ни камайтириши мумкин. Мос `7d` window, verified Hook/format mapping ва назорат гуруҳи йўқ; катта lifetime views Hook самараси ёки вируслилик сабабини исботламайди.

## EXPERIMENT — таклиф, ишга туширилмаган

`feedback-hook-intro-20261030-v1`: кейинги алоҳида owner-approved Calendar Reserve сценарийларида **фақат Hook intro** A/B ўзгарувчисини синаш. Бир хил account/platform, locale, HSK, duration band, `creativeFormatId`, voice ва CTA; exact provider `7d` start/end ва native record ID шарт. Hook Lab minimum: ҳар format **≥3 post**, ҳар post **≥500 views**, relative lift **≥10%**, secondary `savesPer1000Views` ва `sharesPer1000Views` **10%**дан ортиқ тушмасин; owner қарор қилади. Бу ишда сценарий ёзилмади ва эксперимент ишга тушмади.

## DECISION — insufficient-evidence

Verified provider-exact `24h` records: **0**; verified `7d` records: **0**; verified source-bound creative/Hook/HSK/format/story mapping: **0**; eligible matched primary 7d comparisons: **0**. Турли ёшдаги lifetime totals 24h/7d эмас. TJ YouTube analytics pending, TJ native post IDs йўқ. Authorized competitor source ёки янги Instagram caption proposal йўқ, тегишли skill'лар чақирилмади. Ҳеч қандай publish/DM, future scenario, localization, motion, calendar, CTA, Gemini voice, SRT ёки renderer ўзгартирилмади.

## READ-ONLY SOURCE READINESS / HANDOFF

`content/languages.json`: `ru` ва `tg`. `content/calendar.json`да 2026-10-30, 10-31, 11-01, 11-02, 11-04, 11-06 planned lesson/series entries; иккала locale'нинг мос source JSON файллари GitHub directory listing'да мавжуд. 30 октябрдан кейин **5** planned lesson/series, minimum **3** ва target **4**дан кам эмас; текширилган horizon'да аниқ missing date/ID/locale файл топилмади. Бу фақат file presence: `localization.sourceHash` integrity, cue-linked motion, Gemini TTS, MP4, final preview ва publication readiness тасдиқланмаган. `content:buffer`, `content:feedback`, `content:viral-plan` CLI бу коннектор муҳитида ишга туширилмади. Calendar Reserve'га тасдиқланган source-gap handoff йўқ.

## GITHUB DELIVERY

Фақат `content/feedback/observations/instagram-2026-10-30.json`, `content/feedback/observations/youtube-2026-10-30.json`, `content/feedback/reports/2026-10-30-instagram-youtube-cycle.md`. PR/CI/merge/new `main` readback ушбу report'дан ташқари мустақил текширилади; матнни merge далили деб қабул қилманг.
