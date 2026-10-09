# HSK AI: 16 subagent muhokamasi va yakuniy tahlil

Sana: 2026-10-09, Asia/Shanghai.

Bu 16 ta alohida AI subagentning loyiha kodi, mavjud ma’lumotlar va rasmiy hujjatlar asosidagi tekshiruvi. Rollar inson mutaxassisining sertifikati yoki real auditoriya tajribasi degani emas. Bu safar kod yoki ishlayotgan avtomatika o‘zgartirilmadi: kamchiliklar uchun yechimlar va takomillashtirilgan dizayn ishlab chiqildi.

## Asosiy xulosa

G‘oya amalga oshadi: ChatGPT bulut vazifasi natijalarni tekshirishi, keyingi to‘rtta senariyni tayyorlab turishi va GitHub orqali kontentni yangilashi mumkin. Buning hisobingizdagi amaliy ishlashi hali desktop yopiq holatdagi sinov bilan tasdiqlanishi kerak. Rasmiy hujjat bulut vazifalari ulangan pluginlardan foydalanishini tasdiqlaydi; bu barcha hisoblarda kerakli yozish ruxsatlari avtomatik borligini bildirmaydi. [OpenAI hujjati](https://learn.chatgpt.com/docs/automations).

Oldingi rejani o‘zgartiradigan eng muhim topilmalar:

- GitHub main himoyasiz: tekshiruvlar avtomatik qabulni majburan to‘smaydi. Agentga keng yozish huquqi berilgan bo‘lsa, faqat “CI’dan keyin merge qil” degan prompt haqiqiy chegarani yaratmaydi.
- Hook hisobida 500 ko‘rishga yetmagan videolar chiqarib tashlanadi. Bu muvaffaqiyatsiz natijalarni yashirishi mumkin.
- GitHub yangilansa ham eski mahalliy senariy ishlatilishi mumkin. Ishlab chiqarish boshlanganini bulut ko‘rmaydi.
- Alohida videoning engagement natijasini kampaniya signup’i bilan sababiy bog‘lab bo‘lmaydi.
- Kelajakdagi darslarda tekshiruv qaydlari bo‘sh. Birida aniq pinyin xatosi mavjud.
- To‘rtta senariy to‘rtta tayyor video emas. Ovoz, timing, render va egasining tasdig‘i hali alohida ish.
- Muntazam tahlilning o‘zi o‘sish emas. Yangi dalil bo‘lmaganda agent kontentni qayta-qayta o‘zgartirmasligi kerak.

## 16 ta mustaqil nuqtayi nazar

Baholar subagentlarning subyektiv dizayn diagnostikasi; ular o‘sish ehtimoli yoki o‘lchangan ROI emas.

| № | Yo‘nalish | Asosiy e’tiroz | Qabul qilingan yechim | Dastlabki baho |
|---|---|---|---|---:|
| 1 | ChatGPT bulut runtime’i | Desktop’dagi pluginlar bulutdagi ruxsatni isbotlamaydi. | Haqiqiy bulut chatida o‘qish, kontent taklifi, tekshiruv va qabul; keyin kompyuter yopiq scheduled sinov. | 43 |
| 2 | GitHub yaxlitligi | Main himoyasiz; PR head tekshiruvi source/base poygasini yopmaydi. | Mustaqil validator, aniq tekshirilgan revision va kutilgan manba commit’iga bog‘langan atomik qabul. | 43 |
| 3 | Uzilishlardan tiklanish | Doim aynan to‘rtta senariy kafolatlanmaydi; yo‘qolgan heartbeat ishlab chiqarish tugaganini anglatmaydi. | To‘rt — muvaffaqiyatli to‘ldirishdan keyingi maqsad; ishlab chiqarish rezervi explicit yakun/bekorgacha saqlanadi. | 44 |
| 4 | Zernio statistikasi | Null, pending, unsupported va nol aralashishi; TikTok lane va lag farqi. | Har akkauntning metrika imkoniyatlari, holatlari, birliklari va provayder vaqtini alohida saqlash. | 53 |
| 5 | Statistik tajriba | 500-view filtri, uch post va takroriy g‘olib tanlash noto‘g‘ri xulosa berishi mumkin. | Barcha belgilangan postlarni saqlash, bitta omil, oldindan belgilangan muddat, uncertainty va takroriy tekshiruv. | 66 |
| 6 | Sababiyat va biznes KPI | Kampaniya signup’i muayyan hook user olib kelganini ko‘rsatmaydi. | Video engagement va kampaniya acquisition uchun alohida tahlil. | 65 |
| 7 | Acquisition yo‘li | UTM Telegram signup’iga yetib bormaydi; native manbalar yo‘qoladi. | Allowlist kampaniya kodi, marketing payload’ini referral’dan ajratish, qolgan manbalarni unknown saqlash. | 64 |
| 8 | DB va tranzaksiya | Referral ichki commit’i acquisition yozuvini userdan ajratib qo‘yishi mumkin. | Manbani yangi user tranzaksiyasida, referral commit’idan oldin saqlash; v1 uchun ikki nullable ustun. | 74 |
| 9 | Xavfsizlik va maxfiylik | Agent o‘z gate’ini chetlab o‘tishi; schema-valid matn/URL ham ishonchli emas. | Cheklangan candidate vositasi, mustaqil validator, ruxsatsiz yozishga yo‘l bermaslik, faqat agregat eksport. | 61 |
| 10 | Hook strategiyasi | Past average watch opening sababini isbotlamaydi; format yorlig‘i ijroni tasdiqlamaydi. | Sababni unknown deb belgilash; birinchi foydali ibora, aniq payoff va opening-only tajriba. | 73 |
| 11 | Mandarin/Russian pedagogika | Real pinyin xatosi CI’dan o‘tishi mumkin; citation borligi claim to‘g‘riligiga teng emas. | Tasdiqlangan dars birliklari; yangi misol/ma’no/qoida va noaniq talaffuz uchun alohida tekshiruv. | 65 |
| 12 | Senariy va brend ovozi | Hook hypothesis, narration va vizual mazmun mos kelmasligi; owner qoidasi yo‘qolishi. | Aniq muammo va javob, sodda ruscha; tasdiqlangan fakt, CTA, ovoz va faol correction versiyalarini saqlash. | 65 |
| 13 | Effekt va mobil aniqlik | JSON’da aytilgan effektlarning hammasi renderer’da ishlamaydi; timing fallback xatoni yashiradi. | Ishlaydigan preset reyestri, cue/asset tekshiruvi, 360×640 preview va haqiqiy eksport inspeksiyasi. | 72 |
| 14 | Ishlab chiqarish va zaxira | Local holat ignored; edit guard yetishmaydi; approval CTA ID bilan saqlansa tarix ustiga yozilishi mumkin. | Umumiy holat reyestri, TTS’dan oldin rezerv, alohida immutable package ID va media hash’iga bog‘langan approval. | 62 |
| 15 | Operatsiya va iqtisod | Ishga tushmagan job o‘z xatosini xabar qilolmaydi; revision’ning TTS/render xarajati noma’lum. | Run ledger, mustaqil watchdog, retry/revision chegarasi va ikki haftalik xarajat/throughput sinovi. | 67 |
| 16 | Dizaynni soddalashtirish va matn aniqligi | Avtonom tizim tekshiruv isbotidan oldin murakkablashmoqda. | Cheklangan gateway, ikki user ustuni, bitta tajriba, ikki haftalik sinov va aniq yoqish mezonlari. | 46 |

## Muhokamadagi qarama-qarshi fikrlar va mening qarorim

**GitHub prompt’i yoki majburiy chegarami?** GitHub, reliability va security subagentlari promptning o‘zi yetmasligini ko‘rsatdi. Tanlov: ChatGPT kontent taklif qiladi; cheklangan server vositasi ruxsat etilgan o‘zgarishlarni mustaqil tekshiradi va qabul qiladi. Scheduled agentda uni chetlab o‘tib main’ga yozish imkoniyati qolmasligi kerak. Tekshiruvchi kodi candidate’dan olinmaydi. Rezerv va qabul bir xil manba revision’i bo‘yicha ketma-ketlashtiriladi. [GitHub branch protection hujjati](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

**Acquisition jadvalimi yoki user ustunlarimi?** Dastlab alohida jadval taklif qilingan edi. DB mutaxassisi v1’da bitta qayd etilgan manba uchun userga nullable platform/campaign ustunlari yetishini ko‘rsatdi. Men shu sodda variantni tanlayman. Ko‘p touch tarixi kerak bo‘lsa, keyin alohida jadval ko‘rib chiqiladi.

**Olti postmi yoki o‘n sakkiz postmi?** Hook mutaxassisi olti postli dastlabki saralashni, statistik mutaxassis olti haftalik 18 postli blokni taklif qildi. Qaror: olti post — yo‘nalish beradigan sinov; keng qoidani avtomatik almashtirish uchun yetarli deb hisoblanmaydi. Keyingi blokda tekshirish va uncertainty zarur. Organik tarqatishda 18 post ham sababiyat kafolati emas.

**Har tekshiruvda senariy yangilansinmi?** Operatsiya mutaxassisi bunga qarshi chiqdi: yangi dalil kelmasdan rewrite qilish faqat ishni ko‘paytiradi. Qaror: har kuni data/health/zaxira tekshiriladi; ijodiy o‘zgarish faqat yangi mos dalil yoki aniqlangan tahririy/fakt xatosi bo‘lganda qilinadi.

**Unknown manba hamma tajribani to‘xtatadimi?** Oxirgi subagent bu haddan tashqari qoida bo‘lishini tuzatdi. Kutilgan anonymous native unknown engagement tajribasini to‘xtatmaydi. U acquisition haqida qat’iy xulosa qilishni cheklaydi. Unknown ulushi kutilmaganda oshsa, tracking tekshiriladi.

**Senariy zaxirasi yoki tayyor video zaxirasimi?** Qaror: ikkisi alohida ko‘rsatkich. Agent keyingi to‘rtta tekshirilgan, ishlab chiqarish boshlanmagan matnni ushlab turadi. Audio/render/preview-ready paketlar soni alohida ko‘rsatiladi.

## Koddan topilgan aniq kamchiliklar

1. [Hook hisoblash](/Users/kaijimima1234/Documents/ChatGPT/HSK%20AI%20Kantent/hsk-tu-vous/scripts/hook-lab.mjs:224) minimum ko‘rishdan past postlarni cohort’dan chiqaradi. Ularni yashirish o‘rniga saqlab, ma’lumot aniqligi cheklanganini ko‘rsatish kerak. Shu modul duration’ni scene rejasidan oladi; tezlashtirilgan 22 soniyalik eksport nominal 33 soniya bilan baholanmasligi kerak.
2. [Senariy loader’i](/Users/kaijimima1234/Documents/ChatGPT/HSK%20AI%20Kantent/hsk-tu-vous/scripts/lib.mjs:212) mavjud review nusxasini source hash’ini solishtirmay qaytaradi. Boshlanmagan eskirgan nusxa yangilanadi; boshlangan paket esa rezervdagi versiyada qoladi.
3. [le-first-look darsi](/Users/kaijimima1234/Documents/ChatGPT/HSK%20AI%20Kantent/hsk-tu-vous/content/episodes/le-first-look.json:91) bir nechta joyda bú mǎi deb yozilgan. Bu kontekstda bù mǎi kerak: mǎi uchinchi ton, 不 ikkinchi tonga to‘rtinchi ton oldidan o‘tadi. [Xitoy Ta’lim vazirligi](https://www.moe.gov.cn/moe_879/moe_1252/s8447/201412/t20141204_179444.html), [CUHK fonetika materiali](https://www.ilc.cuhk.edu.hk/chinese/re_PTHforForeigners_Phonetics3.html).
4. Bir nechta kelajak senariyda learningFactSources bo‘sh. Bularni til tekshiruvi yakunlangan kontent deb hisoblab bo‘lmaydi.
5. JSON’da pulse mavjudligi renderer’da alohida pulse ijrosi borligini isbotlamaydi. Bitta maxsus vizual uslub episode ID’ga bog‘langan. “Effektni yaxshilash” avval mavjud, tekshirilgan presetlar bilan chegaralanadi.

Bu kamchiliklar ushbu muhokamada kodga tuzatish sifatida qo‘llanmagan. Yuqoridagi yechimlar keyingi implementatsiya uchun taklifdir.

## Takomillashtirilgan birinchi versiya

1. **Remote ishlashni isbotlash.** Haqiqiy ChatGPT cloud chatida Zernio, GitHub manbalari va yangi cheklangan vositalarni sinash. Desktop executor’dan foydalanmagan holda scheduled ishni tekshirish.
2. **Umumiy holat.** GitHub’da senariy manbasi, production rezervi, package versiyasi, post ID’lari va natija kuzatuvlari saqlanadi. Audio/video mahalliy yoki mavjud private artifact joyida bo‘lishi mumkin; credential saqlanmaydi.
3. **Ma’lumotni tozalash.** Har post/platform/account uchun real observation time, provider cutoff mavjud bo‘lsa uning vaqti, actual export duration, metric birligi va measured/pending/unsupported/stale/error holati. Cumulative sonlar qo‘shib yuborilmaydi. Zernio endpoint’i pagination hamda pending/failed javoblarini ajratadi. [Zernio API](https://docs.zernio.com/analytics/get-analytics).
4. **Ikki tahlil.** Video engagement uchun hook/taqdimot gipotezalari; platforma/kampaniya uchun yangi akkauntlar va unknown ulushi. Signup asosiy KPI; onboarding yoki dars yakuni qo‘shimcha sifat belgisi. Muayyan video sabab bo‘lgan degan da’vo qilinmaydi.
5. **Bitta ijodiy omil.** Dastlab tasdiqlangan dars faktlari saqlanib, opening wording o‘zgaradi. Keyin mavjud visual preset yoki davomiylik alohida tajribada. CTA, ovoz va egasining faol qoidalari saqlanadi.
6. **Zaxira.** Haftasiga uchta video; muvaffaqiyatli maintenance’dan keyin keyingi to‘rtta eligible senariy. Ikki yoki kam qolsa to‘ldirish. Ishlab chiqarishdan oldin yangi revision/zaxira tekshiruvi. Rezervdan keyin avtomatik creative edit yo‘q.
7. **Avtomatik qabul.** Agent bounded candidate beradi. Trusted gate ruxsat etilgan fields, dars faktlari, preset va owner-policy versiyasini tekshiradi. Source o‘zgarsa qayta tekshiradi; partial yoki stale qabul bo‘lmaydi.
8. **User manbasi.** Mavjud Telegram entry yo‘llarida allowlist marketing kampaniya kodi. Faqat yangi account tranzaksiyasida bir marta saqlash, referral’dan ajratish, backfill qilmaslik. Remote aggregate vositasi shaxsiy yozuvlarni qaytarmaydi.
9. **Sog‘liq va xarajat.** Last start/success, data freshness, pending candidate, eligible scripts, production-ready paketlar va navbatdagi uncovered slot. Scheduled ish umuman boshlanmaganini mustaqil watchdog bildiradi. Retry va revision soni cheklangan.
10. **Ovoz/render/nashr.** Hozirgi renderer va tasdiqlangan ovoz jarayoni saqlanadi. Ishlab chiqarish va nashr egasining final preview tasdig‘i bilan davom etadi.

## Yoqish mezonlari va sinov

Dastlab ikki haftalik kuzatuv sinovi: u taxminan olti nashrning operatsion jarayonini tekshiradi; o‘sishni isbotlamaydi.

Avtomatik qabuldan oldin:

- Kamida uchta ketma-ket scheduled cloud run kompyuter yopiq paytda muvaffaqiyatli ishlaydi.
- Ishga tushirishdan keyin 48 soat ichida birinchi muvaffaqiyat bo‘lmasa commissioning xatosi ko‘rsatiladi.
- Bir senariyga parallel rezerv/edit sinovida faqat to‘g‘ri revision qabul qilinadi; ishlab chiqarishdagi paket o‘zgarmaydi.
- Snapshot, signup va candidate retry hisob yoki epizodni takrorlamaydi.
- Media almashtirilsa eski approval yaroqsiz bo‘ladi, ammo uning tarixiy qaydi yo‘qolmaydi.
- Invalid marketing code, oddiy referral, Android linking, eski user login’i va yangi user tranzaksiyasi regressiya sinovidan o‘tadi.
- Missing/pending TikTok, provider lag, milliseconds/seconds va past-view postlar noto‘g‘ri winner yaratmaydi.
- Til xatosi, ruxsatsiz CTA/policy/workflow edit va tasdiqlanmagan preset qabul qilinmaydi.
- Bir eksperiment blokida har unstarted script uchun ko‘pi bilan bitta accepted creative revision; rezervdan keyin nol.
- Egasi avtomatik rejimdan oldin pul/xarajat chegarasini belgilaydi. Pilot TTS/render urinishlari, egasining vaqti va bitta approved export xarajatini o‘lchaydi.

Agar engagement oshib signup o‘zgarmasa, agent acquisition g‘olibini e’lon qilmaydi. U tracking yoki funnel haqidagi gipotezani dalili bilan beradi. Tasdiqlangan CTA’ni o‘zi almashtirmaydi.

## Baholashning uch bosqichi

- Birinchi bosqich: 16 mustaqil review. Humanizer roliga 1.5 vazn qo‘llangan umumiy diagnostik baho **59.8/100**.
- Ikkinchi bosqich: umumlashtirilgan dizaynni oxirgi systems reviewer qayta baholadi: **70/100**.
- Uchinchi bosqich: gateway, tranzaksiya, commissioning, revision chegaralari va qaror qoidalari aniqlashtirilgach o‘sha reviewer bahosi **74/100**.

Ikkinchi/uchinchi bosqich butun panelning takroriy ovozi emas. Baholar real pilot o‘rnini bosa olmaydi. 90 ga sun’iy oshirilmadi: bulut ishlashi, race/approval sinovlari va xarajat chegarasi hali amalda tasdiqlanmagan.

Eng mos yo‘l: avval o‘lchov va ishlab chiqarish holatini to‘g‘ri qilish, keyin bitta cheklangan tajribani avtomatlashtirish. 16 ta agent bu safar review uchun ishladi; kundalik tizimga 16 ta agent kerak emas.
