/**
 * Meaning visuals for motion slides (content/EDITING_SPEC.md#professional-motion-system):
 * which animated, topic-matched component shows what the Chinese means.
 * Pure and deterministic; the reusable word lexicon is content/meaning-visuals.json,
 * so every future lesson gets the same treatment without per-lesson authoring.
 * Coverage report CLI: scripts/meaning-visual-check.mjs.
 */
import { formulaChips, lessonFocus, planVisualModes } from "./pro-motion-plan.mjs";

const CAST = ["panda", "crane", "monkey", "rabbit", "dragon"];

/** Every icon src/pro-motion/MeaningIcons.tsx draws (its type requires one drawing per kind). */
export const MEANING_ICON_KINDS = ["compare", "intensity", "height", "cold", "hot", "day", "count", "size", "speed", "choice", "also", "all", "and",
  "no", "skill", "can", "question", "where", "number", "price", "done", "pin", "have", "check", "near", "far", "think", "want", "heart",
  "on", "under", "in", "beside", "clock", "book", "table", "chair", "cup", "tea", "coffee", "water", "bowl", "apple", "coin", "bag", "phone",
  "laptop", "house", "school", "student", "board", "medic", "car", "plane", "cat", "dog", "rain", "sun", "swim", "eye", "pencil", "speech",
  "go", "come", "cart", "sleep", "work", "ear", "music",
  "shirt", "shoe", "train", "bus", "bike", "shop", "ticket", "fish", "egg", "milk", "screen", "ball", "run", "gift", "flower", "tree", "umbrella", "door", "snow", "moon", "cake", "cloud", "camera", "palette", "card", "mountain"];
/** Comparison stages src/pro-motion/MeaningStages.tsx draws. */
export const MEANING_COMPARISON_COMPONENTS = ["height", "thermometer", "bars", "count"];
const hanOnly = (text) => (String(text ?? "").match(/\p{Script=Han}/gu) ?? []).join("");

/**
 * "A 比 B (adverb) ADJ (多了/一点儿)", "A 没有 B (那么) ADJ" and "A 跟/和 B 一样 ADJ"
 * → an animated comparison on one baseline. With 比 A takes the lexicon's
 * `more` value and B the `less` value; with 没有 the sides swap (A is less
 * ADJ than B); with 一样 both stand level. Person pronouns become HSK AI cast
 * members (never people). Null when no form matches or the adjective is not
 * in the lexicon.
 */
export function comparisonMeaning(copy, lexicon) {
  const text = hanOnly(copy?.hanzi);
  const adjectives = alternation(Object.keys(lexicon.comparisons ?? {}));
  if (!text || !adjectives) return null;
  const adverbs = alternation(lexicon.adverbs ?? []);
  const adverb = adverbs ? `(?:${adverbs})?` : "";
  const forms = [
    { marker: "比", relation: "more", re: new RegExp(`^(.+?)比(.+?)${adverb}(${adjectives})(?:得多|多了|一点儿|一点|一些|点儿|[一二两三四五六七八九十几]+(?:岁|块|个|米|公斤|斤|分钟|天|年|本|次|度)?)?[吗呢]?$`, "u") },
    { marker: "没有", relation: "less", re: new RegExp(`^(.+?)没有(.+?)(?:那么|这么)?(${adjectives})[吗呢]?$`, "u") },
    { marker: "一样", relation: "equal", re: new RegExp(`^(.+?)(?:跟|和)(.+?)一样(${adjectives})[吗呢]?$`, "u") },
  ];
  for (const { marker, relation, re } of forms) {
    const match = text.match(re);
    if (!match) continue;
    const [, aText, bText, adjective] = match;
    const chips = formulaChips(copy);
    const pinyinOf = (part) => chips.find((chip) => chip.hanzi === part)?.pinyin ?? null;
    const spec = lexicon.comparisons[adjective];
    const aCast = lexicon.roles?.[aText] ?? null;
    let bCast = lexicon.roles?.[bText] ?? null;
    if (bCast && bCast === aCast) bCast = CAST.find((id) => id !== aCast);
    const [aValue, bValue] = relation === "more" ? [spec.more, spec.less] : relation === "less" ? [spec.less, spec.more] : [spec.more, spec.more];
    return {
      component: spec.component, unit: spec.unit ?? "", relation, marker,
      a: { hanzi: aText, pinyin: pinyinOf(aText), cast: aCast, value: aValue },
      b: { hanzi: bText, pinyin: pinyinOf(bText), cast: bCast, value: bValue },
      adjective: { hanzi: adjective, pinyin: pinyinOf(adjective) },
    };
  }
  return null;
}

/** Which part of the comparison the narration is naming now. */
export function comparisonRole(meaning, highlight) {
  const key = hanOnly(highlight);
  if (!meaning || !key || !meaning.a) return null;
  if (key === meaning.a.hanzi) return "a";
  if (key === meaning.b.hanzi) return "b";
  if (key === meaning.marker || key === "比") return "sign";
  if (key === meaning.adjective.hanzi) return "adj";
  return null;
}

/** The animated icon of a single word or short form shown on a card, or null. */
export function meaningIcon(text, lexicon) {
  const key = hanOnly(text);
  return lexicon.icons?.[key] ?? lexicon.objects?.[key] ?? null;
}

const alternation = (keys) => [...keys].sort((a, b) => b.length - a.length).join("|");

/** The object or action a text names: the lexicon key ending latest (then the longest). */
export function objectIn(text, lexicon) {
  const source = hanOnly(text);
  let best = null;
  for (const [key, icon] of Object.entries(lexicon.objects ?? {})) {
    const at = source.lastIndexOf(key);
    if (at < 0) continue;
    const end = at + key.length;
    if (!best || end > best.end || (end === best.end && key.length > best.hanzi.length)) best = { hanzi: key, icon, end };
  }
  return best ? { hanzi: best.hanzi, icon: best.icon } : null;
}

/** An exact word as a thing: object or icon word, else the object it ends with. */
const thingOf = (text, lexicon) => {
  const key = hanOnly(text);
  const icon = lexicon.objects?.[key] ?? lexicon.icons?.[key];
  if (icon) return { hanzi: key, icon };
  const inner = objectIn(key, lexicon);
  return inner && key.endsWith(inner.hanzi) ? { hanzi: key, icon: inner.icon } : null;
};

const subjectOf = (text, lexicon) => {
  const key = Object.keys(lexicon.roles ?? {}).filter((role) => hanOnly(text).startsWith(role)).sort((a, b) => b.length - a.length)[0];
  if (!key) return null;
  return { hanzi: key, cast: lexicon.groups?.[key] ?? [lexicon.roles[key]] };
};

/** "三" → 3, "十五" → 15, "三十" → 30. */
const numberOf = (word, lexicon) => [...word].reduce((sum, ch) => (ch === "十" ? (sum || 1) * 10 : sum + (lexicon.numerals?.[ch] ?? 0)), 0);

/** Numeral or question word + optional measure word + the counted thing. */
function quantityIn(text, lexicon) {
  const numerals = Object.keys(lexicon.numerals ?? {}), questions = Object.keys(lexicon.questionNumbers ?? {});
  const measures = lexicon.measures ?? [];
  const pattern = [questions.length ? alternation(questions) : "", numerals.length ? `[${numerals.join("")}]+(?![起样下直定般共边些点])` : ""].filter(Boolean).join("|");
  if (!pattern) return null;
  const match = hanOnly(text).match(new RegExp(`(${pattern})(${measures.length ? alternation(measures) : "(?!)"})?(.*)$`, "u"));
  if (!match) return null;
  const [, word, measure = null, rest] = match;
  const question = questions.includes(word) ? word : null;
  const count = question ? null : numberOf(word, lexicon);
  const item = objectIn(rest, lexicon) ?? (measure ? { hanzi: measure, icon: lexicon.objects?.[measure] ?? null } : null);
  return { question, count, measure, item, range: question ? lexicon.questionNumbers[question].range : null };
}

/**
 * What a sentence means, as an animated stage: a 比 comparison, an object
 * placed on/under/in another (有 / 在), a choice (还是 / 或者), a skill or
 * permission (会 / 能 / 不能), inclusion (也 / 都), a degree (有点儿 / 一点儿),
 * a quantity or price (几 / 多少 / numeral + measure word), an identity
 * (A 是 B), a wish or liking (想 / 要 / 喜欢), a question or a plain action. Null when no pattern applies (preparation then stops with meaning-visuals-required so Codex builds it;
 * the renderer's lesson-art card is only a safety net).
 */
export function sentenceMeaning(copy, lexicon) {
  const text = hanOnly(copy?.hanzi);
  if (!text) return null;
  const comparison = comparisonMeaning(copy, lexicon);
  if (comparison) return { pattern: "comparison", ...comparison };
  const positions = alternation(Object.keys(lexicon.positions ?? {}));
  if (positions) {
    const exists = text.match(new RegExp(`^(.+?)(${positions})有(.+)$`, "u"));
    if (exists) {
      const quantity = quantityIn(exists[3], lexicon);
      return { pattern: "location", form: "exists", position: lexicon.positions[exists[2]], positionHanzi: exists[2],
        container: objectIn(exists[1], lexicon) ?? { hanzi: exists[1], icon: null },
        item: quantity?.item ?? objectIn(exists[3], lexicon) ?? { hanzi: exists[3], icon: null },
        count: quantity?.count ?? null, measure: quantity?.measure ?? null };
    }
    const placed = text.match(new RegExp(`^(.+?)在(.+?)(${positions})$`, "u"));
    if (placed) return { pattern: "location", form: "placed", position: lexicon.positions[placed[3]], positionHanzi: placed[3],
      container: objectIn(placed[2], lexicon) ?? { hanzi: placed[2], icon: null },
      item: objectIn(placed[1], lexicon) ?? { hanzi: placed[1], icon: null }, count: null, measure: null };
    // A bare place phrase ("桌子上"): the spot itself glows on the container.
    const place = text.match(new RegExp(`^(.+?)(${positions})$`, "u"));
    if (place && thingOf(place[1], lexicon)) return { pattern: "location", form: "place", position: lexicon.positions[place[2]],
      positionHanzi: place[2], container: thingOf(place[1], lexicon), item: null, count: null, measure: null };
  }
  const choiceKey = Object.keys(lexicon.choices ?? {}).find((key) => text.includes(key));
  if (choiceKey) {
    const [left, right] = [text.slice(0, text.indexOf(choiceKey)), text.slice(text.indexOf(choiceKey) + choiceKey.length)];
    const options = [objectIn(left, lexicon), objectIn(right.replace(/(都行|都可以|都好)$/u, ""), lexicon)];
    if (options.every(Boolean) && options[0].hanzi !== options[1].hanzi)
      return { pattern: "choice", kind: lexicon.choices[choiceKey], marker: choiceKey, options,
        subject: subjectOf(left, lexicon) };
  }
  // A shown list of options ("茶 / 咖啡", "茶、咖啡、水"): the options side by side.
  const listed = String(copy?.hanzi ?? "").split(/\s*[\/／·、，,|]\s*/u).map(hanOnly).filter(Boolean);
  if (listed.length >= 2 && listed.length <= 3 && listed.every((part) => thingOf(part, lexicon)) && new Set(listed).size === listed.length)
    return { pattern: "choice", kind: "pair", marker: null, options: listed.map((part) => thingOf(part, lexicon)), subject: null };
  const modals = alternation(Object.keys(lexicon.modals ?? {}));
  const modal = modals && text.match(new RegExp(`^(.*?)(今天|明天|现在)?(${modals})(.+)$`, "u"));
  if (modal) {
    const action = objectIn(modal[4], lexicon);
    if (action) return { pattern: "modal", modal: lexicon.modals[modal[3]], modalHanzi: modal[3],
      subject: subjectOf(modal[1], lexicon), time: modal[2] ?? null, action };
  }
  const inclusion = text.match(/^(.+?)(也|都)(是|有|会|要|喜欢|在)?(.+)$/u);
  if (inclusion && subjectOf(inclusion[1], lexicon)) {
    const predicate = objectIn(inclusion[4], lexicon) ?? { hanzi: inclusion[4], icon: null };
    return { pattern: "inclusion", kind: lexicon.inclusion?.[inclusion[2]] ?? "also", marker: inclusion[2],
      verb: inclusion[3] ?? null, subject: subjectOf(inclusion[1], lexicon), predicate };
  }
  const degrees = alternation(Object.keys(lexicon.degrees ?? {}));
  const adjectives = alternation(Object.keys(lexicon.comparisons ?? {}));
  const before = degrees && adjectives ? text.match(new RegExp(`(${degrees})(${adjectives})`, "u")) : null;
  const after = degrees && adjectives ? text.match(new RegExp(`(${adjectives})(${degrees})`, "u")) : null;
  const degree = before ? [before[0], before[1], before[2]] : after ? [after[0], after[2], after[1]] : null;
  if (degree) {
    const [degreeHanzi, adjective] = [degree[1], degree[2]];
    return { pattern: "degree", degree: lexicon.degrees[degreeHanzi], degreeHanzi,
      adjective: { hanzi: adjective, icon: meaningIcon(adjective, lexicon) },
      after: Boolean(!before && after) };
  }
  if (text.includes("几点")) return { pattern: "question", word: "几点", object: objectIn(text, lexicon), subject: subjectOf(text, lexicon) };
  const quantity = quantityIn(text, lexicon);
  if (quantity && (quantity.item || quantity.question)) {
    const price = /钱|块|元/u.test(text);
    // What is priced: the thing named before the price ("这件衣服多少钱" → 衣服).
    const before = price ? text.slice(0, text.search(/多少|几|[一二两三四五六七八九十]+(块|元)/u)) : "";
    const priced = price ? objectIn(before.replace(/钱$/u, ""), lexicon) : null;
    // A stated price ("十五块") is the amount the counter rolls up to.
    const amount = price ? text.match(/([一二两三四五六七八九十]+)(块|元)/u) : null;
    const stated = amount ? { question: null, count: numberOf(amount[1], lexicon), measure: amount[2], range: null } : {};
    return { pattern: "quantity", price, ...quantity, ...stated, priced: priced && priced.icon !== "coin" ? priced : null, subject: subjectOf(text, lexicon) };
  }
  const want = text.match(/^(.+?)(想要|想|要|喜欢|爱)(.+)$/u);
  if (want && subjectOf(want[1], lexicon) && objectIn(want[3], lexicon))
    return { pattern: "want", kind: ["喜欢", "爱"].includes(want[2]) ? "like" : "want", verbHanzi: want[2],
      subject: subjectOf(want[1], lexicon), object: objectIn(want[3], lexicon) };
  const identity = text.match(/^(.+?)是(.+)$/u);
  if (identity && subjectOf(identity[1], lexicon))
    return { pattern: "inclusion", kind: "identity", marker: "是", verb: "是", subject: subjectOf(identity[1], lexicon),
      predicate: objectIn(identity[2], lexicon) ?? { hanzi: identity[2], icon: null } };
  const question = text.match(/(吗|呢|什么|谁|哪儿|哪里|怎么样|怎么|几点)/u);
  if (question) return { pattern: "question", word: question[1], object: objectIn(text, lexicon), subject: subjectOf(text, lexicon) };
  // Any other sentence naming an action or thing: who does it, when, together,
  // refused (不/没) or completed (了/过).
  const action = objectIn(text, lexicon);
  if (action) {
    const times = alternation(Object.keys(lexicon.times ?? {}));
    const time = times ? text.match(new RegExp(`(${times})`, "u"))?.[1] ?? null : null;
    const partner = text.match(/(?:和|跟)(.+?)一起/u);
    return { pattern: "action", subject: subjectOf(text, lexicon), action, time,
      negated: /(^|[^还])(不|没有|没|别)/u.test(text.replace(/不错|没关系|不客气/gu, "")),
      done: /了$|了[^解]|过/u.test(text), together: partner ? subjectOf(partner[1], lexicon) ?? { hanzi: partner[1], cast: [] } : null };
  }
  return null;
}

const LEAD_ICONS = { location: { on: "on", under: "under", in: "in", beside: "beside" }, modal: { skill: "skill", can: "can", noskill: "no", cannot: "no" },
  inclusion: { also: "also", all: "all", identity: "check" } };

/**
 * The one animated icon a word card, hero word or stacked row shows: the word's
 * own icon, else the icon leading its sentence pattern (a place phrase shows its
 * position, a comparison its adjective, a choice the balance…). Null when the
 * lexicon has nothing that fits.
 */
export function slideIcon(text, lexicon) {
  const key = hanOnly(text);
  if (!key) return null;
  const own = meaningIcon(key, lexicon);
  if (own) return own;
  const meaning = sentenceMeaning({ hanzi: text }, lexicon);
  if (!meaning) return null;
  switch (meaning.pattern) {
    case "comparison": return meaningIcon(meaning.adjective.hanzi, lexicon) ?? "compare";
    case "location": return meaning.form === "place" ? LEAD_ICONS.location[meaning.position] ?? "pin"
      : meaning.item?.icon ?? LEAD_ICONS.location[meaning.position] ?? "pin";
    case "choice": return "choice";
    case "modal": return LEAD_ICONS.modal[meaning.modal] ?? "can";
    case "inclusion": return LEAD_ICONS.inclusion[meaning.kind] ?? "check";
    case "degree": return "intensity";
    case "quantity": return meaning.price ? "price" : meaning.item?.icon ?? "number";
    case "want": return meaning.kind === "like" ? "heart" : "want";
    case "question": return meaningIcon(meaning.word, lexicon) ?? "question";
    case "action": return meaning.action.icon ?? null;
  }
  return null;
}

/**
 * Coverage of one lesson: every motion slide and what meaning visual it gets.
 * `missing` lists the forms the lexicon cannot illustrate yet.
 */
export function meaningCoverage(scenes, lexicon) {
  const focus = lessonFocus(scenes.flatMap((scene) => scene.beats ?? []));
  const covered = [], missing = [];
  const note = (entry, ok) => (ok ? covered : missing).push(entry);
  for (const scene of scenes) {
    const beats = scene.beats ?? [];
    if (!beats.some((beat) => beat.visual?.illustration)) continue;
    const modes = planVisualModes(beats, focus);
    const seen = new Set();
    modes.forEach((mode, index) => {
      if (mode.mode !== "slide" || seen.has(mode.content)) return;
      seen.add(mode.content);
      const where = { sceneId: scene.id, beatId: beats[index].id, template: mode.template };
      if (mode.template === "formula") {
        const copy = beats[mode.formulaBeat].visual;
        const meaning = sentenceMeaning(copy, lexicon);
        note({ ...where, text: hanOnly(copy?.hanzi), visual: meaning ? meaning.pattern + (meaning.component ? ":" + meaning.component : "") : null }, Boolean(meaning));
        return;
      }
      const rows = mode.template === "contrast"
        ? String(beats[mode.rows[0]].visual?.hanzi ?? "").split("·")
        : (mode.rows ?? []).map((row) => beats[row].visual?.hanzi);
      for (const text of rows) {
        const key = hanOnly(text);
        if (!key) continue;
        const icon = slideIcon(text, lexicon);
        note({ ...where, text: key, visual: icon ? "icon:" + icon : null }, Boolean(icon));
      }
    });
  }
  return { covered, missing };
}
