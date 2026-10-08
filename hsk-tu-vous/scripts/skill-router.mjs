import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const has = (text, pattern) => pattern.test(text);
const norm = (value) => String(value ?? "").toLowerCase().normalize("NFKC");

export function registeredSkills(root = DEFAULT_ROOT) {
  const doc = fs.readFileSync(path.join(root, "content/SKILLS.md"), "utf8");
  const table = doc.split("## Registered skills")[1]?.split("## Onboarding")[0];
  if (!table) throw new Error("Missing skill registry");
  const backtick = String.fromCharCode(96);
  const skills = new Map();
  for (const line of table.split("\n")) {
    const cells = line.split("|").map((s) => s.trim());
    if (cells.length < 4) continue;
    const [name, route] = cells.slice(1, 3);
    if (name.startsWith(backtick) && route.startsWith(backtick)) {
      skills.set(name.slice(1, -1), route.slice(1, -1));
    }
  }
  return skills;
}

/** Recommendation only: never executes a skill or changes a renderer. */
export function recommendSkills(task, { existingEngine = "unknown", root = DEFAULT_ROOT } = {}) {
  const text = norm(task).trim();
  const registry = registeredSkills(root);

  const finish = (engine, skillNames, reason, confidence = "high", needsClarification = false) => {
    for (const name of skillNames) {
      const route = registry.get(name);
      if (!route) throw new Error("Unregistered skill: " + name);
      if (engine === "remotion" && route === "hyperframes-only") {
        throw new Error("Cannot route HyperFrames skill into Remotion: " + name);
      }
    }
    return {
      engine,
      skills: skillNames.map((name) => ({
        name, route: registry.get(name),
        instructions: ".agents/skills/" + name + "/SKILL.md",
      })),
      confidence, needsClarification, reason,
      caution: "This is a recommendation, not execution or authorization to migrate, install, change voice, upload or publish.",
    };
  };

  if (!text) return finish("clarify", [], "Describe the requested video task.", "low", true);
  const remotion = has(text, /remotion|ремоушин|ремотион|ремоушн/iu);
  const hyper = has(text, /hyperframes|hyper\s*frames|хайперфрейм|гиперфрейм/iu);
  const migrate = has(text, /migrat|convert|портир|кўчир|кучир|миграц|перенос|ўтказ|утказ/iu);
  const existing = has(text, /existing|current|already|existing video|edit |fix |update |мавжуд|ҳозирги|хозирги|олдинги|тузат|ўзгартир|узгартир|исправ|существующ|передел/iu);
  const lesson = has(text, /\bhsk\b|hsk[1-6]|дарс|урок|lesson|курс|иероглиф|hanzi|pinyin|пиньин|грамматик|луғат|лугат|словар/iu);
  const promo = has(text, /promo|промо|реклама|advert|marketing|product launch|launch film|тизер|trailer|трейлер|реклам/iu);
  const premium = has(text, /premium|премиум|махсус|special|кинематограф|cinematic|brand film|complex|мураккаб|сложн|advanced motion|advanced ui|ui animation|интерфейс анимац|эффект|3d intro|motion graphic/iu);
  const makeVideo = has(text, /видео|ролик|reel|shorts?|animation|анимац|монтаж|render|рендер|export|экспорт|яс[ао]|ярат|сделай|создай|create|produce|тайёрла|таерла/iu);
  const ui = has(text, /\bui\b|interface|интерфейс|экран|heroui|кнопка|button/iu);
  const vertical = has(text, /reframe|crop|convert to vertical|16:9.*9:16|горизонтал.*вертикал|вертикал.*формат|reel.export|экспорт.*reels/iu);
  const voiceOnly = has(text, /voice profile|голос|озвучк|овоз|tts|provider|провайдер/iu) && !makeVideo;
  const inquiry = has(text, /^(нима|қандай|кандай|почему|что такое|what is|how does|difference|фарқ|фарк|разница|объясни|тушунтир)\b/iu) && !makeVideo;

  if (voiceOnly || inquiry) return finish("none", [], "Information/configuration task: no video-generation skill required.");
  if (migrate && remotion && hyper) {
    return finish("approval-required", ["remotion-to-hyperframes"],
      "Explicit migration: establish scope and preserve existing source until approved.", "high", true);
  }
  if (remotion && hyper) return finish("clarify", [], "Two engines mentioned; ask which deliverable to build.", "low", true);
  if (existingEngine === "remotion" || (existing && remotion) || (existing && lesson && !hyper)) {
    return finish("remotion", ["remotion-best-practices", ...(ui ? ["heroui-react"] : [])],
      "Preserve the existing Remotion project and its dated episode pipeline.");
  }
  if (existingEngine === "hyperframes" || hyper) {
    return finish("hyperframes", ["hyperframes", ...(promo ? ["product-launch-video"] : premium ? ["motion-graphics"] : ["general-video"])],
      "An explicitly selected/existing standalone HyperFrames deliverable.");
  }
  if (lesson) return finish("remotion", ["remotion-best-practices", ...(ui && makeVideo ? ["heroui-react"] : [])],
    "HSK course content uses its established Remotion pipeline.");
  if (vertical && makeVideo) return finish("postprocess", ["reel-export"],
    "Reframing/exporting existing footage does not change the production engine.");
  if (promo && premium && makeVideo) return finish("hyperframes",
    ["hyperframes", "product-launch-video", ...(ui ? ["hyperframes-animation"] : [])],
    "Standalone premium promo or advanced animation uses the approved HyperFrames path.");
  if (promo && makeVideo) return finish("remotion", ["remotion-best-practices"],
    "Ordinary promo does not require switching video engines.", "medium");
  if (makeVideo && ui) return finish("remotion", ["remotion-best-practices", "heroui-react"],
    "Ordinary UI animation can use the current renderer unless standalone HyperFrames is specified.", "medium");
  if (makeVideo) return finish("clarify", [], "Unspecified video: ask whether dated lesson, existing edit, or standalone special promo.", "low", true);
  return finish("none", [], "This task does not require a video skill.", "medium");
}
