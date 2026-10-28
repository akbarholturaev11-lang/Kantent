# CTA laboratoriyasi

## Markaziy CTA manbasi va platforma variantlari

**CTA матни қўлда ҳар бир сценарийга такрор ёзилмайди.** Фақат `content/cta-lab.json` файлда битта CTA registry бор:

- `offer.canonicalRussian` — эгаси тасдиқлаган CTA матнининг ягона таҳрирланадиган манбаси; ҳозирги матн Instagram’даги мавжуд CTA’дан олинган.
- `platformVariants.instagram` — шу матнга `copySource: "offer"` орқали ҳавола қилади; **иккинчи Instagram CTA матни сақланмайди**.
- Russian `platformVariants.tiktok` — профильга кириш, `HSK` деб шахсий хабар ёзиш ва ҳаволани эга қўлда юборишни таклиф қилади. Tajik `content/locales/tg/cta-lab.json#platformVariants.tiktok` шу йўналишнинг алоҳида тоҷикча локализациясидир. Иккаласида ҳам cue’ларга мос кинетик типографика қўлланади; DM интерфейси ёки юборилган хабар саҳналаштирилмайди, автоматик DM йўқ. TikTok нашри фақат `content/publication-destinations.json`даги тилга мос аккаунт, тайёр тил CTA’си ва аниқ preview тасдиғи билан рухсат этилган.
- `platformVariants.youtube` — `copySource: "offer"` орқали айнан шу CTA матнини ишлатади. Саҳна Instagram шаблонидан олинган; фақат эгаси юборган профиль ва браузер танлови кадрлари билан профил/ҳавола скриншотлари алмаштирилган. Қолган саҳна, cue ва матн ўзгармайди. YouTube Shorts Zernio орқали нашр қилиш учун тасдиқланган; мақсад ҳаволаси ҳали мустақил текширилмаган. Оддий render оқими YouTube охирини ҳам автоматик тайёр экспортга улайди.

**Платформага мос видео:** Instagram ва YouTube бир хил CTA матни ва овозни ишлатади; YouTube охирида эгаси берган профиль ва ҳавола скриншотлари алмашади. TikTok матни бошқача бўлгани учун унинг CTA овози ва word-level cue’лари алоҳида яратилади. TikTok’нинг локал preview’и `review/<id>/tiktok/` папкасида сақланади; CTA’да скриншот, тақлид қилинган DM интерфейси ёки юборилган хабар тасвири бўлмайди. Ҳар бир CTA ўзининг версия регистрациясига эга; матн ўзгарса мос овоз/cue ҳам қайта тайёрланади. TikTok аккаунтлари owner-authorized, аммо фақат destination registry’даги тил/account мослиги, тайёр CTA ва аниқ final preview тасдиғидан кейин нашр қилинади.

**Автоматик экспорт:** оддий make/render/MCP тайёрлаш оқими иккала якунги файлни чиқаради. Асосий дарс кадрлари бир марта рендер қилинади; Instagram ва YouTube CTA охирлари алоҳида уланади. Битта узлуксиз овоз/SFX микси иккаласида ишлатилади. YouTube пакети `review/<id>/youtube/`да, Instagram пакети аввалги review папкасида сақланади. `status.platformPackages` ҳар платформанинг аниқ видео файли, hash ва CTA версиясини кўрсатади. Оқим янги қоида тасдиғини тахмин қилмайди: база регистрациясидаги амалдаги, аниқ тан олинган тузатишларгина YouTube baseline регистрациясига ўтади. Аниқ мос эски регистрация қайта ишлатилади; бошқа ҳолда янги ўзгармас версия қўшилади.

**Instagram amaldagi ro‘yxatga olingan CTA:** viewer → Instagram profile → profile link → download HSK AI → learn Chinese every day. “Зайди” cue’da egasi bergan profil skrinshoti, “Открой” cue’da havolalar skrinshoti ko‘rsatiladi. Sayt skrinshoti va “с сайта” iborasi olib tashlangan. “Скачай”da HSK AI yuklab olish kartasi, “учи”da “КИТАЙСКИЙ КАЖДЫЙ ДЕНЬ” yakuniy brend kartasi chiqadi. Bu sahnalashtirilgan ko‘rsatma; real bosish yoki yuklab olish tugaganini bildirmaydi.

**TikTok DM билан адашмаслик:** тилга мос `platformVariants.tiktok` матни эга ҳаволани қўлда жўнатишини айтади; бу автоматик жавоб эмас. Видео ҳақиқий хабар юборилганини ёки ҳавола ишлашини кўрсатмайди. Скриншотлар ўрнига cue’га мос типографик эффектлар ишлатинг; “хабар юборилди” ёки “юклаб олинди” деган далилни саҳналаштирманг. YouTube’даги ҳавола скриншоти ва ҳаволанинг ҳақиқий манзили мустақил текширилмаган; уларни текширилган ишлайдиган ҳавола деб айтманг.

**Янги сценарийларда CTA қандай сақланади?** 2026-10-09 ва кейинги режалаштирилган `content/episodes/*.json` файлида **CTA матни, CTA саҳнаси ва `ctaExperiment` бўлмайди**. `scripts/episode-cta-assembly.mjs` сўралган платформа CTA’сини ўша умумий дарсга бириктиради. Instagram ва YouTube `offer.canonicalRussian`дан фойдаланади; YouTube’да охирги CTA саҳнасининг фақат икки профил/ҳавола кадри алмашади. CTA матни ўзгармаган бўлса, асосий овоз ва word-level субтитрлар сақланади; якунги CTA экспорт қайта йиғилади. YouTube экспорти оддий renderer орқали ўз review package’ига автоматик чиқади; ҳар нашр preview’си ўз платформасининг аниқ файлига боғланади.

**Нима учун ишчи нусхада CTA учрайди?** `review/<id>/episode.json` — рендер, овоз, вақтлар ва версияланган CTA экспериментларига боғланган **тайёрлаш snapshot’и**, таҳрирланадиган иккинчи қоида эмас. CTA Lab’даги аввалги эксперимент билан ишчи нусха тўлиқ мос бўлса, эски регистрация ўзгартирилмасдан уланади; мос бўлмаса янги версияни рўйхатдан ўтказиш шарт. CTA марказда янгиланса, аввал тасдиқланган ёки нашр қилинган snapshot’лар ўзгармайди. 2026-10-08 гача бўлган сценарийлар тарихий версия сифатида сақланади; календар CTA матнини сақламайди.

**Хавфсизлик:** `get_platform_cta_status` орқали ҳар вариант тайёрлигини текширинг. YouTube’нинг Instagram offer’ини ишлатиши ва икки CTA кадрини алмаштириши эгасининг аниқ кўрсатмаси билан тасдиқланган; янги платформа матнини жимгина кўчирманг. Сохта авто-DM ёки ҳавола имкониятини тасвирламанг. YouTube’да ҳар бир видео учун title, visibility, audience ва synthetic-media disclosure аниқ preview’да кўрсатилади. Ҳар бир аниқ final preview учун нашрдан олдин эгасининг тасдиғи талаб қилинади.

## Har yangi chat va CTA tahriridan oldin

1. Ushbu fayl va `content/cta-lab.json`ni o‘qing. `get_cta_learning_status` orqali amaldagi qoidalar versiyasi va tuzatishlarni oling.
2. `corrections` ichidagi barcha faol umumiy, epizodga yoki formatga tegishli qoidalarni o‘qing. Har qoida original `ownerWording`, aniq `rule`, doira (`scope`), ID va versiyani saqlaydi.
3. CTA matni, ovoz, UI amali va vaqtlarini bitta reja sifatida yozing. “Зайди” cue’da profil, “Открой” cue’da havolalar oynasi ko‘rinsin; “скачай”da HSK AI brendli yuklab olish kartasi, “учи”da kundalik o‘rganish yakuniy kartasi chiqsin. Sayt skrinshoti ishlatilmaydi.
4. Matnni tekshirib, yangi CTA versiyasini ro‘yxatdan o‘tkazing. `acknowledgedCorrectionIds` ichiga o‘qilgan faol tuzatishlarning aniq IDlarini kiriting. Bu maydonni ko‘r-ko‘rona to‘ldirish tahririy tekshiruv hisoblanmaydi.
5. Narratsiya o‘zgarsa oldingi MP3, VTT/SRT, render va tasdiq yaroqsiz. Shu matnga mos yangi ovoz va so‘zma-so‘z vaqtlar kerak. Faqat yangi CTA yozib eski ovoz bilan paketni “tayyor” demang.

Har sana uchun versiya ro‘yxatga olinishi CTA varianti sinovdan o‘tkazilyapti degani emas. Yozuv ayni doimiy CTA nusxasi, vizual ketma-ketligi va shu dars bilan bog‘lanishini saqlaydi. Egasi o‘zgarish so‘ramaguncha barcha roliklar bir xil standartdan foydalanadi.

## Egasi tuzatish berganda

Masalan, bir hafta ichida beshta tuzatish bo‘lsa, beshalasi ham doimiy xotiraga tushadi. Keyingi chat ularni shu laboratoriyadan o‘qiydi.

- `record_cta_correction` yangi yozuv qo‘shadi: original gapni o‘zgartirmasdan `ownerWording`, bajariladigan qoida `rule`, qo‘llanish doirasi `scope`.
- Tuzatish darhol egasining majburiy qoidasi bo‘ladi. Bu statistik yutuq degani emas.
- Bir qoidaning o‘rniga boshqa qoida kelsa `supersedes`ga oldingi ID yoziladi; eski yozuv o‘chmaydi. Faqat bir xil doiradagi faol qoidani almashtirish mumkin.
- Egasi o‘zgartirishni so‘ramasa, CTA matni va montaj ketma-ketligini tajriba variantlariga ajratmang. Egasi yangi qoida bersa, uni kelgusi sanalarning barchasiga qo‘llang va bir xil doiradagi eski qoidani `supersedes` bilan almashtiring.
- Yangi qoida butun qoidalar versiyasini oshiradi. Amaldagi CTA yangi versiyani tan olmasa tayyorlash/render tekshiruvi to‘xtaydi. Oldingi nashr qilingan CTA va uning statistikasi eski versiyasida qoladi.
- Ovoz, markaziy fokus, subtitr yoki dizayn bo‘yicha yangi tuzatish prose ko‘rinishida saqlanadi. Matn tekshiruvchisi bunday vizual talabni to‘liq tekshira olmaydi: agent haqiqiy kadrlarni ko‘rib chiqadi.

## Versiya va tarix

`experiments` — nashrdan oldingi o‘zgarmas registr. Har yozuv: epizod, CTA nusxasi, ssenariy va vizual beatlar hashi, qoida versiyasi, tan olingan tuzatishlar, taklif IDsi, taxmin, o‘zgartirilayotgan bitta element va ro‘yxatga olingan vaqt. CTA matni yoki vizual rejasi o‘zgarsa yangi ID kerak. Eski CTA nomini yangi matnga ko‘chirib qo‘ymang.

`readbacks` — platformadan egasi kiritgan o‘lchovlar. Har o‘lchov o‘sha payt nashr qilingan aniq registr versiyasining nusxasiga biriktiriladi. Epizod keyin tahrirlangan bo‘lsa ham eski ko‘rsatkichlar eski matnga tegishli qoladi. Xato son tuzatilsa oldingi o‘lchov `supersedes` bilan yangi o‘lchovga almashtiriladi; tarix saqlanadi. Bitta platformadagi bitta postga boshqa CTA versiyasi bog‘lab bo‘lmaydi.

Yozish atomar, registrlar faqat kengaytiriladi. Bir vaqtda ikki chat yozsa eskirgan `revision` bilan yozish rad etiladi; yangi holatni o‘qib qayta qo‘shish kerak. Ishlayotgan yozuvning `.lock` faylini o‘chirmang.

## Ko‘rsatkichlar va yaxshilanish

Asosiy ko‘rsatkich: **profil havolasini ochgan noyob tomoshabinlar / ko‘rishlar × 1000**. Bu link bosish ko‘rsatkichi; sayt yuklab olishlarini alohida qayd eting. Oldingi HSK izoh/DM o‘lchovlari o‘z CTA versiyasiga biriktirilgan tarixiy ma’lumot bo‘lib qoladi.

- `views` va aniq platforma metrika ta’rifi yoziladi. `profileLinkClickers: 0` — tekshirilgan nol; `null` yoki berilmagan qiymat — ma’lumot yo‘q. Ko‘rishlar nol bo‘lsa nisbat `null`.
- `linkClicks` va `downloads` faqat egasi berganda qayd etiladi. Yuklab olish sonini havola bosishdan taxmin qilmang.
- Taqqoslashda mavjud qo‘shimcha `downloads` ko‘rsatkichi variantlar orasida 10% dan ko‘p tushsa, asosiy havola ko‘rsatkichi oshgan bo‘lsa ham `keep-testing` saqlanadi. Berilmagan ko‘rsatkich `unknown` bo‘lib qoladi.
- Har post uchun 24 soat va 7 kun oynasini saqlang. Taqqoslashda platforma, oyna, taklif, metrika ta’rifi, mavzu, HSK darajasi, davomiylik guruhi (`under-25s`, `25-29s`, `30-35s` yoki `over-35s`), hook formati, ovoz profili va oldindan belgilangan tajriba guruhi mos bo‘lsin. Davomiylik guruhlari faqat tahlil uchun; video uzunligiga yuqori limit qo‘ymaydi. Har CTA ro‘yxati aynan o‘sha video ssenariysi, hooki, ovozi va CTA joylashuviga bog‘lanadi; keyin ular o‘zgarsa yangi versiya talab qilinadi. Bir xil mavzudagi turli postlarda aynan bir xil matn bo‘lishi shart emas.
- Bir tajribada CTA so‘zlari **yoki** vizuali **yoki** joylashuvini o‘zgartiring. Mavzu va auditoriya farqi baribir natijaga ta’sir qilishi mumkin. Hook, ovoz va CTA birga o‘zgargan videoni bitta CTA o‘zgarishining isboti deb ko‘rsatmang.
- Boshlang‘ich ish chegarasi: har variantga kamida 3 ta mos post, har postga kamida 500 ko‘rish va median asosiy ko‘rsatkichda kamida 10% o‘sish. Bular statistik isbot emas; dastlabki ehtiyotkor ish qoidalari.
- Tizim faqat `eligible-for-owner-review` nomzodini ko‘rsatadi. `promote_cta_pattern` uchun mos dalil va egasining aniq qarori zarur. Ma’lumot kelmaganida holat `unmeasured`, yetmaganda `keep-testing`.

## Modul interfeysi

`scripts/cta-lab.mjs` tashqi API yoki hisob talab qilmaydi:

- `readCtaLab()` va `writeCtaLab(lab)` — doimiy xotira; yozish yangilangan revisionli obyekt qaytaradi.
- `createCtaCorrection({lab, ownerWording, rule, scope, supersedes})` — `lab.corrections`ga qo‘shiladigan yangi o‘zgarmas yozuv.
- `createCtaExperiment({lab, episode, id, formatId, hypothesis, changedVariable, comparisonGroupId, registeredAt, acknowledgedCorrectionIds, supersedes})` — `lab.experiments` yozuvi. `changedVariable`: `baseline`, `wording`, `visual`, `placement`. `ctaExperimentMetadata(record)` epizodda saqlanadigan qismini beradi.
- `validateCtaEpisode(episode, lab)` — qoida versiyasi, matn, kutilgan skrinshot manbalari va so‘z cue’lari, faol tuzatishlar hamda o‘zgarmas registr nusxasini tekshiradi. Haqiqiy kadrdagi halqa joylashuvi va o‘qiluvchanlikni renderdan keyin ko‘zdan kechiring.
- `createCtaReadback({lab, experimentId, platform, window, postReference, publishedAt, capturedAt, views, profileLinkClickers, videoDurationSeconds, metricDefinition, linkClicks, downloads, supersedes})` — `lab.readbacks` yozuvi. Eski nashrlar `hskCommenters` o‘lchovini tarixiy formatda saqlaydi. `postReference` egasi bergan mahalliy nom/ID bo‘lishi mumkin; shaxsiy havola yoki login kerak emas.
- `summarizeCtaLab(lab)` — faol qoidalar, holat va ehtiyotkor taqqoslashlar.
- `createCtaPromotion({lab, candidateFormatId, changedVariable, evidenceReadbackIds, ownerWording, ownerConfirmed:true})` — faqat dalil yetarli va egasi tanlaganda `lab.promotions` yozuvi.

Funksiyalar yozuv yaratadi, keyin chaqiruvchi uni tegishli massivga qo‘shib `writeCtaLab` bilan saqlaydi. Hech biri post yoki DM yubormaydi.
