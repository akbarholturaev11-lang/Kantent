# HSK AI uchun qisqa video kontent tizimi

## Maqsad

HSK AI uchun muntazam, 25–35 soniyalik vertikal videolar tayyorlash. Video va ovoz tojikcha bo‘ladi; xitoycha ieroglif, pinyin va tojikcha ma’no birga ko‘rsatiladi. Har bir rolik bitta o‘quv nuqtasini sodda misol bilan tushuntiradi.

## Ko‘rilgan uch videodan olingan tizim

### 1. `0c6a11c7ac83469090419e3d084611c2.MP4`

- Kulgili yoki kutilmagan kirish bilan e’tibor tortadi.
- Keyin `Pronin MCP` ulanganini va dizayn tizimi asosida uchta rolik tuzganini ko‘rsatadi.
- Interfeysdagi yo‘nalishlar: dizayn, animatsiya, o‘tishlar, matn; yakunda `собрать` — yig‘ish tugmasi.
- MCP bu yerda muallifning maxsus integratsiyasi sifatida ko‘rsatilgan. HSK AI uchun hozircha bunday MCP kerak emas; avval takrorlanadigan andoza va dizayn qoidalari kerak.

### 2. `8b58e636ef18464fb29f11364eeb15d4.MP4`

- Instagram’dagi natijani ko‘rsatadi, so‘ng “yuzsiz blog” formatiga o‘tadi.
- `Codex` chatida avvalgi maketga fikr bildirib, shriftni almashtirish va ish uslubini saqlashni so‘raydi.
- `Remotion` rolikni yig‘ish uchun ko‘rsatiladi; keyin tayyor rolik misollari va profilga yo‘naltiruvchi CTA bor.
- Foydali dars: birinchi AI natijani yakuniy deb qabul qilmaslik. Shrift, matn joylashuvi va tempni ko‘rib, aniq tuzatish so‘rash kerak.

### 3. `718b9a3a7a704621b41b90c995ebd48b.MP4`

Bu tizimning eng foydali namoyishi. Muallif ish tizimini to‘rt bo‘limga ajratadi:

- **Vizual:** shriftlar va komponentlar; tokenlar, kartochkalar, usullar, to‘r va rang.
- **Ko‘nikmalar:** yangi rolik, tahrir aylanasi, ovoz, yakun va qadoqlash.
- **Hooks/avtomatlashtirish:** turlar, katalog, linter, start, commit. Bu ro‘yxat kontent uchun tayyor hook gaplaridan ko‘ra ishlab chiqish yoki agent hodisalariga o‘xshaydi.
- **Xotira:** qoidalar va jurnal.

Keyingi kadrda oqim aniq yozilgan: **Notes — rolik matni → ElevenLabs — ovoz → Whisper — so‘zlar bo‘yicha vaqt belgilash → Claude Code — videoni yig‘ish**. Boshqa videoda bu jarayonda Codex va Remotion ham ko‘rsatiladi. Kod yordamchisi, ovoz xizmati va video renderi — alohida vazifalarni bajaradi.

## HSK AI uchun amaliy vositalar

| Vazifa | Videolarda ko‘ringani | HSK AI uchun hozirgi tanlov |
|---|---|---|
| Mavzu va matn | Notes | Umumiy ssenariy fayli yoki loyiha papkasi; har mavzuga alohida matn |
| Matnni ishlab chiqish va tuzatish | Codex, Claude Code | Codex bilan matn, kadr reja va Remotion kodini tayyorlash; o‘quv mazmunini xitoy tili biladigan odam tekshiradi |
| Ovoz | ElevenLabs | Gemini 3.8 Flash TTS; rasmiy jadvalda tojikcha va Standard Free Tier ko‘rsatilgan |
| Matnni ovozga mos vaqt belgilash | Whisper | Bepul asosiy yo‘l sahna davomiyligidan foydalanadi; Whisper-1 ixtiyoriy va pulli bo‘lishi mumkin |
| Video yig‘ish | Remotion | Mavjud `hsk-tu-vous` Remotion loyihasi: 1080×1920, 30 fps, 30 soniya. Shu bazada davom etish mumkin |
| Saqlash va natijani ko‘rsatish | Instagram profil yoki bilim bazasi | Har rolikni mavzu, HSK darajasi, format, ko‘rish, saqlash va ulashishlar bilan qayd etish |

### Ovoz bo‘yicha muhim tekshiruv

Siz yuborgan Kveeky skrinshotida **Free Plan**: oyiga 3 000 belgi va 5 ta studiya ovozi ko‘rsatilgan. Bu kichik sinov uchun yetadi, ammo tojikcha qo‘llanishini tasdiqlamaydi. Namunaviy videoda ElevenLabs ishlatilgan, lekin uning e’lon qilingan TTS tillari ro‘yxatida tojikcha yo‘q.

Avtomatik versiya uchun Gemini Flash TTS tanlandi: rasmiy jadvalda tojikcha aynan Flash modelida bor (Flash-Lite qatorida emas) va Standard rejada bepul kvota ko‘rsatilgan. Kvota, model mavjudligi, cheklov va shartlar Google akkauntiga qarab o‘zgarishi mumkin. Free Tier’dagi so‘rovlar Google mahsulotlarini yaxshilashda ishlatilishi mumkin, shuning uchun faqat ommaga mo‘ljallangan dars matnini yuboring. Birinchi ovozni tinglab, tojikcha va xitoycha talaffuzni tekshiring. Matnni tashqi xizmatga yubormaslikni istasangiz, ovozni o‘zingiz yozib ishlatishingiz mumkin.

Whisper-1 so‘zma-so‘z vaqt belgilashning ixtiyoriy ulanishi sifatida qo‘shildi, biroq u pulli bo‘lishi mumkin. `.env.local` dagi ochiq ruxsatsiz audio OpenAI’ga yuborilmaydi; tojikcha transkripsiyani odam tekshirishi kerak.

## HSK AI’ning o‘ziga xos vizual tizimi

Mavjud Remotion prototipida iliq fon `#f7f3ea`, to‘q ko‘k `#162338`, qizil `#e6513d`, yashil-ko‘k `#247d76` ranglari bor. Buni saqlab, roliklarda tezkor kartochkalar va kichik UI maketlaridan foydalanish mumkin. Boshqa ijodkorning watermark’i, tayyor shabloni yoki aynan o‘sha vizuallarini ko‘chirmasdan, faqat ish jarayoni g‘oyasini olamiz.

Doimiy kartochka tartibi:

1. Xitoycha so‘z yoki ibora katta yozuvda.
2. Pinyin va ton belgisi.
3. Tojikcha ma’nosi.
4. Sodda misol-jumla yoki dialog.
5. Bir jumlalik izoh va HSK AI chaqirig‘i.

Har sahnada bitta fikr bo‘lsin; kadr taxminan har 2–4 soniyada o‘zgarsin. Ovoz ravshan va oldinda, fon musiqasi past, muhim so‘z chiqqanda yengil tovush effekti bo‘lsin.

## Bir rolikni tayyorlash tartibi

1. HSK ro‘yxatidan bitta so‘z yoki qoida tanlanadi.
2. Xitoycha shakli, pinyin, ton va misoli tekshiriladi.
3. 25–35 soniyalik tojikcha matn yoziladi: 0–3 soniya kirish, 3–8 soniya qoida, 8–18 soniya misollar, 18–25 soniya qo‘llash vaziyati, 25–30 soniya CTA.
4. Ovoz yoziladi yoki yaratiladi; xitoycha so‘zlar talaffuzi tekshiriladi.
5. Whisper yoki qo‘lda subtitr vaqt belgilari qo‘yiladi; tojikcha va xitoycha yozuvlar tahrirlanadi.
6. Remotion’da tayyor vizual komponentlarga matn, kartochka va ovoz joylanadi.
7. Rolik boshidan oxirigacha ko‘riladi: kirish, talaffuz, o‘qilishi, temp va CTA tekshiriladi.
8. Bitta rolik chiqariladi va natijalar qayd etiladi: 3 soniyadan keyin ko‘rishda qolish, oxirigacha ko‘rish, saqlash va ulashish.

## Kontent papkalari uchun taklif

- `brand/` — rang, shrift, logotip, kartochka va animatsiya qoidalari.
- `scripts/` — tasdiqlangan mavzular va tojikcha ssenariylar.
- `audio/` — ovoz fayllari, talaffuz eslatmalari va musiqa.
- `assets/` — ieroglif/pinyin ma’lumotlari, illyustratsiyalar va HSK AI ilovasi UI kadrlari.
- `templates/` — “so‘z taqqoslash”, “talaffuz”, “misol dialog”, “HSK AI funksiyasi” andozalari.
- `exports/` — tayyor MP4 va subtitrlar.
- `analytics/` — post sanasi va natijalari.

## Joriy loyiha holati

`hsk-tu-vous/` ichida 12 mavzuli to‘rt haftalik reja; birinchi tojikcha ssenariy; Gemini ssenariy va ovoz API oqimi; bepul, sahna davomiyligiga tayangan subtitr; ixtiyoriy Whisper vaqt belgilashi; qayta ishlatiladigan Remotion kompozitsiyasi; va tasdiqdan oldingi ko‘rib chiqish paketi bor. Nashr siz tasdiqlaganingizdan keyin ham qo‘lda bajariladi, ijtimoiy akkauntlar ulanmagan. Ishga tushirish bo‘yicha [loyiha README’sini](./hsk-tu-vous/README.md) ko‘ring.

## Manbalar

- [ElevenLabs: tillar ro‘yxati](https://elevenlabs.io/docs/help-center/other/what-languages-do-you-support)
- [ElevenLabs: narx va bepul reja](https://elevenlabs.io/pricing)
- [ElevenLabs: TTS va bepul audio ishlatish shartlari](https://elevenlabs.io/text-to-speech)
- [Gemini TTS: tojikcha tillar ro‘yxati va API tuzilishi](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini API: bepul kvota va joriy narxlar](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI Whisper: rasmiy transkripsiya va vaqt belgilari qo‘llanmasi](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Remotion: asoslar](https://www.remotion.dev/docs/the-fundamentals)
