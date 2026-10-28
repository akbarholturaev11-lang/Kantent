# HSK AI Content Studio — feedback cycle (2026-10-28)

## OBSERVATION — ўз аккаунтлар, rolling publishedAt cohort

- Бошланғич GitHub `main`: `dd8091c272bb27ee691b3d21da1280ca30881e09`; текширувда очиқ feedback PR: 0. Аввалги immutable snapshot: 2026-10-26. 2026-10-28 учун янги санали observation/report яратилди, аввалгилари ўзгартирилмади.
- Жорий Zernio RU `accounts_list`: Instagram **hskai.app** (`6a411e989d9472faae10a430`) ва YouTube **hskai_app** (`6ac96e053f8f4ffc10b0655f`) уланган. Бошқа Zernio коннекторида `akbar.chinaa` уланган, лекин у HSK AI аккаунти эмас, таҳлилга қўшилмади. TikTok HSK AI профилида уланмаган.
- Hook Lab policy: охирги **30 кун**, ҳақиқий `publishedAt` бўйича `2026-09-28T00:56:25.231Z` дан `2026-10-28T00:56:25.231Z` гача. `24h` — early; `7d` — primary. Zernio `analytics_get_analytics` ҳар платформа/аккаунт учун `2026-09-28..2026-10-28`, `limit=50`, `page=1`, барча қайтган саҳифалар (1/1). Провайдер `lastSync=2026-10-28T00:54:44.909Z`, `staleAccountCount=1`, `syncTriggered=true`; айрим post metric update'лари бундан эски.
- **Instagram Reels:** [2026-10-28 observation](../observations/instagram-2026-10-28.json): **18** видео, **17** synced ва **1** unavailable; synced **52,705 lifetime views** (raw, unavailable row қўшилганда 52,969; unavailable metric null сақланди). Энг кўп кўрилган [18112275989167272](https://www.instagram.com/reel/DeZkfCbDc3o/) — **22,006 lifetime views**, publishedAt `2026-10-12T15:36:48.000Z`. Аввалги 26 октябр snapshot'га нисбатан янги native post ID: `18100340456428176`. Бир хил ID'ли 16 synced post учун йиғма lifetime-view фарқи **+1564**; бу fixed-age 24h/7d ёки causal lift эмас.
- **YouTube Shorts:** [2026-10-28 observation](../observations/youtube-2026-10-28.json): **6** видео, **6** synced, **4,472 lifetime views**. Энг кўп кўрилган [xN1OZkcVgHY](https://www.youtube.com/watch?v=xN1OZkcVgHY) — **1,211 lifetime views**, publishedAt `2026-10-24T02:00:20.000Z`. Янги native post ID: йўқ; аввалги snapshot'даги 6 бир хил ID бўйича йиғма lifetime фарқи **+4** (fixed-age натижа эмас).
- Post-level provenance: `platformPostId`, `providerRecordId`, `zernioPostId` (мавжуд бўлса), `postUrl`, `publishedAt`, `observedAt`, `collectedAt`, `source.syncedAt`, `source.providerMetricUpdatedAt`, `source.syncStatus`, `source.query`, `metricUnits`. `window=lifetime` барча қаторда. `episodeId/hookFormat/hskLevel/effectStyle/creativeFormatId/storytellingPattern=null`: пост caption/сана/мавзу source creative version'ни исботламайди.
- Қўшимча read-only endpoint'лар: `analytics_get_post_timeline` (IG 18100340456428176, YT xN1OZkcVgHY) ва `analytics_get_daily_metrics(attribution=received)` иккала аккаунт учун. Timeline UTC calendar-day cumulative, daily received platform aggregation; exact `24h`/`7d` `source.windowEvidence` бермайди. Масалан, YT xN1OZkcVgHY `analytics_get_analytics` 1211 lifetime view, daily received 2026-10-24..28 агрегати 1215; endpoint freshness/definition mismatch. Бир-бирига қўшилмади.

## HYPOTHESIS — фақат текшириладиган тахмин

Мавзуга хос тезкор Mandarin жавобли кириш generic intro'га қараганда Reel skip-rate'ни пасайтириши мумкин. Бу ҳали hypothesis: `7d` window, matched format/level/duration ва media-source mapping йўқ; lifetime view'дан Hook ғолиби ёки вируслилик исботланмайди.

## EXPERIMENT — таклиф, ишга туширилмаган

Кейинги алоҳида owner-authorized экспериментда **битта Hook ўзгарувчиси**ни синаш: бир хил платформа, real exact `7d` window, HSK, duration band, `creativeFormatId`, voice ва CTA. Hook Lab minimum: ҳар format учун 3 post, ҳар post камида 500 views, камида 10% relative lift ва saves/shares per 1,000 views secondary guardrail'да 10% дан ортиқ пасайиш йўқ. `ig-competitor-research` учун independently authorized рақобатчи далили йўқ; `ig-caption-quality` учун янги caption таклифи берилмади; `ig-reel-planning` бу агентга тегишли эмас.

## DECISION — insufficient-evidence

Verified `provider-exact-post-age` 7d record ID + start/end **0 та**, verified episode/Hook/HSK/creativeFormat attribution **0 та**; matched eligible primary 7d comparison **0 та**. 24h signal ҳам unknown. 30d rolling coverage тарихи провайдердан тўлиқ тасдиқланмаган; `staleAccountCount=1` freshness caveat. Номаълум YouTube reach/saves/shares/watch/skip ва zero-default comment қийматлари null. Virality, cause, Hook/CTA/storytelling winner йўқ. Янги нашр, DM, calendar, future scenario, localization, voice, SRT, renderer ёки CTA policy ўзгартирилмади.

## SOURCE READINESS / HANDOFF (read-only)

- `content/languages.json`: default `ru` + `tg`. `content/calendar.json`да 2026-10-28, 10-30, 10-31, 11-01, 11-02, 11-04, 11-06 учун future lesson/series source ва tg locale файллари мавжудлиги GitHub'да ўқиб текширилди; 2026-10-29 promo ru/tg файллари ҳам мавжуд. 28 октябрдан кейинги future lesson/series 6 та, `planningBuffer` minimum 3/target 4 дан кам эмас. Фақат файл мавжудлиги текширилди: `sourceHash` cryptographic binding, complete motionBeats, real Gemini TTS, MP4 ва final preview approval исботланмаган. `content:buffer`, `content:feedback`, `content:viral-plan` local CLI diagnostics бу коннектор сессиясида ишга туширилмади; статик ўқишни CLI натижаси деб ҳисобламаслик керак.
- No confirmed missing dated/locale source files in inspected horizon; Calendar Reserve'га аниқ файл gap handoff йўқ. Source QA/voice/render тайёрлиги алоҳида текширилиши керак.

## GITHUB DELIVERY

Data/report-only: `content/feedback/observations/instagram-2026-10-28.json`, `content/feedback/observations/youtube-2026-10-28.json`, `content/feedback/reports/2026-10-28-instagram-youtube-cycle.md`. PR, exact HEAD CI, merge ва final main readback ташқаридан текширилади; ушбу report ўзи merge далили эмас.
