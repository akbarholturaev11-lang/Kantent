---
format: 1080x1920
duration: 60s
message: "HSK AI’da o‘rganilgan so‘zlarni AI Voice suhbatida ishlatib mashq qilish mumkin."
arc: "Qiyinchilik → HSK AI → haqiqiy AI Voice namoyishi → yordam va tuzatishlar → CTA"
audience: "Xitoy tilini o‘rganayotgan rus tilida so‘zlashuvchi boshlovchilar"
mode: collaborative
music: none
version: 2
---

## Tasdiqlangan reja

Foydalanuvchi 60 soniyalik, gapirishdagi qiyinchilikdan boshlanadigan reklama va avval ssenariy/kadrlar rejasini tanladi. Ssenariy taklifidan keyin «xop boshla» deb tasdiqladi. Tasdiqlangan ovoz matni: `../HSK_AI_AI_Voice_Reklama_60s.md`. Bu bosqich — 8 kadrning statik vizual eskizi.

## Brend manbalari

Rang, subtitr va shakl manbasi: `../../hsk-tu-vous/content/visual-system.json`; tasvir tamoyillari: `../../hsk-tu-vous/content/EDITING_SPEC.md`. Logotip: `../../materialar/hsk-ai-logo.png`. Uchinchi tomon presetidagi ranglar ishlatilmaydi. Eskizdagi qisqa subtitrlar joylashuv namunasi; yakuniy subtitrlar tasdiqlangan ovoz eksportidan olinadi.

## Changes from v1

Foydalanuvchining izohi: «fon ranglari gaolarga mos almashsin kadrlar jizilshiyam videoga kelsin maqsad prafisianalniy bulsin».

Bu rolikning har kadrida fon g‘oyaga mos almashtiriladi va joylashuv videodagi sarlavha, katta tasvir hamda subtitrning vazifasiga ko‘ra qayta ishlanadi. Bu alohida reklamaning vizual qarori; umumiy seriya konfiguratsiyasi o‘zgartirilmaydi. v1 nusxalari `storyboard-v1.html` va `STORYBOARD-v1.md`da saqlangan.

## Ko‘rinish va davomiylik

Bitta asosiy mazmun, ammo har fikrga mos fon va kadr masshtabi. Fonlar: to‘q `#211D17` → oltin `#E9A916` → oq `#FFFFFF` → iliq och `#FDF9F0` → to‘q → oq → yashil `#2FA06A` → qizil `#E04A40`. Barcha ranglar HSK AI’ning mavjud palitrasidan olinadi. Kichik rangli yozuvlar ishlatilmaydi: to‘q va qizil fonda katta och matn, yashil va oltin fonda to‘q matn.

Sarlavha va tasvir alohida vaqtda markaziy urg‘u bo‘ladi. AI Voice namoyishida butun telefonni uzoqdan ko‘rsatish o‘rniga aytilayotgan amaldagi ekran fragmentiga yaqinlashiladi: boshlash → mikrofon → javob → yordam → tuzatish. 03-kadrda kursning haqiqiy fragmenti katta ko‘rinadi. Asosiy mazmun taxminan kadrning 22–73% balandligida, subtitr esa 79–84% oralig‘ida; sarlavha, tasvir va subtitr bir-birini yopmaydi. Kadr chetidan muhim yozuvlargacha kamida 10% yon maydon saqlanadi.

Asosiy sarlavha 90–150 px, subtitr 54 px atrofida. System-ui brend matni va monospace faqat varaqdagi vaqt yorliqlari uchun. 8 kadrning taxminiy davomiyligi: 6 + 6 + 7 + 9 + 8 + 7 + 6 + 11 = 60 soniya. Eskizdagi tasvirlar harakatsiz; kamera harakatlari va ranglar orasidagi yumshoq o‘tishlar animatsiya bosqichida bajariladi.

## Video direction

Boshlanish tomoshabinning gapirish oldidagi ikkilanishini katta yozuv va sokin pauza bilan beradi. 02-kadrdagi oltin fon yechimni ochadi. O‘rganish va maslahatlar och fonda o‘qilishi qulay; ovozli amal to‘q fonda katta mikrofon bilan ajraladi. Tuzatishning yashil foni qayta urinib ko‘rishga, brend qizili esa yakuniy chaqiriqqa xizmat qiladi.

Rang almashishi fikr almashishi bilan bog‘lanadi. To‘q/och fon chegaralarida qisqa `blur-crossfade`, oq/iliq och orasida oddiy `crossfade`; tez yorug‘lik sakrashi qo‘shilmaydi. Har bir scene ichida 1.5–3.5 soniyalik mazmunli yaqin kadrlar ovozdagi ibora boshlanishiga bog‘lanadi. 04–07 kadrlarda bir xil haqiqiy suhbatning davomiyligi saqlanadi; bu yangi mustaqil slaydlar qatori sifatida qurilmaydi.

## Hali ochiq

- Kadrlarning joylashuvi foydalanuvchiga ko‘rish uchun beriladi.
- AI Voice’ning yangilangan ruscha interfeysidan bir xil suhbatning haqiqiy yozuvi keyingi bosqichda olinadi. Eski tojikcha ekran va 7-javob hisoblagichi yakuniy demoga ishlatilmaydi.
- 08-kadr eskizi CTA’ning oxirgi holatini ko‘rsatadi; montajda profil → havola → yuklash belgili brend kartasi → kunlik o‘rganish ketma-ketligi saqlanadi.
- Musiqa bu eskiz bosqichida ishlab chiqarilmagan. `music: none` hozirgi ko‘rib chiqish holatini bildiradi.

## Frame 1 — Ikkilanish (00–06)

- background: "#211D17"
- layout: "Katta chapga tekislangan sarlavha 25%; oltin savol 48%; subtitr 80%."
- status: built
- duration: 6s
- transition_in: cut
- scene: "СЛОВА ЗНАЕШЬ… / А ОТВЕТИТЬ ТРУДНО?"
- voiceover: "Знаешь китайские слова, но когда нужно ответить — теряешься?"
- sketch: storyboard.html#frame-01
- asset_candidates: haqiqiy HSK AI logotipi; asosiy mazmun tipografika

Savol tomoshabinning gapirishdagi qiyinchiligini ochadi. Birinchi yozuv keladi, savol ochiladi, keyin qisqa pauza. HSK AI belgisi keyingi kadrda davom etadi. Soxta suhbat yoki tayyor o‘quvchi natijasi ko‘rsatilmaydi.

## Frame 2 — Asosiy foyda (06–12)

- background: "#E9A916"
- layout: "Ikki qatorli asosiy yozuv 25%; logotip chapda 46%; subtitr 80%."
- status: built
- duration: 6s
- transition_in: blur-crossfade
- scene: "ОТ СЛОВ — К РАЗГОВОРУ"
- voiceover: "С HSK AI переходи от изучения слов к разговорной практике."
- sketch: storyboard.html#frame-02
- asset_candidates: haqiqiy HSK AI logotipi

Foyda ikkinchi kadrdayoq aytiladi. Markaziy logotip va ikki qatorli sarlavha o‘rganishdan suhbatga o‘tishni beradi. Tez o‘rganish kafolati qo‘shilmaydi.

## Frame 3 — HSK AI tanishtiruvi (12–19)

- background: "#FFFFFF"
- layout: "Uch qatorli harakat sarlavhasi 23%; haqiqiy kurs fragmenti 46–73%; subtitr 80%."
- status: built
- duration: 7s
- transition_in: blur-crossfade
- scene: "УЧИ. / ПОВТОРЯЙ. / ПРОВЕРЯЙ."
- voiceover: "Проходи уроки, повторяй лексику и проверяй себя в тестах. Затем используй знакомые слова в разговоре."
- sketch: storyboard.html#frame-03
- asset_candidates: ../../videos/hsk-ai-explained/assets/miniapp-course-path.png; ../../videos/hsk-ai-explained/assets/vocabulary-flashcard.png; ../../videos/hsk-ai-explained/assets/quiz-feedback.png

Eskiz uch asosiy harakatning matnini va haqiqiy kurs xaritasining katta fragmentini ko‘rsatadi. Yakuniy montajda kurs, so‘z va testning haqiqiy ekranlari aytilgan paytda ketma-ket keladi. Uch ekran bir vaqtning o‘zida mayda panellarga bo‘linmaydi.

## Frame 4 — Darajaga mos suhbat (19–28)

- background: "#FDF9F0"
- layout: "AI Voice nomi 22%; daraja 33%; suhbat yozuvi 41–72%; subtitr 80%."
- status: built
- duration: 9s
- transition_in: crossfade
- scene: "AI VOICE / ТВОЙ УРОВЕНЬ HSK"
- voiceover: "Открой AI Voice. Здесь ты практикуешь китайский с AI-собеседником на своём уровне HSK."
- sketch: storyboard.html#frame-04
- asset_candidates: yangilangan ruscha ilovadan olinadigan haqiqiy AI Voice yozuvi

Darajaga mos suhbat mexanizmi ochiladi. Plain blok yozuv uchun ajratilgan joy bo‘lib, mahsulot interfeysi sifatida taqdim etilmaydi. Bir xil suhbat yozuvi 05–07 kadrlarda davom etadi.

## Frame 5 — Gapirish va javob (28–36)

- background: "#211D17"
- layout: "Harakat sarlavhasi 23%; mikrofonning katta yaqin kadri 43%; javob kelganda shu markaziy joyda ekran fragmenti; subtitr 81%."
- status: built
- duration: 8s
- transition_in: blur-crossfade
- scene: "СКАЖИ ФРАЗУ. / ПОЛУЧИ ОТВЕТ."
- voiceover: "Запиши фразу голосом. Собеседник ответит по-китайски и продолжит разговор коротким вопросом."
- sketch: storyboard.html#frame-05
- asset_candidates: 04-kadrdagi shu haqiqiy suhbat yozuvi

Mikrofon belgisi eskizda gapirishning markaziy o‘rnini ko‘rsatadi. Yakuniy montajda haqiqiy mikrofon amali, ovozli javob va AI qaytargan xabar turadi. To‘qilgan xabar yoki tugma qo‘shilmaydi.

## Frame 6 — Javob uchun yordam (36–43)

- background: "#FFFFFF"
- layout: "Maslahatlar sarlavhasi 22%; yozuv 39–68%; izohlar 72%; subtitr 83%."
- status: built
- duration: 7s
- transition_in: blur-crossfade
- scene: "ПОДСКАЗКИ, КОГДА НУЖНО."
- voiceover: "Не знаешь, что сказать? Посмотри подсказки: китайскую фразу, пиньинь с тонами и перевод."
- sketch: storyboard.html#frame-06
- asset_candidates: 04-kadrdagi shu haqiqiy suhbatning maslahatlar oynasi

Ibora, pinyin va tarjima ovozda tilga olingan paytda ajratiladi. Eskizda chinakam yozuv uchun bitta blok turadi; xitoycha iboralar yakuniy yozuvdan olinadi.

## Frame 7 — Tuzatishlar (43–49)

- background: "#2FA06A"
- layout: "Yirik sarlavha 22%; tuzatish va yakun ekrani 43–70%; subtitr 80%."
- status: built
- duration: 6s
- transition_in: blur-crossfade
- scene: "ЗАМЕЧАЙ ОШИБКИ. / ПРОБУЙ СНОВА."
- voiceover: "AI помогает заметить важные ошибки. После разговора посмотри исправления и попробуй ответить иначе."
- sketch: storyboard.html#frame-07
- asset_candidates: shu suhbatdagi haqiqiy tuzatish va suhbat yakuni

Mashqdan keyingi o‘rganishni ko‘rsatadi. Tuzatishdan yakunga o‘tib, haqiqiy natijani o‘qish uchun sokin ushlab turish. Aniq ball yoki mavjud bo‘lmagan xato yozilmaydi.

## Frame 8 — Profil havolasi (49–60)

- background: "#E04A40"
- layout: "Logotip chapda 24%; yakuniy sarlavha 40%; profil havolasi 65%; subtitr 80%."
- status: built
- duration: 11s
- transition_in: blur-crossfade
- scene: "КИТАЙСКИЙ КАЖДЫЙ ДЕНЬ. / HSK AI · ССЫЛКА В ПРОФИЛЕ"
- voiceover: "Попробуй HSK AI. Зайди в профиль, открой ссылку, скачай HSK AI и учи китайский каждый день."
- sketch: storyboard.html#frame-08
- asset_candidates: haqiqiy HSK AI logotipi; ../../hsk-tu-vous/public/cta/instagram-profile.png; ../../hsk-tu-vous/public/cta/instagram-links.png

Ovoz va ichki kadrlar ketma-ketligi canonical CTA’dan olinadi: `../../hsk-tu-vous/content/cta-lab.json`. Eskiz so‘nggi holatni beradi. YouTube uchun faqat canonical platforma skrinshotlari almashtiriladi. Yuklash tugagani yoki havola haqiqatan bosilgani tasvirlanmaydi.
