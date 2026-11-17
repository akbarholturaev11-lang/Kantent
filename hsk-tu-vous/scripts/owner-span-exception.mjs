/**
 * Owner one-off exception for single unconfirmed words of ONE saved voice take.
 *
 * This is NOT a spoken-token rule (content/WORKFLOW.md keeps its exact list).
 * The owner listened to the reason and explicitly let named words of a named
 * take pass (real 2026-11-16 bi-comparison takes: RU "с 比" heard as "спи",
 * TG "баъд" heard as "бад"). The file lives inside that take's folder
 * (`owner-span-exceptions.json`) and every entry is bound to the exact chunk
 * audio SHA-256, the exact measured gap bounds and the exact single expected
 * word, so it cannot apply to any other take, span or word.
 *
 * Timing is never estimated:
 *  - "provider-heard": the provider's own timed word with the named spelling,
 *    inside the gap (±120 ms, the recovery tolerance);
 *  - "measured-gap": the gap bounds, which are the provider-timed edges of the
 *    verified neighbouring words (used when the provider merged the word into
 *    a neighbour and returned no separate timing for it);
 *  - "provider-heard-span" (owner 2026-11-17, "шу ёзган вахтини олип хитойчага
 *    угир"): a whole gap of several words that the owner listened to and found
 *    correctly spoken, while the recognizer wrote a translation or a homophone
 *    (RU take: 这个多少钱 written as "Этот сколько денег"). The interval runs from
 *    the provider's own start of the first heard word to its own end of the last
 *    heard word, inside the gap; the covered source words are shown together.
 * Captions still display the source narration word.
 */
export const OWNER_SPAN_EXCEPTIONS_FILE = "owner-span-exceptions.json";
const TIMINGS = new Set(["provider-heard", "measured-gap", "provider-heard-span"]);
const plain = (text) => String(text ?? "").toLocaleLowerCase("und").replace(/[\p{P}\s]+/gu, "");

export function validateOwnerSpanExceptions(record) {
  if (!record || record.approvedBy !== "owner" || typeof record.ownerWords !== "string" ||
      !record.ownerWords.trim() || typeof record.approvedAt !== "string" || !Array.isArray(record.exceptions) ||
      !record.exceptions.length)
    throw new Error("Owner span exceptions need approvedBy=owner, the owner's words, a date and entries.");
  for (const entry of record.exceptions) {
    if (!Number.isInteger(entry?.chunk) || entry.chunk < 1 || !/^[0-9a-f]{64}$/.test(entry.audioSha256 ?? "") ||
        !Number.isInteger(entry.startMs) || !Number.isInteger(entry.endMs) || entry.endMs <= entry.startMs ||
        typeof entry.expected !== "string" || !entry.expected.trim() ||
        (entry.timing !== "provider-heard-span" && /\s/.test(entry.expected.trim())) ||
        !TIMINGS.has(entry.timing) || (entry.timing !== "measured-gap" && !plain(entry.heard)))
      throw new Error("Invalid owner span exception entry: " + JSON.stringify(entry));
  }
  return record;
}

/** Recovered block for an owner-excepted gap, or null when no entry applies. */
export function ownerSpanException({ record, chunk, audioSha256, gap, gapBlocks = [] }) {
  if (!record) return null;
  const tokens = gap?.tokens ?? [];
  if (!tokens.length) return null;
  const entry = record.exceptions.find((item) => item.chunk === chunk && item.audioSha256 === audioSha256 &&
    item.startMs === gap.startMs && item.endMs === gap.endMs &&
    (item.timing === "provider-heard-span" ? item.expected.trim().split(/\s+/).join(" ") === tokens.join(" ")
      : tokens.length === 1 && item.expected === tokens[0]));
  if (!entry) return null;
  let timing;
  if (entry.timing === "provider-heard-span") {
    const words = entry.heard.trim().split(/\s+/).map(plain).filter(Boolean);
    const inside = gapBlocks.filter((block) => block.startMs >= gap.startMs - 120 && block.endMs <= gap.endMs + 120 &&
      block.endMs > block.startMs);
    if (!words.every((word) => inside.some((block) => plain(block.text) === word))) return null;
    const startMs = Math.min(...inside.filter((block) => plain(block.text) === words[0]).map((block) => block.startMs));
    const endMs = Math.max(...inside.filter((block) => plain(block.text) === words.at(-1)).map((block) => block.endMs));
    if (!(endMs > startMs)) return null;
    timing = { startMs, endMs };
  } else if (entry.timing === "measured-gap") {
    timing = { startMs: gap.startMs, endMs: gap.endMs };
  } else {
    const candidates = gapBlocks
      .filter((block) => plain(block.text) === plain(entry.heard) &&
        block.startMs >= gap.startMs - 120 && block.endMs <= gap.endMs + 120 && block.endMs > block.startMs)
      .sort((a, b) => a.startMs - b.startMs || (b.endMs - b.startMs) - (a.endMs - a.startMs));
    if (!candidates.length) return null;
    timing = { startMs: candidates[0].startMs, endMs: candidates[0].endMs };
  }
  return {
    block: { text: tokens.join(entry.timing === "provider-heard-span" ? "" : " "), tokens: [...tokens], ...timing, ownerException: entry.timing },
    applied: { chunk, startMs: gap.startMs, endMs: gap.endMs, expected: entry.expected,
      timing: entry.timing, ...(entry.heard ? { heard: entry.heard } : {}), wordStartMs: timing.startMs,
      wordEndMs: timing.endMs, ownerWords: record.ownerWords, approvedAt: record.approvedAt },
  };
}
