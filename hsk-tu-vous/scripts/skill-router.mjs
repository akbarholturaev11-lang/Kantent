import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadSkillCatalog(root = DEFAULT_ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, "content/skill-catalog.json"), "utf8"));
}

export function registeredSkills(root = DEFAULT_ROOT) {
  return new Map(Object.entries(loadSkillCatalog(root).skills).map(([name, item]) => [name, item.route]));
}

const has = (text, pattern) => pattern.test(text);
const normal = (text) => String(text ?? "").normalize("NFKC").toLocaleLowerCase("und");

/**
 * Conservative, advisory, stage-aware routing.
 * Reading a SKILL.md is NOT permission to run updates, source new media, change
 * voice providers, alter brand tokens, migrate the renderer or publish a video.
 */
export function recommendSkills(task, { existingEngine = "unknown", root = DEFAULT_ROOT } = {}) {
  const t = normal(task).trim();
  const catalog = loadSkillCatalog(root);
  const known = catalog.skills;
  const re = {
    remotion: /remotion|ремоушин|ремоушн|ремотион/iu,
    hyper: /hyperframes|hyper.frames|хайперфрейм|гиперфрейм/iu,
    migrate: /migrat|convert|портир|кўчир|кучир|миграц|перенос|перенес|переведи|ўтказ|утказ/iu,
    editing: /existing|current|already|fix |update |edit\b|мавжуд|ҳозирги|хозирги|олдинги|тузат|ўзгартир|узгартир|исправ|существующ|передел|таҳрир|тахрир/iu,
    lesson: /дарс|урок|lesson|курс виде|учебн|грамматик|иероглиф|hanzi|pinyin|пиньин|луғат|лугат|словар|слова китай|vocabulary|вокабул/iu,
    hskNumber: /hsk[\s.-]*[1-6](?:\.0)?/iu,
    promo: /promo|промо|реклама|reklama|advert|marketing|product launch|launch film|тизер|trailer|трейлер|реклам|продвижен|презентац.*продукт/iu,
    premium: /premium|премиум|махсус|special|кинематограф|cinematic|brand film|complex|мураккаб|сложн|advanced|продвинут|motion graphic/iu,
    video: /video|видео|ролик|rolik|reel|shorts?|animation|анимац|монтаж|render|рендер|export|экспорт|яс[ао]|yasa|ярат|сделай|создай|create|generate|produce|тайёрла|таерла|тайёр|таёр|tayyorla|tayorla|собери/iu,
    captions: /caption|subtitle|субтитр|титр|vtt|srt|captions?/iu,
    layout: /layout|жойлаш|располож|композиц|позици|overlap|перекры|экран|screen layout|шрифт|типограф|font size|text size/iu,
    ui: /\bui\b|interface|интерфейс|heroui|кнопка|button|modal/iu,
    effects: /эффект|effect|transition|переход|анимац|motion|ҳаракат|харакат|keyframe|кейфрейм|3d|glitch|wipe|crossfade/iu,
    audio: /music|sound|audio|озвуч|овоз|голос|voice|тишина|музыка|микс|soundtrack|sfx|ducking|сведение|bgm/iu,
    figma: /figma|фигма/iu,
    vertical: /reframe|crop|16:9.*9:16|горизонтал.*вертикал|вертикал.*формат|reel.export|экспорт.*reels/iu,
    brand: /rebrand|brand reset|брендни қайта|брендни янгила|новый бренд|brand intake|фирменн.*обнов/iu,
    newFootage: /talking.head|интервью|подкаст|спикер|говорящ.{0,10}голов|existing footage|готов.{0,8}видео/iu,
    graphicOverlay: /overlay|graphics over|инфографик.*поверх|плашк|callout|lower.third/iu,
    sourceQuestion: /^(нима|қандай|кандай|почему|что такое|what is|how does|difference|фарқ|фарк|разница|объясни|тушунтир)/iu,
  };
  const flags = Object.fromEntries(Object.entries(re).map(([k,v]) => [k, has(t,v)]));
  // These are editorial phases, not an alternative renderer, subtitle track or
  // publishing integration. Only explicitly Instagram-scoped tasks may route here.
  const igTask = /instagram|инстаграм|инста|\breels?\b|рилс|рилз/iu.test(t);
  const socialResearch = /конкурент|рақиб|ракиб|рақобат|ракобат|competitor|benchmark|ниша.*(?:анализ|таҳлил|тахлил)|соперник/iu.test(t);
  const socialCaption = /\bcaption\b|подпись|описани[ея]|пост матни|пост учун матн|хештег|хэштег|hashtags?|post copy/iu.test(t)
    && !/субтитр|\bsubtitle\b|\bsrt\b|\bvtt\b/iu.test(t);
  const socialHook = /\bhooks?\b|хук|зацепк|илмоқ|илмок|первые.{0,12}секунд|биринчи.{0,12}секунд/iu.test(t);
  const mediaExecution = /рендер|render|экспорт|export|монтаж|собери видео|видеони тайёрла|видео ясаб|видео ярат|ролик ясаб/iu.test(t);
  const activeStageIds = [];
  const helperSkills = [];

  const make = (engine, names, reason, confidence = "high", needsClarification = false, branch = null) => {
    const unique = [...new Set(names)];
    for (const name of unique) {
      if (!known[name]) throw new Error("Unregistered skill: " + name);
      if (engine === "remotion" && known[name].route === "hyperframes-only") throw new Error("HyperFrames skill cannot run inside Remotion: " + name);
    }
    return {
      engine, branch, confidence, needsClarification, reason,
      selectedStages: activeStageIds,
      ...(flags.promo ? {creativeGuidance: {
        policy:'content/creative-formats.json#promoPolicy',
        presentation:'content/visual-system.json#promoPresentation',
        workflow:'content/PROMO_WORKFLOW.md',
        nextAction:'Author the original situation-led promo and cue-linked visuals, then validate it with content:promo-plan or get_promo_plan before media production.',
      }} : {}),
      skills: unique.map((name) => ({
        name,
        category: known[name].category,
        route: known[name].route,
        instructions: ".agents/skills/" + name + "/SKILL.md",
      })),
      caution: "Recommendations only. Preserve existing work; no new voice, transcriber, dependency, brand source, upload, migration or publication is authorized.",
    };
  };
  const stage = (id, branch) => {
    const recipe = catalog.recipes[id]?.[branch];
    if (!recipe) throw new Error("Missing stage recipe: " + id + "/" + branch);
    activeStageIds.push({
      step: id, branch, owner: recipe.owner, references: recipe.references ?? [],
      optionalHelpers: recipe.helpers ?? [],
      notes: recipe.notes,
    });
    return recipe.owner;
  };
  const withStages = (engine, branch, workflowName, stageIds, reason, confidence = "high") => {
    const names = (Array.isArray(workflowName) ? workflowName : [workflowName]).filter(Boolean);
    for (const id of stageIds) {
      const owner = stage(id, branch);
      if (owner) names.push(owner);
    }
    return make(engine, names, reason, confidence, false, branch);
  };

  if (!t) return make("clarify", [], "The video task is unspecified.", "low", true);
  // Do not treat a question about a technique as a request to create a video.
  if (flags.sourceQuestion && !flags.video) return make("none", [], "Question only: do not execute skills.");
  if (igTask && socialResearch && !mediaExecution) {
    return withStages("none", "special", null, ["social_research"], "Read-only Instagram competitor analysis; do not scrape, publish or overwrite HSK performance data.");
  }
  if (igTask && socialCaption && !mediaExecution) {
    return withStages("none", "special", null, ["social_caption"], "Review platform post copy only, not Gemini word-level video subtitles or the approved CTA.");
  }
  if (igTask && socialHook && !mediaExecution &&
      /напиш|придум|предлож|вариант|сценар|ёз|ёзиб|таклиф|режа|план|plan|draft|write|analy|анализ|таҳлил|тахлил/iu.test(t)) {
    return withStages("none", "lesson", null, ["social_hook"], "Plan Instagram lesson hooks before production; preserve canonical Hook Lab and narration timing.");
  }
  if (flags.migrate && flags.remotion && flags.hyper) return make("approval-required", ["remotion-to-hyperframes"], "Explicit framework migration requires owner confirmation of scope.", "high", true);
  if (flags.remotion && flags.hyper) return make("clarify", [], "Both engines named without migration instruction.", "low", true);
  if (existingEngine === "remotion" && flags.hyper) return make("approval-required", [], "Switching an existing Remotion project requires a separate decision.", "high", true);
  if (flags.lesson && flags.hyper) return make("approval-required", [], "Existing HSK lessons stay in Remotion unless explicitly migrated.", "high", true);

  const actualLesson = flags.lesson || (flags.hskNumber && !flags.promo);
  const isExisting = flags.editing || existingEngine !== "unknown";
  const chosen = existingEngine === "hyperframes" ? "hyperframes"
    : existingEngine === "remotion" ? "remotion"
    : flags.remotion ? "remotion"
    : flags.hyper ? "hyperframes"
    : actualLesson ? "remotion"
    : (flags.promo || flags.effects) && flags.premium ? "hyperframes"
    : "unknown";

  const feature = (pattern) => has(t,pattern);
  // Special self-contained deliverables. These do not alter the dated course renderer.
  const specialWorkflows = [
    [/remotion.to.hyperframes/iu,"remotion-to-hyperframes","approval-required"],
    [/chart|график|диаграм|график/iu,"animated-chart","standalone"],
    [/milestone|10k|подписчик.{0,15}анимац|числ.{0,14}анимац/iu,"milestone-reveal","standalone"],
    [/model showdown|model comparison|сравн.{0,15}модел|моделлар.*солиштир/iu,"model-showdown","standalone"],
    [/newsletter|рассылк|substack/iu,"newsletter-promo","standalone"],
    [/pull request|github pr|pr.to.video|pull.request/iu,"pr-to-video","hyperframes"],
    [/loop.cover|animated cover|gif cover|обложк.{0,12}gif/iu,"loop-cover","standalone"],
    [/slideshow|slide deck|презентац.{0,15}слайд|интерактивн.{0,15}слайд/iu,"slideshow","hyperframes"],
    [/music.to.video|музыкальн.{0,10}видео|клип под музык/iu,"music-to-video","hyperframes"],
    [/vox.style|vox.explainer|документальн.{0,15}объясн/iu,"vox-explainer","standalone"],
    [/faceless|без лица|без съёмки.*объясн/iu,"faceless-explainer","hyperframes"],
    [/3d.*(?:intro|title)|3d.*интро|кинематограф.*заставк/iu,"title-sequence-3d","standalone"],
    [/apple.*(?:launch|реклам|promo)|mac.*launch|apple.style.launch/iu,"apple-launch-film","standalone"],
  ];
  if (!actualLesson && !isExisting) {
    for (const [pattern, name, engine] of specialWorkflows) {
      if (!pattern.test(t)) continue;
      return make(engine, engine === "hyperframes" ? ["hyperframes",name] : [name],
        "A distinct specialized deliverable is explicitly requested.", "high", engine === "approval-required", "special");
    }
  }
  if (flags.brand && !flags.video) return make("standalone", ["brand-intake"], "An explicit brand-reset task; edit only canonical sources.", "high", false, "special");
  if (flags.figma && chosen !== "remotion") return make("hyperframes", ["hyperframes","figma"], "Figma supplied as input to a separate HyperFrames composition.", "medium", false, "special");

  if (flags.newFootage && chosen !== "remotion" && !actualLesson) {
    const name = flags.captions && !flags.graphicOverlay ? "embedded-captions" : "talking-head-recut";
    return make("hyperframes", ["hyperframes",name], "Existing talking-head clip requires footage-specific workflow.", "high", false, "special");
  }
  if (flags.vertical && !actualLesson && !flags.promo && !flags.effects) return make("postprocess", ["reel-export"], "Vertical format conversion only; retain original audio.", "high", false, "special");
  if (!flags.video && !flags.effects && !flags.layout && !flags.captions) {
    return make("none", [], "No video stage has been requested.", "medium");
  }

  // Both engine branches route the same *stage* to different owners.
  if (chosen === "remotion") {
    const ids = [];
    if (igTask && actualLesson && flags.video && !flags.editing) ids.push("social_hook");
    if (flags.layout || flags.ui || (flags.video && !flags.captions && !flags.effects)) ids.push("layout");
    if (flags.effects || (flags.video && !flags.captions && !flags.layout)) ids.push("effects");
    if (flags.captions || (flags.video && !flags.effects && !flags.layout)) ids.push("captions");
    if (flags.audio && !flags.captions) ids.push("audio");
    if (flags.promo) ids.push("promotion");
    if (flags.vertical) ids.push("export");
    if (!ids.length) ids.push("layout");
    return withStages("remotion","lesson","remotion-best-practices",ids,"Use approved Remotion lesson/easy-promo design with canonical HSK tokens.");
  }
  if (chosen === "hyperframes") {
    const ids = [];
    if (flags.layout || flags.ui) ids.push("layout");
    if (flags.effects || flags.premium) ids.push("effects");
    if (flags.captions) ids.push("captions");
    if (flags.audio) ids.push("audio");
    if (flags.promo) ids.push("promotion");
    if (flags.vertical) ids.push("export");
    if (!ids.length) ids.push("layout");
    const main = flags.promo ? "product-launch-video" : flags.effects && !flags.video ? "motion-graphics" : "general-video";
    return withStages("hyperframes","premium",["hyperframes",main],ids,
      "Standalone HyperFrames workflow. Read its main creation workflow and requested stage owners.");
  }
  if (flags.promo && flags.video) return withStages("remotion","lesson","remotion-best-practices",
    ["promotion"],"A straightforward promo can use Remotion; premium motion must be explicit.", "medium");
  if (flags.effects && !flags.promo && !actualLesson) return withStages("standalone","special","motion-effects",["effects"],"Isolated seek-safe effect sketch.", "medium");
  if (flags.video) return make("clarify", [], "Specify whether dated HSK lesson, existing edit, or independent premium/special deliverable.", "low", true);
  return make("none", [], "No video action is needed.", "medium");
}
