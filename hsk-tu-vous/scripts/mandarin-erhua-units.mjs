/**
 * Acoustic alignment unit policy for the verified colloquial suffix 点儿.
 * In this lesson 点儿 (diǎnr) is rhotacized as ONE syllable. A provider may
 * output an instantaneous 儿 after a fully timed 点. We never invent a new
 * duration for the suffix; the combined unit inherits the real 点 boundaries.
 * No other 儿 spelling is folded without independent pronunciation evidence.
 */
export function splitExperimentalMandarinUnits(text) {
  if (typeof text !== "string" || !/^\p{Script=Han}+$/u.test(text))
    throw Error("Mandarin acoustic unit split requires nonempty Hanzi only.");
  const chars = Array.from(text);
  const units = [];
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] === "点" && chars[i + 1] === "儿") {
      units.push("点儿");
      i += 1;
    } else {
      units.push(chars[i]);
    }
  }
  if (units.join("") !== text) throw Error("Mandarin unit folding changed the source characters.");
  return units;
}
