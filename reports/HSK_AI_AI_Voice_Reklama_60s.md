# HSK AI + AI Voice — 60 soniyalik reklama ssenariysi

Holat: [60 soniyalik subtitrli MP4 tayyor](hsk-ai-voice-60s/hsk-ai-ai-voice-60s.mp4), avvalgi 8 kadr 4 ta uzluksiz sahnaga birlashtirilgan. Ssenariy «xop boshla», v3 ko‘rinishi «buladi», Gemini Kore ovozi «Ha, shu ovozda tayyorlang» javoblari bilan tasdiqlangan. [Videoni ko‘rish sahifasi](hsk-ai-voice-60s/storyboard.html).

## Tanlangan yo‘nalish

Siz tanlagan g‘oya: gapirishdagi qiyinchilikdan boshlangan qisqa hikoya, 60 soniyalik batafsil namoyish, avval ssenariy va kadrlar rejasini ko‘rib chiqish.

Rolik xitoy tilini o‘rganayotgan tomoshabinga HSK AI’da o‘rganilgan so‘zlarni AI Voice suhbatida ishlatib mashq qilish mumkinligini ko‘rsatadi.

Hikoya: «So‘zlarni bilaman, lekin gapirishga qiynalaman» → HSK AI → AI Voice suhbatining qanday ishlashi → yordamchi iboralar va tuzatishlar → ilovani sinab ko‘rishga chaqiriq.

Loyihadagi mavjud formatdan olingan takliflar: Reels/Shorts uchun 9:16, 1080×1920; ruscha ovoz va ekran matni; haqiqiy ilova ekranlari; tasdiqlangan brend ko‘rinishi. Ovoz konfiguratsiyasi `hsk-tu-vous/content/voice-profile.json`dan olinadi.

## Kadrlar rejasi

Yakuniy taqsimot haqiqiy ovoz va tekshirilgan so‘z tayminglariga moslandi. Video aynan 60 soniya; jadvaldagi vaqtlar yaxlitlangan.

| Vaqt | Ekranda | Ruscha ovoz | Kadrning vazifasi |
| --- | --- | --- | --- |
| 00–11.6 | O‘ylanib qolgan o‘quvchining tabiiy fotosi; sariq sathda «знаешь слова. трудно заговорить?» | Birinchi 2 ta o‘zgarmagan ovoz bo‘lagi. | Gapirishdagi qiyinchilikni sodda va tabiiy ko‘rsatish. |
| 11.6–18.9 | HSK AI kurs xaritasining haqiqiy ekrani; «от слов — к разговору». | Uchinchi ovoz bo‘lagi. | Kursdan suhbat mashqiga o‘tishni ko‘rsatish. |
| 18.9–49.6 | Haqiqiy AI Voice mobil ekrani: xitoycha javob, pinyin, tarjima va mikrofon. Bitta uzluksiz yaqinlashish. | 4–7-ovoz bo‘laklari; avvalgi fayllari o‘zgarishsiz. | Ilova ishlashini kadr almashinuvisiz, ovoz bilan birga ko‘rsatish. |
| 49.6–60 | «попробуй HSK AI» sarlavhasi va profil ichidagi mavjud yuklab olish havolalari ekrani. | Yakuniy ovoz bo‘lagi. | Haqiqiy yuklab olish havolasiga yo‘naltirish. |

## To‘liq ruscha ovoz matni

Знаешь китайские слова, но когда нужно ответить — теряешься? С HSK AI переходи от изучения слов к разговорной практике. Проходи уроки, повторяй лексику и проверяй себя в тестах. Затем используй знакомые слова в разговоре. Открой AI Voice. Здесь ты практикуешь китайский с AI-собеседником на своём уровне HSK. Запиши фразу голосом. Собеседник ответит по-китайски и продолжит разговор коротким вопросом. Не знаешь, что сказать? Посмотри подсказки: китайскую фразу, пиньинь с тонами и перевод. AI помогает заметить важные ошибки. После разговора посмотри исправления и попробуй ответить иначе. Попробуй HSK AI. Зайди в профиль, открой ссылку, скачай HSK AI и учи китайский каждый день.

## Kadrlar uchun materiallar

- Mavjud logotip: `materialar/hsk-ai-logo.png`.
- Kurs, so‘z va test ekranlari: `videos/hsk-ai-explained/assets/miniapp-course-path.png`, `vocabulary-flashcard.png`, `quiz-feedback.png`.
- Mavjud AI Voice ekrani: `videos/hsk-ai-explained/assets/ai-voice-conversation.png`. Foydalanuvchi «Faqat mavjud ekranlardan foydalaning» deb tanladi. Tojikcha haqiqiy ekran ishlatildi; eskirgan hisoblagich kesimdan tashqarida qoldi. Ovoz va izohlar ruscha.
- Mikrofon va xitoycha javob: mavjud haqiqiy ekran fragmentlari. Tuzatish mazmuni matn orqali tushuntiriladi; mahsulot natijasi to‘qilmagan.
- Instagram yakuni: `hsk-tu-vous/public/cta/instagram-profile.png`, `instagram-links.png`.
- YouTube yakuni: `hsk-tu-vous/public/cta/youtube-telegram-profile.jpg`, `youtube-open-link-browser.jpg`. Asosiy rolik va ovoz bir xil; yakundagi platforma ekranlari almashtiriladi.

## Tasvir va ovoz yo‘nalishi

Kirishda AI yaratilgan bitta tabiiy foto ishlatilgan; u ilova ekrani emas. Mahsulot namoyishida faqat mavjud haqiqiy skrinshotlar ishlatiladi. To‘rtta sahna: gapirishdagi pauza; haqiqiy kurs xaritasi; haqiqiy AI Voice mobil ekranidagi bitta sekin yaqinlashish; yuklab olish havolalari. To‘q siyoh va sariq brend ranglari fonni to‘ldiradi, ilova ekranlarining asl ranglari saqlanadi. Ruscha subtitrlar bir xil o‘qiladigan to‘q lentada chiqadi; sahna almashishi 0,6 soniyalik fade bilan.

Foydalanuvchi tasdiqlagan Gemini Kore ovozi ishlatildi. Musiqa qo‘shilmagan; o‘tish va subtitrlar ovozga bog‘langan. Ohang tabiiy va vazmin, foydalanuvchining «krinjsiz» izohiga mos.

## Tekshirilgan ma’lumot manbalari

- HSK darajasiga mos suhbat: `/Users/kaijimima1234/Projects/HSK AI bot/app/services/voice_practice_service.py` — `LEVEL_GUIDANCE`, `_generate_reply`.
- Ovozli javobni qabul qilish va suhbatni davom ettirish: shu fayldagi `process_turn`; qisqa xitoycha javob va keyingi savol qoidalari — `_generate_reply`.
- Xitoycha ibora, pinyin, tarjima va maslahatlar: `_generate_reply` qaytaradigan `chinese_reply`, `pinyin`, `translation`, `suggestions`.
- Tuzatish va suhbat yakuni: `android/app/src/main/java/com/pomp/hskai/feature/voice/VoiceScreen.kt`; ruscha nomlar — `android/app/src/main/res/values-ru/strings.xml`.
- Kurs, so‘z kartalari va testlar: loyihadagi haqiqiy ilova skrinshotlari.
- Yakuniy chaqiriq matni va platformaga mos ekranlar: `hsk-tu-vous/content/cta-lab.json` — `offer.canonicalRussian`, `platformVariants`.

Reja kod va mavjud haqiqiy materiallarga tayangan. Yakuniy namoyishda foydalanuvchi tanlagan mavjud ekranlar ishlatildi. Reklamaga bepul yoki cheksiz foydalanish, Live rejimining hamma uchun ochiqligi, aniq talaffuz ballari yoki tez o‘rganish kafolati qo‘shilmagan.

## Ishlab chiqarish holati

Video: 1080×1920, 30 fps, H.264, AAC, 60 soniya. Ruscha ovoz matni o‘zgarmagan, 99 so‘zning tayminglari tekshirilgan. Ovozning avvalgi Kore yozuvi o‘zgarmagan, subtitrlar esa oddiy qoramtir rangda qoldi. Subtitrlar videoga qo‘shilgan, alohida [SRT nusxasi](hsk-ai-voice-60s/captions.srt) ham bor.

Yakuniy fayl xatosiz ochildi va to‘liq dekodlandi. 6 vakillik kadr eksport qilingan videodan tekshirildi. Tasdiqlangan ovoz o‘zgarmagan: oldingi va yangi videodagi AAC audio oqimlarining SHA-256 qiymatlari bir xil. QA: `../videos/hsk-ai-voice-promo/QA.json`.

Ilova tili vaqtincha rus tiliga o‘tkazilgach, tojikchaga qaytarildi. Rolik mahalliy ko‘rib chiqish uchun tayyorlandi; e’lon qilinmagan.
