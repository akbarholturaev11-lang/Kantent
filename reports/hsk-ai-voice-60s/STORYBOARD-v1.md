---
format: 1080x1920
duration: 60s
message: "HSK AI’da o‘rganilgan so‘zlarni AI Voice suhbatida ishlatib mashq qilish mumkin."
arc: "Qiyinchilik → HSK AI → haqiqiy AI Voice namoyishi → yordam va tuzatishlar → CTA"
audience: "Xitoy tilini o‘rganayotgan rus tilida so‘zlashuvchi boshlovchilar"
mode: collaborative
music: none
version: 1
---

## Tasdiqlangan reja

Foydalanuvchi 60 soniyalik, gapirishdagi qiyinchilikdan boshlanadigan reklama va avval ssenariy/kadrlar rejasini tanladi. Ssenariy taklifidan keyin «xop boshla» deb tasdiqladi. Tasdiqlangan ovoz matni: `../HSK_AI_AI_Voice_Reklama_60s.md`. Bu bosqich — 8 kadrning statik vizual eskizi.

## Brend manbalari

Rang, subtitr va shakl manbasi: `../../hsk-tu-vous/content/visual-system.json`; tasvir tamoyillari: `../../hsk-tu-vous/content/EDITING_SPEC.md`. Logotip: `../../materialar/hsk-ai-logo.png`. Uchinchi tomon presetidagi ranglar ishlatilmaydi. Eskizdagi qisqa subtitrlar joylashuv namunasi; yakuniy subtitrlar tasdiqlangan ovoz eksportidan olinadi.

## Ko‘rinish va davomiylik

Bir och fon, bitta markaziy mazmun. Telefon ekranidagi xavfsiz matn maydoni saqlanadi. Asosiy sarlavha 90–130 px atrofida, subtitr 46–54 px; tasvirga qarab o‘lcham moslanadi. System-ui brend matni va monospace texnik vaqt yorliqlari. 8 kadrning taxminiy davomiyligi: 6 + 6 + 7 + 9 + 8 + 7 + 6 + 11 = 60 soniya. Eskizdagi tasvirlar harakatsiz; animatsiya keyin qo‘shiladi.

## Hali ochiq

- Kadrlarning joylashuvi foydalanuvchiga ko‘rish uchun beriladi.
- AI Voice’ning yangilangan ruscha interfeysidan bir xil suhbatning haqiqiy yozuvi keyingi bosqichda olinadi. Eski tojikcha ekran va 7-javob hisoblagichi yakuniy demoga ishlatilmaydi.
- 08-kadr eskizi CTA’ning oxirgi holatini ko‘rsatadi; montajda profil → havola → yuklash belgili brend kartasi → kunlik o‘rganish ketma-ketligi saqlanadi.
- Musiqa bu eskiz bosqichida ishlab chiqarilmagan. `music: none` hozirgi ko‘rib chiqish holatini bildiradi.

## Frame 1 — Ikkilanish (00–06)

- status: built
- duration: 6s
- transition_in: cut
- scene: "СЛОВА ЗНАЕШЬ… / А ОТВЕТИТЬ ТРУДНО?"
- voiceover: "Знаешь китайские слова, но когда нужно ответить — теряешься?"
- sketch: storyboard.html#frame-01
- asset_candidates: haqiqiy HSK AI logotipi; asosiy mazmun tipografika

Savol tomoshabinning gapirishdagi qiyinchiligini ochadi. Birinchi yozuv keladi, savol ochiladi, keyin qisqa pauza. HSK AI belgisi keyingi kadrda davom etadi. Soxta suhbat yoki tayyor o‘quvchi natijasi ko‘rsatilmaydi.

## Frame 2 — Asosiy foyda (06–12)

- status: built
- duration: 6s
- transition_in: crossfade
- scene: "ОТ СЛОВ — К РАЗГОВОРУ"
- voiceover: "С HSK AI переходи от изучения слов к разговорной практике."
- sketch: storyboard.html#frame-02
- asset_candidates: haqiqiy HSK AI logotipi

Foyda ikkinchi kadrdayoq aytiladi. Markaziy logotip va ikki qatorli sarlavha o‘rganishdan suhbatga o‘tishni beradi. Tez o‘rganish kafolati qo‘shilmaydi.

## Frame 3 — HSK AI tanishtiruvi (12–19)

- status: built
- duration: 7s
- transition_in: crossfade
- scene: "ЗНАКОМЫЕ СЛОВА — В ДЕЛО. / УРОКИ / СЛОВА / ТЕСТЫ"
- voiceover: "Проходи уроки, повторяй лексику и проверяй себя в тестах. Затем используй знакомые слова в разговоре."
- sketch: storyboard.html#frame-03
- asset_candidates: ../../videos/hsk-ai-explained/assets/miniapp-course-path.png; ../../videos/hsk-ai-explained/assets/vocabulary-flashcard.png; ../../videos/hsk-ai-explained/assets/quiz-feedback.png

Eskiz uch asosiy yo‘nalishning matnini ko‘rsatadi. Yakuniy montajda kurs, so‘z va testning haqiqiy ekranlari aytilgan paytda ketma-ket keladi. Uch ekran bir vaqtning o‘zida mayda panellarga bo‘linmaydi.

## Frame 4 — Darajaga mos suhbat (19–28)

- status: built
- duration: 9s
- transition_in: crossfade
- scene: "AI VOICE / ТВОЙ УРОВЕНЬ HSK"
- voiceover: "Открой AI Voice. Здесь ты практикуешь китайский с AI-собеседником на своём уровне HSK."
- sketch: storyboard.html#frame-04
- asset_candidates: yangilangan ruscha ilovadan olinadigan haqiqiy AI Voice yozuvi

Darajaga mos suhbat mexanizmi ochiladi. Plain blok yozuv uchun ajratilgan joy bo‘lib, mahsulot interfeysi sifatida taqdim etilmaydi. Bir xil suhbat yozuvi 05–07 kadrlarda davom etadi.

## Frame 5 — Gapirish va javob (28–36)

- status: built
- duration: 8s
- transition_in: crossfade
- scene: "СКАЖИ ФРАЗУ. / ПОЛУЧИ ОТВЕТ."
- voiceover: "Запиши фразу голосом. Собеседник ответит по-китайски и продолжит разговор коротким вопросом."
- sketch: storyboard.html#frame-05
- asset_candidates: 04-kadrdagi shu haqiqiy suhbat yozuvi

Mikrofon belgisi eskizda gapirishning markaziy o‘rnini ko‘rsatadi. Yakuniy montajda haqiqiy mikrofon amali, ovozli javob va AI qaytargan xabar turadi. To‘qilgan xabar yoki tugma qo‘shilmaydi.

## Frame 6 — Javob uchun yordam (36–43)

- status: built
- duration: 7s
- transition_in: crossfade
- scene: "ПОДСКАЗКИ, КОГДА НУЖНО."
- voiceover: "Не знаешь, что сказать? Посмотри подсказки: китайскую фразу, пиньинь с тонами и перевод."
- sketch: storyboard.html#frame-06
- asset_candidates: 04-kadrdagi shu haqiqiy suhbatning maslahatlar oynasi

Ibora, pinyin va tarjima ovozda tilga olingan paytda ajratiladi. Eskizda chinakam yozuv uchun bitta blok turadi; xitoycha iboralar yakuniy yozuvdan olinadi.

## Frame 7 — Tuzatishlar (43–49)

- status: built
- duration: 6s
- transition_in: crossfade
- scene: "ЗАМЕЧАЙ ОШИБКИ. / ПРОБУЙ СНОВА."
- voiceover: "AI помогает заметить важные ошибки. После разговора посмотри исправления и попробуй ответить иначе."
- sketch: storyboard.html#frame-07
- asset_candidates: shu suhbatdagi haqiqiy tuzatish va suhbat yakuni

Mashqdan keyingi o‘rganishni ko‘rsatadi. Tuzatishdan yakunga o‘tib, haqiqiy natijani o‘qish uchun sokin ushlab turish. Aniq ball yoki mavjud bo‘lmagan xato yozilmaydi.

## Frame 8 — Profil havolasi (49–60)

- status: built
- duration: 11s
- transition_in: crossfade
- scene: "КИТАЙСКИЙ КАЖДЫЙ ДЕНЬ. / HSK AI · ССЫЛКА В ПРОФИЛЕ"
- voiceover: "Попробуй HSK AI. Зайди в профиль, открой ссылку, скачай HSK AI и учи китайский каждый день."
- sketch: storyboard.html#frame-08
- asset_candidates: haqiqiy HSK AI logotipi; ../../hsk-tu-vous/public/cta/instagram-profile.png; ../../hsk-tu-vous/public/cta/instagram-links.png

Ovoz va ichki kadrlar ketma-ketligi canonical CTA’dan olinadi: `../../hsk-tu-vous/content/cta-lab.json`. Eskiz so‘nggi holatni beradi. YouTube uchun faqat canonical platforma skrinshotlari almashtiriladi. Yuklash tugagani yoki havola haqiqatan bosilgani tasvirlanmaydi.
