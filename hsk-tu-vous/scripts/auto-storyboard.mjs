import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recommendCreativeFormats } from "./viral-plan.mjs";
import { validateStoryboardEpisode } from "./storyboard-validation.mjs";
import { applySemanticReviewDraft } from "./semantic-review-integration.mjs";
import { validateStorytellingEpisode } from "./storytelling-plan.mjs";
import { applyLessonPresentationDefault } from "./lesson-presentation-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, "content", file), "utf8"));
const clone = (value) => structuredClone(value);
const chinese = (s) => [...String(s ?? "").matchAll(/[\u3400-\u9fff]+/gu)].map(x=>x[0]);
const RELEVANT = /(?:^|\W)(?:cafe|кафе|заказ|кофе|чай|напиток|школ|колледж|универ|университет|дома|дом|улиц|street)(?:\W|$)/iu;

export function compareAuthorialContent(a, b) {
  // Only format-owned visual fields may be backfilled. Never overwrite owner's
  // changed hook, narration, CTA, timing, captions or publishing fields.
  const omit = (episode) => {
    const copy = clone(episode);
    delete copy.creativeFormatId;
    delete copy.autoStoryboard;
    delete copy.autoSemantic;
    delete copy.semanticVisual;
    for (const scene of copy.scenes ?? []) {
      delete scene.storyboard;
      delete scene.semanticShot;
      for (const beat of scene.visualBeats ?? []) {
        if (beat.semanticAction) {
          delete beat.semanticAction;
          delete beat.syncCueText;
          delete beat.syncCueOccurrence;
        }
      }
    }
    return JSON.stringify(copy);
  };
  return omit(a) === omit(b);
}

export function chooseSetting(episode, scene) {
  const topic = `${episode.topic || ""} ${episode.title || ""}`;
  const text = `${scene.headline || ""} ${scene.narration || ""} ${(scene.visualBeats || []).map(b=>b.hero).join(" ")}`;
  if (/在家|家里|我在家|(?:^|\W)(?:дома|домой|home)(?:\W|$)/iu.test(text)) return "home";
  if (/学校|学生|учеб|школ|колледж|университет/iu.test(text)) return "campus";
  if (/喝茶|咖啡|买|多少钱|кафе|заказ|кофе|напиток|стакан|чай|цен[ауые]/iu.test(text)) return "cafe";
  if (/кафе|заказ|кофе|напиток|стакан|чай/iu.test(topic)) return "cafe";
  if (/школ|колледж|университет|учеб|时间|今天|明天|время/iu.test(topic)) return "campus";
  return "street";
}

export function authoredQuizChoices(episode) {
  // Require two genuinely authored independent teaching terms, not fabricated
  // distractors. Vocabulary cards can be sourced; a broad sentence cannot.
  const values = [];
  for (const scene of episode.scenes || []) {
    if (scene.kind !== "vocabulary" && scene.kind !== "example") continue;
    for (const beat of scene.visualBeats || []) {
      const word=String(beat.hero || "").trim().replace(/[。！？?]/gu,"");
      const units=chinese(word);
      if (units.length!==1 || units[0]!==word || [...word].length>4) continue;
      if (!values.includes(word)) values.push(word);
    }
  }
  return values.length>=2 ? values.slice(0,2) : null;
}

function findChoice(registry, calendar, episodeByFile, targetId) {
  const since = registry.automaticStoryboard?.fromDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since || ""))
    throw Error("Automatic storyboard rollout start missing from creative registry");
  const feedback={posts:[],caveats:[]};
  const policy={primaryDecisionWindow:"7d",minimumViewsPerPost:500,minimumPostsPerFormat:3};
  const plan=recommendCreativeFormats({
    calendar, episodeByFile, registry, feedback, policy, date:since
  });
  return plan.upcoming.find(x=>x.episodeId===targetId);
}

export function decorateFutureLesson(episode, {calendar,registry,episodeByFile}) {
  let lesson=clone(episode);
  const item=calendar.items.find(x=>x.id===lesson.id && x.date===lesson.date);
  if (!item || item.status!=="planned" || lesson.date < registry.automaticStoryboard.fromDate)
    return lesson;
  if (lesson.publishingStatus && lesson.publishingStatus!=="pending-owner-review")
    return lesson;
  if (lesson.scenes?.some(s=>s.kind==="cta") || "cta" in lesson || "ctaExperiment" in lesson)
    throw Error("Automatic format selection accepts only CTA-free canonical lessons");
  lesson=applyLessonPresentationDefault(lesson,read("visual-system.json").lessonPresentation);
  const chosen=findChoice(registry,calendar,episodeByFile,lesson.id);
  if (!chosen || chosen.status!=="creative-brief-only" || !chosen.creativeFormatId)
    throw Error(`No compatible creative format for ${lesson.id}: ${chosen?.status || "missing calendar plan"}`);
  const preset=lesson.creativeFormatId;
  let formatId=preset || chosen.creativeFormatId;
  if (!registry.formats.some(x=>x.id===formatId && x.hookFormats.includes(lesson.hookExperiment?.formatId)))
    throw Error("Existing creative format is incompatible with the registered hook");
  let options=formatId==="speed-quiz" ? authoredQuizChoices(lesson) : null;
  if(formatId==="speed-quiz" && !options) {
    // No inventing Chinese answers/distractors: a compatible non-quiz visual
    // format can still teach the *unchanged* approved source.
    formatId="problem-fix";
  }
  lesson.creativeFormatId=formatId;
  lesson.autoStoryboard={
    source:"content/creative-formats.json",
    selection:"cycle-compatible-formats",
    status:"generated-for-review",
    requestedFormatId:chosen.creativeFormatId,
    reason:chosen.creativeFormatId!==formatId ? "missing-authored-quiz-options-fallback" : "compatible-hook-and-existing-lesson"
  };
  if (lesson.storytelling) {
    const errors = validateStorytellingEpisode(lesson);
    if (errors.length) throw Error("Adaptive storytelling metadata invalid: " + errors.join("; "));
  }
  const reHooks = new Set(lesson.storytelling?.reHooks?.map(x => x.sceneId) ?? []);
  const payoffs = new Set(lesson.storytelling?.reHooks?.map(x => x.payoffSceneId) ?? []);
  lesson.scenes=lesson.scenes.map((scene,index)=>{
    const existing=scene.storyboard;
    const setting=existing?.setting ?? chooseSetting(lesson,scene);
    const mood=existing?.mood ?? (reHooks.has(scene.id) ? "question" : payoffs.has(scene.id) ? "answer" : index===0 ? "question" : scene.kind==="example" ? "answer" : "practice");
    const storyboard=existing ?? {
      formatId,setting,character:"student",mood,
      ...(formatId==="speed-quiz"&&index===0 ? {options} : {})
    };
    if(storyboard.formatId!==formatId) throw Error(`Mixed storyboard formats in ${lesson.id}`);
    return {...scene,storyboard};
  });
  validateStoryboardEpisode(lesson);
  return applySemanticReviewDraft(lesson);
}

export function decorateCanonicalLesson(episode) {
  const calendar=read("calendar.json");
  const registry=read("creative-formats.json");
  const episodeByFile={};
  for(const item of calendar.items) {
    if(!item.episodeFile || episodeByFile[item.episodeFile]) continue;
    const p=path.resolve(root,"content",item.episodeFile);
    if(!p.startsWith(path.join(root,"content","episodes")+path.sep)) throw Error("Unsafe calendar episode path");
    if(fs.existsSync(p)) episodeByFile[item.episodeFile]=read(item.episodeFile);
  }
  return decorateFutureLesson(episode,{calendar,registry,episodeByFile});
}
