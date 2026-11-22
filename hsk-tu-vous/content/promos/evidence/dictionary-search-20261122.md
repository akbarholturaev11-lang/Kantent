# HSK AI dictionary search — product-source verification (2026-11-22)

Source product repository: `akbarholturaev11-lang/HSK-AI-Bot`.
File: `app/static/hsk-lugat.html`, branch `main`.
Verified GitHub blob SHA: `ce1d9a884be543de5f81d4caa63ee880aed05a82`.
URL: https://github.com/akbarholturaev11-lang/HSK-AI-Bot/blob/main/app/static/hsk-lugat.html

## Verified from real current code (not an invented screen)

- The search input `id="search"` has a placeholder inviting queries by meaning, pinyin or Hanzi. The Russian UI placeholder is «Поиск по значению, пиньиню или иероглифу…».
- In `renderList(query)`, results are filtered by `w.h.indexOf(q)` (Hanzi), `w._p.indexOf(qPinyin)` (normalized pinyin) or `w._m.indexOf(qLower)` (meaning).
- The actual `dictRowHtml(w)` renders `w.h` (characters), `w.p` (pinyin) and `text(w.m)` (localized meaning). The code exposes language-specific UI settings including Russian and Tajik.
- The feature is linked from the HSK AI PWA/course shell `app/static/course-v3.html` (GitHub blob `aacb025655196ef6c48e21beffc64b63da90dbef`, 2026-11-22).

Claims supported: dictionary search by characters/pinyin/meaning; result rows display characters/pinyin/meaning.

**Limitations:** Source verification is not a real-user search test, a live deployment test, proof that any particular word is in the catalog, a captured video, or an authenticated UI screenshot. No first-person testimonial, learning outcome, offline mode or guaranteed result is supported.

**Required before product-demo/media readiness:** Obtain and inspect a genuine HSK AI dictionary screen capture from the current real application, with no invented text, responses, or translated fake UI; confirm language/privacy and match the exact source. The ad storyboard must remain blocked for media until this evidence exists.
