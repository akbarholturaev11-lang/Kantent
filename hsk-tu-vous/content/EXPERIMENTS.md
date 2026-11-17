# Eksperimentlar bo'limi (egasi qoidasi 2026-11-17)

HSK AI kontentini ssenariydan natijagacha uzluksiz yaxshilaydigan yagona bo'lim. U mavjud mexanizmlarni takrorlamaydi, ularni bog'laydi:

| Nima | Yagona manba |
|---|---|
| Testlar, uslublar (A/B), armlar taqsimoti, egasining qarorlari | `content/experiments.json` |
| Har kontent turining maqsadi va asosiy metrikasi | `content/creative-formats.json#contentGoals` |
| Dalil chegaralari (post soni, minimal ko'rish, foiz o'sish, yon metrika) | `content/hook-lab.json#policy` |
| Har video yozuvi: ssenariy, prompt, hook, storytelling, vizual uslub, chiqqan versiya | `content/feedback/publications.json` (`scripts/publication-ledger.mjs`) |
| Natijalar | `content/feedback/observations/` (Zernio, faqat manbali) |
| Haftalik ko'rib chiqish | `content/feedback/reports/<sana>-experiment-review.md` |
| Dvigatel | `scripts/experiments.mjs` (`npm run content:experiments`), MCP `get_content_experiments` |

## Egasi nimani ko'radi

```bash
npm run content:experiments
```

Har test uchun quyidagilar ko'rinadi:

- **Maqsad**: kontent turi va qaysi metrika bilan baholanishi.
- **A (hozirgi)** va **B (yangi)** uslub.
- Nechta video taqsimlangan va nechta post chiqqan.
- Har platforma/til bo'yicha A va B natijasi.
- Tavsiya va uning sababi.
- **Keyingi qaror**.

## Asosiy qoidalar

1. **Har tur faqat o'z maqsadi bilan baholanadi**:
   - dars: HSK AI'ga foydalanuvchi olib kelish, ya'ni havola so'rovlari (`commentsPer1000Views`); manbali click yoki sign-up bo'lsa, ular ishlatiladi;
   - reklama: brendni eslab qolish (`reach`, `averageWatchRatio`);
   - serial: obunachi o'sishi (`followsPer1000Views`).

   Ko'rishlar soni yolg'iz o'zi hech qachon mezon emas.
2. **Bir vaqtda bitta test, bitta o'zgaruvchi.** Haftasiga bitta yangi ssenariy yoki taqdimot uslubi hozirgi uslubga qarshi sinaladi. Mavzu, CTA, ovoz, dizayn, davomiylik va nashr vaqti o'zgarmaydi. `visual-variety.json` dagi fon-guruhi testi shu qoida sabab **pauza**da.
3. **Arm qo'lda tanlanmaydi.** Muvozanatli almashinuv ishlatiladi: kam taqsimlangan arm navbatda turadi; teng bo'lsa, oxirgisining teskarisi olinadi. Taqsimot `experiments.json` da saqlanadi va o'zgarmaydi. Serialda ikkala qism bitta armda bo'ladi: bitta hikoyaning 1- va 2-qismi hech qachon A va B qilib solishtirilmaydi.
4. **Natija oynasi — nashrdan keyingi birinchi 7 kun.** Ikki xil natija qabul qilinadi:
   - provayderning aniq `7d` oynasi;
   - post yoshi 7–10 kun bo'lganda olingan `lifetime` snapshot. Uning aniq yoshi yoziladi va u hech qachon "7d" deb qayta nomlanmaydi; 10 kunlik chegara Dushanba/Chorshanba/Juma Feedback ritmini qamraydi.

   Ma'lumot bo'lmasa, uydirilmaydi: holat `waiting-for-day-7`, `no-first-week-snapshot` yoki `insufficient-evidence` bo'lib qoladi.
5. **Majburiy haftalik g'olib yo'q.** Har platforma/til guruhida har armda kamida `minimumPostsPerFormat` ta (hozir 3) mos post bo'lishi kerak, har biri kamida `minimumViewsPerPost` (500) ko'rish bilan. B asosiy metrikada kamida `minimumRelativeLiftPercent` (10%) yaxshi bo'lishi va yon metrikalar 10% dan ortiq yomonlashmasligi kerak. Shunda dvigatel **egasiga taklif qiladi**. Aks holda test davom etadi va hozirgi uslub saqlanadi.
6. **Doimiy qoida faqat egasi tasdiqlaganda o'zgaradi.** Qaror egasining o'z so'zlari bilan yoziladi:

   ```bash
   npm run content:experiments -- --decide lesson-opening-v1 --decision promote --owner-words "…" --write
   ```

   Keyin navbatdagi test keyingi Dushanbadan avtomatik boshlanadi. `promote` bo'lsa, B uslubi kanonik siyosatga yoziladi: darsda `HOOK_LAB.md`/`creative-formats.json`, reklamada `PROMO_WORKFLOW.md`. So'ng `npm run check:consistency` ishga tushiriladi.
7. **O'zgarmaydi**: kalendar, tillar, dizayn qoidalari va har videoning aniq final preview'i egasi tomonidan tasdiqlanishi. Eksperiment hech qachon videoni nashr qilmaydi.

## Testlar navbati

| # | Test | Tur | A (hozirgi) | B (yangi) | Holat |
|---|---|---|---|---|---|
| 1 | `lesson-opening-v1` | dars | Challenge → Answer → Practice | Mistake → Correction → Practice | **faol**, 2026-11-18 dan |
| 2 | `ad-brand-demo-v1` | reklama | hozirgi reklama uslubi | birinchi 2 soniyada brend + haqiqiy mahsulot demosi | navbatda (1-test baholangach) |
| 3 | `serial-micro-drama-v1` | serial | hozirgi ikki qismli hikoya | Micro-Drama: takrorlanuvchi qahramon, davom etuvchi hikoya; har qism o'zi dars beradi | navbatda (2-testdan keyin) |

Ikkala dars armi ham to'liq foydali dars bo'ladi; faqat ochilish farq qiladi. Birinchi videolar:

- 2026-11-18 `ji-vs-duoshao` — A;
- 2026-11-20 `ye-dou-placement` — B.

Ma'lum chalkashtiruvchi omillar `experiments.json#knownConfounders` da yozilgan.

## Agentlar

- **Ssenariy yozuvchi (Calendar Reserve yoki qo'lda chaqirilgan muallif).** Faol test qamragan kelajakdagi har slot uchun avval quyidagilardan birini o'qiydi:
  - `npm run content:experiments -- --brief <sana>`;
  - MCP `get_content_experiments {date}`.

  Arm hali saqlanmagan bo'lsa, uni `experiments.json#…assignments` ga qo'shadi (`--assign <id> --write` yoki o'sha balans qoidasi bilan ulagich orqali). Keyin har tildagi manbaga `"experiment": {"id","arm","structure"}` blokini yozadi; `structure` arm qadamlarini sahna ID'lariga tartib bilan bog'laydi. `content:buffer` va `content:experiments -- --check` bu blokisiz qoralamani tayyor deb hisoblamaydi.
- **Analitika (Feedback, Dushanba/Chorshanba/Juma).** Faol test postlari uchun 7–10 kunlik oynaga tushgan har kuzatuvni o'z yozuvi bilan saqlaydi. Har Dushanba quyidagi buyruqni ishga tushiradi va hisobotni `content/feedback/reports/` ga yozadi (faqat qo'shiladi, ustidan yozilmaydi):

  ```bash
  npm run content:experiments -- --review --write
  ```

  Tavsiyalari asosli bo'ladi va keyingi testni taklif qiladi, lekin hech qachon ssenariy, siyosat yoki `experiments.json` qarorini o'zgartirmaydi.
- **Nashr.** `scripts/codex-local-video-publish.mjs` har tasdiqlangan Zernio natijasidan keyin `publication-ledger.mjs` orqali yozuvni `content/feedback/publications.json` ga qo'shadi. Eski paketlar uchun quyidagi buyruq ishlatiladi:

  ```bash
  npm run content:publications -- --write
  ```

  Tasdiq qayd etilmagan eski kvitansiyalar o'tkazib yuboriladi va hech narsa taxmin qilinmaydi. Kuzatuvlar Zernio post ID orqali bog'lanadi, sana yoki sarlavha orqali emas.
