# CTA laboratoriyasi

## Doimiy CTA yo‘li

Ruscha asosiy matn:

> Попробуй HSK AI. Зайди в профиль, открой ссылку и скачай приложение с сайта.

Tomoshabinning yo‘li bitta va ketma-ket: HSK AI’ni sinab ko‘rish → Instagram profiliga kirish → profildagi havolani ochish → saytdan ilovani yuklab olish. Izohga kalit so‘z yozish, Direct yoki boshqa qo‘shimcha harakatni so‘ramang. Sayt yoki ilova holatini tekshirilgan deb ko‘rsatmang; CTA matni egasi tanlagan yo‘riqdir.

Ovoz bilan bir vaqtda uchta egasi yuborgan skrinshotni ko‘rsating: “профиль” deyilganda Instagram profili va havola qatori; “ссылку” deyilganda Instagram havolalar oynasi va HSK AI havolasi; “скачай” deyilganda yuklab olish sayti va yuklab olish tugmasi. Butun skrinshot markaziy sahnada o‘qiladigan bo‘lsin, kerakli joyni esa aniq halqa/yumshoq puls bilan belgilang. Kadrni ovozga moslang; haqiqiy bosish yoki yuklab olish yakunlandi degan taassurot bermang.

Bu matn va so‘zlarga bog‘langan CTA UI ketma-ketligi butun seriya uchun doimiy standart. Har videoda aynan shu ruscha nusxa va amallar ishlatiladi. CTA o‘zgarishi, boshqa UI ketma-ketligi yoki montaj varianti faqat egasi aniq so‘raganda kiritiladi. Ko‘rsatkichlar hisobot va tahlil uchun; ular CTA’ni avtomatik o‘zgartirmaydi. Egasi o‘zgartirish so‘rasa, yangi qoida barcha keyingi sanalarda amal qiladi, eskisi esa tarixda saqlanadi.

## Har yangi chat va CTA tahriridan oldin

1. Ushbu fayl va `content/cta-lab.json`ni o‘qing. `get_cta_learning_status` orqali amaldagi qoidalar versiyasi va tuzatishlarni oling.
2. `corrections` ichidagi barcha faol umumiy, epizodga yoki formatga tegishli qoidalarni o‘qing. Har qoida original `ownerWording`, aniq `rule`, doira (`scope`), ID va versiyani saqlaydi.
3. CTA matni, ovoz, UI amali va vaqtlarini bitta reja sifatida yozing. “Зайди” cue’da profil, “Открой” cue’da havolalar oynasi, “скачай” cue’da sayt ko‘rinsin; tegishli qator yoki tugmani belgilang.
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
- Har post uchun 24 soat va 7 kun oynasini saqlang. Taqqoslashda platforma, oyna, taklif, metrika ta’rifi, mavzu, HSK darajasi, 25–29/30–35 soniya oralig‘i, hook formati, ovoz profili va oldindan belgilangan tajriba guruhi mos bo‘lsin. Har CTA ro‘yxati aynan o‘sha video ssenariysi, hooki, ovozi va CTA joylashuviga bog‘lanadi; keyin ular o‘zgarsa yangi versiya talab qilinadi. Bir xil mavzudagi turli postlarda aynan bir xil matn bo‘lishi shart emas.
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
