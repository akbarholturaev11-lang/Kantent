---
name: ig-caption-quality
description: Instagram feed-caption editorial QA for HSK AI approved preview text, not burned-in video subtitles.
---

# Instagram publication caption QA — HSK AI

**Scope:** a *copy-only* check of the Instagram publication text. Do not confuse post captions with word-timed Remotion subtitles.

## Read canonical sources
- `AI_RULES.md` social publication and claims guardrails.
- `content/CTA_LAB.md` and **current** `content/cta-lab.json` before suggesting copy changes.
- `content/WORKFLOW.md` final preview/publishing gate and the exact currently generated Instagram post text.

## Editorial checks
1. Show the *actual* opening line and a **rough first ~125-character mobile-feed preview**. The cutoff is interface-dependent, **not** a hard Instagram API guarantee. Avoid a useful promise hidden after truncation.
2. Verify Russian Cyrillic audience copy matches the current series, and that every instructional claim is correct with Chinese characters, tone-marked pinyin and meaning where applicable. Keep one teaching objective.
3. Detect generic engagement bait, forced hashtags, unverified numbers, fabricated testimonials, excess emoji, missing search-relevant terms or multiple competing asks.
4. Check platform length/hashtag restrictions against current official documentation if accuracy matters; **never freeze a stale cap as a canonical rule**.
5. Only suggest an alternative publication caption in the **exact preview**. Do not silently change the approved platform CTA, episode narration, `review/<id>/episode.json`, generated video, caption SRT, published posts or central CTA registry.
6. The owner must explicitly approve the final destination account, exact video hash, full caption, hashtags, disclosures and timing before the existing Zernio flow can publish.

## Output
First-line preview; concise PASS/WARN findings with concrete changes; one corrected Russian-language caption **proposal**; list of any claims requiring evidence. An editorial PASS is not permission to publish.

## Provenance
Inspired by [instagram-agent-skill/ig-caption](https://github.com/Jakeschincariol/instagram-agent-skill/tree/main/skills/ig-caption) (MIT). No extra scraper, Python linter, automatic rewriter or parallel CTA source is installed.
