# KANTENT — V5 кенг қамровли техник аудит: код, овоз, сценарий, кадр, визуал маъно, реклама, нашр ва ҳужжатлар

> **V3 янги далиллар (2026-11-05):** Илгариги V2 сақланган. Энг охирги ва устувор хулосалар — файл охиридаги [M бўлими](#m-учинчи-босқич--v3-очиқ-қолган-масалаларни-код-ci-ва-ҳақиқий-wav-асосида-ёпиш): MCP/CLI parity, 4 платформали тасдиқ, duplicate TTS, SFX fail state, real WAV pauses. Эски V2 даъволарини M бўлими аниқлаштириши мумкин.

> **АУДИТ V2 — 2026-11-05 19:00 CST:** Аввалги 77 бандга иккинчи босқич қўшилди: янги синтетик Linux duration репродукцияси, TikTok CTA crossing guard, STT retry path, real A/B waveform metrics, API тил hints ва аввалги даъволарни аниқлаштириш. Ушбу файлнинг [L бўлими](#l-иккинчи-босқич-аввалги-ноаниқликларни-қайта-текшириш-2026-11-05-1900-cst) аввалги даъволарни зарур жойда тўғрилайди; 77 та банд = 77 та тасдиқланган bug эмас.


**Сана:** 2026-11-05  ·  **Repository:** `akbarholturaev11-lang/Kantent`  ·  **База:** `main@6b8e66e39e828166333a904113877426b91afae5`
**Ҳолат:** audit-only / read-only. Production код, календарь, тасдиқланган аудио ва нашрлар ўзгартирилмади.
**Тил:** ўзбекча (кирилл). **Мақсад:** сифатни туширмасдан хатолар, конфликтлар, redundant йўллар, UI/операцион ноқулайлик, синаш ва .md rule debt’ни қайта тузиш.

> **Далил чегараси:** репозиторийнинг бутун Git tree’си (1 622 blob), барча 8 workflow, барча асосий каноник қоидалар ва doc/plan манбалари, асосий сценарий→аудио→MP4→нашр код йўллари, sample профиллар, GitHub Actions логлари ва аввалги реал OpenRouter smoke/A-B тестлари ўрганилди. 988 та third-party skill ва 297 та `videos/` файлларининг ҳар бир байти manual code-review қилинмади; учинчи томон skill’лар алоҳида security audit талаб қилади. Reviewer барча 1 622 файлни line-by-line кўрдим ёки 100% bug-free деб даъво қилмайди. **Кодда аниқ** — шу код йўли мавжуд; **реал тест** — ҳақиқий API/CI; **эҳтимолий** — исботланмаган сифат/операцион хавф.

## A. Қисқа хулоса

1. **Иккита мустақил муаммо аралашган:** TTS’нинг биринчи take сифати ва ASR/STT’нинг тўлиқ транскрипция қилолмаслиги. Овоз яхши бўлса ҳам subtitle gate уни рад қилиши мумкин. STT failure аудиони қайта генерация қилишга сабаб бўлмаслиги керак.
2. **Энг катта босқичлар муаммоси:** checkpoint/resume default workflow’да йўқ, GitHub runner failure аудиони сақламайди; STT’га 3 retry бор, лекин adapter баъзи хатоларда олдин throws қилади.
3. **Сифатга асосий номзод:** standard scene-wise TTS; 3 саҳнали RU/TG A/B реал API овоз намуналарида continuous ва scene такрор сони ҳамда давомийлиги фарқ қилди. Лекин “continuous табиийроқ” деган инсон қулоғидаги QA ҳали йўқ.
4. **Сценарий↔визуал муаммо:** русча hook 6 секунд cap, тест овози 8.44 секунд; визуал эрта ўтиш хавфи. Бу аудионинг ўзини бузмайди, лекин тайёр ролик синхронизациясини бузиши мумкин.
5. **Ҳужжатлар хатарли:** `AI_RULES.md`, `WORKFLOW.md`, `PROJECT_MEMORY.md`, `GITHUB_VIDEO_REVIEW.md`да OpenRouter migration’дан олдинги Google-only/429 баёнлар қолган. Яшил consistency test семантик зиддиятни кўрмайди.
6. **Контент резерви ҳақиқатан етишмаяпти:** 2026-11-05 main CI `readyFutureEpisodes=1`, `target=4` ва 2026-11-07/08/09 missing деб чиқарган, лекин CI overall success.
7. **Repo блоати:** 988 third-party agents files (~15.9 MB), 3 standalone HyperFrames workspaces 297 files (~148.3 MB), `reports` ~50.2 MB, `exports` ~27.4 MB; source кодни оқилона ажратиш мумкин, лекин тарихий аудио/approved sample’ни ўчириш мумкин эмас.

### Audit инвентаризацияси

| Объект | Кузатилган | Изоҳ |
|---|---:|---|
| Git blobs / tree | 1 622 | GitHub `main` recursive tree, truncated=false |
| Asosiy `scripts/` | 130 файл | 50 та `*.test.mjs` |
| Workflow | 8 | main repo `.github/workflows/` |
| `content/` | 110 файл | RU/TG calendar, CTA/hook/voice, episodes, observations |
| `.agents/` | 988 файл | 39 `SKILL.md`, vendor ва plugin test corpus |
| `videos/` | 297 файл | 3 мустақил HyperFrames campaign workspace |
| `src/` | 14 файл | Remotion/React визуал код |
| CI `2026-11-05` | success | Synthetic tests/consistency: live API/render QA эмас |

## B. Лойиҳа қандай ишлайди — архитектура харитаси

```text
ChatGPT Calendar Reserve / manual agent  [source authoring only]
  → content/calendar.json + RU episode/promos + TG sourceHash-bound translation
  → per-locale Hook lab + CTA lab + creative/visual/storytelling rules
  → review/<episode-id>/episode.json (RU) ёки review/<episode-id>/tg/episode.json (TG working snapshot)
  → VoiceProfile RU/TG (approved Gemini model + Kore; OpenRouter default transport)
  → TTS WAV [scene-by-scene default | continuous pilot] → MP3
  → STT word timestamps → strict token gate → recovery → captions.vtt
  → import: public/generated/<locale>/..., per-scene start/end/frames
  → Remotion: lesson body once + per-platform CTA end + audio mix
  → Instagram / YouTube / Facebook shared lesson, separate TikTok spoken CTA
  → review packages MP4/SRT/post/metadata + source/video/post SHA256
  → owner exact preview approval (always required for VIDEO)
  → Zernio connected account: GitHub artifact route OR Codex-local upload
  → post GET/readback → receipts/observations → feedback hypotheses only
```

**Расмий source ownership:** `AGENTS.md` → `AI_RULES.md` → `content/WORKFLOW.md`, `content/languages.json`, `content/calendar.json`, per-language `voice-profile.json`/`cta-lab.json`, `visual-system.json`. Тарихий plans ва HyperFrames campaign’ларни бунинг устига қўйиш мумкин эмас.

**Видео турлари:** normal HSK lesson ва serial-part (Remotion `explain-actions-v1`), stand-alone advertising (Remotion `minimalist-promo-v1` ёки алоҳида owner-selected HyperFrames), тасдиқланган exact preview билан platform-specific exports. Static Telegram/Instagram/Facebook product-news agent видео workflow’дан алоҳида, уни auto-video publisher қилиш тақиқланган.

## C. Топилмалар: далил, таъсир, тузатиш ва тест

### ОВОЗ / TTS / STT / AUDIO — 20 топилма

| ID | Priority | Тасдиқ даражаси | Аниқ топилма |
|---|---|---|---|
| `V-01` | **P0** | Кодда аниқ | Стандарт TTS ҳар бир саҳнани алоҳида ўқийди |
| `V-02` | **P1** | Кодда аниқ | Continuous TTS режими opt-in, одатда ўчирилган |
| `V-03` | **P0** | Реал API текшируви | Аралаш RU/TG + Mandarin транскрипция беқарор |
| `V-04` | **P0** | Қоида–код зиддияти | OpenRouter STT request икки тил hint’ини узатмайди |
| `V-05` | **P0** | Кодда аниқ | Recovered gap тили OpenRouter сўровида йўқолади |
| `V-06` | **P0** | Кодда аниқ | OpenRouter STT `words` бўлмаганда биринчи уринишда throws |
| `V-07` | **P0** | Кодда аниқ | CLI `content:make` автоматик resume’ни чақирмайди |
| `V-08` | **P0** | Кодда аниқ | GitHub runner’да хатодан кейин WAV/metadata йўқолади |
| `V-09` | **P1** | Кодда аниқ | `gemini-production`/`Gemini` статус ва лейбллари OpenRouter учун қолган |
| `V-10` | **P1** | Кодда аниқ | Gemini word-token алиаслари қўлда ёзилган, айримлари конкрет эпизодга боғланган |
| `V-11` | **P1** | Кодда аниқ | STT transcript alignment мутлақ барча токенга боғланган |
| `V-12` | **P1** | Кодда аниқ | Audio QA фақат container/timing, овоз табиийлиги йўқ |
| `V-13` | **P1** | Эҳтимолий сифат | TTS style бўш; provider’лар style семантикаси бир хил эмас |
| `V-14` | **P1** | Кодда аниқ | OpenRouter PCM sample-rate/channel header params текширилмайди |
| `V-15` | **P1** | Кодда аниқ | OpenRouter TTS фақат битта HTTP уриниш, transient retry йўқ |
| `V-16` | **P1** | Кодда аниқ | TTS/STT/FFmpeg/импорт бир 1492 қаторлик файлда |
| `V-17` | **P1** | Кодда аниқ | Audio WAV→128k MP3→AAC занжири |
| `V-18` | **P1** | Кодда аниқ | Approved sample `.gitignore` билан GitHub runner’да мавжуд эмас |
| `V-19` | **P1** | Эҳтимолий | Диктор тили ва Mandarin code-switching акустик муаммо |
| `V-20` | **P2** | Эҳтимолий | True-peak/RMS ва master mix first-take quality metric’лари бир жойда йўқ |

**V-01 · Стандарт TTS ҳар бир саҳнани алоҳида ўқийди**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L491-L531).  \
**Хавф/таъсир:** Саҳнама-саҳна янги генерация темп/пауза/интонацияда ўзгариш хавфини беради; сифатдаги айнан шу фарқ аудио билан ҳали инсон тасдиқламаган.  \
**Тузатиш:** Текширилган continuous-first стратегияси; узун сценарийда режали chunk fallback, ҳар бир вариант мустақил овоз-матн текширувидан ўтсин.  \
**Қабул тести:** RU ва TG бўйича blind A/B; ўқув сўзлари тўлиқ, табиийлик баҳоси.

**V-02 · Continuous TTS режими opt-in, одатда ўчирилган**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1046-L1055).  \
**Хавф/таъсир:** Камроқ take билан бир хил нутқ олиш варианти production default эмас.  \
**Тузатиш:** Жорий аудио билан A/B сифат тасдиғи ва regression ортидан default қилиш; версияланган config ва rollback.  \
**Қабул тести:** Бир хил сценарий/модель/voice/transport; аудио сифати пасаймасин.

**V-03 · Аралаш RU/TG + Mandarin транскрипция беқарор**  \
**Далил:** [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L106-L149).  \
**Хавф/таъсир:** Реал синовда айрим хитойча сўзлар ва тожикча жумла тушиб қолган; кўп марта STT қайта уринади.  \
**Тузатиш:** TTS натижасига тегмаган ҳолда, STTни овоз сифати баҳосидан ажратиш; тил-сегментга йўналтирилган recovery; fallback STT — фақат далил билан.  \
**Қабул тести:** Бир хил сақланган аудиода RU/TG+Mandarin 100% source-token match; реал вақт белгиси.

**V-04 · OpenRouter STT request икки тил hint’ини узатмайди**  \
**Далил:** [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L121-L133) ↔ [AI_RULES.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/AI_RULES.md#L40-L47).  \
**Хавф/таъсир:** Қоида explanation locale ва Mandarin hint’ни талаб қилади, адаптер эса атайлаб автоматик аниқлашга қолдирган. Бу ҳар доим хато эмас, аммо жойида documented decision йўқ.  \
**Тузатиш:** Provider capability’га қараб мос тил hint’и/сегмент стратегияси; автоматик аниқлаш ва hint’ни тестда солиштириш.  \
**Қабул тести:** RU/TG+Mandarin тестлари; API schema; артефакт аудиосини ўзгартирмаслик.

**V-05 · Recovered gap тили OpenRouter сўровида йўқолади**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L722-L736).  \
**Хавф/таъсир:** Gap zh ёки locale деб топилади, `languageCode` ҳисобланади, аммо OpenRouter branch’да қўлланмайди.  \
**Тузатиш:** Тилни аниқланган сегмент билан боғлаш; unsupported hint бўлса механик равишда юбориш эмас, алоҳида provider strategy.  \
**Қабул тести:** Махсус бир тилли 2–3 сониялик clip; асл timestamps сақлансин.

**V-06 · OpenRouter STT `words` бўлмаганда биринчи уринишда throws**  \
**Далил:** [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L135-L142) ↔ [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1191-L1208).  \
**Хавф/таъсир:** Adapter throws; ташқи `while attempts < 3` recoverable malformed STT жавобини қайта синашга улгурмайди.  \
**Тузатиш:** Transient/invalid result’ни категориялаш; bounded STT retry; овозни қайта генерация қилмаслик.  \
**Қабул тести:** Mock 200 + words=[], 400, 429, timeout; чиқишда WAV сақланган.

**V-07 · CLI `content:make` автоматик resume’ни чақирмайди**  \
**Далил:** [make-episode.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/make-episode.mjs#L54-L83) ↔ [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L974-L1046).  \
**Хавф/таъсир:** STT/render хатосидан кейин янги run янги timestamp папкаси/янги TTS take яратиши мумкин; мавжуд WAV ундан автоматик тикланмайди.  \
**Тузатиш:** Натижани `(language, episode, narrationHash, voiceProfile, transport, mode)` билан индекслаш; бир хил checkpoint топилса STT’dan давом этиш.  \
**Қабул тести:** GitHub job abort → rerun; TTS API hit count ўзгармасин.

**V-08 · GitHub runner’да хатодан кейин WAV/metadata йўқолади**  \
**Далил:** [video-review.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/video-review.yml#L172-L203).  \
**Хавф/таъсир:** Фақат якуний пакетга келганда artifact upload бор; STT босқичида fail бўлган runner локал файллари йўқолиши мумкин.  \
**Тузатиш:** `if: always()` билан маҳфий маълумотсиз, чекланган ҳажмли, вақтли recovery checkpoint; SHA ва resume workflow. Ёки тасдиқланган private object storage.  \
**Қабул тести:** Fail after TTS синтетик тест → artifact; қайта run WAV SHA ўзгармасин.

**V-09 · `gemini-production`/`Gemini` статус ва лейбллари OpenRouter учун қолган**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L956-L1053).  \
**Хавф/таъсир:** Operational диагностикада транспорт ва модель провайдери аралашиб кетади; monitoring аналитикаси нотўғри аталиб қолиши мумкин.  \
**Тузатиш:** Backward-compatible `modelProvider=google`, `transport=openrouter|gemini-direct`, `voiceProfileId` ажратиш; legacy папкаларни rename қилмаслик.  \
**Қабул тести:** Янги run metadata тўғри, старий run ўқилиши сақлансин.

**V-10 · Gemini word-token алиаслари қўлда ёзилган, айримлари конкрет эпизодга боғланган**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L193-L257).  \
**Хавф/таъсир:** Янги Mandarin/тожикча матнларда кўп фонетик вариантлар мос келмайди; асл хато ва иероглиф фонетик вариантини ажратиш мушкул.  \
**Тузатиш:** Хитойча verified lexeme+syllable харитаси; script-specific dictionaries; episode override фақат далил ва тест билан.  \
**Қабул тести:** Ҳар бир Mandarin мисоли: Hanzi/pinyin/locale normalize round trip.

**V-11 · STT transcript alignment мутлақ барча токенга боғланган**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L313-L392).  \
**Хавф/таъсир:** Нутқ тўғри бўлса ҳам ASR имло/қисқартмаси аудионинг импорт бўлишини блоклайди.  \
**Тузатиш:** Қатъий gate’ни сақлаган ҳолда validated aliases ва gap-level re-recognition; silence/word omission’ни тасдиқсиз ўтказмаслик.  \
**Қабул тести:** Асл ёмон аудио рад бўлсин; яхши аудио ASR вариациясидан кейин сақлансин.

**V-12 · Audio QA фақат container/timing, овоз табиийлиги йўқ**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1110-L1173).  \
**Хавф/таъсир:** РИФФ/давомийлик/токен ўтса ҳам роботдек ўқиш, интонация, кераксиз пауза аниқланмайди.  \
**Тузатиш:** QA first-take: signal integrity; sustained silence, clip boundary, phrase completeness, Mandarin pronunciation; инсон тинглаш белгилари.  \
**Қабул тести:** Назорат тестда ёмон сунъий аудио блок, яхши approved аудио ўтсин.

**V-13 · TTS style бўш; provider’лар style семантикаси бир хил эмас**  \
**Далил:** [voice-profile.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/voice-profile.json#L1-L20); [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L75-L87).  \
**Хавф/таъсир:** Бўш style автоматик хато эмас, аммо баъзи сценарийда нейтрал интонация; OpenRouter adapter style бўлса throw қилади.  \
**Тузатиш:** Икки тил учун аудиода A/B тинглаш; owner-approved style қабул қилингандан кейин OpenRouter compatibility қўшиш.  \
**Қабул тести:** Овоз идентификатори/модель ўзгармасин, accent ва произношение яхшилансин.

**V-14 · OpenRouter PCM sample-rate/channel header params текширилмайди**  \
**Далил:** [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L55-L72); [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L90-L104).  \
**Хавф/таъсир:** Header’га 24k mono мажбуран ёзилади; provider бошқа rate қайтарса WAV нотўғри тезлик/баландликда ўқилиши мумкин. Реал A/B’да бундай носозлик исботланмаган.  \
**Тузатиш:** `audio/pcm` content-type parameters текшириш; номувофиқ форматни рад этиш ёки explicit resample.  \
**Қабул тести:** 24k/48k test bytes; WAV давомийлиги ва pitch нормал.

**V-15 · OpenRouter TTS фақат битта HTTP уриниш, transient retry йўқ**  \
**Далил:** [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L75-L104).  \
**Хавф/таъсир:** 429/502/timeout’да битта take узилади; rerun бўлса бутун workflow қиммат тушиши мумкин.  \
**Тузатиш:** Идемпотентлик хавфига қараб фақат response келмаган transient failure’ни bounded retry; успешный audio ни қайта генерация қилмаслик.  \
**Қабул тести:** Test 429 Retry-After, timeout, 5xx, 200 success; usage/attempt logs.

**V-16 · TTS/STT/FFmpeg/импорт бир 1492 қаторлик файлда**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1-L50).  \
**Хавф/таъсир:** Transport switch, recovery, аудио сақлаш ва хато lifecycle бир модулга ўрнашган; regression хавфи баланд.  \
**Тузатиш:** 4 фазали voice service: `synthesize`, `checkpoint`, `transcribe+align`, `import`; CLI фасад қолсин.  \
**Қабул тести:** Bit-identical fixtures, resume regression, baseline sample provenance.

**V-17 · Audio WAV→128k MP3→AAC занжири**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1138-L1169); [render-platform-videos.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-platform-videos.mjs#L119-L166).  \
**Хавф/таъсир:** Lossy encode икки босқич; сифатига таъсири ҳали ABX билан исботланмаган.  \
**Тузатиш:** Source WAV immutable; финал AAC фақат бир марта кодлаш; MP3 фақат archival/public preview зарур бўлса.  \
**Қабул тести:** WAV vs final AAC даража-калибрланган ABX; frame/audio sync regression.

**V-18 · Approved sample `.gitignore` билан GitHub runner’да мавжуд эмас**  \
**Далил:** [voice-profile.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/locales/tg/voice-profile.json#L37-L65); [GITHUB_VIDEO_REVIEW.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/docs/GITHUB_VIDEO_REVIEW.md#L42-L46).  \
**Хавф/таъсир:** Код тўғри равишда қайта take’ни рад этади, аммо архив аудио ташки муҳитда топилмаса тожикча тарихий sample учун review blocked.  \
**Тузатиш:** Protected asset store: SHA-256 immutable restore, explicit consent; янги sample генерациясини тақиқлаш.  \
**Қабул тести:** Мавжуд SHA текшириш; downloaded byte count ва асл аудио бир хил.

**V-19 · Диктор тили ва Mandarin code-switching акустик муаммо**  \
**Далил:** [voice-profile.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/locales/tg/voice-profile.json#L5-L15).  \
**Хавф/таъсир:** `Kore` ва танланган моделлар иккала тилда ҳам доим бир хил табиийлик/тон беради, деб кафолат йўқ.  \
**Тузатиш:** Фиксацияланган RU/TG+Hanzi тест корпус, меъёрий талаффузни инсон баҳолаш, моделларни бир-биридан мустақил баҳолаш.  \
**Қабул тести:** Талабларга жавоб бермаган Mandarin мисоли видеога ўтмасин.

**V-20 · True-peak/RMS ва master mix first-take quality metric’лари бир жойда йўқ**  \
**Далил:** [EpisodeComposition.tsx](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/EpisodeComposition.tsx#L1380-L1475); [visual-system.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/visual-system.json).  \
**Хавф/таъсир:** Фон мусиқаси/soft-cut SFX овоз аниқлигини пасайтириши мумкин, лекин бу зарар реал тестда исботланмаган.  \
**Тузатиш:** Бир voice-only + final-mix A/B; loudness measurement ва кўз билан эмас қулоқ билан текшириш.  \
**Қабул тести:** Reels телефон эшитишида овоз ясалиш, хиралашиш, SFX masking йўқ.

### RENDER / ВИДЕО / ВИЗУАЛ — 9 топилма

| ID | Priority | Тасдиқ даражаси | Аниқ топилма |
|---|---|---|---|
| `R-01` | **P0** | Кодда аниқ | Русча hook визуали 180 frame (6s) билан чекланган |
| `R-02` | **P1** | Кодда аниқ | Scene mapping’да fallback proportional timeline бор |
| `R-03` | **P1** | Кодда аниқ | Remotion композицияси 1490 қатор, эски/янги визуал йўллар аралаш |
| `R-04` | **P1** | Кодда аниқ | Renderer анимация timing’и STT exact cues’га боғланган |
| `R-05` | **P1** | Кодда аниқ | Фон мусиқа + soft-cut/soft-tap рендерда боғланган |
| `R-06` | **P2** | Кодда аниқ | MP4 shared lesson render энди самарали; буни қайта ёзиш керак эмас |
| `R-07` | **P2** | Кодда аниқ | TikTok render ва default render ўхшаш preflight/receipt логикасига эга |
| `R-08` | **P2** | Эҳтимолий | Хаконик `motionBeats` матн/визуал контракти мураккаб |
| `R-09` | **P2** | Эҳтимолий | Audio/video duration фақат guidance, final scene cadence учун quality threshold йўқ |

**R-01 · Русча hook визуали 180 frame (6s) билан чекланган**  \
**Далил:** [import-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L324-L352).  \
**Хавф/таъсир:** Аудио hook 8.44s бўлган реал тестда, production йўлига тушса, визуал 2.44s эрта алмашиши мумкин. Test production MP4 да ҳали исботланмаган.  \
**Тузатиш:** Қатъий 6s cap’ни audiovisual cue boundary билан алмаштириш; hook pacing quality gate.  \
**Қабул тести:** Айнан 8.44s аудио fixtures + визуал кадрлар; Hanzi ўрни ва subtitle sync.

**R-02 · Scene mapping’да fallback proportional timeline бор**  \
**Далил:** [import-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L273-L321).  \
**Хавф/таъсир:** Нормаллашган токенни substring match топа олмаган ҳолда caption index → тахминий саҳна; семантик кадр wrong position бўлиши мумкин.  \
**Тузатиш:** Mapping’ни explicit source-token-index асосида deterministic қилиш, ambiguity болсо render stop; episode cues test.  \
**Қабул тести:** Такрорланган сўзлар ва Hanzi мисоли бир нечта саҳнада.

**R-03 · Remotion композицияси 1490 қатор, эски/янги визуал йўллар аралаш**  \
**Далил:** [EpisodeComposition.tsx](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/EpisodeComposition.tsx#L1-L80).  \
**Хавф/таъсир:** Semantic/legacy/storyboard/action шартлари бир рендерга аралашган; coverage drift ва future migration хатар.  \
**Тузатиш:** `LessonSceneRouter`, `AudioTracks`, `CaptionStage` ажратиш; кейин support matrix билан deprecate legacy.  \
**Қабул тести:** Синтетик ва реал кадр snapshots, CTA safe-zone, caption overlay.

**R-04 · Renderer анимация timing’и STT exact cues’га боғланган**  \
**Далил:** [motion-design-plan.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/motion-design-plan.mjs#L16-L75).  \
**Хавф/таъсир:** Битта ASR сўзи йўқолса видео тўхташи мумкин; бу ўқитишда ёлғон кадр кўрсатмаслик учун тўғри ҳимоя.  \
**Тузатиш:** Guard’ни ўчирманг; аввал STT recovery, кейин motion cue compile.  \
**Қабул тести:** Word cues absent → stop; recovery after source audio → pass.

**R-05 · Фон мусиқа + soft-cut/soft-tap рендерда боғланган**  \
**Далил:** [EpisodeComposition.tsx](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/EpisodeComposition.tsx#L1280-L1370); [EpisodeComposition.tsx](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/EpisodeComposition.tsx#L1400-L1474).  \
**Хавф/таъсир:** Маскаланиш даражаси тўлиқ аудио A/B’да ўлчанмаган; сифатига эҳтимолий таъсир.  \
**Тузатиш:** Final mix учун monitor/peak test; зарур бўлса SFX ducking/лимит.  \
**Қабул тести:** 0/1 музыка билан perceived clarity, ҳамма тилда.

**R-06 · MP4 shared lesson render энди самарали; буни қайта ёзиш керак эмас**  \
**Далил:** [render-platform-videos.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-platform-videos.mjs#L68-L172).  \
**Хавф/таъсир:** Дарс бир марта, CTA ending алоҳида; аудио битта continuous mix. Бу аллақачон оптимизация.  \
**Тузатиш:** Мавжуд механикани сақлаш, фақат QA ва cleanup’ни яхшилаш.  \
**Қабул тести:** Instagram/YouTube/Facebook visual body byte-equivalence.

**R-07 · TikTok render ва default render ўхшаш preflight/receipt логикасига эга**  \
**Далил:** [render-tiktok-review.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-tiktok-review.mjs#L33-L172); [render-episode.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-episode.mjs#L34-L214).  \
**Хавф/таъсир:** Икки параллел implementationда келажак фиксациялардан бири қолиб кетиши мумкин.  \
**Тузатиш:** Умумий `validateAudioCaptions`, `renderVerify`, `writePackageReceipt`; TikTok CTA voice алоҳида қолсин.  \
**Қабул тести:** Иккала йўлда caption/granularity/voice SHA текшируви бир хил.

**R-08 · Хаконик `motionBeats` матн/визуал контракти мураккаб**  \
**Далил:** [GRAPHIC_SCENES.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/GRAPHIC_SCENES.md#L1-L45).  \
**Хавф/таъсир:** Ҳар бир янги дарс учун кўп SVG geometry ва anchor ёзиш авторликни қийинлаштиради.  \
**Тузатиш:** Қайта ишлатиладиган семантик `graphic` templates registry, JSON schema validation; drawing proof’ни сақлаш.  \
**Қабул тести:** Визуалнинг объекти аниқ танилсин, максимал hold ва cue checks сақлансин.

**R-09 · Audio/video duration фақат guidance, final scene cadence учун quality threshold йўқ**  \
**Далил:** [duration-policy.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/duration-policy.mjs#L1-L21).  \
**Хавф/таъсир:** 50s target ҳақиқий hard limit эмас (бу тўғри), аммо ўта секин контент QA’гача етиши мумкин.  \
**Тузатиш:** Пейсинг review: scene/word counts, pauses, visual changes; narration speed stretch қилмаслик.  \
**Қабул тести:** Targetдан ташқари видеони ҳам сифатли бўлса қабул қилиш.

### ОРКЕСТРАЦИЯ / CI / АВТОМАТИЗАЦИЯ — 11 топилма

| ID | Priority | Тасдиқ даражаси | Аниқ топилма |
|---|---|---|---|
| `O-01` | **P0** | Кодда аниқ | `content:make` умумий orchestration фақат субпроцесс exit-code’га суянади |
| `O-02` | **P1** | Кодда аниқ | MCP entry point жуда катта: 1885 қатор |
| `O-03` | **P1** | Кодда аниқ | GitHub schedule run success бўлса ҳам реал render job skipped бўлиши мумкин |
| `O-04` | **P0** | Реал CI натижаси | 4 келгуси слотдан 1 таси source-ready; CI non-gating warning |
| `O-05` | **P1** | Кодда аниқ | Daily writer main’га алоҳида-алоҳида файл commit қилади |
| `O-06` | **P2** | Кодда аниқ | CI тестлар қамрови барча active 50 test file’ни чақирмайди |
| `O-07` | **P2** | Кодда аниқ | CI build ҳозирги Remotion/Synthetic test’га оғир боғланган |
| `O-08` | **P2** | Кодда аниқ | `actions/checkout@v4`, `setup-node@v4` эски warning чиқаряпти |
| `O-09` | **P2** | Эҳтимолий | Мутлақ `requireFreshGitMain()` локал экспериментларни тўхтатиши мумкин |
| `O-10` | **P1** | Кодда аниқ | `.env.local` fallback’и бирор API калит йўқлигига боғланган |
| `O-11` | **P2** | Кодда аниқ | `generate-voice.mjs` бор-йўғи 38 байтли alias |

**O-01 · `content:make` умумий orchestration фақат субпроцесс exit-code’га суянади**  \
**Далил:** [make-episode.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/make-episode.mjs#L47-L93).  \
**Хавф/таъсир:** Voice/import/render/CTA босқичларидан бирида fail бўлса фаза fingerprint’и билан автоматик давом этиш йўқ.  \
**Тузатиш:** `production-state.json` атомик phase checkpoints, поэтапный resume, status unified.  \
**Қабул тести:** Ҳар босқичда kill/retry, фазалар қайталанмасин.

**O-02 · MCP entry point жуда катта: 1885 қатор**  \
**Далил:** [mcp-server.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/mcp-server.mjs#L1-L95).  \
**Хавф/таъсир:** Контент таҳрири, тил, voice, preview, publish бир серверда; фаза guard drift хавфи.  \
**Тузатиш:** Domain tools (`planning`,`voice`,`review`,`publishing`) modules; асосий сервер фасад; backward-compatible MCP tool names.  \
**Қабул тести:** Tool schemas, locale isolation, permission tests.

**O-03 · GitHub schedule run success бўлса ҳам реал render job skipped бўлиши мумкин**  \
**Далил:** [video-review.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/video-review.yml#L112-L117).  \
**Хавф/таъсир:** Actions саҳифасида `success` фақат synthetic safe-ci ишлаганини англатиши мумкин; real RU/TG video яратилмаган.  \
**Тузатиш:** Job-specific `READY_AUDIO`, `RENDERED_VIDEO`, `OWNER_REVIEW` status summary; run conclusion’ни ноаниқ қўймаслик.  \
**Қабул тести:** Schedule gate off CI success + zero MP4 → UI `render-skipped`.

**O-04 · 4 келгуси слотдан 1 таси source-ready; CI non-gating warning**  \
**Далил:** [consistency.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/consistency.yml#L112-L126).  \
**Хавф/таъсир:** 2026-11-05 `content:buffer`: next 11/06 ready, 11/07-11/09 missing. CI яшил бўлса ҳам календарь резерв тўлмаган.  \
**Тузатиш:** Calendar Reserve workflow натижасини алоҳида blocking readiness check’га чиқариш; муҳаррирлик тасдиғига таъсир қилмасин.  \
**Қабул тести:** Ready>=minimum=3, target=4; missing type/date clear.

**O-05 · Daily writer main’га алоҳида-алоҳида файл commit қилади**  \
**Далил:** [WORKFLOW.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/WORKFLOW.md#L78-L90).  \
**Хавф/таъсир:** Canonical/locale/calendar орасида temporarily inconsistent ҳолат; ҳужжат ўзи ҳам non-atomic commit хавфини тан олади.  \
**Тузатиш:** Имкон бўлса GitHub tree/commit atomic multi-file write; йўқ бўлса staging+validation, календарь last ва rollback handoff. Бу ҳозирги owner сиёсатига тегади: алоҳида тасдиқ керак.  \
**Қабул тести:** Crash between writes → календарь халалсиз; hash binding correct.

**O-06 · CI тестлар қамрови барча active 50 test file’ни чақирмайди**  \
**Далил:** [consistency.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/consistency.yml#L1-L168); [video-review.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/video-review.yml#L71-L110).  \
**Хавф/таъсир:** Файл номи бўйича scan: 50 та `scripts/*.test.mjs`, workflow матнида 45 таси бор; қолган 5 таси CI shell calls’да кўринмади.  \
**Тузатиш:** `npm run test:unit` curated split ва `test:all` manifest; setup-node cache.  \
**Қабул тести:** Unreferenced: content-attribution, content-schedule, duration-policy, hook-lab, promo-production.

**O-07 · CI build ҳозирги Remotion/Synthetic test’га оғир боғланган**  \
**Далил:** [consistency.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/consistency.yml#L11-L82).  \
**Хавф/таъсир:** Яхши end-to-end motion coverage бор, аммо ҳар docs change учун costly heavy checks.  \
**Тузатиш:** Path-aware CI incremental jobs + кечки full suite; source correctness ва render safeguards умуман камаймасин.  \
**Қабул тести:** Full nightly green, PR differential jobs билан same guard.

**O-08 · `actions/checkout@v4`, `setup-node@v4` эски warning чиқаряпти**  \
**Далил:** [consistency.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/consistency.yml#L17-L23).  \
**Хавф/таъсир:** 2026-11-05 Actions логида Node 20 deprecated, runner Node 24 forcing warning.  \
**Тузатиш:** Версияли actions audit, approved update PR ва supply-chain pin; workflows синтетик тестдан ўтсин.  \
**Қабул тести:** Warning йўқ, repo checkout/test тўлиқ green.

**O-09 · Мутлақ `requireFreshGitMain()` локал экспериментларни тўхтатиши мумкин**  \
**Далил:** [make-episode.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/make-episode.mjs#L34-L38).  \
**Хавф/таъсир:** Production учун асосли ҳимоя; local isolated A/B experiments учун алоҳида йўл керак.  \
**Тузатиш:** Production freshness hard, review-only synthetic/offline experiments isolated command; ҳимоя bypass қилинмасин.  \
**Қабул тести:** Main-only publish, local test no social/API secrets.

**O-10 · `.env.local` fallback’и бирор API калит йўқлигига боғланган**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L64-L80).  \
**Хавф/таъсир:** Иккала калит environment’da бор бўлса `.env.local`даги transport/feature flag ўқилмайди; operator қандай config ишлатилганини адаштириши мумкин.  \
**Тузатиш:** Environment loading deterministic; explicit precedence, non-secret effective config report.  \
**Қабул тести:** Иккала key env’da мавжуд + `.env.local`да `gemini-direct` тест.

**O-11 · `generate-voice.mjs` бор-йўғи 38 байтли alias**  \
**Далил:** [generate-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice.mjs).  \
**Хавф/таъсир:** Иккинчи API implementation эмас; номни кўрган developer адашиши мумкин.  \
**Тузатиш:** Deprecated фасадни document; референслар узилгандан кейин rename/removal.  \
**Қабул тести:** Search imports/CLI; legacy commands ўтсин.

### КОНТЕНТ / ТИЛ / CTA — 7 топилма

| ID | Priority | Тасдиқ даражаси | Аниқ топилма |
|---|---|---|---|
| `C-01` | **P1** | Кодда аниқ | Ёзув тили ва аудиторияси RU+TG, package description ҳали Russian-only |
| `C-02` | **P1** | Кодда аниқ | Таълимий факт/translation cross-language sourceHash билан боғланган |
| `C-03` | **P2** | Эҳтимолий | Иккала тил учун алоҳида HSK талаффуз ва грамматика инсон QA кафолати йўқ |
| `C-04` | **P2** | Кодда аниқ | `CTA` snapshot, lab registry ва `review` бир неча версияга эга |
| `C-05` | **P2** | Эҳтимолий | Сценарий `cueText` ва кадр графикаси муаллиф учун қўлда катта иш |
| `C-06` | **P1** | Реал CI натижаси | 11/07–11/09 future drafts йўқ |
| `C-07` | **P2** | Кодда аниқ | Feedback snapshots Git-versioned, platform analytics билан live automatic sync ишламайди |

**C-01 · Ёзув тили ва аудиторияси RU+TG, package description ҳали Russian-only**  \
**Далил:** [package.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/package.json#L1-L13).  \
**Хавф/таъсир:** Onboarding/developer тушунчасида лойиҳа якка тилли кўринади.  \
**Тузатиш:** Description ва README’нинг биринчи саҳифасини configured languages’га боғлаш.  \
**Қабул тести:** Locale default test ва docs audit.

**C-02 · Таълимий факт/translation cross-language sourceHash билан боғланган**  \
**Далил:** [language-context.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/language-context.mjs#L53-L73).  \
**Хавф/таъсир:** Бу қимматли integrity guard; уни соддалаштириб ўчириш қайси тил эскирганини яширади.  \
**Тузатиш:** Hash сақлансин; developer-friendly дифф ва localized repair action.  \
**Қабул тести:** Shared episode ўзгарса TG stale аниқ кўринсин.

**C-03 · Иккала тил учун алоҳида HSK талаффуз ва грамматика инсон QA кафолати йўқ**  \
**Далил:** [AI_RULES.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/AI_RULES.md#L21-L27).  \
**Хавф/таъсир:** JSON/source citation check контент ҳақиқатини кафолатламайди.  \
**Тузатиш:** Sample syllabus audit, Mandarin факт reviewer checklist, audio phonetic audit.  \
**Қабул тести:** Ёдлаш учун керак бўлган tone-mark/pinyin/meaning invariant.

**C-04 · `CTA` snapshot, lab registry ва `review` бир неча версияга эга**  \
**Далил:** [episode-cta-assembly.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/episode-cta-assembly.mjs#L20-L68).  \
**Хавф/таъсир:** Фақат canonical CTA лаборатория ҳақиқат манбаи; мажбурий snapshot’ни ўчириш `post hash` ва experiment attribution’ни бузади.  \
**Тузатиш:** Шаффоф Version+sourceRef diagram, `snapshot` read-only title; duplicate editable source эмаслигини кўрсатиш.  \
**Қабул тести:** CTA change → new working snapshot, old published immutable.

**C-05 · Сценарий `cueText` ва кадр графикаси муаллиф учун қўлда катта иш**  \
**Далил:** [EDITING_SPEC.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EDITING_SPEC.md#L7-L23).  \
**Хавф/таъсир:** Source-ready state яратиш қиммат, AI agent камчилик/кринж фрейм қўшиб юбориши мумкин.  \
**Тузатиш:** Approved graphics library, auto-validate cue coverage before TTS, визуал preview.  \
**Қабул тести:** Клипда битта аниқ предмет/ҳаракат ва битта subtitle stack.

**C-06 · 11/07–11/09 future drafts йўқ**  \
**Далил:** [calendar.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/calendar.json).  \
**Хавф/таъсир:** Automated calendar job учун 4 кунлик buffer мақсади бажарилмаган; маҳсулот режаси оқсайди.  \
**Тузатиш:** Source-only authoring agent’га 11/07 series part1, 11/08 part2, 11/09 lesson restore task; quality checks йўқотилмасин.  \
**Қабул тести:** `content:buffer` = ready 4/4 ва sourceHash valid.

**C-07 · Feedback snapshots Git-versioned, platform analytics билан live automatic sync ишламайди**  \
**Далил:** [README.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/README.md#L70-L92); [feedback-analyzer.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/feedback-analyzer.mjs#L181-L207).  \
**Хавф/таъсир:** Analytics read-only reports бор; dataset freshness амалда ташқи agent/Zernio sync’га боғлиқ.  \
**Тузатиш:** Аниқ `observedAt`/syncFreshness; API integration only if actual use justified.  \
**Қабул тести:** 7d matched-age evidence, stale observations never treated new.

### НАШР / ZERNIO / PREVIEW — 7 топилма

| ID | Priority | Тасдиқ даражаси | Аниқ топилма |
|---|---|---|---|
| `P-01` | **P1** | Кодда аниқ | `github-video-pipeline.resolve` бошқа тилни ҳисобга олмай RU publication check қилади |
| `P-02` | **P1** | Кодда аниқ | `published-evidence` registry фақат Instagram/YouTube қабул қилади |
| `P-03` | **P1** | Кодда аниқ | Cloud ва Codex-local Zernio publish икки мустақил entrypoint |
| `P-04` | **P2** | Кодда аниқ | Cloud publish draft қўллайди, Codex local CLI фақат now/scheduled |
| `P-05` | **P2** | Кодда аниқ | Approved render artifact 7 кун сақланади |
| `P-06` | **P2** | Кодда аниқ | Owner approval ва connected account checks — тўғри ҳимоя, сақлаш керак |
| `P-07` | **P2** | Эҳтимолий | Facebook RU/ТJ битта саҳифа; бир хил account routing адаштириши мумкин |

**P-01 · `github-video-pipeline.resolve` бошқа тилни ҳисобга олмай RU publication check қилади**  \
**Далил:** [github-video-pipeline.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/github-video-pipeline.mjs#L89-L99).  \
**Хавф/таъсир:** `confirmedPublishedFor(found.id)` activeLanguage() default ru; `language=tg` талабида RU published бўлса TG ишини блоклаши мумкин.  \
**Тузатиш:** `languages.some(lang=>confirmedPublishedFor(id,...,lang))` ни effective target policy’га мос scope қилиш; per-language published check.  \
**Қабул тести:** RU published/TG unpublished ва аксинча 2 test.

**P-02 · `published-evidence` registry фақат Instagram/YouTube қабул қилади**  \
**Далил:** [published-evidence.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/published-evidence.mjs#L16-L36).  \
**Хавф/таъсир:** TikTok/Facebook ҳам destination, аммо уларнинг published evidence’i бу registry schema’сида кўрсатилмаган; duplication guard platform coverage чекланган.  \
**Тузатиш:** Умумий platform-грануляр registry схемаси; migration фақат verified Zernio readbacks билан.  \
**Қабул тести:** RU/TG 4 platforms, manual FB RU exception сақлансин.

**P-03 · Cloud ва Codex-local Zernio publish икки мустақил entrypoint**  \
**Далил:** [zernio-approved-publish.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/zernio-approved-publish.mjs#L149-L248); [codex-local-video-publish.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/codex-local-video-publish.mjs#L109-L207).  \
**Хавф/таъсир:** Икки media origin зарур, аммо duplicate receipt/approval policy drift бўлиши мумкин.  \
**Тузатиш:** Shared `validateApproval`, `verifyAccount`, `writeReceipt`, `reconcile` core; upload transport икки хил қолсин.  \
**Қабул тести:** Same SHA/account/mode preconditions, идемпотент publish.

**P-04 · Cloud publish draft қўллайди, Codex local CLI фақат now/scheduled**  \
**Далил:** [zernio-publication-core.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/zernio-publication-core.mjs#L14-L33); [codex-local-video-publish.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/codex-local-video-publish.mjs#L160-L166).  \
**Хавф/таъсир:** UI/қоидаларда иккита йўл имкониятлари фарқ қилади, chalkashlik.  \
**Тузатиш:** Capability matrix’ни README’да очиқ ёзиш; support parity кераклиги бўйича owner қарор.  \
**Қабул тести:** No unauthorized draft/auto posting.

**P-05 · Approved render artifact 7 кун сақланади**  \
**Далил:** [video-review.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/video-review.yml#L194-L203).  \
**Хавф/таъсир:** Етти кундан кейин preview/MP4 GitHub artifact download мумкин эмас, лекин published provenance hash тарихда қолади.  \
**Тузатиш:** Owner-approved архив учун hash-keyed storage/receipts; ишланмаган media’ни сақлаб кетмаслик.  \
**Қабул тести:** Post media hash link to long-term retention.

**P-06 · Owner approval ва connected account checks — тўғри ҳимоя, сақлаш керак**  \
**Далил:** [zernio-publication-core.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/zernio-publication-core.mjs#L20-L112); [zernio-approved-publish.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/zernio-approved-publish.yml#L55-L61).  \
**Хавф/таъсир:** Ўчириб «соддалаштириш» тасодифий оммавий пост ва privacy risk беради.  \
**Тузатиш:** Қисқартириш фақат код дубликатларига; owner preview, SHA, route, API readback unchanged.  \
**Қабул тести:** Unauth mode/target/time/sha → zero publish calls.

**P-07 · Facebook RU/ТJ битта саҳифа; бир хил account routing адаштириши мумкин**  \
**Далил:** [publication-destinations.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/publication-destinations.json#L1-L145).  \
**Хавф/таъсир:** RU Facebook automatic Zernio publishing тақиқланган, TJ рухсат. Handle’ларга қараб locale infer қилиш хато.  \
**Тузатиш:** Routing visual QA, hard fail on RU FB Zernio; one canonical destination mapping.  \
**Қабул тести:** ТJ TikTok @hskai.ru бўлишига қарамай тожикча контент кетсин.

### REPO / ИНФРА / БЕЗОПАСЛИК — 9 топилма

| ID | Priority | Тасдиқ даражаси | Аниқ топилма |
|---|---|---|---|
| `I-01` | **P2** | Кодда аниқ | `.mcp.json`да npx -y @latest MCP’лар pin қилинмаган |
| `I-02` | **P2** | Кодда аниқ | `.agents` vendor skills 988 файл / ~15.9 MB |
| `I-03` | **P2** | Кодда аниқ | `videos/` учта алоҳида HyperFrames workspace ≈148.3 MB |
| `I-04` | **P2** | Кодда аниқ | reports ≈50.2 MB ва exports ≈27.4 MB бинарлар Git’да |
| `I-05` | **P2** | Кодда аниқ | 3 HyperFrames проектада `AGENTS.md` ва `CLAUDE.md` байтма-байт нусха |
| `I-06` | **P2** | Кодда аниқ | HeroUI skill `.claude` ва `.cursor` папкаларида byte-identical |
| `I-07` | **P2** | Эҳтимолий | Public repo’да ҳақиқий UI capture ва video assets бор |
| `I-08` | **P2** | Кодда аниқ | Бир хил PNG Git blob бир неча project’да тарқалган |
| `I-09` | **P2** | Эҳтимолий | TTS error handling Google-key redaction’га махсуслашган |

**I-01 · `.mcp.json`да npx -y @latest MCP’лар pin қилинмаган**  \
**Далил:** [.mcp.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/.mcp.json#L1-L19).  \
**Хавф/таъсир:** Agent tool behavior без контроля версия алмаштириб юбориши мумкин; supply-chain ва reproducibility risk.  \
**Тузатиш:** Approved fixed versions; update bot + smoke; unique skill source.  \
**Қабул тести:** Clean workspace MCP start, no unexpected downloads.

**I-02 · `.agents` vendor skills 988 файл / ~15.9 MB**  \
**Далил:** [skill-catalog.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/skill-catalog.json).  \
**Хавф/таъсир:** 37+ skills and embedded helper duplicates project navigationни оғирлаштиради; барчаси active lesson code эмас.  \
**Тузатиш:** Inventory route’га қараб archive/uninstall only unused vendors; pinned manifest/sbom; owner approval.  \
**Қабул тести:** Remotion/HyperFrames production skill routing remains deterministic.

**I-03 · `videos/` учта алоҳида HyperFrames workspace ≈148.3 MB**  \
**Далил:** [SKILLS.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/SKILLS.md#L27-L62).  \
**Хавф/таъсир:** Лойиҳанинг асосий Remotion дарс pipeline’и эмас; медиа ва `AGENTS` duplicate repo оғир.  \
**Тузатиш:** `archive/` ёки external release/LFS; уларни фаол `main`дан алоҳида белгиланг; файлларни ўчирмасдан аввал SHA/reference audit.  \
**Қабул тести:** 3 independent old campaigns reproduce/preview if needed.

**I-04 · reports ≈50.2 MB ва exports ≈27.4 MB бинарлар Git’да**  \
**Далил:** [HSK_AI_Content_System.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/HSK_AI_Content_System.md#L1-L36).  \
**Хавф/таъсир:** Repo clone size ва CI checkout traffic кескин ошади; ишлаб чиқариш artifact архиви Git source’га аралашган.  \
**Тузатиш:** Versioned metadata & signed manifests Git’да, heavy outputs release/object storage; Git history rewrite қилмаслик.  \
**Қабул тести:** Archive sha matched, CI build preserves media references.

**I-05 · 3 HyperFrames проектада `AGENTS.md` ва `CLAUDE.md` байтма-байт нусха**  \
**Далил:** [AGENTS.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/videos/hsk-ai-voice-promo/AGENTS.md); [CLAUDE.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/videos/hsk-ai-voice-promo/CLAUDE.md).  \
**Хавф/таъсир:** Иккита active йўриқнома келажак ўзгартиришда drift қилади.  \
**Тузатиш:** Бир canonical file + adapter symlink/link (platform compatibility текширилгандан кейин).  \
**Қабул тести:** Content hash per workspace identical.

**I-06 · HeroUI skill `.claude` ва `.cursor` папкаларида byte-identical**  \
**Далил:** [SKILL.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/.claude/skills/heroui-react/SKILL.md); [SKILL.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/.cursor/skills/heroui-react/SKILL.md).  \
**Хавф/таъсир:** Бир skill’нинг икки локал version owner’и бор.  \
**Тузатиш:** Platform-specific shim ва canonical version pin; старий agent config бузилмасин.  \
**Қабул тести:** Smoke both Cursor/Claude entrypoints.

**I-07 · Public repo’да ҳақиқий UI capture ва video assets бор**  \
**Далил:** [ai-voice-original.png](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/public/promo-captures/ai-voice-original.png).  \
**Хавф/таъсир:** Шахсий маълумот ёки эски app UI чиқиб қолган бўлиши мумкин; файлларнинг ўзида privacy issue исботланмаган.  \
**Тузатиш:** Барча media учун privacy/PII + freshness scan; platform-specific reuse ва provenance.  \
**Қабул тести:** Метадата/скриншотда account IDs, secrets, private user content йўқ.

**I-08 · Бир хил PNG Git blob бир неча project’да тарқалган**  \
**Далил:** [hsk-ai-logo-1024.png](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/public/branding/hsk-ai-logo-1024.png).  \
**Хавф/таъсир:** Repo tree текширувида логотип 6 жойда, AI Voice capture 8 жойда бир blob SHA.  \
**Тузатиш:** Asset registry/shared source ёки archive dedup; versioned snapshots бузилмасин.  \
**Қабул тести:** Ҳар campaign render asset absolute path ишласин.

**I-09 · TTS error handling Google-key redaction’га махсуслашган**  \
**Далил:** [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L783-L794); [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L38-L51).  \
**Хавф/таъсир:** `safeErrorMessage` AIza pattern’ни тозалайди; бошқа махфий key у эҳтимолий provider error string’да акс этса тозаланмаслиги мумкин. Ҳозирча leak далили йўқ.  \
**Тузатиш:** Credential-agnostic redaction + structured error code; full provider raw error logs public artifact’га кирмасин.  \
**Қабул тести:** Artificial secret strings (OpenRouter, Gemini, Zernio) ҳеч қаерда кўринмасин.

### ЭСКИРГАН .MD ҚОИДАЛАР / ЙЎРИҚНОМАЛАР — 14 топилма

| ID | Priority | Тасдиқ даражаси | Аниқ топилма |
|---|---|---|---|
| `D-01` | **P0** | Эскирган актив қоида | `AI_RULES.md` Google Gemini API’ни ягона production transport деб атаяпти |
| `D-02` | **P0** | Эскирган актив йўриқнома | `WORKFLOW.md` Google upload/delete ва `.env.local`ни ягона йўл деб ёзади |
| `D-03` | **P0** | Эскирган архитектура | `PROJECT_MEMORY.md` HTTP 429’да Gemini key rotate қилинади дейди |
| `D-04` | **P1** | Эскирган архитектура | `PROJECT_MEMORY.md` тожикча voice ҳали candidate деб ёзади |
| `D-05` | **P1** | Эскирган йўриқнома | `GITHUB_VIDEO_REVIEW.md` биринчи қадам фақат `GEMINI_API_KEY` дейди |
| `D-06` | **P1** | Эскирган source docs | `content/SKILLS.md` production captions’ни exclusively Gemini direct деб тушунтирган |
| `D-07` | **P1** | Эскирган editorial doc | `content/REFERENCE_AUDIT.md` овоз Google’га юборилади деб ёзган |
| `D-08` | **P1** | Эскирган schema терминологияси | `EPISODE_SCHEMA.md` `gemini-production` ва `pending-gemini-generation` номларига боғланган |
| `D-09` | **P1** | Эскирган planning file | `SEMANTIC_VISUAL_STORYTELLING_PLAN.md` бошида implemented ва “design-only / not merged” бирга турибди |
| `D-10` | **P2** | Эскирган scope | `EDITING_SPEC.md` “Russian captions” бўлими default RU+TG’ни тўлиқ акс эттирмайди |
| `D-11` | **P2** | Документда hard-coded кўчирилган қиймат | `CONTENT_PLAN.md` buffer target 4 деб яна ёзади |
| `D-12` | **P2** | Эскирган label | `README`/`docs`да legacy CLI `gemini` ва provider номлари UI учун икки хил |
| `D-13` | **P2** | План статуси | `ADAPTIVE_STORYTELLING*` тарихий/таклиф экани белгиланган, архив номига ажратиш мумкин |
| `D-14` | **P2** | Документни узунлиги | `WORKFLOW.md` ≈44KB / 149 қатор; `AI_RULES.md` ≈18KB / 69 қатор |

**D-01 · `AI_RULES.md` Google Gemini API’ни ягона production transport деб атаяпти**  \
**Далил:** [AI_RULES.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/AI_RULES.md#L38-L48).  \
**Хавф/таъсир:** Кодда default OpenRouter; агент қоидадан турли API’га йўналиши мумкин.  \
**Тузатиш:** Model provider, transport, STT source, failover алоҳида каноник contracts; default OpenRouter ва manual Gemini secondary аниқ.  \
**Қабул тести:** Операцион ҳужжат ва код semantically consistent.

**D-02 · `WORKFLOW.md` Google upload/delete ва `.env.local`ни ягона йўл деб ёзади**  \
**Далил:** [WORKFLOW.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/WORKFLOW.md#L109-L119).  \
**Хавф/таъсир:** Операцион 3-босқич OpenRouter учун нотўғри, кейинги developer/agent ишни бузиши мумкин.  \
**Тузатиш:** Transport-specific steps ва common checkpoint; sample exception unchanged.  \
**Қабул тести:** `content:make` default OpenRouter setup docs accurate.

**D-03 · `PROJECT_MEMORY.md` HTTP 429’да Gemini key rotate қилинади дейди**  \
**Далил:** [PROJECT_MEMORY.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/PROJECT_MEMORY.md#L13-L20) ↔ [video-credentials.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/video-credentials.mjs#L54-L70).  \
**Хавф/таъсир:** Амалдаги код HTTP 429да rotate қилмайди; маъновий зиддият бор.  \
**Тузатиш:** Current behavior’га мос такрорлаш: 429 backoff/reset, never rotate across accounts/projects to evade quota.  \
**Қабул тести:** Docs+tests reflect key failover.

**D-04 · `PROJECT_MEMORY.md` тожикча voice ҳали candidate деб ёзади**  \
**Далил:** [PROJECT_MEMORY.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/PROJECT_MEMORY.md#L5-L11) ↔ [voice-profile.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/locales/tg/voice-profile.json#L1-L18).  \
**Хавф/таъсир:** Тожикча профиль `approved`, архитектура ҳолати obsolete.  \
**Тузатиш:** Delete outdated candidate sentence, voice status only profile’dan read.  \
**Қабул тести:** Owner approval sample unchanged.

**D-05 · `GITHUB_VIDEO_REVIEW.md` биринчи қадам фақат `GEMINI_API_KEY` дейди**  \
**Далил:** [GITHUB_VIDEO_REVIEW.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/docs/GITHUB_VIDEO_REVIEW.md#L11-L31) ↔ [video-review.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/video-review.yml#L125-L153).  \
**Хавф/таъсир:** OpenRouter primary secret инструкцяси йўқ, job default OpenRouter.  \
**Тузатиш:** `OPENROUTER_API_KEY` асосий; `GEMINI_API_KEY` optional secondary, no secrets in repo.  \
**Қабул тести:** New user GitHub Actions walkthrough real.

**D-06 · `content/SKILLS.md` production captions’ни exclusively Gemini direct деб тушунтирган**  \
**Далил:** [SKILLS.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/SKILLS.md#L27-L60).  \
**Хавф/таъсир:** `OpenRouter → Gemini model` transport тушунчаси ёзилмаган.  \
**Тузатиш:** Қоидани transport-agnostic `approved model + word-alignment` қилиш; actual disabled providers untouched.  \
**Қабул тести:** Skill router docs current.

**D-07 · `content/REFERENCE_AUDIT.md` овоз Google’га юборилади деб ёзган**  \
**Далил:** [REFERENCE_AUDIT.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/REFERENCE_AUDIT.md#L9-L19).  \
**Хавф/таъсир:** Очиқ фаол reference жорий route’ни нотўғри тушунтиради.  \
**Тузатиш:** “Original review at date X” historical annotation + current README link.  \
**Қабул тести:** Reference doc not second active authority.

**D-08 · `EPISODE_SCHEMA.md` `gemini-production` ва `pending-gemini-generation` номларига боғланган**  \
**Далил:** [EPISODE_SCHEMA.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EPISODE_SCHEMA.md#L69-L100).  \
**Хавф/таъсир:** Legacy keys route-agnostic эмас. Бу ерда сохта rebrand қилиб old published snapshotsни бузиб бўлмайди.  \
**Тузатиш:** Legacy schema term сақлансин; field definitions’da `model` vs `transport` ажратилсин; v2 migration future.  \
**Қабул тести:** Old episodes deserialize; new metadata transport accurate.

**D-09 · `SEMANTIC_VISUAL_STORYTELLING_PLAN.md` бошида implemented ва “design-only / not merged” бирга турибди**  \
**Далил:** [SEMANTIC_VISUAL_STORYTELLING_PLAN.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/plans/SEMANTIC_VISUAL_STORYTELLING_PLAN.md#L1-L29).  \
**Хавф/таъсир:** Historical roadmap сифатида белгилаб қўйилган, аммо 5/13/15/28 қаторлар current state билан зид; фаол манба сифатида адашиш осон.  \
**Тузатиш:** Файл бошига `ARCHIVED — historical snapshot` ва актуал owner/docs pointer; old notes preserve as history.  \
**Қабул тести:** Agent never uses archived proposal as current rule.

**D-10 · `EDITING_SPEC.md` “Russian captions” бўлими default RU+TG’ни тўлиқ акс эттирмайди**  \
**Далил:** [EDITING_SPEC.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EDITING_SPEC.md#L63-L70).  \
**Хавф/таъсир:** Атама русчага йўналган; canonical input bilingual.  \
**Тузатиш:** `Localized captions` деб қайта номлаш, locale-specific typography сақлаш.  \
**Қабул тести:** TG script, Chinese Hanzi, pinyin readable.

**D-11 · `CONTENT_PLAN.md` buffer target 4 деб яна ёзади**  \
**Далил:** [CONTENT_PLAN.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/CONTENT_PLAN.md#L12-L16).  \
**Хавф/таъсир:** Canonical `calendar.json` қиймати келажакда ўзгарса docs stale бўлади.  \
**Тузатиш:** Numeric mutable count’ни docs’да такрорламаслик; JSON owner path’га ссылка.  \
**Қабул тести:** Consistency check should detect duplication or dynamic source.

**D-12 · `README`/`docs`да legacy CLI `gemini` ва provider номлари UI учун икки хил**  \
**Далил:** [README.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/README.md#L1-L54); [package.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/package.json#L17-L40).  \
**Хавф/таъсир:** New operator `content:voice:gemini`ни Direct Google деб ўйлаши мумкин, у ҳозир OpenRouter default генераторга йўналади.  \
**Тузатиш:** CLI display/alias deprecation; primary `content:voice`, explicit `--transport`; docs.  \
**Қабул тести:** Legacy script old commands work as aliases.

**D-13 · `ADAPTIVE_STORYTELLING*` тарихий/таклиф экани белгиланган, архив номига ажратиш мумкин**  \
**Далил:** [ADAPTIVE_STORYTELLING_V1.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/plans/ADAPTIVE_STORYTELLING_V1.md#L1-L18); [ADAPTIVE_STORYTELLING_PILOT_V1.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/plans/ADAPTIVE_STORYTELLING_PILOT_V1.md#L1-L6).  \
**Хавф/таъсир:** Буларнинг ўзи хато эмас; эски instruction’ни агент жорий режа деб қабул қилмаслиги муҳим.  \
**Тузатиш:** `plans/archive/` move with links after references search; не менять source history.  \
**Қабул тести:** All backlinks resolved.

**D-14 · `WORKFLOW.md` ≈44KB / 149 қатор; `AI_RULES.md` ≈18KB / 69 қатор**  \
**Далил:** [WORKFLOW.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/WORKFLOW.md); [AI_RULES.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/AI_RULES.md).  \
**Хавф/таъсир:** Бир қаторда кўп policy, diff ва agent контекст овоз қисмига тегишли бўлмаган қоидаларни ҳам олади.  \
**Тузатиш:** Parent contents + topic sections split, лекин каноник owner битта; hash/line backlinks сақлаш.  \
**Қабул тести:** No duplicate active rule, migration tests.

## D. Текширилган реал экспериментлар

| Эксперимент | Русча | Тожикча | Нима исботлайди |
|---|---|---|---|
| OpenRouter live smoke | TTS 200, STT қайтди; Mandarin баъзан тушиб қолган | TTS 200, STT беқарор | API калит ва транспорт ишлайди; STT тўлиқлиги кафолат эмас |
| 3 саҳна continuous | 27.28 s | 27.72 s | Бир сўровда генерация |
| 3 саҳна scene-wise жами | 28.72 s | 36.04 s | Бир хил матнда алоҳида take темпи/сукутлари сезиларли фарқ қилади |
| Умумий waveform QA | 24 kHz PCM/WAV асосланган | 24 kHz PCM/WAV асосланган | RIFF, RMS, near silence/clipping рақамлари бор, табиийлик субъектив QA йўқ |

**Тожикчада scene-wise 36.04s vs continuous 27.72s (~30.0% узоқ).** Бу сабаб сифатида silence/интонацияни тинглаб текшириш учун далил; “сифат continuous’да 30% яхши” дегани эмас. Ушбу 8 аудио 3 саҳна учун; бутун 50s видео бўйича ҳали A/B бажарилмаган.

Реал тестлар:
- [OpenRouter live smoke 1](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41996975874) — TTS/STT бирлаштирилган тест; тестнинг дастлабки success status’и word coverage’ни текширмаган.
- [OpenRouter STT diagnosis](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41997465023) — Gemini/Whisper/MAI local ва Mandarin сўз натижалари солиштирилган.
- [Voice A/B run](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41998283174) — 8 файли сақланган.
- [Voice A/B artifact](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41998283174/artifacts/13401038147) — 7 кунлик retention; файллар history’га permanent commit қилинмаган.
- [Main consistency CI](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41994959528) — икки job success; `content:buffer` warning бор.
- [Scheduled safe-ci only](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41776134228) — `render-review` skipped; аудио/video produced эмас.

Официальные API манбалари: [Google Gemini Transcription](https://ai.google.dev/gemini-api/docs/transcribe), [OpenRouter TTS](https://openrouter.ai/blog/tutorials/text-to-speech/), [OpenRouter STT](https://openrouter.ai/blog/tutorials/transcription-on-openrouter/). Google расмий ҳужжати `word-level timestamps may degrade overall transcription accuracy` деб очиқ ёзади: шунинг учун transcript accuracy ва word timing алоҳида QA талаб қилади. Google’да `custom_vocabulary` билан word timestamps бирга ишламаслиги ҳам кўрсатилган; текширмасдан “hint қўшиб ҳал бўлади” дейиш нотўғри.

## E. Соддалаштириш қарори: нимани бирлаштириш, нимани сақлаш

| Модуль/жараён | Қарор | Сабаб | Қатъий чегара |
|---|---|---|---|
| `generate-voice-gemini.mjs` | **4 service’га ажратиш** | Генерация, resume, транскрипция, импорт аралашган | Voice profile/hash/old sample immutable |
| OpenRouter/Gemini Direct | **Иккита adapter сақлаш** | API response/credentials бошқа | Тасдиқсиз automatic paid fallback йўқ |
| Scene-wise vs continuous | **Бир production strategy** (A/B сўнг) | Duplicate mode complexity | Quality gate, multilingual checkpoint |
| MP3 intermediary | **Камайтириш номзоди** | Икки lossy transcode | WAV/AAC ABX тести олдин |
| `make-episode`, MCP prepare, render scripts | **Умумий orchestration** | Parallel CLI logic | CLI/MCP backwards compatible |
| `src/EpisodeComposition.tsx` | **Composer module split** | Large conditional renderer | Exact cue, owner-approved visuals same |
| Instagram/YouTube/FB body | **Ҳозиргича сақлаш** | Already renders shared body once | CTA/voice/audio sync |
| TikTok separate CTA | **Сақлаш** | Матн бошқа, permission boundary | No invented DM & exact owner preview |
| Two Zernio publish routes | **Core validation unify, transports сақлаш** | Cloud artifact ва local upload бошқа | Approval and readback never removed |
| JSON calendar and sourceHash | **Сақлаш** | Auditability, multilingual freshness | Source hash never bypassed |
| Heavy `videos/`, `.agents`, `reports` | **Scope/archive audit** | Many generated/duplicated assets | No destructive delete without SHA/owner consent |
| `plans/` historical documents | **ARCHIVED labels, backlink update** | Stale instructions | Historical evidence preserved |

## F. `.md` ва agent instruction миграция реестри

| Файл | Ҳолат | Нима қилинади | Ўзгармас қоида |
|---|---|---|---|
| `AI_RULES.md` | **фаол, зиддият** | Provider vs transport; STT locale; credential rule янгилаш | owner approved model, voice, no unauthorized publish |
| `content/WORKFLOW.md` | **фаол, эскирган** | OpenRouter default, audio checkpoint, error branches, TTS quality stage | sourceHash, all languages, exact preview |
| `PROJECT_MEMORY.md` | **фаол, эскирган ҳолат** | RU/TG approved, 429 no rotation, real transport info | architecture only, no repeated policies |
| `docs/GITHUB_VIDEO_REVIEW.md` | **фаол, эскирган қадамлар** | Secrets: OpenRouter first; scripts current; restore protected assets; run job states | isolated no-auto-publication |
| `content/SKILLS.md` | **мезонлар сақланади** | Transport-neutral voice provider terminology | Remotion lessons/HyperFrames special split |
| `content/EDITING_SPEC.md` | **scope rewrite** | Russian captions → localized captions; QA step after voice | one visible action, phone readability |
| `content/EPISODE_SCHEMA.md` | **legacy terminology** | Add `transport`/checkpoint schema definitions | old approvals & captions unchanged |
| `content/REFERENCE_AUDIT.md` | **historical note** | Remove present-tense Google-only assumption | source evidence integrity |
| `content/CONTENT_PLAN.md` | **dup numeric** | Read dynamic buffer target from calendar | weekly mix canonical |
| `content/GRAPHIC_SCENES.md` | **соғлом source** | Reference via SKILLS, no mandatory rewrite | action proof and no fake visuals |
| `content/PROMO_WORKFLOW.md` | **review** | Voice transport terminology; product evidence route | genuine captures/story disclosure |
| `plans/SEMANTIC_VISUAL_STORYTELLING_PLAN.md` | **historical** | Clear ARCHIVED header and remove active-state contradictions | no history rewriting |
| `plans/ADAPTIVE_STORYTELLING_V1.md` | **historical already marked** | Archive folder after backlink tests | measured hypotheses only |
| `AGENTS.md` | **каноник router** | Update source ownership for new voice API config only | ownership not duplicated |
| `README.md` | **кўп қисми current** | Align `content:voice:gemini` alias/status, local setup | OpenRouter default, Google explicit secondary |
| `videos/*/AGENTS.md` + `CLAUDE.md` | **separate workspaces** | Canonical link/shim; do not apply to `hsk-tu-vous` lessons | independent HyperFrames workflows |

## G. Тузатишнинг аниқ, dependency-aware босқичлари

### Phase 0 — baseline ва regression evidence (read-only)
1. Тўлиқ `main` SHA + CI baseline + old published/approved sample SHA manifest (RU/TG/CTA/media) сақлаш.
2. `content:make` stage graph, source/locale/CTA identity; 3 сценарийли synthetic fixtures ва ҳамма unique Mandarin exemplar test corpus.
3. Сифат baseline: 8 A/B sample owner blind listen, 3–5 такрорий take, RU/TG Mandarin ASR coverage. Натижа йўқ бўлса сифат даъвоси қилмаслик.
4. `safe-ci green`, `source-ready`, `audio-ready`, `captions-verified`, `video-rendered`, `owner-approved`, `published` статусларини алоҳида баҳолаш.

### Phase 1 — P0 audio checkpoint/restore (биринчи тузатиш)
1. `(episodeId,language,platform/CTA,narrationHash,voiceProfileId,ttsModel,transport,style,chunkMode)` fingerprint бўйича immutable audio file ID.
2. TTS 200 ва RIFF validation → WAV + SHA + metadata atomic write, STT кейинги босқичда.
3. `content:make` + MCP main executor resume’ни автоматик танласин: old good audio untouched; failed STT → STT гана.
4. Actions failure учун secure, short-retention recovery artifact ва permissions. Key/raw provider response/transcript sensitive data artifact’га кирмасин.
5. `approved sample` махсус `audioMustNotBeRegeneratedForTranscription` checkbox давом этсин; no cloud TTS after it.

### Phase 2 — P0/P1 STT, Mandarin word accuracy
1. Адаптер malformed successful response ва HTTP transient’ни категориялашсин; retry STT only.
2. Locale+Mandarin автоматик таниш, supported language hint, verified gap-level recovery A/B; google-direct secondary manual қолсин.
3. First pass speech coverage ва word-timestamp alignment pipeline’ни алоҳида баҳолаш. Google огоҳлантирган timestamp accuracy tradeoff’ни ҳисобга олиб fallback only after mismatch.
4. Source tokens, recognized tokens, provider word times ва mismatch spans immutable diagnostics; explicit phonetic aliases — фақат verified Mandarin lexemes.
5. `MAI`, `Whisper`, `Scribe` STT’ни default қилиб алмаштириш шарт эмас: аввал ишончли RU/TG benchmark. Tajik support текширмасдан provider switch йўқ.

### Phase 3 — P1 first-take TTS сифатини ошириш
1. **1 take whole narration** + approved voice/models билан A/B. Scene mode fallback фақат full-take қусурли ёки provider limit бўлса.
2. Human blind score: clean Mandarin tone, clear RU/TG language, no omitted/repeated content, consistent pace/identity, no unnatural silence. Ҳар тилни алоҳида score.
3. Automatic physical QA: clip rate, decoded sample rate/channel, RMS/peak/clipping/silence, excessive pause, speech coverage; fake “99% naturalness” score чиқармаслик.
4. `spokenStyle`ни owner тасдиғисиз ўзгартирмаслик; model/voice pin сақлансин. Audio already approved бўлса қайта генерация йўқ.
5. Агар `continuous` 2 тилдан бирига ёмон чиқса, per-locale configurable strategy; universal compulsory conversion эмас.

### Phase 4 — P1 импорт, визуал ва аудио master
1. Русча 6s hook cap’ни ҳақиқий provider word boundaries билан алмаштириш; синтетик 8.44s case test.
2. Caption-to-scene mapping’да таймлайн proportional fallback ўрнига source span indexes; no fake anchors.
3. WAV→AAC direct render route A/B. MP3 generated preview when required, but do not decode a lossy preview to final master.
4. Visual `explain-actions-v1` графика қисмларини compositional modules’га ажратиш; semantic, storyboard ва old CTA snapshots untouched.
5. Per-platform render visual cue proof, final phone 270×480 preview + full sound.

### Phase 5 — P1/P2 orchestration, CI, docs
1. Voice adapter’лар, phase runner ва common CLI’ни модуллаштириб, old `content:voice` командасини сақлаш.
2. Missing 5 test files CI’га қўшиш; real API smoke always opt-in with capped spending; failing synthetic regression blocks merge.
3. Calendar buffer warning’ни алоҳида readiness gate/контент-task escalation қилиш; GitHub CI code check pass аниқ алоҳида кўрсатилсин.
4. `.md` active source migration: one file owner, no old rules side-by-side; `npm run check:consistency` + semantic manual audit.
5. Third-party skills/dependency inventory, npx @latest pin, media/privacy scan, archives (owner approves before removal).
6. Merge only after exact test suite and approval; do not auto-trigger Zernio/social publication.

## H. Қабул мезонлари — “done” деган аниқ шартлар

| Gate | Минимал қоида | Далил/тест |
|---|---|---|
| TTS cost/retry | Сақланган success WAV STT fail’дан кейин **қайта генерация қилинмайди** | API hit counter + SHA equality |
| TTS fidelity | Матндаги барча айтилган Mandarin сўзлар тўғри, RU/TG эшитиладиган нутқ табиий | Owner audio QA + source-text comparison |
| Word timing | 100% written tokens approved provider word intervals’га мос | exact source-token gate, gap provenance |
| Scene sync | 6s cap wrong не; кадр/овоз text маъноси бир вақтда | audio 8.44s hook regression + frame proof |
| Audio master | Quality no worse than approved baseline, encoder artifacts йўқ | WAV vs AAC A/B + ffprobe + phone preview |
| Two languages | RU ва TG packages мустақил, hash/source/voice lifecycle ажратилган | mixed-language/full E2E |
| Shared platforms | IG/YT/FB shared lesson body, TikTok separate CTA voice | content/video hashes & matched timing |
| Protected archive | 2026-10-26 TJ sample hash ўзгармайди | SHA-256 independent restore |
| Publishing | Ҳеч бир видео owner approval’сиз чиқмайди | wrong account/mode/hash negative tests |
| Docs | Active docs’да OpenRouter/Google 429 зиддиятлари қолмайди | semantic docs inspection, CI consistency |
| CI | Code success, content-readiness, real TTS и video success алоҳида | Actions summary job statuses |
| Cleanup | Archive/dedup old content safe, no broken imports/references | git tree & smoke after changes |

## I. Кодекс/агентга юбориладиган ишчи вазифа — амалда ишлаш тартиби

```text
BASE: akbarholturaev11-lang/Kantent main@6b8e66e39e828166333a904113877426b91afae5
Read the complete audit and current main before edits; main may have advanced.
Do NOT start by rewriting all modules. Work in separate small PRs and establish baseline tests.
Order: P0 immutable TTS checkpoints & resume -> STT-only retry/recovery ->
continuous-first A/B after owner audible approval -> hook/visual sync -> codec master ->
shared orchestration -> docs/rules migration -> CI & archive review.
Keep all existing owner-approved RU/TG voice profiles, lesson facts, CTA,
published status, Zernio permission controls and historical audio hashes unchanged.
Never fabricate word timestamps or substitute another voice to make tests green.
No unsolicited media publication; owner must approve exact preview/time/account.
For every PR: list changed behavior, why simpler, risks, audio quality impact,
mock and live test evidence, backward compatibility and rollback step.
```

## J. Очиш мумкин бўлмаган/етишмаган далиллар

- Runtime secrets’нинг қийматлари (OpenRouter калит GitHub Secrets’да борлиги реал API run’дан маълум, лекин secret UI’ни/қийматини кўрмадик).
- Production’да ҳар бир видео учун ҳақиқий OpenRouter/Google billing, exact usage, quota state ва voice failure rate статистикаси.
- 8 A/B файлнинг инсон қулоғидаги тасдиқланган баҳоси. Ҳаqiqiy audio кўриниши GitHub Actions artifact’ида, but not here bitwise listening/owner scoring.
- 2026-11-05 main’да ҳақиқий RU+TG mixed full-episode production E2E. Scheduled video-review workflow’да render job олдинги runs’да skipped.
- Public media asset’ларда PII/security leak борлиги тасдиқланмаган; media privacy QA алоҳида керак.
- Third-party `.agents/` skills ва учта independent `videos/` workspace’нинг **ҳар бир** манба файли manual line-by-line текширилмаган. Функция бўйича inventory ва ишга тушириш routing текширилди; “100% code-free bugs” деб даъво қилинмайди.

## K. Текширувни қайта ишга тушириш учун асосий файллар

1. [AGENTS.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/AGENTS.md)
2. [AI_RULES.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/AI_RULES.md)
3. [PROJECT_MEMORY.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/PROJECT_MEMORY.md)
4. [WORKFLOW.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/WORKFLOW.md)
5. [EPISODE_SCHEMA.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EPISODE_SCHEMA.md)
6. [EDITING_SPEC.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EDITING_SPEC.md)
7. [languages.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/languages.json)
8. [calendar.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/calendar.json)
9. [voice-profile.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/voice-profile.json)
10. [voice-profile.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/locales/tg/voice-profile.json)
11. [generate-voice-gemini.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs)
12. [openrouter-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs)
13. [continuous-tts-plan.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/continuous-tts-plan.mjs)
14. [make-episode.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/make-episode.mjs)
15. [import-voice.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs)
16. [render-episode.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-episode.mjs)
17. [render-platform-videos.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-platform-videos.mjs)
18. [EpisodeComposition.tsx](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/EpisodeComposition.tsx)
19. [github-video-pipeline.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/github-video-pipeline.mjs)
20. [published-evidence.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/published-evidence.mjs)
21. [mcp-server.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/mcp-server.mjs)
22. [video-credentials.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/video-credentials.mjs)
23. [video-review.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/video-review.yml)
24. [consistency.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/consistency.yml)
25. [GITHUB_VIDEO_REVIEW.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/docs/GITHUB_VIDEO_REVIEW.md)
26. [SKILLS.md](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/SKILLS.md)
27. [skill-catalog.json](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/skill-catalog.json)
28. [zernio-publication-core.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/zernio-publication-core.mjs)
29. [zernio-approved-publish.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/zernio-approved-publish.mjs)
30. [codex-local-video-publish.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/codex-local-video-publish.mjs)
31. [feedback-analyzer.mjs](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/feedback-analyzer.mjs)

---

**Жами:** 77 та далилланган code-path, rule mismatch, CI gap ёки алоҳида A/B билан текширилиши керак бўлган хавф/имконият. Ҳар бири алоҳида “тасдиқ даражаси” билан белгиланган. Рўйхатнинг узунлиги автоматик равишда 77 та ишлаб турган production bug бор дегани эмас.
**Аудитдан кейинги энг тўғри биринчи иш:** `V-07 + V-08 + O-01` (аудиони қайта генерация қилмасдан сақлаш), кейин `V-03...V-06` (STT), кейин `V-01/V-02` (continuous TTS A/B), кейин `R-01` (hook sync), сўнг документация ва қолган қисқартиришлар.


---

# L. Иккинчи босқич: аввалги ноаниқликларни қайта текшириш (2026-11-05, 19:00 CST)

**Мақсад:** аввалги 77 бандни автоматик «77 bug» деб қабул қилмасдан, муҳим гипотезаларни код, расмий API схемаси, 4 та реал live STT run, битта RU/TG A/B run ва Linux синтетик репродукцияси билан аниқлаштириш. **Иш базаси ўзгармаган:** `main@6b8e66e39e828166333a904113877426b91afae5`. Бу addendum аввалги C/E/G бўлимларидаги баён билан зид бўлса, **шу L бўлимдаги аниқлаштириш устувор**. Production код ўзгартирилмади.

## L.1. Статусларнинг аниқ маъноси

- **REPRODUCED** — код шароити синтетик ёки live ишга туширишда кўрсатилган. Айнан ҳар бир мавжуд видеода шу белгиси бор, дегани эмас.
- **CONFIRMED CODE DEFECT** — амалга ошиши мумкин бўлган нотўғри шарт/ўлчаш/контроль мантиғи коддан исботланади.
- **CONFIRMED GAP** — ҳимоя/талаб етмайди ёки эскирган, лекин бу ҳолатнинг ўзи сифати паст овоз дегани эмас.
- **CONDITIONAL RISK** — маълум шарт бўлса таъсир қилади; ҳозирги real episode’да содир бўлгани ҳали исботланмаган.
- **DISPROVED / DOWNGRADED** — аввалги ҳисоботдагидан кучсизроқ хулоса; код тўғри safeguard'га эга ёки тестда тахмин тасдиқланмади.
- **OPEN** — artifact аудиосини инсон тинглаши, Zernio/provider usage ёки production E2E талаб қилади.

## L.2. Энг кучли янги топилмалар

### X-01 — P0/P1 · **REPRODUCED: Ubuntu'да `afinfo` йўқ, аудио давомийлиги субтитр вақтига алмаштирилади**

**Код:** [`scripts/import-voice.mjs#L175-L183`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L175-L183), [`#L240-L250`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L240-L250), [`#L349-L375`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L349-L375), [`video-review.yml#L165-L170`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/video-review.yml#L165-L170).

**Аниқ сабаб:** `readDurationMs` фақат macOS `afinfo` чақиради. Linux GitHub runner'да `afinfo` йўқ. `readDurationMs(...)` нол қайтарса, `durationMs = lastCaptionEndMs`. Бу аудио файлнинг ҳақиқий охири эмас; код фақат субтитр охирини билади. `audioTrimAfterFrames` учун табиий 500 ms tail қоидаси ҳам ишламайди (`durationMs-lastCaptionEndMs = 0`). `finalSceneEndMs` эса voice'нинг асл охирини ҳисобга олмайди.

**Синтетик репродукция (локал Linux):** 3 секундлик MP3 тайёрланди; энг охирги сўз белгиси атайлаб 2.0s деб берилди. `ffprobe`: **3048ms**, коднинг `afinfo` fallback натижаси: **2000ms**, фарқ: **1048ms**. Бу синтетик тест, real Kantent MP4'нинг 1048ms кесилганини исботламайди. Натижада final кадр вақти нотўғри қисқариши ёки пауза қирқилиши мумкин; тармоқда биринчи уриниш сифатсиздек эшитилишининг **ишонарли сабаби**.

**Ечим:** `ffprobe -show_entries format=duration` (лойиҳада FFmpeg/ffprobe аллақачон бор) ёки мавжуд `mediaDurationMs` ни умумий helper сифатида ишлатиш. `captions.endMs` фақат validation учун; файл duration ўрнини босмасин. Мажбурий tail policy'ни verify. **Тест:** `2s captions / 3s WAV/MP3`, Ubuntu/macOS, TikTok CTA; final output қанча sample сақланганини ffprobe билан солиштириш.

### X-02 — P1 · **CONFIRMED CODE DEFECT: TikTok CTA boundary’да ишламайдиган текширув**

**Код:** [`import-voice.mjs#L192-L229`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L192-L229).

```js
const lessonCaptions = baseEpisode.captions.filter(caption => caption.endMs <= ctaStartMs);
if (!lessonCaptions.length || lessonCaptions.at(-1).endMs > ctaStartMs) throw Error(...);
```

`filter(endMs <= ctaStartMs)`дан кейин `lessonCaptions.at(-1).endMs > ctaStartMs` **ҳеч қачон true бўла олмайди**. Демак safeguard'нинг иккинчи шарти мажбурий равишда ўлик. Агар (бошқа bug ёки нотўғри scene mapping сабаб) сўз CTA boundary'ни кесиб ўтса, у caption рўйхатидан ташлаб юборилиши, `atrim=end=ctaStartMs` эса унинг аудиосини кесиши мумкин. Ҳозирги scene mapper одатда boundary'ни сўздан кейин қўяди, шунинг учун **реал TikTok кесилгани ҳали исботланмаган**.

**Ечим:** кесишдан олдин **барча** source lesson captions’ни кўриб crossing detection; сўз boundary'дан ўтса қатъий block. Тасдиқланган boundary'да audio fade/crossfade фақат actual sample'га мувофиқ ишлатилсин. **Тест:** caption `[900, 1100]ms`, CTA start `1000ms`, бошқа correct caption ҳам бўлсин → ҳозирги код бу word'ни silently drops; янги код reject.

### X-03 — P1 · **CONFIRMED CODE DEFECT: `afinfo` Linux сабаби TikTok'да ҳам такрорланади**

**Код:** [`import-voice.mjs#L207-L230`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L207-L230). TikTok'нинг `voice-full.mp3` янги MP3 файлга қайта кодланади; сўнг унинг давомийлиги яна `readDurationMs` билан ўлчанади, `afinfo` бўлмаса `ctaStartMs +` **тахминий** биринчи audio duration қўшилади. Бу мустақил, platform-specific regression нуқтаси. Уни X-01 билан бир умумий `probeDurationMs` тузатиши ҳал қилади; икки марта мустақил patch қилиш керак эмас.

### X-04 — P0 · **CONFIRMED CODE DEFECT: STT 200 + `words=[]` retry budget'ни четлаб ўтади**

**Код:** [`openrouter-voice.mjs#L124-L143`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L124-L143); [`generate-voice-gemini.mjs#L1192-L1208`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1192-L1208). Ташқи `while(attempts<3)` бор, аммо `transcribeOpenRouter(...)` invalid word list'га `throw` қилади; catch фақат бутун генераторнинг охирги `catch`ига тушади. Натижада бир мартаги нестабил STT жавоби бутун media job'ни block қилади; **WAV маҳаллий сақланади, аммо runner'да durable checkpoint йўқ**.

**Ечим:** STT transport error classes (`retryable`, `nonretryable`, `valid-response-invalid-timing`) ва per-STT attempt catch; bounded retry фақат STT'да. `403`/unsupported schema каби доимий хато учун бекорга пул сарфламаслик. Транскрипция тикланса ҳам original WAV хэши ўзгармасин.

### X-05 — P1 · **DOWNGRADED: `content:make` ҳар сафар TTS'ни қайта генерация қилмайди**

Аввалги `V-07/O-01` баёнини аниқлаштириш: [`make-episode.mjs#L55-L83`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/make-episode.mjs#L55-L83) `hasImportedVoice` ва `hasTikTokVoice` ни текшириб, тўғри imported `audioSrc + voiceProfileId + narrationHash + gemini-word-timestamps + captions` бўлса, TTS'ни **skip** қилади. Демак **успешно импорт қилинган овоз сақланади**. Реал бўшлиқ — *TTS тайёр, STT/import ҳали ўтмаган* ҳолатни автоматик resume қилмаслик ва runner ўлганда checkpoint'ни сақламаслик. Тузатиш ҳам фақат шу missing phase'га қаратилсин, ишлаб турган reuse йўлини қайта ёзмасин.

### X-06 — P1 · **CONDITIONAL BUG: GitHub video preflight RU state'ни TG request'га аралаштириши мумкин**

**Код:** [`github-video-pipeline.mjs#L89-L96`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/github-video-pipeline.mjs#L89-L96). `confirmedPublishedInAllLanguages(languages)` тўғри, лекин кейинги `confirmedPublishedFor(found.id)` аргументсиз `activeLanguage()` default'га (RU) қайтади. `language=tg` ҳолатида агар RU пост бор, TG ҳали йўқ бўлса, preflight TG production'ни ортиқча тўсади. **Жорий `published-posts.json`да фақат эски `zai-location` RU IG/YT ёзувлари бор**, демак янги 6 ноябрь эпизодида бу хатонинг содир бўлгани эмас, фақат коддаги condition исботланган. `make-episode` callback'идаги per-locale `confirmedPublishedFor` эса locale context ичида ишлайди ва тўғри; айнан `github-video-pipeline.resolve`га fix керак.

### X-07 — P2 · **DOWNGRADED: `published-posts.json` қоплами қисман тарихий, ҳар бир TikTok/FB пости ҳимоясиз дегани эмас**

[`published-evidence.mjs#L16-L33`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/published-evidence.mjs#L16-L33) фақат Instagram/YouTube'ни қабул қилади, **ҳақиқат**. Аммо [`codex-local-video-publish.mjs`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/codex-local-video-publish.mjs#L75-L107)да local receipts/duplicate guard бор; [`zernio-publication-core.mjs#L141-L145`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/zernio-publication-core.mjs#L141-L145) deterministic idempotency key бор. Шу боис аввалги `P-02` — **барча TikTok/FB post'ларига duplicate protection умуман йўқ** деб талқин қилинмасин. **Ҳали очиқ:** қайси shared registry cross-run/cross-host dedup'ни тўлиқ қамрайди ва унга реаль Zernio GET readback қай тарзда импорт қилинади. Аввал evidence-flow map/test, кейин migration.

### X-08 — P1 · **CONFIRMED: Scene-wise ва one-take'да “1–2 уриниш”нинг маъноси бошқа**

**Код:** [`generate-voice-gemini.mjs#L1051-L1072`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1051-L1072); [`openrouter-voice.mjs#L75-L100`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/openrouter-voice.mjs#L75-L100). OpenRouter adapter ҳозир ҳар **TTS chunk** учун битта HTTP call. Standart scene-wise >1 chunk, ўзиёқ 1 video учун кўп paid TTS сўровлари. Direct Gemini 4 attempts/scene budget — бу ҳам **видео бўйича эмас**, chunk бўйича. Биринчи 2 request'да 2 тилли 4 платформали тўлиқ episode чиқариш мақсади стандарт режимда принципиал бажарилмайди. Ҳар тилда shared-voice + TikTok CTA структураси ҳам бор. **Ечим:** request budget'ни episode/language/platform кесимида аниқлаш, cache checkpoint ва `continuous`ни owner A/B тасдиғи ортидан default қилиш. Икки тилни **бир овозда аралаштирмаслик**.

### X-09 — P1 · **REAL A/B: тожикчада scene-wise тартибда танаффусга яқин сигналлар кўпроқ, лекин бу tabиийлик рейтинги эмас**

**Run:** [41998283174](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41998283174). Бир хил 3 саҳна, бир хил тил-модель-овоз, фақат chunk strategy фарқ қилади.

| Тил | Continuous audio | Scene audio totals | Scene − continuous | Weighted `nearSilencePct` continuous → scene | RMS continuous; scene variations |
|---|---:|---:|---:|---:|---|
| RU | 27.28s | 28.72s | +1.44s | 25.11% → **20.74%** | −17.51 dBFS; scene −16.91/−16.16/−15.38 |
| TG | 27.72s | 36.04s | **+8.32s** | 18.43% → **29.46%** | −17.10 dBFS; scene −16.91/−15.04/−16.36 |

`nearSilencePct` — амплитудаси `0.001`дан кичик **sample улуши**, ҳақиқий VAD silence seconds эмас. Шунинг учун «тожикчада 5.5s silence ортиқ» деб қатъий айтиш мумкин эмас; акустик хулоса учун waveform/VAD/инсон тинглаши керак. Русча results эса ўзгача: scene-wise *silence sample улуши камроқ*. Демак **continuous ҳар доим silence камайтиради** деган умумий назария ҳам исботланмаган. Моделлар RU ва TG орасида фарқ қилади; уларни тиллараро модель рейтингига айлантирмаслик керак.

### X-10 — P0/P1 · **REAL API: «тил hint’ини қўшсак ҳал» гипотезаси рад этилди**

**Run'лар:** [41996975874](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41996975874), [41997214886](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41997214886), [41997465023](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41997465023). RUда `ru` hint кўпинча `你好`ни тушириб қолдирган, `auto` баъзан фонетик «Нихэо» қилган. TGда `tg` hint тожикча жумлани тўғри, лекин Mandarin'ни туширган; `zh` hint баъзан фақат «Ni hao», баъзан форсий-араб ёзувида тожикчага ўхшаш жавоб қайтарган. Бир хил TTS sample ҳам ҳар бир run'да айнан бир хил эмас, STT randomness алоҳида causal test'га тўлиқ ажратилмаган — **ноаниқлик шу ерда**.

**Расмий OpenRouter STT schema:** `language` — **битта** ISO-639-1 code ёки auto; multiple `["tg-TJ", "zh-CN"]` эмас. [OpenRouter guide](https://openrouter.ai/blog/tutorials/transcription-on-openrouter/). **Google Direct** `language_codes` — multi-code, бошқа API. [Google transcription](https://ai.google.dev/gemini-api/docs/transcribe). Натижа: old `AI_RULES`ни OpenRouter request'га кўр-кўрона кўчириш хато. Доимий ечим: audio'ни immutable сақлаш; first-pass auto ва асосланган gap-specific re-recognition; ҳар бир til+Mandarin test case exact verified word cues.

### X-11 — P1 · **REAL API: word-count smoke тест нотўғри муваффақият берган, лекин бу production strict gate эмас**

[41996975874](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41996975874) live smoke job `success` бўлган: RU transcript'да `你好` йўқ, TG output фақат «Shalom. Ni hao.» каби. Чунки test `wordAnnotations.length>=3`ни текширган, **100% сценарий coverage'ни эмас**. Бу **алоҳида audit/test branch**даги smoke test'нинг камчилиги; production'даги `alignWords` strict gate бундай нотўғри transcript'ни қабул қилмаслиги керак. Демак "live smoke green = production video quality green" деган хулоса чиқармаслик. Тест'ни воқеий RU/TG+Hanzi `expectedNormalizedTokens===recognizedNormalizedTokens` ва actual timestamps билан янгилаш шарт.

### X-12 — P1 · **CONFIRMED INTENDED BLOCK: approved sample GitHub checkout'да йўқ — ҳимояни ўчирмаслик керак**

`review/` ва `public/generated/` `.gitignore`да; `voice-profile.json` sampleAudio кўпинча `review/...`га ишора қилади. [`github-video-pipeline.mjs#L65-L85`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/github-video-pipeline.mjs#L65-L85) тасдиқланган тожик sample учун аудио/капшн ҳамда working copy кўринмаса атайлаб **stop** қилади. Бу "pipeline bug" эмас, approved source аудио'ни тасодифан алмаштиришдан ҳимоя. Тузатиш: immutable audio SHA билан protected private storage/restore; guard'ни ўчирмаслик. Жорий репозиторий `main`да sample оригинали йўқ, шу sample эпизодини тўғридан-тўғри GitHub runner'да қайта йиғиб бўлмайди.

### X-13 — P1 · **RECLASSIFIED: `main` CI green ≠ calendar ready, эски production video ҳам эмас**

[Consistency run 41994959528](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41994959528)да next future 4 slots'дан **1 ready**, 2026-11-07, 11-08, 11-09 **missing**, лекин workflow `success`, чунки `content:buffer` code 2 атайлаб warning. Бу **real source readiness blocker**, `syntax` error эмас. [Video-review schedule run 41776134228](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41776134228)да `safe-ci=success`, `render-review=skipped` — video generation йўқ. Пуш тестлари ва реал нашр KPI'сини бир хил green статусдан ўлчаш мумкин эмас.

### X-14 — P2 · **OPEN: Git freshness source'ни текширади, лекин ишчи папкадаги uncommitted ўзгаришни текширмайди**

[`git-freshness.mjs`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/git-freshness.mjs#L8-L44) `HEAD` ва remote `main/currentBranch` ancestry'ни исботлайди, `git status --porcelain` текшируви йўқ. Шундай экан локал uncommitted scenario/visual/voice edits билан render қилиб, provenance'ни фақат `HEAD` деб қайд этиш мумкин. Бу локал workflow учун **conditional attribution risk**, реал misattribution исботланмаган. Ечим: dirty-source manifest (`trackedDirtyPaths`, relevant source hash), ёки publishable package учун tracked source cleanliness guard; `review/` каби generated ignored files'ни блокламаслик.

### X-15 — P1 · **REFINED: Audio codec занжири — учта мустақил platform re-encode эмас**

Normal lesson voice: WAV→MP3 128 kbps, Remotion master→AAC, [`render-platform-videos.mjs`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-platform-videos.mjs#L119-L163) final platform MP4'ларга `-c copy` қилади. Яъни YouTube ва Facebook учун audio'ни қайта-қайта мустақил кодламайди; **бу аллақачон яхши оптимизация**. TikTok'да қўшимча MP3 concat-reencode бор (`import-voice.mjs#L207-L229`). Қуйидаги A/B керак: original WAV, imported 128k MP3, final AAC; source sample-bit differences ва кўр-кўрона тинглаш. "Codec овозни аниқ ёмон қилган" ҳали исботланмаган.

### X-16 — P1 · **CONDITIONAL DEFECT: `spokenStyle`ни оддий config edit билан қўшиш OpenRouter'ни тўхтатади**

Иккала approved профилда `spokenStyle:""`; `openrouter-voice.mjs#L79-L80` `style` бўш бўлмаса `throw`. Демак ҳозирги бўш style **мажбурий compatibility** шарт. Аввалги «style берсак овоз яхши бўлади» деган тавсияни бажариш production'ни бузади. Style proposal фақат янги transport capability+mock+paid sample test ва owner approval билан. **Ҳозир бўш style — bug эмас.**

### X-17 — P2 · **DOWNGRADED: Cloud/Local нашрда draft parity бўлмаслиги автоматик bug эмас**

GitHub cloud path `draft|scheduled|now`, Codex-local path `scheduled|now`. Бу аниқ product UX асимметрия. Бироқ Codex-local `draft`ни автоматик қўшиш owner permission contract'ни ўзгартиради; аввал canonical capability matrix ва кераклиги ҳақида product қарори, кейин синхрон secure tests. Publishing mode'ларни бирлаштириб owner approvals ни соддалаштирмаслик.

### X-18 — P2 · **DOWNGRADED: `.agents` ва `videos/` бир хил Git blob билан repo pack ни ҳам шунча баробар шиширмайди**

Ҳужжатнинг inventory'си Git tree entry байтларни жамлайди; бир хил Git blob SHA турли path'да такрорланса, Git object storage дедупликация қилади. Бу duplicated working-tree file count ва checkout/human-maintenance cost'ини оширади, аммо compressed Git pack ҳажмига айнан файллар жами бўйича коэффициент қўллаш нотўғри. 988 skill файлини оммавий ўчиришга ҳали асос йўқ. Катта мустақил 3 HyperFrames workspace ҳам normal lesson Remotion'дан қасддан ажратилган.

### X-19 — P1/P2 · **OPEN: асл TTS талаффузини STT жавобига қараб 100% баҳолаб бўлмайди**

Live STT аралаш русча/тожикча+Mandarin сўзларни нотўғри берди. Бу TTS ҳам нотўғри айтганининг **етарли далили эмас**; ASR model ўзи хатога йўл қўйиши мумкин. Шундай қилиб **TTS voice quality** ва **STT transcript fidelity** мустақил score card бўлиши шарт:

1. Сценарийдаги ҳар бир Mandarin syllable, тожикча имло ва бренд номини native/competent reviewer аудиодан тинглайди.
2. Диктор identity, cadence, natural pauses, clipping, music ducking — аудио бўйича баҳоланади.
3. Exact audio SHA сақланган ҳолда 2–3 STT benchmark қайта ишлатилади. Ҳар STT fail янги TTS request эмас.
4. 3 саҳна A/B'дан тўлиқ episode ва 4 platform чиқишларига умумлаштириш фақат кейинги full E2E натижаси билан мумкин.

### X-20 — P1 · **REAL: муқобил STT моделлар ҳам Tajik учун беайб fallback эмас**

[41997465023](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41997465023): `MAI-Transcribe-2` RU'да `你好`ни яхши чиқарди, TG'да «Имроз ... Ние хао» каби хатолар; Whisper TG'да латин имло ва Mandarin бузилди. [41997802478](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41997802478) Scribe v2 TG'да **форсий-араб ёзувига** ўтган (`سلام. امروز...`). Бу pipeline'нинг Tajik Cyrillic script token gate'ига drop-in substitute эмас. Alternate model default'ни алмаштириш эмас, optional benchmark; ишончли source cues ва audio SHA талаб қилинсин.

## L.3. Энг муҳим қўшимча қабул тестлари

| Test ID | Нима сабаб? | Далилли натижа нимани исботлайди? |
|---|---|---|
| `AT-DURATION-LINUX` | X-01/X-03 | `ffprobe 3s` vs last caption 2s; final video ҳеч қачон матн охирига мажбуран қисқартирмасин; tail policy explicit |
| `AT-CTA-CROSSING-WORD` | X-02 | CTA boundary'ни кесган caption барча ҳолатда block; ҳеч қандай silent drop йўқ |
| `AT-STT-EMPTY-WORDS` | X-04 | 200+words=[] recoverable STT retry; TTS hit count zero additional |
| `AT-VOICE-RESUME-PREIMPORT` | X-05 | TTS saved, STT fails → қайта ишга тушганда TTS zero additional |
| `AT-LOCALE-PREFLIGHT` | X-06 | RU published/TG not → TG allowed; reverse symmetric |
| `AT-PUB-IDEMPOTENCY-CROSSROUTE` | X-07 | Cloud+Local same SHA/account/platform concurrent attempts → exactly 1 external post, verified GET |
| `AT-ONE-TAKE-E2E` | X-08/X-09 | RU+TG exact-word captions, pronunciation, full scene sync, correct CTA/audio, approved hashes |
| `AT-STT-BILINGUAL-FIXTURE` | X-10/X-20 | Same immutable audio per 3+ STT variants, clip recovery, no fabricated time |
| `AT-LIVE-SMOKE-COVERAGE` | X-11 | Missing Mandarin/Tajik tokens → test fail despite ≥3 word timestamps |
| `AT-SAMPLE-PROTECTION` | X-12 | Protected sample missing → no TTS call, explicit restore instruction |
| `AT-CI-STATUS` | X-13 | CI success != media delivered; per-run indicators source-ready/rendered/reviewed |
| `AT-WORKTREE-PROVENANCE` | X-14 | Dirty tracked source → hash+disclosure or block before externally publishable proof |
| `AT-AUDIO-ABX` | X-15/X-19 | 24k WAV vs MP3 vs AAC level-matched; codec impact ўлчанган |
| `AT-STYLE-CONFIG` | X-16 | Nonempty style fail-closed; validated extension only after sample |

## L.4. Янги тузатиш тартиби (аввалги Phase G'ни аниқлаштиради)

1. **P0/A — Android ёки iOS эмас: айнан audio pipeline учун Linux duration fix** (`X-01/X-03`). Бир умумий `ffprobe` helper; audio real length + tail policy test; approved source audio файлларни тегмаслик.
2. **P0/B — Durability** (`V-07/V-08/O-01/X-05`). Immutable WAV and MP3 SHA; minimal encrypted private checkpoint or scoped failure artifact; saved TTS audio from STT fail reuse; no secrets/raw prompt in artifact.
3. **P0/C — STT stability and coverage** (`V-03..06/X-04/X-10/X-11`). Mock `words=[]`, partial transcript, RU/TG+Mandarin A/B; exact provider word timings; source narration must remain full. STT-only budget; no model switch without evidence.
4. **P1/D — CTA cross-boundary** (`X-02`) + Russian 6s hook visual cap (`R-01`). Actual sentence/syllable cues first; no early cut or forced 6s audio timing.
5. **P1/E — TTS continuous trial** (`V-01/V-02/X-08/X-09`). Audition 3-scene samples, full RU/TG episode on isolated branch; no promotion solely from elapsed seconds/silence fraction.
6. **P1/F — Final master audio QA** (`X-15/X-19`). Comparative WAV/MP3/AAC, TikTok concat and music/SFX, actual MP4 phone listening, first-take quality score.
7. **P2/G — Docs and operations:** explicitly separate `modelProvider` (Google Gemini) vs `transport` (OpenRouter/default or Google Direct/secondary), correct false 429 rotation in `PROJECT_MEMORY.md`, stale `WORKFLOW.md`, current `GITHUB_VIDEO_REVIEW.md`; mark archived plans as nonauthoritative; CI status and 5 missing test files; avoid accidental branch/route rules drift.

## L.5. Нима ҳали ҳам ноаниқ (ва буни қандай ёпиш мумкин)

| Очиқ савол | Ҳозир далил даражаси | Аниқлаш учун қандай текширув керак? |
|---|---|---|
| Continuous TTS'нинг овози табиийроқми? | 3 саҳнали durations/metrics; **инсон тинглаш йўқ** | Blind A/B RU/TG, бир хил loudness; Mandarin pronunciation баҳо |
| Реал GitHub production финал MP4'да охирги сўз кесилганми? | **Linux mismatch reproduced**, real final video failure йўқ | Реал MP4 frame/audio sample duration ва imported last caption difference |
| `Kore` икки тил учун бир хил идентификациями? | Model/voice slugs stable; акустик identity ҳали subjectively баҳоланмаган | Audio characteristic/identity blind review |
| STT missing `你好` — TTS айтмаганми ёки ASR танимаганми? | Live STT inconsistent | Асл WAV'ни тинглаш, тасдиқланган transcript + source waveform |
| Audio WAV→MP3→AAC сезиларли артефакт қиладими? | Код занжири аниқ, audible impact unmeasured | ABX ва финал MP4 тинглаш |
| Барча TikTok CTA кесилишлари тўғрими? | Dead guard confirmed, real cut unproven | crossing word synthetic + 3 real localized CTA |
| Ягона cross-route Zernio dedup кафолатлими? | Per-route guards бор, shared concurrent test йўқ | Икки йўлдан concurrent dry-run/idempotent mocked publish |
| Public capture'ларда махфий маълумот борми? | Файллар inventory қилинган, visual privacy inspection тўлиқ эмас | Media privacy screen review, owner consent, crop audit |
| Барча `third-party` skill safe'ми? | 988 файлик inventory, line-by-line security review йўқ | Dependency/SAST/license review, no arbitrary npm exec on PR |
| `main`дан кейинги ўзгаришлар борми? | Текширувда `6b8e66e` unchanged | Ҳар код ўзгаришидан олдин SHA refresh ва regression baseline |

## L.6. Аввалги ҳисобот учун расмий «тўғриланган» қарорлар

- `V-07`: **«ҳар қайта ишга туширишда TTS янги» — нотўғри**. Импорт қилинган овоз skip қилинади; фақат *pre-import failure*да auto-resume йўқ.
- `V-04`: **«бир нечта language hint қўшсак тўғриланади» — исботланмаган**; OpenRouter STT `language` битта code ва live testда йўқолишлар кўпайган. Multi-language hint фақат Google Direct конфигурациясида бор.
- `V-13`: `spokenStyle` бўшлиги **ҳозирги OpenRouter implementationда deliberate compatible**; уни бўшдан тўлдириш дарҳол throw. Биринчи навбатда style config edit қилманг.
- `V-15`: битта OpenRouter TTS HTTP attempt — knowingly fail-closed; бу bug эмас, retry policy ўрнатиш имконияти; total per-episode requests >1.
- `R-01`: 6s hook **визуал** cap, TTS файлни бевосита кесмайди. Аудио кесилиши ҳақида аниқ хулоса `X-01/X-02`дан кейинги rendered MP4 билан қилинади.
- `P-02`: IG/YT-only published registry — structural limit; бошқа platform'ларда **бошқа** guards бор. Уни global «TikTok/FB ишлайдиган dedup йўқ»га айлантирманг.
- `I-02/I-08`: duplicate Git tree entries — working tree/developer burden; physical Git pack bytes'ни айнан tree size'га тенглаштирманг.
- `O-06`: workflow command'da 50 тестдан 5 ном кўринмаслиги coverage gap; уларнинг барчаси ҳатман failure беришини ёки runtime coverage бутунлай йўқлигини исботламайди.
- `R-05`: BGM/SFX кўзга ташланадиган сифат муаммоси бўлиши мумкин, лекин 0.07 volume level'нинг ўзи failure'ни исботламайди.

**Иккинчи босқич якуни:** янги тасдиқланган `afinfo` cross-platform duration bug, TikTok crossing guard'нинг tautology'си ва STT retry escape билан 3 та аниқ техник нуқта кучайди. Аввалги бир нечта даъво пастроқ ишонч даражасига туширилди. **Тузатишлар ҳали production'га киритилмади.** Бу ҳисобот рефактор қилишдан олдинги далил реестри сифатида ишлатилиши керак.

---

# M. Учинчи босқич — V3: очиқ қолган масалаларни код, CI ва ҳақиқий WAV асосида ёпиш

> **Сана:** 2026-11-05, тахминан 20:08–20:30 CST. **Audit base:** `main@6b8e66e39e828166333a904113877426b91afae5`. Тасдиқланган OpenRouter A/B GitHub Action: [`41998283174`](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41998283174), artifact `13401038147`. **Иш режими:** read-only, маҳаллий WAV/ZIP таҳлили; production код, тасдиқлар ва нашрлар ўзгартирилмади.

## M.1. V3 доираси ва методология

- `main` commit SHA қайта текширилди; `mcp-server.mjs`, CLI оркестрацияси, voice generator, import, renderer, export validation, approval, Zernio эълон ва attribution йўллари бир-бири билан **қатор/шарт даражасида** таққосланди.
- `video-review.yml`нинг 2026-11-02 ва 2026-11-04 run'лари (`41389286263`, `41776134228`)да **синтетик MP4/test job success**, **реал narration→Remotion artifact job skipped** экани текширилди. Шунинг учун бу икки run'ни реал production қабул тести деб ҳисоблаш мумкин эмас.
- Real A/B архивининг барча 8 WAV файли ёзувлари `wave`/NumPy билан текширилди; 24 kHz, mono, PCM16 форматлари аниқланди. Илгариги RMS/clipping метрикаларидан ташқари, 30 ms RMS ойна, −37 dBFS чегара ва камида 160 ms узлуксиз паст энергияли сегмент мезони билан **танаффус давомийлиги** ҳисобланди. −33/−40/−45 dBFS чегара сезгирлиги ҳам синаб кўрилди. Бу нутқ сифатининг субъектив баҳоси эмас.
- Кейинги бандларда **CONFIRMED CODE** — аниқ коддаги шарт/йўл; **REPRODUCED DATA** — WAV/CI логидан ҳисобланган; **CONDITIONAL** — маълум шартда юзага келадиган муаммо, production occurrence исботланмаган; **DESIGN LIMIT** — хатодан кўра қоида/архитектура чеклови; **OPEN** — етарли далил йўқ.
- V2'даги 77 та топилма ва X-01…X-20 такрорланмасин: M бандлар фақат **янги** ёки сезиларли аниқлаштирилган хулосалардир. V3 умумий сонини «77+20+... тасдиқланган баг» деб талқин қилиш тақиқланади.

## M.2. Янги аниқланган код/қоида муаммолари — қисқа реестр

| ID | Устуворлик | Далил даражаси | Янги хулоса / кўлами |
|---|---|---|---|
| **Y-01** | **P0** | **CONFIRMED CODE** | MCP `prepareReviewForDate()` генерaциядан **олдин ўқилган `episode`** билан кейинги янги MP4/hash'ни verify қилади: биринчи тайёрлашда «partial» деб хато баҳолаш хавфи |
| **Y-02** | **P1** | **CONFIRMED CODE** | MCP `needsVoice` `voiceTextHash === narrationHash(episode)` шартини унутган; CLI'да бор |
| **Y-03** | **P1** | **CONFIRMED SCHEMA CONFLICT** | MCP `approve_video_package`: максимум **4** target, `approve-package.mjs`: максимум **2**; кейин статус `owner-approved`, иккинчи approval шу CLI'да блокланади |
| **Y-04** | **P1** | **CONDITIONAL CODE** | `content:make` `ready-for-review` ни талаб қилинган **барча** enabled platform'ларнинг борлигини қатъий санамасдан қайтаради; GitHub `packageReview()` бундан қатъийроқ |
| **Y-05** | **P0/P1** | **CONFIRMED CODE** | MCP `generate_voice` қайта чақирилса, мавжуд unapproved импорт аудиосини reuse қилмай TTS'ни яна бошлаши мумкин; `content:make` reuse қилади |
| **Y-06** | **P1** | **CONFIRMED CODE** | `render-episode.mjs`да SFX тайёрлаш **render `try/catch`дан олдин**: SFX fail → статус `rendering` бўлиб қолиши мумкин |
| **Y-07** | **P1** | **CONFIRMED SCHEMA GAP** | `content-attribution.mjs` фақат Instagram/YouTube publication mapping қабул қилади, `feedback-analyzer.mjs` эса 4 платформа metrics'ини қабул қилади; TikTok/Facebook attribution ёпилмаган |
| **Y-08** | **P1** | **CONDITIONAL TRUST GAP** | `import-voice` `SRT/VTT`ни матнга тўлиқ мослаб текширади, лекин **ҳақиқатан провайдердан олинган word timing** эканини мустақил signed provenance билан тасдиқламайди; қўлбола матн/тайминг ҳам ўтиши мумкин |
| **Y-09** | **P2** | **CONFIRMED CODE OMISSION** | `git-freshness.mjs` remote `main` ancestor'ни текширади, лекин `git status --porcelain` орқали dirty worktree'ни текширмайди; `sourceRevision` локал ўзгаришларни тавсифламаслиги мумкин |
| **Y-10** | **P2** | **CONDITIONAL RESIDUE** | `invalidateReviewArtifacts` root/YouTube `.render-work`ни тозалайди, **Facebook/TikTok** папкаларини йўқ; кейинги fail'да эски package файллари файл тизимида қолиши мумкин; status hash guard'лар бор |
| **Y-11** | **P2** | **CONFIRMED OPERATIONS** | `content:voice:gemini` npm alias номи Gemini Direct'ни англатса-да, у ҳам `generate-voice-gemini.mjs`га йўналади ва default provider `openrouter` бўлиб қолади |
| **Y-12** | **P1** | **CONFIRMED DOC/TOOL DRIFT** | MCP `generate_voice` description ва `nextAgentAction` Google'га юбориш/«both exports» деб нотўғри айтади: OpenRouter default, 4 target'ли тизимга мос эмас |
| **Y-13** | **P1** | **REPRODUCED DATA** | Тожикча scene-wise 36.04s ва continuous 27.72s фарқининг 6.03s қисми паст энергияли паузалар билан изоҳланади (72.5%); русчада бу тенденция **йўқ** |
| **Y-14** | **P1** | **CONFIRMED CI EVIDENCE** | Иккита охирги video-review run «success» бўлса ҳам реал paid voice/render job `skipped`, фақат синтетик тест бор |
| **Y-15** | **P2** | **DESIGN TRADEOFF** | `lessonSourceHash` ва `sourceHash` raw `JSON.stringify`га боғланган; семантик ўзгаришсиз JSON калит тартиби ўзгарса locale translation bound hash эскириб қолади |
| **Y-16** | **P1** | **CONDITIONAL COST** | Review voice flow'dа STT 3 та уриниш/бўлак + clips recovery + икки тил/TikTok; TTS call budget'ни «битта видеога 1–2 уриниш» деб эълон қилиш нотўғри |
| **Y-17** | **P1** | **CONFIRMED SOURCE POLICY** | Импортда `captionSource='gemini-word-timestamps'` номи барча транспортлар учун қолган; OpenRouter'га ўтиш семантик source provenance эмас, фақат лейбл |
| **Y-18** | **P2** | **CONFIRMED DEFENSIVE GUARD** | Protected TG approved audio runner'да йўқ бўлса intentionally stop; уни «тестни яшил қилиш» учун бекор қилиш мумкин эмас |

### Y-01 — P0: MCP янги аудио ва видеони эски episode билан текширади

**Далиллар:** [`mcp-server.mjs#L873-L978`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/mcp-server.mjs#L873-L978), [`platform-exports.mjs#L168-L208`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/platform-exports.mjs#L168-L208).

**Аниқ код занжири:** `currentEpisode(date)` натижасида `const {item,episode}` локал объект яратилади. Кейин `ensureRunCopy`, `runScript('generate-voice-gemini.mjs')`, `runScript('render-episode.mjs')` **алоҳида Node жараёнлари**да `review/.../episode.json`ни ўзгартиради. `const renderedStatus=await readStatus` янгиланган ҳолат; аммо `requirePlatformPackage(episode, renderedStatus, platform)` **эски `episode` объектини** олади. Validator `stored.baseContentHash === episodeContentHash(base)` ва platform metadata/subtitles'ни солиштиради. Биринчи марта нолдан овоз+видео яратилган сценарийда эски объектда `audioSrc/captions/durationFrames` йўқ — hash mismatch. MCP «partial» дейиши мумкин, ҳатто файллар тўғри чиққан бўлса ҳам.

**Ечим:** барча child subprocess'лардан сўнг **қайтадан** `getEpisode(id,{seed:false})` ёки ишчи `episode.json`ни ўқиш; айнан шу версиянинг `voiceTextHash`, `audioSrc`, `contentHash`, `sourceRevision` ва `platformPackages`ни тасдиқлаш. Битта `prepareAndValidateEpisode` хизматини CLI ва MCP учун умумийлаштириш. **Қабул тести:** нолдан RU/TG тайёрлашда MP4 воқеан бор + hash valid → MCP `ready-for-review`; synthetic stub subprocess test first-run/second-run фарқини аниқ кўрсатсин.

### Y-02 — P1: `needsVoice` stale fingerprint'ни кўрмайди

**Код:** [`mcp-server.mjs#L909-L923`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/mcp-server.mjs#L909-L923) ↔ [`make-episode.mjs#L55-L73`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/make-episode.mjs#L55-L73).

MCP `needsVoice` `!audioSrc || voiceProfileId !== ... || captionSource ... || !captions` билан чекланган, CLI `episode.voiceTextHash===narrationHash(episode)`ни қўшган. Эски narration fingerprint бўлса MCP қайта генерация қилмайди, renderer эса мустақил hash текширувида тўхтайди. **Тузатиш:** битта `isVoiceReusable()` guard; stale voice'ни эгаси тасдиқлаган бўлса қайта генерация қилмасдан block қилади, unapproved бўлса `resume/rebuild` ни аниқ таклиф этади. **Тест:** сценарий 1 ҳарф ўзгарган/ўзгармаган ҳолатда CLI/MCP айнан бир қарор берсин.

### Y-03 — P1: MCP 4 платформани қабул қилади, орқа CLI 2 тасини

**Код:** [`mcp-server.mjs#L259-L294`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/mcp-server.mjs#L259-L294) (`z.array(...).min(1).max(4)`); [`approve-package.mjs#L27-L37`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/approve-package.mjs#L27-L37) (`platforms.length > 2` → reject); `status.stage` биринчи approval'da owner-approved'га ўзгаради, кейинги оддий approval олдинги `rendered-pending-owner-approval` шартга тушмайди. **Ечим:** битта canonical schema (1–4), ҳар платформани алоҳида exact preview/hash билан version-locked ёзиш, partial approval ҳолати очиқ кўрсатилсин. Биринчи ва иккинчи owner approval бир-бирини overwrite қилмасин. **Тест:** 1,2,3,4 platform; ҳар платформа SHA/target, қайта чақириш идемпотентлиги.

**Чегара:** GitHub `zernio-approved-publish.yml` битта конкрет target'ни owner `workflow_dispatch` орқали тасдиқлаши мумкин. Шунинг учун мазкур чекловни **барча нашр усуллари бутунлай ишламайди** деб айтмаслик керак. Бу локал/MCP approval йўлидаги аниқ номувофиқлик.

### Y-04 — P1: CLI'да «тайёр» белгиси барча платформалар учун қатъий эмас

**Код:** [`make-episode.mjs#L72-L93`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/make-episode.mjs#L72-L93) `Object.entries(status.platformPackages??{})` бўйича **борларинигина** чоп этади ва `stage:'ready-for-review'` қайтаради. У `enabledVideoPlatforms(language)` билан кутилган тўпламни солиштирмайди. GitHub `packageReview` ҳар enabled destination учун `verifyReviewPackage` қилади. **Ечим:** умумий `assertCompletePlatformSet(language,status)` ва `required==actual`, ҳақиқий MP4/SRT/post hash текшируви. **Тест:** Facebook ёки TikTok intentionally absent → CLI partial/blocked, тўлиқ 4 та → ready.

### Y-05 — P0/P1: MCP `generate_voice` reuse check'сиз қайта TTS қилади

**Код:** [`mcp-server.mjs#L767-L792`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/mcp-server.mjs#L767-L792) тўғридан-тўғри `runScript('generate-voice-gemini.mjs')`; [`generate-voice-gemini.mjs#L928-L986`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L928-L986) owner-approved/published'ни блоклайди, **unapproved valid imported audioSrc**ни reuse деб танимайди, янги timestamp folder яратишга тайёрланади. Бошқа `content:make` йўлида `hasImportedVoice` бор. **Хавф:** бир хил матн учун ортиқча пулли TTS, илгари маъқул бўлган илк take'ни бефойда такрорлаш. **Ечим:** идемпотент `ensureVoice` public API; explicit `--force-new-take` ҳам owner қоидаси билан, default reuse. **Тест:** икки марта `generate_voice` чақириш → TTS paid call-count **1**, voice SHA бир хил; approved sample `force`сиз мутлақо ўзгармасин.

### Y-06 — P1: `rendering` статуси SFX fail'да осилиб қолиши мумкин

**Код:** [`render-episode.mjs#L99-L115`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-episode.mjs#L99-L115), `try/catch(render-failed)` [`#L122-L170`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/render-episode.mjs#L122-L170). Аввал status `rendering` ёзилади, кейин `generate-sfx.mjs` `spawnSync` орқали ишлайди. Бу қадам `try`дан олдин. Агар executable/error/nonzero exit бўлса, exception `render-failed` catch'га тушмайди. **Ечим:** SFX, render, encode, package, verify'ни битта `try/finally` lifecycle'га олиш; atomic status update; CLI чиқиш коди билан status ўзаро мос. **Тест:** fake SFX subprocess exit=1 → stage `render-failed`, error/provenance сақлансин, эски тасдиқланган MP4 ўзгармасин.

### Y-07 — P1: аналитика 4 платформа, attribution фақат 2 платформа

**Далил:** [`feedback-analyzer.mjs#L10-L42`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/feedback-analyzer.mjs#L10-L42) `'instagram','tiktok','youtube','facebook'`; [`content-attribution.mjs#L24-L40`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/content-attribution.mjs#L24-L40) `['instagram','youtube']`. Агар ҳақиқий TikTok/FB publication mapping келса, `validatePublicationMapping` рад этади; observations асл platform кўрсаткичларига source/video hash'ни улаш қийин. **Ечим:** 4 platform, provider provenance, exact native ID ва account mapping билан versioned migration; existing IG/YT archive untouched. **Тест:** RU/TG × 4 платформадан 8 mapping/analytics join; duplicate native post IDs reject; link attribution deterministic.

### Y-08 — P1: manual voice import'да provenance чеклови

**Далил:** [`import-voice.mjs#L123-L175`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L123-L175), [`#L250-L268`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L250-L268), [`#L370-L436`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L370-L436). Импортёр матнни (`normalize(captions.join('')) === sourceText`) ва cue durations'ни текширади — бу **ҳақиқий кучли safeguard**. Лекин manual import'да VTT producer identity/word recognition API source, audio fingerprint ва provider provenance'ни metadata'дан authentication қилиб ўқиш талаби йўқ; шунинг учун синтетик, лекин ёзма матнга мос SRT ҳам structure gate'дан ўтиши мумкин. Бу production'да қалбаки субтитр ишлатилганини исботламайди. **Ечим:** auto-generated'га strict `generatedAudioHash + transcriptionResponseHash + profileRevision + API transport + source` receipt; manual import алоҳида «owner-verified external audio» статуси билан тинглаб тасдиқлансин. **Тест:** сохта VTT ва тасдиқланмаган audio SHA → auto path reject; чин saved audio/cue → pass.

### Y-09 — P2: Git freshness тоза source tree'ни кафолатламайди

**Код:** [`git-freshness.mjs#L8-L42`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/git-freshness.mjs#L8-L42). `git fetch`, `merge-base --is-ancestor` remote main/branch ancestry'ни текширади; dirty `git status` ишлатилмайди. Агар ишчи код uncommitted бўлса, HEAD SHA «remote up-to-date» бўлиб чиқади, лекин render унинг локал ўзгаришлари билан амалга ошади. **Ечим:** CI production'да clean-tree strict mode; local owner-edit review'да dirty override фақат белгилаш/кузатиш билан; content fingerprints. **Тест:** modified uncommitted `EpisodeComposition.tsx` → production clean check fail, owner local preview explicitly marked dirty.

### Y-10 — P2: эски platform файлларининг қолиб кетиш эҳтимоли

**Код:** [`lib.mjs#L149-L177`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/lib.mjs#L149-L177). Root outputs ва `youtube` тозаланади, `facebook`/`tiktok` тозаланмайди. TikTok'нинг owner-approved sample ҳимояси борлиги учун ҳаммасини blanket `rm -rf` қилиш **нотўғри**. **Ечим:** status'да ҳар platform artifacts'ни versioned hash билан аниқ ажратиш; фақат unapproved stale ephemeral outputs'ни safe cleanup, archived approved previews untouched. **Тест:** old FB/TikTok file + new failed render → status `partial/blocked`, old package current сифатида чиқмасин.

### Y-11/Y-12 — P2/P1: CLI ва MCP текстлари OpenRouter'дан ортда қолган

**Код:** [`package.json#L21-L28`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/package.json#L21-L28)да `content:voice:gemini` OpenRouter default генераторини чақириши мумкин; [`mcp-server.mjs#L767-L798`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/mcp-server.mjs#L767-L798) description'да «sent to Google», «both platform exports» дейди. **Ечим:** `content:voice` default, `content:voice:gemini-direct` explicit safe wrapper / env, `content:voice:openrouter` explicit; tool description `transport resolved from config`, «required mapped platforms»; акс ҳолда Google ва OpenRouter billing ҳақида нотўғри тушунча пайдо бўлади. Тарихий npm alias'ни breaking changeсиз deprecated қилиш.

### Y-13 — P1: ҳақиқий A/B аудиодаги паузалар (тезлашиш сабабини аниқлаштириш)

**Архив:** [`41998283174`](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41998283174/artifacts/13401038147). 8 та native WAV файл форматлари: 24 000 Hz · mono · PCM16. Ўлчаш: 30 ms window RMS < −37 dBFS, contiguous ≥160 ms. Оралиқлар **past-energy**, ҳар бирини лингвистик «пауза» деб чиқиш учун phonetic тыңлаш талаб.

| Тил | Continuous total | Scene-wise total | Continuous паст энергия | Scene-wise паст энергия | Ажрим |
|---|---:|---:|---:|---:|---|
| RU | 27.28s | 28.72s | 7.41s | 6.54s | scene +1.44s, паст энергия **0.87s кам** |
| TG | 27.72s | 36.04s | 5.61s | 11.64s | scene +8.32s, паст энергия **+6.03s** (72.5% extra) |

**Сезгирлик тести:** −33, −37, −40, −45 dBFS thresholds'да тожикча scene-wise паст энергия advantage (6.09, 6.03, 6.03, 6.96s) бир хил йўналишда. Русчада continuous vs scene ўзгариши тескари. **Янги хулоса:** ўзгариш айниқса TG сегментларида; «ҳамма тилда continuous овоз яхшироқ» ҳали исботланмаган. `tg-scene-price.wav`да 0.93s, 1.08s атрофида узоқ паст энергия интерваллари; TG continuous'да энг узун 0.66s. Source words тўлиқ айтилгани ва Mandarin талаффузи тинглаш/мутахассис QA билан текширилмаган.

**Тузатиш/эксперимент:** биринчи TG учун 5 та blind, source-text-identical one-take ва scene-take pair; RU учун алоҳида ўлчов. Критерий: тўлиқ матн, Mandarin Hanzi/pinyin талаффузи тўғри, овоз бир хил, овоз табиий, студия master изчил; фақат duration қисқариши етмайди.

### Y-14 — P1: GitHub Actions success — реал ишга тушиш эмас

**Далил:** GitHub Actions [`41776134228`](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41776134228) ва [`41389286263`](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41389286263) `Test request guards and real synthetic MP4 packaging` job **success**, `Gemini narration -> Remotion -> verified private review artifact` job **skipped**. Янги `main` consistent бўлиши TTS+STT+real MP4 pipeline'нинг реал ишлашига тенг эмас. **Ечим:** job/status алоҳида label: `CI mock passed`, `real voice smoke passed`, `full video QA pending`, `owner approved`. **Тест:** workflow job result кўрсатилсин; `skipped`ни success marketing status деб талқин қилмасин.

### Y-15 — P2: source hash'нинг JSON тартибига сезгирлиги

**Код:** [`language-context.mjs#L53-L71`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/language-context.mjs#L53-L71), [`content-attribution.mjs#L5-L10`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/content-attribution.mjs#L5-L10). JSON key order ўзгарса `JSON.stringify` чиқиши ўзгаради, hash эскиради — бу консерватив safety fail, дастур хато ишлагани эмас. **Ечим:** ҳозир sourceHash'ни ўзгартириб барча TG binding/approved snapshot'ни бузмаслик; келажакда `sourceHashVersion:2` canonical stable JSON hash, old hashes compatibility. **Тест:** same semantic object key order differences → v2 stable, v1 сақланади.

### Y-16 — P1: TTS budget ва транскрипция арзонлаштириш имконияти

**Код:** [`generate-voice-gemini.mjs#L1050-L1070`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1050-L1070) standard scene chunks; [`#L1170-L1360`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-voice-gemini.mjs#L1170-L1360) STT three attempts per chunk plus clip recovery. `OpenRouter PCM` бир марта per chunk, лекин **барча видеода жами битта call** эмас. Устувор ечим — checkpoint/cache, `STT retry only` ва continuous mode'ни QA'дан сўнг танлаш; бир вақтнинг ўзида моделларни тасодифий алмаштирмаслик. **Тест:** API cost ledger `(episode,language,variant,model,transport,requestType,attempt,cacheHit)`; 1 сценарий 2 марта чақирилганда TTS call'лар сони кўпаймасин.

### Y-17/Y-18 — source provenance / approved sample safeguards

`import-voice` `captionSource='gemini-word-timestamps'` лейблини OpenRouter учун ҳам қўяди. Бу parser compatibility учун ҳозирча зарур, **ҳақиқий provenance** эса янги metadata'да `apiTransport` орқали сақланиши керак. Алоҳида аудио sample `review/`да Git'да мавжуд эмаслиги ва `github-video-pipeline`даги stop guard — хатолик эмас, **approved audio'ни тасодифан алмаштиришдан ҳимоя**. Қатъий hash билан private restore яратилмагунча guard'ни ўчирмаслик керак.

## M.3. Илгариги «номаълум» бандларнинг V3 якуний таснифи

| Аввал очиқ савол | V3 қарор | Далил чегараси |
|---|---|---|
| Биринчи тайёрлашда MCP ва CLI бир хил натижа берадими? | **Йўқ — код шартлари зид** (Y-01/Y-02/Y-04) | Реал paid full E2E job ҳали йўқ |
| Бир хил овозни кўп чақириш хавфи ҳамма entrypoint'да борми? | **MCP direct generate_voice'да бор** (Y-05); `content:make` imported reuse қилади | Owner-approved audio protected |
| Барча 4 платформани маҳаллий MCP approval қабул қиладими? | **Йўқ — max(4) schema, max(2) CLI** (Y-03) | GitHub publish'нинг алоҳида route'i ишлайди |
| Видео SFX fail status'и аниқ бўладими? | **Йўқ — pre-try exception `rendering` қолдириши мумкин** (Y-06) | Failure injection тест қолган |
| TikTok/Facebook feedback attribution тегишлими? | **Observations 4 platform, mappings 2** (Y-07) | Real 4-platform post join test қолган |
| Тожикча scene audio узунлигидаги фарқ асосан танаффусми? | **Шу A/Bда: ҳа, ~72.5% қўшимча паст энергия** | Linguistic speaking-quality judgment қолган |
| Русчада ҳам continuous камроқ танаффус берадими? | **Йўқ — ушбу A/Bда scene-wise паст энергия камроқ** | Бир take статистик аҳамият бермайди |
| GitHub video-review success реал TTSдан ўтганми? | **Йўқ, 2 run'да paid job skipped** (Y-14) | Реал OpenRouter smoke алоҳида run'да бор |
| Импортёр ҳар қандай сохта caption'ни тутадими? | **Exact text gate бор, signed provider provenance йўқ** (Y-08) | Тўлиқ public exploit кўрсатилмаган |
| Барча манбалар clean Git checkout'данми? | **Git SHA fresh, dirty workspace назорати йўқ** (Y-09) | Local production failure исботланмаган |
| Approved audio GitHub'да йўқлиги багми? | **Йўқ, ҳимояланган deliberate stop** (Y-18) | Restore infra ҳали йўқ |
| One-take автоматик яхши бўладими? | **Ҳали исботланмаган**; нутқ ва Mandarin QA қолган | WAV энергия метрикалари ягона сифат индикатори эмас |

## M.4. Қолган ҳақиқий номаълумлар: нимани синамасдан «ҳал бўлди» дейиш мумкин эмас

1. **Actual voice intelligibility** — ўқитувчи/она тили ва Mandarin талаффузи билан source script'ни эшитиб текшириш; 8 WAV TTS signal метрикаси ўқув сўзлари тўлиқ айтилганини исботламайди.
2. **Full-length RU+TG OpenRouter E2E** — actual scenario → full WAV → word timestamps → approved CTA → real MP4 → SRT + native phone audio QA; ҳозирги main'да paid full-job success мавжудлиги тасдиқланмаган.
3. **First-run MCP stale state failure injection** — external paid API'сиз mock child actions ва valid media sidecars билан Y-01'ни end-to-end репродукция қилиш.
4. **Real SFX failing exit** — forced `generate-sfx.mjs` error'да status terminal бўлишини ва аввалги video сақланишини текшириш.
5. **OpenRouter retries when provider 200 returns zero word timestamps** — before adapter throw vs after bounded STT retry, saved WAV hash unchanged.
6. **Final MP4 decoded audio vs raw WAV** — source, imported MP3, Remotion AAC ва TikTok composed MP3'ни A/B битрейт, true-peak, spectral artifact, loudness ва субъектив тинглаш билан солиштириш; file'лардаги WAV билан якуний MP4 ҳақиқатда бир хил script эканини текшириш.
7. **Publication cross-host idempotency** — GitHub owner-publish, локал Codex handoff, MCP manual receipts ва analytics `content/feedback/publications.json` бир post ID/hash учун бир-бирига зид ҳолат ёзмаслигини текшириш.
8. **Assets/privacy audit** — `videos/`даги ҳақиқий app captures ва third-party `.agents` skills инсонга тегишли маълумот, secret ёки лицензия хавфи бор-йўқлигини алоҳида текшириш; regex scan етарли эмас.
9. **Current Zernio live connection/permissions** — config ownerAuthorized ва zernioPublishingAuthorized алоҳида: RU Facebook manual-only; ҳар account'нинг live reachability ва credentials'ни connector readback билан текшириш керак; конфигурацияни live permission деб қабул қилмаслик.
10. **Calendar reserve repair** — 2026-11-05 CI'да 1/4 future source ready; кейинги агент commit бўлган-бўлмагани фақат янги `main` ва calendar source'ни қайта текшириб белгиланади. Бу audit baseline'дан ташқари келажакдаги ўзгаришларни тахмин қилманг.
11. **Code modularization breakage risk** — `mcp-server`, `generate-voice-gemini`, `EpisodeComposition`ни қисмларга ажратиш фақат integration test ва approved/published hash immutability билан; модуль сонини шунчаки кўпайтириш мақсад эмас.
12. **Difficult STT mixed-script comparison** — Tajik Cyrillic, Mandarin Hanzi, Russian, HSK acronym ва transliteration алиаслари учун real word-level timestamps; `hint=tg` ва `hint=zh` автоматик тўғри ечим экани аввалги реал тестларда рад этилган.

## M.5. Янгиланган тузатиш навбати ва dependency map

| Тартиб | Нима қилинади | Нимага аввал | Мажбурий қабул шарти |
|---|---|---|---|
| **0. Baseline** | main SHA, approved sample hashes, exact current target map, fake+real call counter, GitHub CI job status archive | Regression'ни ажратиш | Audit baseline ўзгармаган |
| **1. Cross-entrypoint correctness** | `prepareAndValidateEpisode` умумийлаштириш (Y-01/Y-02/Y-04); separate workflow status; fix X-01 Linux `ffprobe` | Ҳозир «готов» натижаси нотўғри бўлиши мумкин | CLI/MCP/GitHub same ready/blocked, 4 outputs |
| **2. Preserve first good take** | MCP `generate_voice` reuse (Y-05) + STT-only resume/checkpoint (V-06/07/08) | Регенерация харажати/йўқотиш | Duplicate call → no paid TTS and same WAV SHA |
| **3. Reliable render lifecycle** | SFX pre-try fix (Y-06), terminal status, safe per-platform cleanup (Y-10) | Осилиб қолган статус ва stale export | Failed SFX → render-failed; approved history untouched |
| **4. Subtitle quality** | STT retry classification, source-proof, verified Mandarin gap recovery, proper sourceAudioDuration | Реал TTS яхши бўлса ҳам reject бўлмасин | Exact 100% word match + real timestamps, no invented cues |
| **5. TTS quality** | TG first, RU separately, continuous A/B with readback; WAV→MP3→AAC QA | Далилсиз модел/voice ўзгартирмаслик | E2E listening+pronunciation+delivery pass |
| **6. Approval + attribution** | Max 4 preview approval (Y-03), 4-platform mappings (Y-07), cross-route receipts | Бутун publish cycle жадвалга мос | Exact SHA/account/time per target, no duplicates |
| **7. Cleanup/docs** | `AI_RULES`, `WORKFLOW`, `PROJECT_MEMORY`, `GITHUB_VIDEO_REVIEW`, `SKILLS`, `mcp-server` descriptions, deprecated aliases | Фақат code fixed'дан кейин rules reconcile | `check:consistency` + semantic docs assertion + CI |

## M.6. Тестлар рўйхати (V3 қўшимчаси)

```text
V3-01  First-ever MCP prepare with seeded source but no review copy; after mock voice/render => ready.
V3-02  CLI and MCP stale narrationHash => identical refusal/reuse path.
V3-03  MCP generate_voice invoked twice with identical unapproved source => paid TTS calls stay constant.
V3-04  Approval 1/2/3/4 platforms; exact hash/account/time; partial approval cannot erase earlier approval.
V3-05  Missing one required platform => neither CLI nor MCP labels full result ready.
V3-06  Forced generate-sfx error => terminal render-failed, no stale rendering state.
V3-07  Four-platform analytics + exact Zernio mapping => RU/TG join; invalid duplicate ID rejected.
V3-08  Manual fake exact-text VTT but missing provider receipt => automated path refuses.
V3-09  Dirty worktree => CI production refuses; approved local explicit preview allowed only as dirty.
V3-10  Failed new Facebook render => cannot reuse old Facebook export as current.
V3-11  Real RU/TG mixed-Chinese sample one-take vs scenes; naturalness + pronunciation reviewed separately.
V3-12  Original WAV, imported MP3, final MP4 AAC, TikTok MP3 joined; audio signal and speech compare.
V3-13  CI run with only synthetic job passes => status must NOT imply paid production success.
V3-14  Provider request metadata: OpenRouter default, Google direct explicit; no secret in diagnostic files.
V3-15  Real provider 200 + words=[] => bounded STT retry/diagnostic, same audio hash.
```

## M.7. V3 якуний қарор ва аниқ чеклов

**Энг муҳим янги хулоса:** TTS ва STTдан ташқари, **контент тайёрлашни бошқарадиган MCP entrypoint'нинг ўзи** янги файлларини текширишда stale object ишлатиши мумкин. Бир хил лойиҳага иккита entrypoint (`content:make` ва `prepare_today_video`) ёзилган, лекин муҳим fingerprint, reuse ва platform completeness шартлари бир хил эмас. Шунинг учун аввал **корректлик + идемпотентлик**, кейин **овоз сифати** ва **кодни қисқартириш** иши мантиқан тўғри тартиб. Кодни радикал қайта ёзиш талаб этилмайди: умумий қоидаларни битта module'га олиш, existing Remotion, owner-approved Kore ва Zernio preview gate'ни сақлаш етарли.

**Нима қилинмади:** production код тузатилмади; `main`га commit/PR/merge йўқ; scheduled jobs ўчирилмади; approved sample, video, social post ва calendar ўзгармади. A/B WAV сигнали таҳлил қилинди, аммо субъектив тинглаш ёки жорий production end-to-end QA ўрнини босмайди. «100% хато йўқ» даъвоси қилинмайди. Кейинги амалий иш учун бу ҳужжат **талаб ва регрессия реестри** сифатида ишлатилади.
---

# N. V4 — СЦЕНАРИЙ → МАЪНОЛИ КАДР → ВИЗУАЛ ГЕНЕРАЦИЯ → СИНХРОНЛАШ: ЧУҚУР АУДИТ

**Сана:** 2026-11-05; **source:** GitHub `akbarholturaev11-lang/Kantent`, `main` commit `6b8e66e39e828166333a904113877426b91afae5`.  
**Мақсад:** сценарийлар қандай ва ким томонидан ёзилиши, кадрларга қандай айлантирилиши, кадрлар воқеанинг мазмунига мослигини қайси код текшириши, нимани соддалаштириш ва қайси ноаниқликларни эксперимент билан ёпиш мумкинлигини ажратиш.  
**Тадқиқот доираси:** 7 та датали дарс × 2 тил = **14 та сценарий**; уларнинг **66 та дарс саҳнаси**, **199 та motionBeat**; 3 та реклама × 2 тил = **6 та promo сценарий**, жами **36 promo beat**; реал `Remotion` JSX, JSON контент, validator, workflow ва тестлар. Бу бутун репозиторийдаги барча тарихий роликларни кўриб чиқиш дегани эмас.  
**Статуслар:** **CODE** — коднинг муайян хулқи тўғридан-тўғри тасдиқланган; **DATA** — GitHub'даги ҳақиқий сценарийлардан ўлчанган; **GAP** — ҳозирги validator/code муайян сифат хусусиятини исботлай олмайди; **CONDITIONAL** — муайян input/вақтда багга айланади, production'да нечта марта бўлгани маълум эмас; **INTENTIONAL** — режалаштирилган дизайн чеклови, уни bug деб ҳисобламаслик керак; **OPEN** — ҳақиқий rendered кадрлар ёки тинглашсиз ҳал бўлмайди. Яшил CI фақат ўз coverage чегарасида ишонч беради.

## N.1. Реал иш жараёни — қаерда автоматик, қаерда агент ёзади?

| Қадам | Реал owner / код | Амалда нима бўлади | Мазмунни ким тасдиқлайди? |
|---|---|---|---|
| 1. Мавзу ва календарь | `content/calendar.json`, `content/WORKFLOW.md` | Ҳар кунги Calendar Reserve агенти келажакдаги дарс/реклама/серия сценарийсини RU/TJ ёзади. CLI `generate-draft.mjs` эса **матнни ўзи ёзмайди**; мавжуд режани ишчи папкага олади | Агент + мустақил манба текшируви; овозга рухсат эмас |
| 2. Мақсад ва storyline | `creative-formats.json#storytellingPolicy`, `storytelling-plan.mjs` | `direct/single-rehook/layered`, ҳаётий муаммо, first payoff, rehook, манбага боғланган хитойча мисоллар | Код фақат структурани текширади; дарс мазмунини эмас |
| 3. Саҳна ва кадр нияти | `episode.scenes[].motionBeats[]` | Агент `cueText`, `explains`, `visual`, `graphic.nodes/tracks` билан **ҳақиқий SVG геометрия** ёзади | `action-design-plan` ва `graphic-scene` техник валидаторлари |
| 4. Автоматик формат | `auto-storyboard.mjs` | Катта format/setting/character/mood metadata танлайди. Янги `explain-actions-v1` дарсда бу storyboard визуалини Remotion кўрсатмайди | Менюда белгиланган формат ва ҳақиқатан кўринадиган renderer фарқли бўлиши мумкин |
| 5. TTS | `generate-voice-gemini.mjs`, `openrouter-voice.mjs` | Тасдиқланган ўқув матнидан WAV/MP3; default OpenRouter, Gemini Direct қўлда захира | Овоз сифатига алоҳида audition керак |
| 6. STT/import | `import-voice.mjs`, `motion-design-plan.mjs` | Аниқ сўз вақт белгиси, воқеадаги cue учун timeline, ҳар саҳна чегараси | Код cue'ни аниқлайди, аммо расм таълим маъносини исботламайди |
| 7. Реал кадр/видео | `EpisodeComposition.tsx`, `NarratedActionScene.tsx`, `GraphicScene.tsx`, `PromoScene.tsx` | JSON геометрияни SVG қилиб, Remotion'да 1080×1920, 30 FPS MP4 га айлантиради. **Янги дарсда алоҳида prompt→photo генератори йўқ** | Сифатли кадр учун ҳақиқий still/contact-sheet/MP4 кўриш шарт |
| 8. Платформалар | `render-platform-videos.mjs`, `render-tiktok-review.mjs` | Умумий дарс бир марта; Instagram/YouTube/Facebook охири ўзгариши мумкин. TikTok CTA учун бошқа овоз | Platform-specific preview ва owner approval |

**Муҳим:** `getBeats()`нинг эски headline/card fallback'и сақлангани янги дарслар ўз-ўзидан таълимга мос кадр олади дегани эмас. Янги action style `motionBeats` талаб қилади, асосий JSX эса `motionDesign` тармоғини биринчи қўяди. Автоматик «сценарийни тушуниб раcм генерация қилиш» хизмати йўқ; ҳозирги усул — **агент тайёрлайдиган declarative vector art + deterministic renderer**. Бу жуда аниқ бошқарув беради, аммо агентнинг визуал танловлари учун мустақил QA шарт.

**Код манбалари:**
- [scripts/generate-draft.mjs#1-29](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-draft.mjs#L1-L29) · [scripts/lib.mjs#213-251](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/lib.mjs#L213-L251) · [scripts/auto-storyboard.mjs#68-144](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/auto-storyboard.mjs#L68-L144)
- [scripts/action-design-plan.mjs#7-90](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L7-L90) · [scripts/graphic-scene.mjs#1-103](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-scene.mjs#L1-L103) · [src/EpisodeComposition.tsx#1168-1242](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/EpisodeComposition.tsx#L1168-L1242)
- [src/NarratedActionScene.tsx#74-103](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/NarratedActionScene.tsx#L74-L103) · [src/GraphicScene.tsx#9-24](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/GraphicScene.tsx#L9-L24)

## N.2. Код асосида ўлчанган контент сифати кўрсаткичлари

**Маълу­мотлар тўплами:**
- `hui-vs-neng-pool-20261028`
- `youdianr-vs-yidianr-price-20261030`
- `zhuozi-you-book-20261031`
- `known-book-zai-20261101`
- `haishi-vs-huozhe-tea-20261102`
- `bi-comparison-height-20261104`
- `ji-vs-duoshao-books-price-20261106`

Ҳар бири `content/episodes/` ва `content/locales/tg/episodes/`даги аниқ variant билан жуфтланган.

| Ўлчов | GitHub source'дан натижа | Талқин |
|---|---:|---|
| Сценарий | 14 (7 RU + 7 TG) | Датали янги дарслар намунаси, тарихий барча файллар эмас |
| Дарс саҳналари | 66 | CTA бу ҳисобга кирмайди |
| `motionBeats` | 199 | **199/199 `kind:graphic`**; quantity/choice/phrase renderer модели бу 14 намунада ишлатилмаган |
| Уч ҳаракатли саҳналар | 65/66 | Бир хил 3-event қолип устун; ҳар мавзуда учта зарурлигини исботламайди |
| Структураси `A→B→A` бўлган саҳналар | 8/66 | `zhuozi` structure, `known-book` location/recall, `haishi` choice ва уларнинг RU/TG жуфтлари; бу баъзан мақсадли қайтариш, баъзан бир хил кадр эффект |
| Бир дарсда 15 ёки 16 график beat учун реал асосий график композициялар | Айрим ҳолларда 3–6 та | Кўп график ҳолат қайта ишлатиляпти; нотўғриликни эмас, визуал хилма-хиллик хавфини кўрсатади |
| Асосий RU серияда storytelling | 7/7 `direct` | `single-rehook`/`layered` автоматик ҳеч қаерда танланмаган; булар керак дегани эмас, лекин editorial танлов нима учун доим `direct` экани кузатилиши мумкин |
| Саҳна `cueText`'и икки марта literal учрайдиган motion beat | 8 та | Улардан **7 тасида `cueOccurrence` йўқ**, биттасида бор. Ҳақиқий STT токенлари ҳам икки марта мос келса, кечки render хатоси чиқиши мумкин |
| `cueText` literal case-мос келмаган beat | 1 та | `бассейн закрыт` vs `Бассейн закрыт` — **ҳақиқий bug эмас**: runtime normalizer case'ни бирхил қилади |
| Promo | 6 сценарий = 36 promo beat | Ҳар уч реклама RU/TG; воқеа, product-demo ва resolution бор |
| Promo product capture | 6 сценарийда бир хил асл файл ишлатилади | `public/promo-captures/ai-voice-original.png` мавжуд. Аммо ҳар бир crop ҳақиқатан микрофон ёки пандани тўлиқ кўрсатиши автоматик ўлчанмаган |

**Метод:** репозиторийдаги ўша JSON'лар ўқилиб санaldi; graph fingerprint ҳисобида `node.id` ва `track.nodeId` декоратив ID сифатида ҳисобланмади. `A→B→A` — биринчи ва учинчи SVG геометрияси/ҳаракат тавсифи бир хил; бу автоматика график тўғри ёки нотўғри эканини ҳал қилмайди.

## N.3. ЯНГИ АНИҚ ТОПИЛМАЛАР РЕЕСТРИ (S-01 … S-35)

### Сценарий ёзиш, storyline ва рамка

**S-01 · P1 · GAP — агент ёзган `explains` мазмуни текширилмайди.** `validateActionVisual()` фақат `explains?.trim()` борлигини кўради. Масалан, `ji-vs-duoshao-books-price-20261106` RU/TG `price` ва `contrast` саҳналарида ҳам «аввал китобларни кўрсатиш» мазмунидаги бир хил изоҳ қолган. Ёзувчи агент `price` жойида нарх миқдорини тушунтирмасдан китоб кўринишини такрорлаши мумкин. **Тузатиш:** `beat.semanticIntent={subject,relationship,before,after,learningClaimId}` contract ва мустақил editorial/vision QA; script→visual evidence receipt. **Тест:** `price` воқеада нарх объект/белгиси кўринмаса `needs-visual-review`; фақат изоҳни ўзгартириш ўтказмасин. Далил: [scripts/action-design-plan.mjs#7-15](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L7-L15) · [реал `ji` сценарийи](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/episodes/ji-vs-duoshao-books-price-20261106.json).

**S-02 · P1 · DATA — 65/66 саҳнада 3 та graphic beat қолипи.** `storytellingPolicy` ҳар сюжетга мос танлашни талаб қилади, аммо асосий намуналар 3 та бир хил визуал event'ни такрорлайди. Бу 3 eventнинг ўзи bug эмас. **Тузатиш:** `sourceFact → required visible transition count`га қараб 2/3/4+ beat; «учта»ни сохта тўлдиришни тақиқлаш. **Тест:** 1-idea саҳна 2 аниқ meaningful state, 3-idea саҳна 3+ ҳақиқий effect билан ўтади; rigid 3 талаб бўлмайди. Далил: [content/creative-formats.json#1-45](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/creative-formats.json#L1-L45) · [scripts/action-design-plan.mjs#64-93](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L64-L93).

**S-03 · P2 · DATA — кўрилган 7 та RU дарсда `direct` 7/7.** Бу мумкин қадар тўғри editorial танлов, лекин `single-rehook` ва `layered` фақат schema имконияти бўлиб қолган. **Тузатиш:** `storytelling.selectionReason`ни 2-3 конкрет альтернатив storyboard билан reviewer солиштирсин; буни мажбурий «кўпроқ рехук» сиёсатига айлантирмаслик. **Тест:** оддий тарбияловчи мисолда `direct` ҳимоя қилинган, ҳақиқий иккинчи мустақил савол бор сценарийда `single-rehook` асосланган. Далил: [scripts/storytelling-plan.mjs#94-159](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/storytelling-plan.mjs#L94-L159).

**S-04 · P1 · CONDITIONAL — `storytelling-generator` матнни алмаштириб, visual/motion plan'ни қайта текширмайди.** У `narrationEdits`ни ёзади, `visualBeats` ва duration'ни ўзгартирмасликни талаб қилади; **`motionBeats` ҳам re-author қилинмайди**. Янги матнда эски exact cue қолмаса render кейин ўчади; қолса ҳам кадрнинг маьноси ўзгарган бўлиши мумкин. **Тузатиш:** `narrationChanged` бўлганда `motionBeats` учун explicit invalidation/review state; old vs new semantic intents diff. **Тест:** narrration edit semantic subject ўзгарса `visual-review-required`, илгариги beat'ни жим қабул қилмасин. Далил: [scripts/storytelling-generator.mjs#96-137](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/storytelling-generator.mjs#L96-L137).

**S-05 · P1 · GAP — `learningFactSources` синтактик текширилади, семантик source verification автоматик эмас.** URL, checkedAt, supports борлиги грамматик мисолнинг тўғрилигига далил эмас. **Тузатиш:** ҳар Chinese claim'га fact ID ва реал reference excerpt/URL, prevoice editorial signoff. **Тест:** `他比我高`, `今天比昨天冷`нинг Hanzi/pinyin/meaning ичида маъно ва контекст инсон/манба билан тасдиқлансин. Далил: [scripts/self-improvement-check.mjs#90-129](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/self-improvement-check.mjs#L90-L129).

**S-06 · P2 · GAP — broad `creativeFormatId` танланиши ва real `explain-actions-v1` визуали фарқ қилади.** `auto-storyboard` selected format ва storyboard metadata тайёрлайди, аммо `EpisodeComposition`да янги `motionDesign` саҳнаси биринчи тармоққа киради; storyboard ва semantic кадрлари ишлатилмайди. **Тузатиш:** `editorialFormatId` ва `actualRendererMode`ни ажратиш, аналитикага фақат кўрилган форматни ёзиш; active visual renderer'га таъсир қилмайдиган metadata'ни арзонлаштириш. **Тест:** 7 та real action episode рендерида `data-action-id` орқали real mode manifest, analytic metadata билан бир хил. Далил: [scripts/auto-storyboard.mjs#91-130](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/auto-storyboard.mjs#L91-L130) · [src/EpisodeComposition.tsx#1180-1250](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/EpisodeComposition.tsx#L1180-L1250).

### Маъноли расм/кадр генерацияси

**S-07 · P0/P1 · GAP — SVG геометрияси тўғрилиги «расм мақсадга мос» дегани эмас.** `graphic-scene.mjs` nodes/tracks, colors, keyframes, visibility'ни чегаралайди. `action-design-plan.mjs` эса 2+ геометрия fingerprint талаб қилади. `price` саҳнасида конкрет нарх визуали, `weather` саҳнасида температура контрасти, `book` саҳнасида китоб ҳақиқатан шаклдан билинадими — бунинг ҳеч бири machine proof эмас. **Тузатиш:** ҳар beat учун `expectedVisibleFacts`, 270×480 кадрни review қилиш; агротавсиф (object semantics)дан босқичма-босқич type registry. **Тест:** визуал предмет алмашса, path/anim valid бўлса ҳам human-vision gate STOP. Далил: [scripts/graphic-scene.mjs#16-103](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-scene.mjs#L16-L103) · [scripts/action-design-plan.mjs#64-93](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L64-L93).

**S-08 · P1 · DATA — кўрилган 14 та lesson'нинг 199/199 event'и declarative `graphic`.** Reusable `quantity`, `choice`, `comparison`, `phrase` model'лари бор, лекин sample'да деярли барча тасвир SVG paths билан қўлда чизилган. **Тузатиш:** содда миқдор ва икки ҳолатли таққослаш учун existing typed component'ларни афзал қилиш; фақат ҳақиқий объект/ҳолат талаб қилганда custom graphic. **Тест:** `几本书` 3 та китобни кўрсатса, `count:3,object:"book"`; `多少` учун ихтиёрий ҳақиқий нарх сумма тўқимасдан савол белгиси/нарх белгисини кўрсатиш. **Эслатма:** minimal SVG ҳар доим ёмон эмас. Далил: [scripts/action-design-plan.mjs#4-60](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L4-L60) · [src/NarratedActionScene.tsx#14-81](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/NarratedActionScene.tsx#L14-L81).

**S-09 · P1 · DATA — айрим сериялар бир хил 3–6 графикка қайта-қайта таянади.** `haishi`да 15 beat учун 3 та, `zhuozi`да 12 beat учун 3 та, `ji`да 15 beat учун 6 та асосий график ҳолат. **Тузатиш:** жиҳатни эмас, ўқитилаётган ўзгаришни алмаштириш: savol→choice answer, price→неча пул, possession→жойлашув. **Тест:** `A→B→A` фақат deliberate recall контекстида; random visual toggle «тушунтириш» ҳисобланмайди. Далил: real episode JSON'лар ва [scripts/action-design-plan.mjs#64-94](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L64-L94).

**S-10 · P1 · DATA — A→B→A 8 та саҳнада.** `known-book` location/recall, `haishi` choice, `zhuozi` structure — ҳамма жойда битта визуални аввал/охири қайта бериш мумкин. **Тузатиш:** `visualTransitionPurpose=introduce|contrast|recall|correct` белгиси; оддий қайтариш recall деб ёлғон асосланмасин. **Тест:** last beat реплика/ўқув натижасини мустаҳкамлаши кўрсатилади. Далил: шу сценариилар ва [scripts/graphic-scene.mjs#121-135](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-scene.mjs#L121-L135).

**S-11 · P1 · INTENTIONAL / UX GAP — `visual.title`, `hanzi`, `pinyin`, `meaning` validator metadata, лекин график renderer уларни алоҳида намойиш қилмайди.** `NarratedActionScene` фақат `GraphicScene` чизади; subtitle ягона матн қатлами бўлиб қолади. Бу `EDITING_SPEC`даги «бир кадр, бир субтитр» қоидасига тўғри. **Хавф:** расмни тушуниш учун субтитрга ортиқча боғланиш. **Тузатиш:** дубль headline қўшмасдан, графикнинг ўзида маънони кўрсатиш; ҳақиқий Hanzi/pinyin subtitle билан мос бўлсин. **Тест:** субтитрни беркитганда ҳам инсон реал предмет/ҳаракатни аниқлай олиши. Далил: [src/NarratedActionScene.tsx#74-103](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/NarratedActionScene.tsx#L74-L103) · [content/EDITING_SPEC.md#15-24](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EDITING_SPEC.md#L15-L24).

**S-12 · P1 · CONDITIONAL — «иккита graph fingerprint бошқача» мазмуннинг ўзгарганини кафолатламайди.** Fingerprint SVG attrs/координата/track'ни ҳисоблайди. Битта объектнинг фақат `y` анимациясини ўзгартириш янги frame state деб ўтиши мумкин, ҳатто дарс маъноси ўзгармаса. **Тузатиш:** meaningful `before/after` визуал фактларини алоҳида текшириш, `cosmeticMotionOnly` ҳимояси. **Тест:** бир хил китобни 10 px силжитиш икки мустақил тушунчани ўргатди деб қабул қилинмасин. Далил: [scripts/graphic-scene.mjs#121-135](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-scene.mjs#L121-L135) · [scripts/action-design-plan.mjs#80-90](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L80-L90).

**S-13 · P2 · INTENTIONAL — «кадр генерация қилиш» ҳозир prompt→AI photo эмас.** Янги дарсларда authorized AI image generator йўқ; vector nodes/треклар агент ёзади. **Тузатиш:** default declarative SVG сақлансин (Hanzi/чизма аниқлиги учун), истисно ҳолатлардагина owner-authorized asset generation/import. Янги service'ни мажбуран жорий қилмаслик. **Тест:** visual-source manifest'da `source:authored-vector|verified-capture|approved-image` бўлсин; AI image ҳеч қачон хитойча иероглиф, панда logo ёки реал UI'ни ўзидан тўқиб бермасин. Далил: [scripts/graphic-scene.mjs#1-31](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-scene.mjs#L1-L31) · [content/GRAPHIC_SCENES.md#7-17](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/GRAPHIC_SCENES.md#L7-L17).

**S-14 · P2 · CONDITIONAL — `GraphicScene` render вақтида ҳар бир кадрда `validateGraphicScene(plan)` чақириши мумкин.** Remotion ҳар кадрда React функцияни қайта бажарса, бир хил SVG 30 FPS рендерда қайта текширилади. Ҳозирча benchmarking йўқ. **Тузатиш:** қатъий JSON validator'ни pre-render contract'да сақлаб, renderer'da cached/memoized validated plan; no silent fallback. **Тест:** 1080×1920 × 30fps 30с real review, frame rendering speed before/after ва hash/pixel parity. Далил: [src/GraphicScene.tsx#9-24](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/GraphicScene.tsx#L9-L24).

**S-15 · P1 · CONDITIONAL — график анимацияси сўнгги keyframe'га етмасдан кейинги beat бошланиши мумкин.** `graphic-scene.mjs` track keyframe'ни 0–10 секунд оралиғида қабул қилади; аммо `NarratedActionScene`да кейинги speech beat келганда олдингиси алмашади. Трекининг охирги keyframe вақти кейинги beat бошланиши билан тўқнашса, чизиш якунланмайди. **Тузатиш:** real `resolvedBeats` ўрнатилгандан кейин `track.lastAtMs <= nextCueStart-currentCueStart-safeBuffer` (ёки conscious overlap) gate. **Тест:** 2.8с анимация 1.5сдан кейинги cue билан кесилса block/replan. Далил: [scripts/graphic-scene.mjs#65-87](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-scene.mjs#L65-L87) · [src/NarratedActionScene.tsx#81-100](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/NarratedActionScene.tsx#L81-L100).

### Cue ва кадр-овоз синхронизацияси

**S-16 · P0/P1 · DATA + CONDITIONAL — 8 ambiguous cue, 7 та occurrence'сиз.** RU/TG `youdianr` reaction `有点儿`, RU `haishi` options `或者`, RU/TG contrast `还是`, RU/TG `known-book` recall `那本书在桌子上` ва бошқалар literal narration'да бир неча марта келади. `validateActionLesson` cue борлигини фақат текширади; `resolveMotionBeats` **actual STT word match** кўп бўлса `cueOccurrence`сиз throw қилади — яъни овоз пулли тайёрлангандан кейингина. **Тузатиш:** author-time normalized cue token occurrence count + explicit chosen anchor mandatory, файл сақланишидан олдин `prevoice:cues` CLI. **Тест:** икки марта айтилган `还是` ва `cueOccurrence`сиз beat source readiness'дан ўтмасин; битта айтилса уриниш талаб қилинмасин. Далил: [scripts/action-design-plan.mjs#64-82](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L64-L82) · [scripts/motion-design-plan.mjs#25-54](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/motion-design-plan.mjs#L25-L54).

**S-17 · P1 · VERIFIED NON-BUG — `бассейн закрыт` / `Бассейн закрыт` literal фарқи.** Битта график cue script'да case'дан фарқ қилса ҳам, runtime `normalize()` ҳаммасини lowercase қилади. Буни “битта нотўғри cue” деб нотўғри ҳисоблаш мумкин эмас. **Тест:** prevoice validator ҳам худди runtime'нинг битта normalizer'идан фойдалансин. Далил: [scripts/motion-design-plan.mjs#7-14](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/motion-design-plan.mjs#L7-L14).

**S-18 · P1 · CONDITIONAL — multiword cue ичидаги >400 ms табиий пауза match'ни йўқ қилади.** `resolveMotionBeats` кетма-кет сўз орасида 400ms'дан катта pause кўрса cue match қидиришни тўхтатади. Бу вақтда TTS шунча танаффус қилса, тўғри ўқилган гап ҳам кадр ўтишини block қилиши мумкин. **Тузатиш:** policy'da human-intended phrase vs punctuation/stop boundaries, timeout-based tolerance with strict no-cross-scene guards; exact аудио ўрнига вақт тўқимаслик. **Тест:** 399ms, 401ms, speaker pause, sentence boundary ва repeated tokens. Далил: [scripts/motion-design-plan.mjs#30-45](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/motion-design-plan.mjs#L30-L45).

**S-19 · P1 · CONDITIONAL — 6 секундлик RU hook ва ундан узун TTS.** `import-voice` русча `sceneIndex === 1` ўтишини 180 кадр (6c) билан cap қилади. Реал AB тестда RU `ji` hook'и 8.44с. Бу овозни кесмайди, лекин 6сдан кейин кадр бошқа саҳнага ўтиши, эски сўз outgoing crossfade'га қолиши мумкин. **Тузатиш:** hook'ни realistic text budget ва actual cue boundary билан бошқариш, тарихий 6с cap'ни янги сценарийларга автоматик қўлламаслик. **Тест:** hook охирги сўзи 8.44с бўлса кадр/капшен/payload визуал мос келсин; stereo/locale бўйича алоҳида. Далил: [scripts/import-voice.mjs#324-346](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/import-voice.mjs#L324-L346) · [реал AB CI](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41998283174).

**S-20 · P1 · CONDITIONAL — pre-cue ҳолатда биринчи график кўриниши мумкин.** `NarratedActionScene`: `active = elapsed[last] ?? beats[0]`; cue келгунигача beat1 биринчи pose'и кўринади. Hook'да предметни аввал кўрсатиш мақсадли бўлиши мумкин, аммо ҳар бир кадр учун «маъно гапирилгандан кейин пайдо бўлсин» қоидасига автоматик тенг эмас. **Тузатиш:** `entryPolicy:preview-before-voice|on-cue|after-cue` per-shot; кадрлар staging тести. **Тест:** savol answer'ни cue'дан олдин очмасин, кўрсатиш мумкин бўлган объектга pre-roll истисно. Далил: [src/NarratedActionScene.tsx#81-89](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/NarratedActionScene.tsx#L81-L89).

**S-21 · P1 · CONDITIONAL — visual hold 6 секунд gate фақат real audio cues импортдан кейин ишлайди.** `validateVisualHold` тўғри: `sourceScene.startMs/endMs` асосида интервални ҳисоблайди, лекин expensive TTS якунлангунча қанча hold бўлишини олдиндан аниқ тасдиқлаб бўлмайди. **Тузатиш:** олдин narrative/character budget ва mock pacing risk estimate, кейин real cue strict gate; manual override эмас. **Тест:** prevoice «risk flag», postvoice 6s strict error, existing output checkpoint preserved. Далил: [scripts/motion-design-plan.mjs#56-77](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/motion-design-plan.mjs#L56-L77) · [content/visual-system.json#1-18](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/visual-system.json#L1-L18).

**S-22 · P1 · GAP — `resolveMotionBeats` вақтни аниқлайди, семантик кадрни эмас.** Ҳақиқий word cue борлиги «расмда тўғри предмет» дегани эмас. **Тузатиш:** алоҳида `scene-frame-review.json`га `scriptExcerpt`, `cueMs`, `expectedVisibleObject`, `semanticChange`, `actualFramePath`, `status` сақлаш. **Тест:** cue'da ҳаракат бор, лекин нотўғри китоб/температура кўрсатилса render success ≠ visual QA success. Далил: [scripts/motion-design-plan.mjs#16-77](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/motion-design-plan.mjs#L16-L77) · [content/EDITING_SPEC.md#73-82](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EDITING_SPEC.md#L73-L82).

### Promo ва икки тил

**S-23 · P1 · GAP — product screenshot crop'и асл эканлиги, қирқилган нуқта мақсадга мослигига далил эмас.** 6 promo plan'да `promo-captures/ai-voice-original.png` ҳақиқатан бор, `uiLanguage:zxx`, `languageNeutralCrop` мавжуд. Лекин Panda/микрофонни crop қачон ва қайси қисмида кўрсатишни инсон static still'да баҳоламаса, кадр воқеага мослигини исботлаб бўлмайди. **Тузатиш:** each product-demo crop still contact sheet, 270×480 and pixel bounds, verified UI revision. **Тест:** микрофон crop'да йўқ бўлса claim demo QA FAIL, файл борлигининг ўзи PASS эмас. Далил: [scripts/promo-plan.mjs#98-120](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/promo-plan.mjs#L98-L120) · [src/PromoScene.tsx#9-27](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/PromoScene.tsx#L9-L27).

**S-24 · P1 · CONDITIONAL — promo narration визуал cue талабида exact substring ва STT cue gate айрим ҳолатда турлича.** `promo-plan` `beat.narration.includes(v.cueText)` орқали script'ни қабул қилади; render `resolvePromoCue()` → `resolveMotionBeats()` exact word timing'дан фойдаланади. Маъно томондан same-looking scripted text бўлса ҳам, TTS/STT multiword pause ёки такрорланиш туфайли кейинги gate'дан ўтмаслиги мумкин. **Тузатиш:** ягона prevoice cue compiler for lesson AND promo. **Тест:** duplicate `AI Voice`, локализацияланган `бо овоз`, pause ва Latin brand tokens. Далил: [scripts/promo-plan.mjs#98-105](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/promo-plan.mjs#L98-L105) · [scripts/promo-visual.mjs#1-5](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/promo-visual.mjs#L1-L5).

**S-25 · P2 · DATA — 2026-10-29 Tajik promo'нинг айрим visual planning тавсифлари русча қолган.** `cafe-first-phrase-20261029` TG'да narration/cue тожикча, аммо `visual.focalSubject`, `visual.action` каби ишчи кўрсатмалардан бир қисми рус тилида. Бу кадрда кўринадиган нашрий матн эмас, шунинг учун автоматик тил аралашган ролик дегани эмас. **Хавф:** кейинги сценарий таҳрирчиси RU prompt'га суяниб локал сюжетни нотўғри қўйиши. **Тузатиш:** agent-facing visual brief language or language-neutral ID; required locale editorial cues independent. **Тест:** TG authoring output'да барча табиий тилдаги tool brief'лар consistent ёки очиқ `languageNeutral` белгиси. Далил: [TG cafe promo JSON](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/locales/tg/promos/cafe-first-phrase-20261029.json).

**S-26 · P2 · DATA — реал реклама структураси ҳолатга боғланган, сақлаш керак.** Уч RU/TG рекламасига қараганда `situation → complication → attempt → product-demo → resolution` storyline бор, ҳақиқий product screenshot'га source asset боғланган. Бу 6 блокни 6 шаблонга мажбурлаш эмас. **Тузатиш:** storyboard quality gate'ни кучайтириш, лекин сюжет воқеанинг узлуксизлигини бузиб 8 та fixed sceneга кўпайтирмаслик. **Тест:** реклама 4–7 beatда ҳам ҳақиқий task resolution ва claim evidence билан ўтсин. Далил: [content/creative-formats.json#1-42](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/creative-formats.json#L1-L42) · [content/PROMO_WORKFLOW.md#5-36](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/PROMO_WORKFLOW.md#L5-L36).

**S-27 · P2 · GAP — RU/TG бир хил SVG геометрияси баъзан тўғри reuse, лекин визуал маъно бир хиллигини source hash исботламайди.** `assertLocalizedLessonSource` canonical raw file hash'ни боғлайди, `assertLocalizedPromoPlan` roles/claims/continuity'ни боғлайди. Визуал «маълумот дарахти»нинг ўқув талқини икки тилда бир хилми — semantic QA эмас. **Тузатиш:** per shot locale-independent `meaningId`, localized captions/cues and cross-language consistency review. **Тест:** ёзув таржимаси тўғри, лекин нарх/саноқ объектлари турлича бўлса reviewers alert. Далил: [scripts/language-context.mjs#53-73](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/language-context.mjs#L53-L73) · [scripts/promo-plan.mjs#27-49](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/promo-plan.mjs#L27-L49).

### CI, QA ва иш оқими

**S-28 · P0/P1 · CONFIRMED TEST GAP — CI real сценарийнинг ҳар бир кадрини баҳоламайди.** `.github/workflows/consistency.yml` synthetic semantic fixture'ларда 2 та расм ва ҳаракатда 5 та hash бошқачалигини текширади, source validator'ларни ва TypeScript'ни ишлатади. Бу 14 actual planned RU/TG сценарийнинг 199та graphic beat'и телефонда тўғри визуал тушунтирилишини исботламайди. **Тузатиш:** янги `content:frame-audit -- episode-id --language` (бошқа файлларга тегмайди) real normalized source'дан still frame/contact sheet, cue/hold manifest; real TTS мавжуд бўлмаса `needs-voice-QA`. **Тест:** 14 source item'нинг ҳар beat'идан камида 3 frame; ҳеч бир story-to-frame failure яшил статус олмасин. Далил: [.github/workflows/consistency.yml](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/consistency.yml#L1-L80) · [scripts/semantic-mp4-smoke.mjs#1-80](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/semantic-mp4-smoke.mjs#L1-L80).

**S-29 · P1 · GAP — фақат 2D text/meta эмас, ҳақиқий phone legibility test керак.** `EDITING_SPEC` 270×480'да кўришни қоида қилган, лекин code'нинг scene plan pass'и SVG экранда ўқилишини тасдиқламайди. **Тузатиш:** 1080×1920 ва 270×480 still; occupied area, clipping, foreground/background contrast, subtitle vs art overlap screenshot review. **Тест:** қисқарганда панда/китоб/нарх кўринмай қолса visual QA FAIL; SVG shape valid status unchanged. Далил: [content/EDITING_SPEC.md#73-82](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EDITING_SPEC.md#L73-L82).

**S-30 · P1 · GAP — кадр ҳақиқатан генерация қилинганига provenance керак.** Мавжуд review bundle'нинг асосий файллари MP4, SRT, post, manifest; кадрма-кадр storyboard hash ва қабул/рад этилган still далиллари package'да мажбурий эмас. **Тузатиш:** artifact'га `frame-manifest.json`, `contact-sheet/`, `review-decision.json` (аввал internal QA, кейин owner exact preview). **Тест:** 6 frame screenshot йўқ эпизод `frame-qa-pending`; approved production'га ўз-ўзидан ўтмасин. Далил: [scripts/github-video-pipeline.mjs#150-205](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/github-video-pipeline.mjs#L150-L205).

**S-31 · P2 · CONDITIONAL — Remotion SVG validation ҳар frame'да кераксиз иш қилаётган бўлиши мумкин.** Runtime test ўтганлиги performance optimised дегани эмас. **Тузатиш:** preflight validation + immutable normalized node tree memo; track tween фреймга қолсин. **Тест:** default 30fps clip before/after render wall time, memory; pixel output parity. Далил: [src/GraphicScene.tsx#9-24](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/GraphicScene.tsx#L9-L24).

**S-32 · P1 · DATA — active scenario authoring AI, preview automation эса якка.** Calendar Reserve манба JSON'ни ёзади, кейин downstream generator фақат шу JSON’ни ўқийди. `storytelling-plan`, `semantic-shot-adviser` — read-only proposal, `generate-draft` — copy; булар мустақил, валидацияланган creative-image generator эмас. **Тузатиш:** агент авторлиги ва machine validation'ни ажратган 2-stage contract: `script-only draft → semantic/graphic storyboard locked → voice permission`. **Тест:** кадр manifest'и тўлиқ ва visual source checked бўлмаса `content:voice` preflight deny, тарк этилган synthetic preview'га кирмасин. Далил: [content/WORKFLOW.md#49-57](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/WORKFLOW.md#L49-L57) · [scripts/generate-draft.mjs#1-29](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/generate-draft.mjs#L1-L29) · [scripts/semantic-shot-adviser.mjs#92-158](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/semantic-shot-adviser.mjs#L92-L158).

**S-33 · P1 · GAP — аудитдаги storyboard'ни ҳақиқий «мувофиқ» деб баҳолайдиган owner rubric машинада йўқ.** `graphic-voice-proof.mjs` real voiced fragments сақлаши мумкин, лекин review result'да file hash/hold/cues бор, кадр ҳақиқатан реал объектга мослиги бўйича structured score йўқ. **Тузатиш:** `subject-recognizable, action-truthful, Chinese-correct, timing-correct, phone-readable, aesthetic-continuity` олтилик pass/fail; ҳар `FAIL`да frame ID ва 1 аниқ ўзгариш. **Тест:** бир beat FAIL бўлса editing plan тузатилмагунча `ready-for-review` эмас. Далил: [scripts/graphic-voice-proof.mjs#1-108](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-voice-proof.mjs#L1-L108) · [content/EDITING_SPEC.md#73-82](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/EDITING_SPEC.md#L73-L82).

**S-34 · P1 · OPEN — хом SVG’ни видеода кўриб subject recognize қилиш ҳали қилинмаган.** Бир қатор **жисмоний кўриниш** деган хулосалар source description ва geometry stats’га асосланган; ҳақиқий 270×480 still'ларни шу аудит учун Remotion'дан чиқармадик. Нотўғри объектни «реал видеода тасдиқланган» деб белгилаш мумкин эмас. **Ёпиш шарти:** 14 RU/TG real script учун аудио йўқ бўлса source-only previews, аудио бор бўлса real cue frames; editor очиб аниқ қарор қайтарсин.

**S-35 · P0/P1 · GAP — барча downstream муаммоларнинг олдини оладиган битта «prevoice source QA» етишмаяпти.** Calendar Reserve source readiness `learningFactSources`, `storytelling`, action structural validators'ни кўради. Лекин 8 та repeated cue ambiguity ва «расм шу мазмунни кўрсатадими?»нинг визуал тасдиғи кейинги босқичга қолади. **Тузатиш:** `source QA` ва `semantic storyboard QA` деб иккита тайёрлик даражаси, кейин TTS; ҳамма data structured artifact билан. **Тест:** кадр/манба/anchor текширилмаган сценарийда ҳеч қандай API калитига TTS сўров кетмасин. Далил: [scripts/self-improvement-check.mjs#90-129](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/self-improvement-check.mjs#L90-L129) · [scripts/motion-design-plan.mjs#16-56](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/motion-design-plan.mjs#L16-L56).

## N.4. Шу 7 та сценарий учун конкрет «кадр талаблари» — қандай бўлиши шарт?

Бу **янги artwork генерация қилиш буйруғи эмас**, QA учун текшириладиган сценарий-кадр specification. Chinese мисоллар source'дан олинган; **нарх, китоб сони, температура, воқеа натижаси каби номаълум фактлар тўқимаслик** шарт.

| Дарс | Гапдаги маъно | Кадрда аниқ нима кўриниши шарт? | Мос келмаган деб қайси ҳолат саналади? |
|---|---|---|---|
| `ji-vs-duoshao` | `几本书` — китоблар сони, `多少钱` — нарх | Биринчи саҳнада китоб/сони ҳақида савол, кейин алоҳида price label / пул белгиси ёки нархни сўраш ҳолати; контраст саҳнада **саноқ vs нарх** фарқи | Ҳамма саҳнада фақат бир хил китоблар ва `几` белгиси, нарх саволига хос ҳеч бир детал йўқ |
| `bi-comparison-height` | `他比我高`, `今天比昨天冷` | Икки одамнинг баландлиги қиёси; кейин кеча/бугун ҳавоси, икки алоҳида temperature/bar ҳолат (аниқ рақам тўқимасдан) | Иккала ҳолатда бир хил generic `比` чизма, одамлар/об-ҳаво контрасти сезилмайди |
| `haishi-vs-huozhe` | `还是` саволда танлов, `或者` билдиришда вариант | Бир хил икки объект (чой/қаҳва) икки қўлланишда турлича муносабат: саволдан танлаш vs ҳар иккиси мумкин | Фақат бир стаканни ўнг-чап силжитиш; савол/вариант фарқи кўринмайди |
| `zhuozi-you-book` | `桌子上有一本书` | Стол, китоб, аниқ «стол устида» жойлашуви; сўз тартибида жой→有→предмет тушунчаси | Китоб бор, аммо стол/жойлашув ёки 有 маъноси кадрдан билинмайди |
| `known-book-zai` | Таниш `那本书` нинг жойи | Аниқ таниш/белгиланган китобнинг столга нисбатан позицияси | Аниқ китоб referent йўқ, random объект алмашади |
| `hui-vs-neng` | 会 — ўрганилган қобилият, 能 — шароитда мумкин | Сузувчи кўникмаси ва ёпиқ бассейн/тўсиқ сабаб ҳозир суза олмаслик **икки мустақил ҳолат** | Бассейн «ёпиқ» деган сўз бор, кадрда тўсиқ/ёпиқлик йўқ ёки фақат swimmer generic ҳаракатланади |
| `youdianr-vs-yidianr` | 有点儿 салбий баҳо, 一点儿 миқдор/илтимос | Қиммат деб баҳолаш ва «озгина арзонроқ» деб сўрашнинг бир-биридан фарқли визуал муносабатлари | Фақат бир нарх теги ранги ўзгаради, request/bad evaluation фарқи йўқ |

**Реклама кадрлари:** `shop-shirt-size` — футболка каттароқ ўлчамни излаш (фақат кўзга кўринадиган кийим/қўл), иккиланиш, телефон олиш, **асл HSK AI панда ва микрофон crop**, суҳбатга қайтиш. `campus-voice-rehearsal` — талабa + хобгоҳ + телефон + асл UI + қайтиш. `cafe-first-phrase` — меню/чой + танаффус + телефон + асл UI + қайтиш. Оригинал маҳсулот UI'сига fake tap, fake reply ёки fake success қўшилмасин; манбада бўлмаган HSK AI feature claim тўқилмасин.

## N.5. Тавсия қилинган янги ишчи contract — *мураккабликни кўпайтирмай*, аниқ маъноли кадр

### Бир марта authordagi `FrameIntent` (янги тармоқ эмас, scene.motionBeat устига ихчам metadata)

```json
{
  "sceneId": "price",
  "beatId": "price-step-2",
  "scriptCue": "这个多少钱",
  "learningClaimId": "ask-price",
  "visibleSubject": "price question for a book",
  "beforeState": "book presented without price",
  "afterState": "price is being asked, amount remains unknown",
  "visualEngine": "existing-graphic",
  "graphicSource": "existing scene.motionBeats[].visual.graphic",
  "requiredEvidence": ["book context", "price-query indicator"],
  "forbiddenAssumptions": ["invented fixed price", "fake product UI"],
  "humanVisualReview": "pending"
}
```

Бу JSON **таклиф**, ҳозирги коднинг ишлаб турган schema'си эмас. Ҳозирги motionBeat'ларини бузмасдан янги опционал `semanticIntent`га ўтказиш керак. `visualEngine` default `existing-graphic`; `auto-image` мажбурий бўлмасин. Фактни кадрга боғлаш ва snapshot QA фақат янги unapproved episode'ларга қўллансин.

### Соддалаштирилган pipeline

1. **Source-only script:** дарснинг битта аниқ ўқув натижаси, ҳаётий context, 1–N source-backed Chinese facts, RU/TG narration, CTA-free.
2. **Frame contract:** ҳар сцена/beat учун `visibleSubject`, `before/after`, аниқ cue, allowed asset, forbidden fabricated detail, source evidence. Сценарийга боғланмаган `explains` stop.
3. **Preview before paid voice:** real 1080×1920 still'лар билан scene thumbnail/contact sheet; `human/vision review` 270×480. Preview TTS қилмайди, timing ҳали approximate деб белгиланади.
4. **Strict pre-TTS:** audio budget + suspicious multiword/duplicate cue audit + drawing validity + file provenance + locale source hash. Шу вақтда `frame-plan-locked` статуси.
5. **Voice once + checkpoint:** тасдиқланган TTS, real STT, actual cue timestamps. STT хатоси овозни қайта яратмайди.
6. **Cue-frame alignment:** ҳар beat cue'дан олдинги frame, cue frame, 0.3/0.7s ўтиш, settled frame; anim lastAtMs nextCue'га мослигини текшириш.
7. **Real MP4 QA:** телефонда иллюстрация аниқлиги, чегаралар, субтитр, pinyin ва таълим маъноси; 6 та boolean acceptance + error list. Partial не complete.
8. **Existing exact-preview approval:** approved/published hash, URL, TikTok CTA ва Zernio қоидаларини ўзгаришсиз қолдириш.

### Automatic frame QA'ни ортиқча оғирлаштирмаслик

- Фақат **2 та мажбурий янги артефакт**: `frame-intents.json` (source) ва `frame-qa.json` + кичик contact sheet (review). Исталса улар битта manifestга бирлашади.
- **Ҳар кадр учун генAI image call йўқ**: vector library/typed `quantity`, `comparison`, `choice` ва existing SVG reuse default.
- Visual reviewer модельдан фойдаланилса, у screenshot ҳақиқатан мос эмаслигини *таклиф* қилади, лекин хитойча грамматика/диққат талаб қиладиган claim'да final owner/editor approval талаб қилинади.
- Тарихий ва нашр қилинган видеоларни қайта ишлаш йўқ; янги source/working copies учун opt-in rollout.
- Барча QA fail'лар **ID + file + reason + required repair** кўринишида, махфий API ва source audio'ни чиқармасдан ёзилади.

## N.6. Ҳужжатлар ва қоидаларни синхронлаштириш — аниқ файллар

| Файл | Амалдаги ёзув/тенденция | Қандай ўзгариши керак |
|---|---|---|
| `content/WORKFLOW.md` | AI agent source JSON ёзади ва pre-TTS structural gate | Source/script stage → semantic storyboard lock → still QA → TTS → real cue QA → MP4 QA деб ажратсин |
| `content/EDITING_SPEC.md` | `Review before delivery` яхши қоида, лекин structured result мажбурий эмас | 270×480 visual rubric чеклистини real output'га боғлаш; final approvalга шарт |
| `content/GRAPHIC_SCENES.md` | Тўғри declarative API ва geometry чекловлари | Visual intent/explains семантик ID, 2+ states маъноси ва animation deadline contract |
| `content/EPISODE_SCHEMA.md` | motionBeats, scene authoring, CTA separated | Optional FrameIntent schema, invalidation, screenshot evidence, locale semantic mapping |
| `content/CONTENT_PLAN.md` | Бир дарс = бир ўқув муаммоси; motion beats | Қандай пайтда 2 ёки 4+ beat керак, optional motion templates, prevoice checklist |
| `content/PROMO_WORKFLOW.md` | Genuine product captures ва minimal story | `frame-audit` crop/readability ва original UI provenance acceptance |
| `AGENTS.md` | Canonical ownership | FrameIntent source ownership, generated QA artifact location, owner preview |
| `AI_RULES.md` | Gemini Direct'ни асосий йўл деб ёзган эски қисми | Алоҳида voice provider миграцияси (V3'dан); янги frame QA қоидаси билан мослаштириш |
| `PROJECT_MEMORY.md` | Old Gemini-path ва active architecture historical mixed | Runbook current vs historical snapshot, V4 frame QA policy |
| `content/visual-system.json` | `maximumVisualHoldSec:6`, lessonPresentation flags | Ўлчовни ўзгартириш шарт эмас; per-cue animation deadline/phone viewport acceptance clear versioned rule |
| `content/creative-formats.json` | Storytelling pattern/autoStoryboard | `actualRendererMode` measurement and source authoring intent; random visual cycling same UI'га айланмасин |
| `.github/workflows/consistency.yml` | code, fixture and synthetic smoke | Мавжуд checks сақлансин; real-source cue lint ва storyboard thumbnail structural audit incremental jobs |
| `scripts/check-consistency.mjs` | Overall repo validator асосан structure | `prevoice:cues` ва frame-intent source contract'ни янги сана учун қатъий қилди; old approved sourceга retroactive rewrite йўқ |

## N.7. Тузатиш тартиби ва dependency graph

**P0 — аввал овоз учун пул сарфланмасидан олдинги кодга тузатиш:**
1. `prevoice:cues` compiler (S-16, S-18, S-24, S-35), ID + ambiguous cue + source field. `cueOccurrence` талаб қилинганини фақат real ambiguity бўлганда қабул қилиш.
2. Existing `action-design-plan` frame visual stage source-only checklist (S-01, S-07, S-12); checker «graphic valid» ва «semantic reviewed»ни алоҳида статус қайтарсин.
3. V3'даги P0 checkpoint/resume ҳам биринчи шарт; cue QA қўшиш овоз йўқолишини ҳал қилмайди.

**P1 — actual frame real audio + script:**
4. Existing narrator vector typed model'ларини кўпайтирмасдан `visibleSemantic` contract (S-08/09) — 2 пилот: `ji` ва `bi`.
5. `FrameIntent` ва contact sheet/artifact proof, cue frame before/during/after; 270×480 phone QA (S-22, S-28–S-30).
6. `graphic` animation next-cue deadline gate (S-15), RU hook policy (S-19), speaker pause allowance (S-18).
7. RU/TG semantic QA ва 3 promo'да genuine UI crop; storyboard before-voice pass ва real voice after pass separate.

**P2 — implementation complexity камайтириш:**
8. `autoStoryboard`/`creativeFormat` metadata ва actual renderer reporting'ни солиштириш (S-06), эски legacy renderer'ни ўчирмаслик; conditional gate by episode date/style.
9. Reusable quantity/choice/comparison models'ни source author prompt'да default қилиш (S-08). Фақат dimensionless voice/ASCII dry run эмас — real rendered screenshot билан compare.
10. GRAPHIC validation cache benchmarking (S-14/S-31); деградация кузатилмаса бефойда refactor қилмаслик.
11. Current docs/agent guidance миграцияси ва evidence-сақлаш; V3'нинг API, publishing, voice тузатишлари билан conflict-free.

### Қабул тестларининг муайян тўплами

| Test ID | Инвариант | Қайси хатони ушлайди |
|---|---|---|
| FRAME-01 | `source narration`га боғланмаган cue ортиқча API call'сиз block | S-16 |
| FRAME-02 | `cueText` икки марта бўлса explicit `cueOccurrence` талаб; битта бўлса йўқ | S-16 |
| FRAME-03 | `cueText` case, Hanzi, pinyin, brand acronym normalizer parity | S-17/S-18 |
| FRAME-04 | 400msдан ошган ўринли pause'да нега blocked ёки accepted экани аниқ | S-18 |
| FRAME-05 | Саҳна учун нарх визуали бўлмаса `frameQA` fail, SVG structurally valid бўлса ҳам | S-07 |
| FRAME-06 | `几本书` саноқ визуали билан `多少钱` нарх визуали адекват фарқ қилади | S-08/S-09 |
| FRAME-07 | SFX/CTA/субтитр битта compact QA still'да ўқилади; 270×480 crop | S-29 |
| FRAME-08 | `graphic` track охирги keyframe кейинги speech cue'дан олдин тугайди | S-15 |
| FRAME-09 | `motionDesign` саҳнаси учун registered actual renderer mode, storyboard metadata билан адашмайди | S-06 |
| FRAME-10 | RU/TG бир хил сюжетда semantic `before/after` ва Chinese факт мос, аммо матн/тайминг мустақил | S-27 |
| FRAME-11 | Changed narration visual source hash'ни invalidates/review mark | S-04 |
| FRAME-12 | Оригинал screenshot'да panda ва microphone crop кўринади, UI сохта эмас | S-23 |
| FRAME-13 | `preview-still → voice → real still → final MP4` status бир-бирига алмаштирилмайди | S-28/S-33 |
| FRAME-14 | source-only QA pass credential талаб қилмайди, TTS сўрови 0 | S-35 |
| FRAME-15 | owner-approved/published media unchanged; no silent fallback audio, screenshot/image | V3 guards |

## N.8. Ҳақиқатан очиқ қолган жойлар — баҳо тўқимаслик

1. **Ҳақиқий 270×480 кадрларда предмет тани­лади­ми?** JSON geometry + validator билан буни 100% тасдиқлаб бўлмайди; real still ва инсон кўриши шарт.
2. **Битта кадр ҳақиқатан ташқи визуал намунага ўхшаш/сифатлими?** Зиёда содда SVG ҳам тўғри таълимий бўлиши мумкин; usability маълумоти йўқ.
3. **RU/TG биринчи уриниш TTS'да 199 motion cue'нинг ҳаммаси топиладими?** Реал full audio'да текширилмаган; 8 repeated cue **potential** error. TTS API quota/миллий тил affinity ҳақиқий E2E'да аниқланиши шарт.
4. **Ҳар бир vector track real cue оралиғида тугайдими?** Source JSON ва STT timestamps интеграция қилинган proof керак.
5. **Product capture UI ҳозирги Android/Telegram production экранга мосми?** Repo'да файл борлиги етарли эмас; HSK AI App product code/screenshots билан version/date evidence ишончли манба керак.
6. **Пиньинь, иероглиф ва маъно ҳар бир still'да кўринади ва педагогик жоизми?** Graph renderer visual text'ни ёзмайди; captions бор. Телефонда ҳақиқатан ўқилиши текширилади.
7. **Қайси сценарий pattern retention'га ёрдам берган?** Verified post-level 7d metrics, назорат гуруҳи ва бир платформада тенг шароитсиз ROI/CTR хулосаси мумкин эмас.
8. **Реал CPU/render time ва SVG cache'нинг фойдаси?** Benchmark йўқ, performance optimizationни production'га кўр-кўрона киритмаслик.
9. **Тайёр owner-approved / scheduled архивдаги видео визуали бошқами?** Git-ignored `review/` ва provider post'лардан барчасини ҳозирги сессияда очиб тингламадик; `source valid` ≠ `historical video quality verified`.
10. **Frame QA инсон/AI reviewer натижаси сақланадими?** Янги `frame-qa.json` architect proposal, амалдаги production artifact эмас.

## N.9. Қарор: нимани сақлаш / соддалаштириш / янги функция деб ажратиш

| Сақлаш шарт | Ихчамлаштириш мумкин | Фақат алоҳида рухсат/пилот билан |
|---|---|---|
| Реал Chinese source checking, Hanzi/pinyin, owner CTA, RU/TG isolation | Scene count бўйича rigid 3-beat prompt, redundant format vs renderer metadata | AI-generated images for everyday lesson frames |
| Locked narration hash, actual STT word time, no synthetic timestamp | Prevoice cue check бир марта lesson+promo учун | Cloud vision model QA (ёрдамчи, owner approval'ни алмаштирмайди) |
| Reusable Remotion SVG renderer + original capture | Basic book/cup/number учун complex 30-node path ўрнига typed model | Legacy semantic/HyperFrames engine migration |
| Genuine product screenshots, protected panda/logo, approved/published hashes | Frame author explanation'да бир хил generic paragraphs | Automatic publishing/auto winner; бу аудит доирасида рухсат йўқ |
| Real MP4 preview and phone-size QA | `graphics preflight` ва renderer duplicated validation benchmark ўтса | Visual asset API/translation service |

**Якуний техник хулоса:** лойиҳанинг энг катта кадр сифати хавфи «SVG чизиб бериш имконияти йўқ»лиги эмас; балки **манба сценарийдан визуал мақсадгача бўлган semantic proof'нинг machine-readable эмаслиги**. Кўпроқ графика, кўпроқ эффект ёки кўпроқ AI API сўрови буни ўзи ҳал қилмайди. Тўғри ечим — source script'да *нима ҳақиқатан кўрсатилиши шарт* деган битта қисқа контракт, TTS олдидан арзон текширув, кейин real MP4 frame + voice билан pass/fail.

**Файл статуси:** бу V4 ҳужжат V1–V3 матнини ўз ичига олади, **код ўзгармаган**, direct GitHub `main`га push/merge қилинмаган, расмий published/approved asset'лар ўзгармаган. V3 аввалги топилмалари ишлаб турган кодга ҳали татбиқ қилинмаган. V4 топилмаларининг барчаси автоматик реал video bug деб таснифланмаган; ҳар банднинг status'и далил чегарасини кўрсатади.

---

# O. V5 — СЦЕНАРИЙНИНГ ҲАҚИҚИЙ ЧИЗИЛГАН КАДРГА МОСЛИГИ, ВИЗУАЛ ҚАЙТА ИШЛАТИШ, ПРОДУКТ ДАЛИЛИ ВА QA ЗАНЖИРИ

**Аудит санаси:** 2026-11-05. **Код baseline:** `akbarholturaev11-lang/Kantent`, `main` = `6b8e66e39e828166333a904113877426b91afae5` (2026-11-05T08:30:11Z). **Маҳсулот текшируви:** `akbarholturaev11-lang/HSK-AI-Bot`, `main` = `2d629dd99ca892951fe9671874d6cd83b8d386c7` (2026-11-05T12:27:03Z). Ҳозирги GitHub branch'га код ўзгартирилиб ёзилмади. Бу — V1–V4'нинг давоми; ундаги тасдиқланган қисмлар сақланади, номаълум деб қолдирилган баъзи фарзлар қайта таснифланади.

**Янгилик:** V4 фақат иллюстрациялар *борлиги* ва умумий JSON формаларини кўрган. V5 эса **ҳар бир beat'нинг айнан график `nodes`/`tracks`и**, уларнинг бошқа beat/дарс/тилларда такрорланиши, танлов/жавоб мазмунига қайси белгилар қўшилиши ёки йўқолиши, маҳсулот скриншотлари билан жорий UI кодининг provenance мослиги ва caption↔pinyin рендер шартларини текширди. Тўлиқ Remotion production MP4 инсон томонидан эшитиб/кўриб баҳоланган деган даъво қилинмайди.

## O.1. Далил ва статус методологияси

- **CODE-CONFIRMED:** аниқ код шарти ёки график nodes/track таркиби repo'дан текширилган. **DATA-CONFIRMED:** GitHub source dataset'идан бевосита ҳисобланган. **SEMANTIC-RISK:** аниқ drawable ҳолат кўрсатилиши сценарий маъносига зид ёки икки маъноли; видеода томошабинга қандай сезилиши ҳали инсон кўриши керак. **REFUTED:** аввалги хавотирни манба чизмаси тасдиқламади. **OPEN-RENDER:** real Remotion still/MP4/crop'сиз исботлаб бўлмайди. **DOC-DRIFT:** code/asset вақти ва ҳужжат ёзуви ўзаро эскирган. **RECOMMENDATION:** ҳали йўқ функция, «ишлаяпти» деб берилмайди.
- Кўрилган контент: 7 та янги дарс × 2 тил = **14 source JSON**, **33 жуфт саҳна = 66 саҳна**, **199 graphic beat**; 3 реклама × 2 тил = 6 promo JSON, 36 promo beat, шундан 12 та real screenshot crop. Тарихий 20+ дарс ёки видео лойиҳаларининг **ҳаммаси MP4 даражасида** текширилгани йўқ.
- Манба: `hsk-tu-vous/content/episodes/`, `content/locales/tg/episodes/`, `content/promos/`, `content/locales/tg/promos/`; `scripts/{graphic-scene,action-design-plan,motion-design-plan,promo-plan,auto-storyboard}.mjs`; `src/{GraphicScene,NarratedActionScene,EpisodeComposition,CaptionOverlay,PromoScene}.tsx`.
- **Эҳтиёт чора:** SVG'нинг `id` номлари (`tea`, `price`, `pool`) сценарийда шу объект бўлишини назарда тутади, лекин пикселда ҳақиқатан аниқ танилишига далил эмас. `graphicFingerprint` расмдаги geometric information'ни ҳисоблайди, визуал семантикани исботламайди.

## O.2. Янги аниқ сонли кўрсаткичлар

| Ўлчов | Реал натижа | Муҳим чеклов |
|---|---:|---|
| Дарс сценарийлари | 14 (7 RU + 7 TG) | Шу 7 та янги дарс sample'и |
| Саҳналар | 66 | CTA чиқарилган |
| `motionBeats` | **199** | Ҳаммаси `kind:graphic` |
| **Такрорланмайдиган айнан бир хил raw SVG JSON** | **29** | Graph data (`nodes`, `tracks`, `width`, `height`) `JSON.stringify` бўйича тенг; semantic uniqueness эмас |
| Такрорий graphic payload instance | **170/199** | Бу механик copy; «170 та хато» дегани эмас |
| Такрорий graphic JSON ҳажми | **324 937 / 386 638 белги ≈ 84%** | Фақат график payload; compression, refs ва файли ўлчамларига таъсири бошқача |
| 29 та unique graph жами raw ҳажми | 61 701 белги | Тахминий иллюстрация registry учун база |
| Бир график турли дарс мавзуларида такрорланган гуруҳлар | **3** | Асосан `桌子上有...` / `那本书在...` стол-китоб серияси |
| Бир хил SVG билан якунланган RU/TG жуфт саҳналар | **32/33** | Бу мақсадли visual reuse бўлиши мумкин, аммо ҳар бир тил учун овоз/cue timing мустақил |
| RU/TG motion beat сони фарқ қилган саҳна | **1/33** | `hui-vs-neng-pool-20261028` `contrast`: RU 3, TG 4 |
| 5–7 секундлик hook режасига нисбатан >15 белгидан/секунд | **6/14** | Белги/секунд — нутқ тезлигининг прокси, TTS сифати ёки ҳақиқий давомийлик эмас |
| >20 белгидан/секунд hook | **2/14** | Иккаласи `ji-vs-duoshao` RU/TG (21.6; 22.4) |
| Реклама product-capture crop'лари | **12/12 координата чегара ичида** | Фақат JSON'да **эълон қилинган** `1179×2556` dimension; PNG pixel content текширилмади |
| Микрофон crop upscale | **700/290 ≈ 2.41x** | `PromoScene.tsx` 700px render width; ажратилган пиксел аниқлиги телефонда тест қилиниши керак |

**Қатъий миқдор методи:** 14 JSON файлидан ҳар `motionBeats[].visual.graphic` raw graph JSON сатрга айлантирилган; `29` аниқ тенг payload саноғи; `199 - 29 = 170`; `(386638 - 61701) / 386638 = 0.8404`. Бир графикка reference қўйилса барча checksum/approval ва тарихий видеолар автоматик ўзгариб кетмаслиги зарур — миграция фақат янги draft'ларга.

## O.3. Аниқ номувофиқликлар ва аввал очиқ қолган жойларни текшириш (V5-01 — V5-24)

### V5-01 — P0/P1 · CODE-CONFIRMED + SEMANTIC-RISK: `或者` жавоб кадри икки тўғри вариантдан биттасини «йўқотади»

- **Манба:** `content/episodes/haishi-vs-huozhe-tea-20261102.json` ва `content/locales/tg/episodes/...` — иккаласининг `scene.id="options"`.
- Нутқ: `茶或者咖啡都行。` (*Chá huòzhě kāfēi dōu xíng* — чой ҳам, қаҳва ҳам бўлади). `options-action-2` графигида иккала объектга **`tick-tea` + `tick-coffee`** белгилари бор. Кейинги `options-action-3` (`cueText: "或者"` / TG `"或者 меояд"`) графигида **`tick-tea` бор, `tick-coffee` йўқ**; `tea-halo`, `choice-line` қолади.
- **Тасдиқ:** кодда айнан шу икки турдаги чизма бор, аниқ `node` таркиби солиштирилди. **Эҳтимолий педагогик оқибат:** гапда иккаласи ҳам мумкин дейилганидан кейин битта ичимлик алоҳида танлангандай чиқади. Ҳақиқий видеода қанчалик кучли сезилиши — OPEN-RENDER.
- **Тузатиш:** `options-action-3` ҳам «both allowed» ҳолатини сақласин ёки иккала вариантни тушунтирувчи нейтрал муносабат/белги чиқарсин. `chosenDrink` маълумоти бўлмаган ҳолатда ягона ичимликни белгиламасин.
- **Тест:** `both-accepted` сценарийи учун ҳар subsequent settled pose'да `tick-tea` ва `tick-coffee` ёки эквивалент `both-allowed` семантикаси; биттаси йўқолса QA fail. Real frame screenshots (cue-1/cue/cue+0.7s) билан тасдиқ.

### V5-02 — P1 · CODE-CONFIRMED + SEMANTIC-RISK: `还是` саволи вақтида жавоб олдиндан белгиланиши мумкин

- Шу дарсда `scene.id="choice"`, `choice-action-2` графигида `tea-halo` ва `tick-tea` пайдо бўлади; narrator ҳали `Ты пьёшь ...` деб **савол** бераётган пайтда. Қатъий хато эмас — агар beat мақсади фақат диққатни чойга буриш бўлса мумкин. Лекин `tick` «тўғри танлов» сигналини бериши мумкин.
- **Тузатиш:** саволнинг `choice-open` ҳолатида икки вариантни нейтрал кўрсатиш; checkbox/check фақат ҳақиқий жавоб берилганда ишлатиш. Actual UX review мажбурий.

### V5-03 — P1 · DATA-CONFIRMED: 199 graphic beat учун 29 unique geometry — мураккаб ёзиш ва семантик айирма хавфи

- Репозиторийда бир SVG қайта-қайта **ўзининг бутун 1–5 KB JSON геометрияси билан** нусхаланган. График таркибни ҳар бир source'га copy қилиш эски note/фокусни қўлда кўчириш хавфини оширади. Бу файлар оғирлиги аниқ хавф эмас, лекин authoring/maintenance мураккаблигининг далили.
- **Соддалаштириш:** янги сценарийлар учун optional `graphicRef: "canonical-name@version"` + `graphicOverrides` эмас, оддий registered shared vector/art asset ID; default existing actual `graphic` фақат махсус ҳолатлар учун. Compile вақтида invariant media snapshot/hash pin; approved historical source'ни touch қилмаслик.
- **Чеклов:** `84%` фақат raw graph JSON; 84% rendering speed, 84% audio cost ёки 84% Git pack камайиши дегани эмас. Икки тил учун умумий чизманинг **source reuse** ва мустақил speech timing'ини аралаштирмаслик.

### V5-04 — P1 · DATA-CONFIRMED: `有` ва `在` дарсларида айнан бир хил стол-китоб чизмаси ишлатилади

- `zhuozi-you-book-20261031` (桌子上有一本书 — *Zhuōzi shàng yǒu yì běn shū* — стол устида бир китоб бор) ва `known-book-zai-20261101` (那本书在桌子上 — *Nà běn shū zài zhuōzi shàng* — ана ўша китоб стол устида) ўртасида аниқ graphic payload 3 гуруҳда кесишади; энг кўп қайтарилган битта graphic 18 марта учраган.
- **Семантик фарқ:** биринчиси **мавжудлик / янги объект**, иккинчиси **таниш объектнинг жойлашуви**. Бир хил стол-китоб саҳнаси иккаласини ҳам тасвирлаши мумкин; визуал фарқни қўшимча focus/motion/caption таъминлайдими — ҳар бир beat'да текширилсин. Геометрия бир хиллигининг ўзи хато деб ҳисобланмайди.
- **Тузатиш:** reuse сақлансин, аммо `learningState: new-object` vs `known-referent-location` боғланиши ва кадр QA алоҳида. Масалан, биринчисида китоб пайдо бўлиши, иккинчисида аввалдан таниш китоб белгиланиши / жой кўрсатилиши.

### V5-05 — P1 · DATA-CONFIRMED: икки тилнинг 32/33 саҳнасида drawing 100% бир хил

- Жуфт саҳна идентификаторлари бўйича RU/TG 33 саҳна солиштирилди; **32** тасида motionBeat сонлари ва ўша позициядаги `visual.graphic` payload'лар 1:1 тенг. Фақат `hui-vs-neng-pool` `contrast`да RU 3, TG 4.
- **Яхши жиҳат:** иккинчи тил учун қайта расм чизиш ортиқча. **Хавф:** узунроқ TG нутқига RU timeline/copied cue ўтмаслиги; individual per-language exact cue ва frame timing шарт.
- **Тест:** `sameGraphicHash` ҳамда `differentCueHash` бир вақтда қабул қилинсин; localized scenario source hashes/captions/audio алоҳида. Бир тилда 4 beat бўлса 3 beat'ли бошқа тилни зўрлаб бирхил қилмаслик.

### V5-06 — P1 · DATA-CONFIRMED: hook режаси баъзи жойда нутқ сиғими билан келишилмаган

- **`ji-vs-duoshao` RU hook:** 108 белги / 5 сония = 21.6 белги/секунд; **TG hook:** 112/5 = 22.4. Яна 4 та hook'да белгилар сони 15/секунддан юқори. Тинув белгилари ва иероглифлар борлиги сабаб бу speech-rate'га тенг эмас; аммо босқични TTSдан олдин хавф белгилашга етарли.
- **Янгилаш:** `durationSec`ни реал овоздан кейин resize қилиш; hook ахборотини 1–2 meaningful cue'га қисқартириш, маъно ва Chinese example'ни йўқотмаслик. 5 сония механик чеклов эмас, editorial target.
- **Тест:** prevoice flag >15 chars/s «editorial review»; реал TTS ўқилгандан кейин hook cue'лари 100% scene boundary ичида ёки қатъий ўтиш жойига мос, ҳеч бири кесилмасин.

### V5-07 — P1 · CODE-CONFIRMED: mixed-language subtitle'да pinyin алоҳида кўрсатилмайди

- `scripts/action-text-layout.mjs#L13-L30` `actionSubtitlePresentation(text, layout)` функциясида `text` ичида Hanzi/punctuation/whitespace'дан бошқа белгилар бўлса (`русча`, `тоҷикча`, рақам, Latin), **`pinyin:""` қайтаради**. Шу сабаб субтитр бир page'да `今天比昨天冷` билан русча изоҳни бирлаштирса, pinyin чиқмаслиги мумкин; source `visual.pinyin` борлиги унинг экранда доим борлигини англатмайди.
- **Аниқлик:** реал caption segmentation ҳали импорт қилинмаган sample'лар учун screenshot'да pinyin йўқ деган даъво эмас. Бу — аниқ код шарти ва conditional UX gap.
- **Ечим:** `segment-level Hanzi+pinyin`ни subtitle block'нинг **ичида**, фақат exact source-backed Chinese span'га қўшиш; иккинчи overlay/duplicate headline чиқармаслик; phone readability сақлансин.
- **Тест:** `"比"` ва `"他比我高"` ҳақиқий tone-marked pinyin олиши; `"Он выше меня — 他比我高"` битта subtitle block'да тўғри сегментга боғланиши; таржима иероглифга қўшилиб тўқимаслик.

### V5-08 — P1 · CODE-CONFIRMED: `graphic` source'даги `visual.hanzi/pinyin/meaning` — мустақил кадрдаги ёзув эмас

- `NarratedActionScene.tsx#L74-L103` active `kind:graphic`да `GraphicScene` тасвирини беради. `GraphicScene.tsx` фақат geometry (`g/path/rect...`) чизади. `hanzi`, `pinyin`, `meaning` майдонлари image stage'да алоҳида чиқмайди; ёзувнинг вазифаси асосан `CaptionOverlay` орқали бажарилиши кўзланган.
- **Қайта тасниф:** бу intentional «one frame one subtitle» дизайни, **renderer bug эмас**. Лекин `visual.hanzi` тўғри деб JSON'ни текшириш, viewer уни экранда кўрди дегани эмас. V5-07 билан бирга QA қилинади.

### V5-09 — P1 · REFUTED: `hui` бассейн ёпиқлигини кўрсатувчи asset source'да йўқ деган гумон

- `hui-vs-neng-pool-20261028` RU `conditions-action-2`да **`pool-gate`, `pool-gate-post-a/b`, `pool-no-entry`, `pool-no-entry-bar`** бор. Кейинги `conditions-action-3` икки бассейн қиёсини ва сузувчини алоҳида график объектларда чизади. Демак source plan мазмунини умуман ўйламасдан ёзилмаган. **Қолган OPEN:** аниқ 270×480 still'да тўсиқ/тақиқ белгиси таниладими?
- **Тест:** cue `Бассейн закрыт` олдидан/кейин gate visible, no-entry label readable, бошқа маҳаллий вариантда ҳам ўхшаш proof.

### V5-10 — P1 · REFUTED: `比` дарсида визуал height/weather контрасти йўқ деган гумон

- `bi-comparison-height-20261104` `answer`да икки персонажнинг кўриниш баландлиги фарқ қилади (`a-torso` vs `b-torso`), `weather`да эса иккита gauge/thermometer'нинг баландлиги турлича ва пастга ишорачи стрелка бор. **Қолган OPEN:** бу ижро ҳақиқатан одамлар ва совуқроқ ҳаво сифатида таниладими, iPhone tiny preview'да тушунарлими? Демак source нимани кўрсатишни билмайди деган умумий даъво бу эпизод учун нотўғри.

### V5-11 — P1 · REFINED: `几/多少` нарх кадрида нарх белгиси шакли бор, аммо 100% ўқилиши номаълум

- `ji-vs-duoshao...` RU `price`да `price-base`, `price-hole`, `price-bar-*` graphic nodes; яъни асосий **price tag шаклини яратишга уриниш бор**. «Фақат китоблар чиқади, нарх белгиси умуман йўқ» деган гумон рад этилди. Бироқ SVG объект `price` деб аталгани билан, унинг контурини ёрлиқ ёки пул белгиси деб таниш учун preview зарур.
- **Тест:** `price-step-1/2/3` босқичида 270×480 кадр кўриниши, ноаниқ сумма тўқилмаслиги, **саноқ ↔ нарх** фарқининг мустақил тушунарлилиги.

### V5-12 — P1 · CONTENT-CONDITIONAL: `几` ва `多少`ни «бирининг вазифаси китоб, иккинчисининг вазифаси фақат нарх» деб қотирмаслик

- Реподаги lesson `几本书` vs `多少钱` реал мисолларда грамматик жиҳатдан тўғри. Аммо ўқувчида `多少` фақат пул учун, `几` эса китоб санаш учун деган нотўғри эксклюзив қоида шаклланиши мумкин. **多少本书** (*duōshao běn shū* — қанча китоб) ҳам тўғри; **几本书** (*jǐ běn shū* — неча китоб) одатда кичик сон кутилганда.
- **Тузатиш:** дарс мақсадини «икки контекстда қайси шакл кўпроқ табиий» деб аниқлаш, `多少`нинг умумий саноқда ҳам ишлашини хулоса ёки ўқув изоҳида яширмаслик. Бош сценарийга ортиқча HSK мураккаблик киритмасдан tiny clarification.
- **Ташқи грамматика манбалари:** https://hskcompanion.org/grammar/question-ji-duoshao/ ; https://char.hanzistack.com/grammar/ji-duoshao-asking-quantities ; https://www.mandarinai.com/grammar/detail/9 . **Статус:** контекст йўқолиши хавфи; source sentence'ларни ёлғон деб белгиламаслик.

### V5-13 — P1 · CODE-CONFIRMED: promo source proof санаси ва actual asset blob бир хил вақтда текширилмайди

- `promo-plan.mjs#L71-L77` evidence item'дан `id`, `kind`, `sourcePath`, `supports`, `checkedAt` сатрларини талаб қилади; `reviewPromoPlan` файл борлигини (`realpath`, `stat`) кўради. Аммо **JPEG/PNG SHA'ни actual file bytes'дан қайта ҳисоблаб evidence record'даги hash билан солиштирмайди**. `supports`да қўлбола GitHub blob SHA қайд этилган — уни machine check сифатида қабул қилиб бўлмайди.
- **Тузатиш:** `evidence[].assetSha256` ёки pinned Git blob + `lastVerifiedProductCommit` майдонлари, real sha compute; product screenshot жорийлигига таъсир қилувчи code change'да `requires-refresh`, автоматик publish block эмас аввал таҳлил ва explicit owner preview.

### V5-14 — P0/P1 · CODE-CONFIRMED + DOC-DRIFT: маҳсулотнинг жорий UI source'и рекламадаги код receipt'идан ўтиб кетган

- `shop-shirt-size-20261105.json` receipt `supports` ичида **2026-11-01даги** `HSK-AI-Bot` source HEAD `12480fbb1131a0810ed3464ce23c969ac50bf477`, ва `app/static/course-v3.html` Git blob `bc60ab8e4ae55c5bb5996a936fc3d97a8a60a76b` деб ёзилган.
- **2026-11-05 реал қайта текширув:** `HSK-AI-Bot/main` `2d629dd99ca892951fe9671874d6cd83b8d386c7`; `course-v3.html` blob **`ba1502b34e92ccae91069bbc91861b070c87077c`**; алмашган. GitHub compare API олдинги HEAD'dan жорий HEAD'га **591 commit ahead** кўрсатди. Бу 591 таси Voice UI'га тегишли дегани эмас, лекин receipt'даги «current product code» вақти аллақачон жорий эмас.
- **Қарама-қарши яхши факт:** `Kantent/main`даги **асл screenshot Git blob** `hsk-tu-vous/public/promo-captures/ai-voice-original.png` = `81f7be1cbadeca7a820cc5877c893fc91e65f267`; receipt'даги билан **айнан бир хил**. Демак screenshot ўзгартирилмаган. **Энди текширилиши керак:** screenshot ҳали жорий экранни ифодалайдими, микрофон ва панда жойи ўзгармаганми, иловада кўринадиган real feature'ни реклама тўғри кўрсатадими. Интерфейс йўқолгани ёки нотўғри деб ҳукм қилинмайди.
- **Тузатиш:** `reviewPromoPlan()` «screenshot genuine» ва «product current at commit X»ни алоҳида status қилиб юритсин; release/build change'дан кейин manual product capture recertification. Маҳсулотга оид реклама тасдиғи current feature code ёки owner-provided new screenshot билан далиллансин.
- **GitHub далил:** https://github.com/akbarholturaev11-lang/HSK-AI-Bot/blob/2d629dd99ca892951fe9671874d6cd83b8d386c7/app/static/course-v3.html ; https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/promos/shop-shirt-size-20261105.json ; https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/promo-plan.mjs#L71-L77 .

### V5-15 — P1 · REFUTED: promo crop кўрсатилган манба чегарасидан чиқади деган умумий гумон

- 3 реклама × 2 тил × 2 product-demo = **12** crop; барчасида `x>=0`, `y>=0`, `width/height>0`, `x+width<=sourceWidth`, `y+height<=sourceHeight`. Барча source config'да `1179×2556` деб берилган; crop'лар **`(285,580,600,540)`** ва **`(440,2180,290,245)`**. **Ҳаммаси эълон қилинган source dimensions ичида.** Бу mathematical bounds'ни ёпади, actual PNG dimensions'ни текширишга тенг эмас.
- **OPEN:** GitHub connector binary `.png`ни UTF-8 файл деб оча олмади. Шу сабаб crop ичида реал панда ва микрофон аниқлиги, тил матни йўқлиги, визуал контраст — кўриб чиқилмаган. Манба screenshot бошқа бир файл билан тахминан ўхшаш `1179x2556` бўлгани учун уни алмаштириб талқин қилиш мумкин эмас.

### V5-16 — P1 · DATA-CONFIRMED: microphone crop 290px'дан 700px'га катталаштирилмоқда

- Барча 6 promo JSON'даги mic crop `width:290`, renderer `src/PromoScene.tsx#L20-L22` product-crop учун stage `width:700` қилади; **2.41x horizontal upscale**. `product` crop эса 600→700 ≈1.17x. Бу пиксел сифатини пасайтириши **мумкин**, аммо real screenshot ва MP4 мавжуд бўлмасдан «хира» деб қатъий баҳоланмайди.
- **Тузатиш:** preview 1080×1920 ва 270×480, икки size'да mic пункти аниқлигини текшириш; source screenshot HD crop бор бўлса уни ишлатиш; UI'ни ўйлаб чизиб қўймаслик.

### V5-17 — P1 · OPEN-RENDER: `zxx` нейтрал UI crop'и жорий скриншотда ҳақиқатан text-free экани исботланмаган

- 12/12 crop `uiLanguage:"zxx"`, `sourceUiLanguage:"tg-TJ"`, `languageNeutralCrop:true` деб белгиланган. Бу тилсиз қисмни ишлатиш учун **қоидага мувофиқ schema**, лекин пикселда тожикча ёзув йўқлигини JSON исботламайди. RU таржимага тожикча интерфейс тиқилиб қолса, промо ишончлилиги пасаяди.
- **Тузатиш:** ҳар `product-capture` учун actual image crop snapshot, owner visible-text certification, provenance hash; `sourceUiLanguage`ни жорий ишлаётган UI ҳолати билан қайта текшириш.

### V5-18 — P1 · CODE-CONFIRMED: storyboarding video review'даги қоида нима учун автоматик «semantic pass» эмас

- `scripts/graphic-scene.mjs#L16-L101` аниқ SVG syntax/geometric constraints, opacity/visibility ва motion keyframe'ни текширади. `action-design-plan.mjs#L64-L90` `motionBeats` сони, `explain` сатр ва graphic fingerprint'лар фарқини текширади. **Бир хил геометрия + нотўғри script context**ни semantic understanding билан баҳолайдиган classifier бу код йўлида йўқ.
- **Тузатиш:** `FrameIntent`ни фақат string node ID асосида «исбот» деб қабул қилмаслик; actual frame thumbs билан (1) script anchor (2) dominant object (3) visible change (4) reading size (5) no invented item (6) correct Mandarin relationship алоҳида reviewer. Fail фақат далил билан; automated model result — proposal, owner/editor approval — final.

### V5-19 — P1 · CI-OPEN: ўқилган source'дан real episode video'гача E2E video evidence йўқ

- `.github/workflows/consistency.yml` `semantic-planned-fixture` ва `semantic-mp4-smoke` синтетик tone/fixture'ни ишлатади; у 7 та ҳақиқий сценарийнинг **video screenshot** сифатига далил эмас. Текширилган `video-review` run'ларда real-TTS video job'лари skipped, synthetic guard jobs success бўлган (V3'да IDs бор).
- **Тузатиш:** paid voice'ни ҳар CI'да эмас, manual review/owner request'да чақириш; source-only generated contact sheet CI'да; real TTS/MP4 owner preview'да actual original/script frames + audio+hash + QA receipt.

### V5-20 — P1 · OPEN: actual screenshot'ни repo text adapter орқали кўра олмаслик — тест блокери, код хатоси эмас

- GitHub connector'нинг `fetch_file` ва `fetch` йўллари PNG binary учун `UnicodeDecodeError`/`only accepts UTF-8 text` қайтарди. Шунинг учун source PNG blob SHA **GitHub tree metadata** орқали, мавжудлиги эса tree орқали тасдиқланган; **пиксел ичи** ўқилмаган.
- **Талаб қилинадиган далил:** PNG crop'ни local binary fetch/artifact орқали очиш ёки GitHub Action'да crop/contact sheet тайёрлаб approval artifact'га юклаш. Бундай файл олмагунча «панда тўлиқ кўринади» ёки «микрофон кўринмайди» деб ёзмаслик.

### V5-21 — P1 · GAP: сценарий→кадр «ҳолатни сақлаш» invariant'и йўқ

- Далил: `haishi/options-action-2`да `both tick`, action-3'да `tea only`; `action-design-plan` буни **ҳар beat геометрияси бошқача** деб қабул қилади. `visibleActionStates()` бир ҳолатдан кейингисига қайси факт сақланиши зарурлигини билмайди.
- **Тузатиш:** `scene.semanticObligations` (масалан, `both-allowed`) ва ҳар beat `mustPreserve` / `mayChange` ихчам чеклови; янги JSON pipeline яратмасдан, мавжуд `motionBeats`га `visualIntent` қўшиш. `both-allowed` баёнини битта вариантга тик тушириш **negative test** бўлсин.

### V5-22 — P1 · GAP: FrameIntent қабул мезони source-only валидатор ва real-frame QA'га бўлинмаган

- V4'да `FrameIntent` JSON **таклиф** эди, кодга ҳали қўшилмаган. Уни бор деб кўрсатиш хато. Аниқ икки gate керак: (a) **pre-TTS** `cueText`, required subject/state, allowed art source, validation of no false facts; (b) **post-render** before/on/after cue screenshot, legibility & semantics acceptance. Иккаласида ҳам тушунтирилган `sourceHash`/graphic hash/asset blob билан proof.
- **Соддалаштириш:** янги файллар сонини кўпайтирмасдан `episode.scenes[].motionBeats[].visualIntent` + `review/<id>/frame-qa.json` битта receipt; фақат юқори хавфли source/brand demo'ларда contact sheet; existing old approved source untouched.

### V5-23 — P2 · DOC-DRIFT: document «қоида бажарилди» ва «бу вазифа бажарилиши керак»ни ажратмайди

- `EDITING_SPEC.md` ишлаб турган **review before delivery** кўрсатмасини ёзган; `GRAPHIC_SCENES.md` ҳар ҳаракатга real MP4 still назарда тутади; `WORKFLOW.md` агент real storyboard/capture қилишни буюради. Аммо `check-consistency` ва GH synthetic CI'да **ҳар бир source кадр учун owner/vision sign-off** receipt шарт эмас.
- **Тузатиш:** runbook'да `policy-defined`, `code-enforced`, `evidence-collected`, `human-approved`, `published` статусларини ажратиш; validator success'ни content truth success деб чиқармаслик.

### V5-24 — P2 · DATA-CONFIRMED: static `visual` reuse ва story-specific edit rules'ни соддалаштириш мумкин, визуал сифати ҳисобига эмас

- Typed vector stage'лар аллақачон бор (`quantity`, `phrase`, `numeral`, `ordinal`, `comparison`, `choice`, `graphic`) аммо 14 та real lesson sample'да **199/199 фақат `graphic`**. Шу сабаб ҳар сафар қўлда SVG копиялаш ўрнига existing typed `quantity/choice/comparison`ни вазиятга мос жойда ишлатиш, graphic'ни фақат ҳақиқатан янги объект/қарама-қаршилик учун қолдириш оқилона.
- **Мажбурий чеклов:** `choice` model'да фақат `selected` бўлгани учун очиқ танлов ва иккала вариант ҳам мумкин деган маънони адаштирмаслик керак. Typed визуал ҳам семантик invariant ва кадр QA'дан ўтсин.

## O.4. Aниқ сценарий-кадр QA мисоллари (тузатиш талабларини аниқлаштириш)

| Сценарий саҳнаси | Нутқда нима исботланиши керак | Реал source graph'да топилди | Статус ва тузатиш |
|---|---|---|---|
| `haishi.../choice`, RU/TG | `还是` — ҳали танланмаган икки вариантли савол | Икки кружка; кейин чойга `tick`/halo | **Semantic risk:** танловни олдиндан ҳал қилиб қўйгандек кўрсатмасин; click/check'ни жавобгача йўқотиш ёки нейтрал қилиш |
| `haishi.../options`, RU/TG | `或者` — чой ҳам, қаҳва ҳам бўлади | `tick-tea + tick-coffee` → кейин фақат `tick-tea` | **Specific confirmed graph regression:** кейинги beat'да `both` state'ни сақлаш |
| `hui.../conditions`, RU | `不能` — бассейн ёпиқ, шароитда мумкин эмас | `pool-gate`, `pool-no-entry`, сузувчи, active vs closed comparison | **Source requirement met; render still OPEN**: gate 270×480 да аниқми |
| `bi.../answer`, RU | `他比我高` — бўй қиёси | Иккита турли баландликдаги одам, arrow/height indicator | **Source requirement met; render still OPEN** |
| `bi.../weather`, RU | `今天比昨天冷` — совуқроқ кун | Иккита weather gauge, бири пастроқ, down arrow | **Source requirement met; render still OPEN** |
| `ji.../price`, RU | `多少钱` — нарх сўралмоқда | `price-base/hole/bars` tag геометрияси | **Source price-tag present; recognizability OPEN**, ноаниқ сумма тўқимаслик |
| `zhuozi.../structure`, RU/TG | `有` — столда китоб пайдо бўлади | stage 1 китоб пайдо бўлади, stage 2 бўш стол, stage 3 китоб қайтиб келади | **Context-sensitive**: сўз тартибига мос, аммо animation қайтариш атайлабми — phone MP4 билан кўриш |
| `known-book...` vs `zhuozi...` | `在` жойлашув ва `有` мавжудлик фарқи | 3 exact reused table-book SVG motif | **Reuse okay**, грамматик диққат ўрни ва объектнинг танишлиги кадрда алоҳида кўрсатилсин |
| `shop-shirt-size` 3 реклама × 2 тил | AI Voice панда/микрофон реал экрани | 12 crop declaration, барча coordinate valid; as-is screenshot blob verified | **Screenshot genuine, pixel legibility OPEN, current product code changed** |

## O.5. Минимал эскирмайдиган `FrameIntent` контракти (янги маҳсулот учун таклиф, ҲАЛИ КОД ЭМАС)

`motionBeats[]`нинг мавжуд `visual`/`cueText` устига ихчам semantic contract қўшиш кифоя; алоҳида генерация framework ёки ҳар beat'га image API қўшиш шарт эмас:

```json
{
  "id": "options-action-3",
  "cueText": "或者",
  "kind": "graphic",
  "visualIntent": {
    "claim": "both-drinks-acceptable",
    "mustShow": ["tea", "coffee", "either-accepted"],
    "mustPreserve": ["both-drinks-allowed"],
    "mustNotShow": ["one-drink-already-selected"],
    "learningEvidence": "茶或者咖啡都行",
    "meaningReview": "pending"
  },
  "visual": { "graphic": "EXISTING_TYPED_GRAPHIC_PAYLOAD" }
}
```

**Қоида:** `visualIntent.claim` ҳақиқий source-тасдиқланган маъно бўлиши керак; `mustShow` фақат node.id сатрига ишонмайди: real frame/crop proof талаб қилинади. `mustPreserve` аввалидаги кўрсатилган фактни кейинги кадрда йўқотмасликка хизмат қилади. `mustNotShow` хусусияти грамматикада ўзига қарши маъно чиқмаслиги учун.

**Алгоритм (production proposal):**
1. `source-note` — олий мақсад, хато тушуниш хавфи, ҳақиқий мисол ва reference.
2. `scenes[]` — ҳар саҳнага қиймати бор сюжет воқеаси; сонга қараб 3 та fake beat талаб қилмаслик.
3. `motionBeats[]` — exact `cueText`, `visualIntent` ва existing typed action/vector graphic.
4. `prevoice:audit` — source lint, ambiguous cue list, two-language localization, asset hash/freshness, `visualIntent` completeness, renderable graph, owner/agent frame acceptance. **Янги TTS сўрови йўқ.**
5. `frame-stills` — zero-voice prototype still/thumbnail; у ахборот учун, ҳақиқий синхронлашган видео эмас деб белгилаш.
6. Approved TTS + stable checkpoint + verified STT → motion cue real `startMs`.
7. `frame-qa.json` — real **before/on/after** frames, 270×480 scaled preview, `semanticInvariant` кўрингани ва UX/readability натижаси. sourceHash+graphicHash+audioHash+renderedVideoSHA бир receipt'га боғлансин.
8. Exact preview owner approval → per platform verified media/hash → Zernio; old approval/media immutable.

## O.6. Қайси ҳужжатларни V5 натижасига мослаштириш керак?

| Манба | Номувофиқлик | Қисқа тузатиш |
|---|---|---|
| `content/WORKFLOW.md` | Сценарий/чизма ёзиш тартиби бор, semantic accepted proof ҳар ролик учун йўқ | `source-only`, `frame-plan`, `prevoice`, `voice-import`, `real-frame-qa`, `owner-approval` ҳолатларини ажратиш |
| `content/GRAPHIC_SCENES.md` | Geometry/shape/pacing яхши; `both-allowed` каби state invariant йўқ | `visualIntent` ва beat-to-beat preserved claims contract, negative test |
| `content/EDITING_SPEC.md` | 270×480 review қоидаси бор, receipt йўқ | `frame-qa.json` + нақты screenshot proof талаб қилиш; без доказательства `review-pending` |
| `content/EPISODE_SCHEMA.md` | `graphic` ва `motionBeats` schema'си бор | Backward compatible optional `visualIntent`, graphicRef migration rules, locale-independent art + locale-specific timing |
| `content/PROMO_WORKFLOW.md` | Genuine image asset қоидаси бор, current app UI SHA механик текширилмайди | `productEvidence {captureBlob, productSourceRevision, reviewedAt, currentStatus}` |
| `content/CONTENT_PLAN.md` | «бир дарс = бир муаммо» бор; 3 graphic beat де-факто такрор | 2/3/4 meaningful actions editorial selection, no filler |
| `.github/workflows/consistency.yml` | Mock/synthetic MP4 бор, реал scenario cue screenshot validator йўқ | `prevoice:visual-intent`, vector snapshots, source-vs-visual QA receipt checks; paid API default CIга қўшилмасин |
| `scripts/promo-plan.mjs` | `checkedAt/supports` ва файл мавжудлиги текширилади, screenshot blob bytes & current product UI pin йўқ | Hashed asset proof + product freshness audit, fail-close publication preview when stale but allow draft repair |
| `scripts/action-text-layout.mjs` | Mixed Chinese + RU/TG caption Pinyin fallback empty | One subtitle with Chinese-only span pinyin validation; don't duplicate text layer |
| `content/visual-system.json` | Explicit baseline policy `maximumVisualHoldSec:6`; semantic invariant йўқ | Вақт чегарасини ўзгартириш шарт эмас; contract version/location қўшиш мумкин, визуал gate code билан боғлансин |
| `AGENTS.md`, `AI_RULES.md`, `PROJECT_MEMORY.md` | Current provider vs old Gemini Direct rules (V1–V4) | provider policy'ни ягона манбага айлантириш; V5 source-proof status added; тарихий лавҳани current deb сақламаслик |
| `content/promos/*.json` | Product receipt SHA қўлбола `supports` ичида; product UI commit эски | Exact code/image revision receipt; янги screenshot нимага мос экани очиқ баён; барча promo'ни автоматик overwrite қилмаслик |

## O.7. Implementation dependency ва acceptance тестлар (V5 қўшимча)

**Gate 0 — ҳозирги ҳолатни музлатиш:** current `main` commit, unchanged screenshot SHA, 7 source lesson RU/TG hashes, 3 promo RU/TG hashes, published/approved ledger; кодга тегмасдан baseline. CI synthetic status'ни production approval билан аралаштирмаслик.

**Gate 1 — биринчи семантик хато тузатилиши:** `haishi...` RU/TG `options-action-3` «both-allowed» invariant'ни сақлаш; `choice` саволдан олдин бир вариантини танлагандай кўрсатмаслик. Source change -> new working review hash; historical approvals unchanged. **Тест:** exact graphic nodes screenshots, field-level negative test.

**Gate 2 — source QA ва ёзувчининг ишлаш тартиби:** script truth source, supported Mandarin, corrected first payoff, `cueText` ambiguity, visualIntent without fake nodes, typed stage reuse. **Тест:** repeated ambiguous cue without occurrence fails before TTS, source fact swapped visual fails semantic QA; user-facing grammar test `多少本书` valid. Аудио йўқ.

**Gate 3 — visual prototype ва actual proof:** 1080×1920 / 270×480 static still/contact sheet; `haishi`, `ji`, `bi`, `hui`, `zhuozi`, `known-book` visual contract test. **Тест:** each selected beat stage recognisable without reading an irrelevant extra title, no invisible subject, no clip/overlap, sane graphic transition.

**Gate 4 — source graphic registry (қўшимча, кичик миграция):** 29 duplicate vectors reusable, but no broad refactor until p0/1 quality solved. **Тест:** old and new compositor snapshots same pixels for same art + same data; reference IDs pin exact content, approvals immutable.

**Gate 5 — genuine product promo:** screenshot SHA `81f7be1...` matches receipt; UI current `course-v3.html` commit changed; manual product feature recertification; exact png crop preview; trust text-free `zxx` only after visual review. **Тест:** out-of-bounds crop negative, mic readability at mobile, Russian text not mixed with Tajik UI, no invented tap/reply.

**Gate 6 — captions/voice/cue/live-render:** verify one-take vs scene per language; STT fail must not cause new TTS; mixed Chinese RU/TG captions pinyin inline; actual audio-anchored cue on frame. **Тест:** `"他比我高"` + RU/TG narration; open source voice profiling. Correct timing not guessed.

**Gate 7 — release:** complete real RU/TG MP4 package, sample with audio and captions, current platform-specific CTA and owner preview. **Тест:** `review-pending` ≠ published; no automatic post; exact video SHA + account + status after Zernio readback.

## O.8. Якунланган номаълумлар ва ҳали ёпилмаган чекловлар

| Савол | V5 қарори | Нима қолди? |
|---|---|---|
| `hui`да бассейн ёпиқлик белгиси йўқми? | **Source'да аниқ бор.** | Phone-size readability |
| `bi`да баландлик/ҳаво қиёси чизилмаганми? | **Source'да аниқ бор.** | Real render image |
| `ji`да нарх объекти йўқми? | **Price tag'га мўлжалланган node'лар бор.** | Icon recognition |
| `haishi`да икки вариант ҳам мумкинлиги кейинги beat'да сақланадими? | **Йўқ, иккинчи tick node йўқолади; RU ва TG'да такрорланади.** | Real visual таъсири ва кодда тузатиш |
| Ҳар beat учун алоҳида янги vector керакми? | **Йўқ, 199 beat учун 29 raw unique graph.** | Маъновий reuse safety |
| RU/TG visual режалар мутлақо алоҳидами? | **32/33 pair'да айнан бир хил artwork.** | Cue/timing ва бир locale'га хос narrative |
| Promo crop чегарадан чиқяптими? | **12/12 declared dimensions ичида.** | PNG'нинг ҳақиқий пиксели/мобил readability |
| Promo screenshot GitHub asset ичида ўзгартирилганми? | **Йўқ, blob SHA `81f7be1...` receipt билан мос.** | Жорий маҳсулот UI'га мослиги |
| Promo product UI далили жорийми? | **Шубҳали/эски:** actual `course-v3.html` blob `bc60...` → `ba150...`. | Current voice UI/screen recertification |
| `FrameIntent` production code борми? | **Йўқ, V4/V5 — таклиф.** | Owner-authorized implementation + tests |
| Хамма actual phone MP4 кадри кўрилдими? | **Йўқ.** Code+SVG data audit real pixels/audition'нинг ўрнини босмайди | Real artifact preview / owner audio review |

**Шуни «100% production audit complete» деб белгилаш мумкин эмас.** Мазмун ва визуалнинг техник асоси яхшилаб таснифланди, аммо GitHub binary image adapter мавжуд эмаслиги сабаб реал screenshot/crop визуал мазмуни ва эпизодлар MP4 playback'и ҳали очиқ. Булар учун унинг ўзига тегишли media artifact'ни олиш керак; `main`га код ўзгартириш зарур эмас, production review GitHub Action/artifact йўли билан ҳам бажарилиши мумкин.

## O.9. Далилни такрорлаш учун source манзиллар

- [Қолип ва энг охирги чизма — `haishi-vs-huozhe` RU](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/episodes/haishi-vs-huozhe-tea-20261102.json) · [TG](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/locales/tg/episodes/haishi-vs-huozhe-tea-20261102.json)
- [Стол/китоб `有`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/episodes/zhuozi-you-book-20261031.json) · [Стол/китоб `在`](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/episodes/known-book-zai-20261101.json)
- [Бассейн](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/episodes/hui-vs-neng-pool-20261028.json) · [Баландлик/об-ҳаво](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/episodes/bi-comparison-height-20261104.json) · [Нарх ва китоб](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/episodes/ji-vs-duoshao-books-price-20261106.json)
- [Маъновий хилма-хиллик validator'и](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-design-plan.mjs#L64-L114) · [SVG validator](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-scene.mjs#L16-L103) · [Actual SVG rendering](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/GraphicScene.tsx#L9-L24)
- [Action subtitle/pinyin gating](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/action-text-layout.mjs#L13-L30) · [CaptionOverlay](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/CaptionOverlay.tsx#L60-L170)
- [Промо source validator](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/promo-plan.mjs#L71-L163) · [Реклама суратлари ва receipt](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/content/promos/shop-shirt-size-20261105.json) · [Crop renderer](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/src/PromoScene.tsx#L15-L26)
- [Product code snapshot, жорий `course-v3.html`](https://github.com/akbarholturaev11-lang/HSK-AI-Bot/blob/2d629dd99ca892951fe9671874d6cd83b8d386c7/app/static/course-v3.html) · [Source compare](https://github.com/akbarholturaev11-lang/HSK-AI-Bot/compare/12480fbb1131a0810ed3464ce23c969ac50bf477...2d629dd99ca892951fe9671874d6cd83b8d386c7)
- [Synthetic semantic CI](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/.github/workflows/consistency.yml#L1-L100) · [Real audio required для fragment QA](https://github.com/akbarholturaev11-lang/Kantent/blob/6b8e66e39e828166333a904113877426b91afae5/hsk-tu-vous/scripts/graphic-voice-proof.mjs#L1-L110)
- Chinese grammar verification: [HSK Companion 几/多少](https://hskcompanion.org/grammar/question-ji-duoshao/) · [HanziStack 几/多少](https://char.hanzistack.com/grammar/ji-duoshao-asking-quantities) · [Mango Languages 还是/或者](https://www.mangolanguages.com/resources/learn/grammar/mandarin-chinese/how-to-distinguish-the-conjunctions-haishi-and-huozhe-in-mandarin)

**V5 якуний чегара:** V1–V4 аниқ ва ноаниқ нуқталари устидан баъзи масалалар **асосли ёпилди** (`hui` gate, `bi` compare, `ji` price tag, crop bounds, screenshot blob); бошқалар **аниқ хато/чеклов** сифатида чиқди (`haishi` semantic regression, 29 SVG/199 beats, mixed-caption pinyin conditional, product UI provenance drift). Долзарб таълим маъноси ва жорий UI учун **инсон кўриши/эшитиши + actual media** барибир охирги gate бўлади.
