# HSK AI Hanzi recognition practice — verified product-source receipt (2026-11-22)

Product repository: `akbarholturaev11-lang/HSK-AI-Bot`, branch `main`.
Current verified file: `app/static/course_v3_recognition.html`, blob SHA `e901a3c3e25427f908fbda3ae52cdc393d015c5c`.
URL: https://github.com/akbarholturaev11-lang/HSK-AI-Bot/blob/main/app/static/course_v3_recognition.html
Additional current file: `app/static/course-v3.html`, blob SHA `aacb025655196ef6c48e21beffc64b63da90dbef`.
URL: https://github.com/akbarholturaev11-lang/HSK-AI-Bot/blob/main/app/static/course-v3.html

## Claims supported by current implementation

- HSK AI includes the feature explicitly labelled in the Russian UI **«Распознавание иероглифов»**, with description **«Найдите нужный среди похожих»**; the Tajik UI supplies the equivalent **«Аз байни монандҳо дурустро ёбед»**. The course shell opens `course_v3_recognition.html` through `RESOURCE.openPractice` in PWA mode.
- In the actual recognition UI, `render()` displays the target pinyin `q.py`, a localized meaning `q.mn`, and answer tiles `q.opts` containing Chinese characters. `pick(k)` checks `q.opts[k].ok`; correct tiles get an `ok` class, an incorrect chosen tile gets a `bad` class, and the result is recorded. No outcome or score uplift is guaranteed.
- The screen uses real questions only when the word pool and plan are available. Free access/limits can apply; never claim unlimited or universal access.

**Source evidence is not a live screenshot.** No real RU/TG screenshot of this recognition practice screen has been verified or committed for the November 24 advertisement. The replacement is a bilingual CTA-free draft **BLOCKED for media and source-complete readiness** until an actual current HSK AI recognition screen is captured and reviewed for authenticity, local language, privacy, feature parity, and legibility. No fabricated quiz question, screen, result or user testimonial may substitute for a screenshot.

Required future media paths, not yet files:
- `public/promo-captures/hanzi-recognition-20261124-ru.png`
- `public/promo-captures/hanzi-recognition-20261124-tg.png`
