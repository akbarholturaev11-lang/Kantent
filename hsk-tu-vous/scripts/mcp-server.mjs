import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { recommendSkills } from "./skill-router.mjs";
import { MOTION_KINDS } from "./motion-design-plan.mjs";
import { graphicSceneSchema } from "./graphic-scene-schema.mjs";
import { reviewPromoPlan } from "./promo-plan.mjs";
import { validateLessonPresentation } from "./lesson-presentation-policy.mjs";
import { suggestSemanticShots } from "./semantic-shot-adviser.mjs";
import { CTA_PLATFORMS, getPlatformCtaStatus } from "./platform-cta.mjs";
import { requirePlatformPackage, requireApprovedPlatformPackages } from "./platform-exports.mjs";
import {
  APPROVED_PUBLICATION_PLATFORMS,
  publicationScheduledFor,
  validatePublicationSchedule,
  validatePublicationTarget,
} from "./publication-policy.mjs";
import { resolveTodayVideo } from "./resolve-production-date.mjs";
import { verifiedPublishedRecords, confirmedPublishedIds, confirmedPublishedFor } from "./published-evidence.mjs";
import { requireFreshGitMain } from "./git-freshness.mjs";
import { activeLanguage, languageSettings, languageEnvironment, withLanguage, assertEpisodeLanguage } from "./language-context.mjs";
import { requestedLanguages, prepareLanguagePackages } from "./bilingual-production.mjs";
import { confirmedPublishedInAllLanguages } from "./published-evidence.mjs";
import * as z from "zod/v4";
import {
  CALENDAR_PATH,
  PROJECT_ROOT,
  getCalendarItemByDate,
  episodeContentHash,
  getPlannedEpisode,
  getRunEpisodeByDate,
  synchronizeAutoStoryboard,
  normalizeEpisode,
  invalidateReviewArtifacts,
  readJson,
  readStatus,
  readVoiceProfile,
  requireApprovedVoiceProfile,
  reviewDir,
  validateEpisode,
  writeJson,
  writeStatus,
} from "./lib.mjs";
import {
  createHookCorrection,
  createHookReadback,
  getActiveHookCorrections,
  readHookLab,
  summarizeHookLab,
  writeHookLab,
} from "./hook-lab.mjs";
import {
  createCtaCorrection,
  createCtaExperiment,
  createCtaReadback,
  createCtaPromotion,
  ctaExperimentMetadata,
  getActiveCtaCorrections,
  readCtaLab,
  summarizeCtaLab,
  validateCtaEpisode,
  writeCtaLab,
} from "./cta-lab.mjs";

export const createServer = () => {
  const server = new McpServer(
    { name: "hsk-ai-content", version: "1.0.0" },
    {
      instructions:
      "Для новых рекламных роликов читайте content/PROMO_WORKFLOW.md и creativeGuidance из recommend_skills. Сценарий строится на жизненной ситуации и доказанной пользе продукта; минималистичный кадр и один субтитр определяет content/visual-system.json#promoPresentation. Перед медиа вызовите get_promo_plan. Этот запрос не расширяет полномочия Calendar Reserve на рекламу. " +
      "При написании новых сценариев выбирайте структуру по content/creative-formats.json#storytellingPolicy и задаче ученика, а не по длине: никаких обязательных восьми блоков. Серии планируйте по content/calendar.json#seriesPolicy и content/WORKFLOW.md. " +
      "Для новых рисунков и действий читайте content/GRAPHIC_SCENES.md. Сценарий и рисунки пишет агент по content/WORKFLOW.md: Calendar Reserve для резерва, вызывающий AI-агент для ручного запроса; не используйте отдельную Gemini-модель сценариста. Используйте kind:graphic и декларативные nodes/tracks, когда готовых объектов недостаточно; автор обязан нарисовать смысловой кадр и привязать его к словам выбранного языка до озвучки. Смена метаданных не считается сменой видимого кадра. " +
      "Перед подготовкой нового HSK-урока читайте content/EDITING_SPEC.md и content/EPISODE_SCHEMA.md. Утверждённый формат выбирается из content/visual-system.json#lessonPresentation. Автор должен заполнить смысловые motionBeats каждой сцены через update_production_plan до voice/render и зарегистрировать изменившийся CTA-контекст. Если prepare_today_video вернул action-plan-required, продолжайте планирование самостоятельно по указанным правилам и повторите подготовку после заполнения плана. " +
      "На команду «Бугунги видеони тайёрла» вызывайте prepare_today_video: по умолчанию он готовит все языки из content/languages.json для одного календарного урока. Для чтения, редактирования, регистрации и approval каждой версии передавайте language ru или tg. Не подменяйте перевод, аудио или approval другим языком. Если на сегодня нет слота, выберите ближайший следующий planned по timezone календаря и сообщите дату. Явно названная дата обрабатывается строго. Перед видео вызывайте recommend_skills и читайте выбранный SKILL.md с content/SKILLS.md; обычный урок остаётся Remotion. До hook/CTA edits читайте соответствующий Lab, active language corrections и регистрируйте новый immutable CTA context до voice/render. Ovoz faqat tanlangan tilning voice-profile.json profilidan tayyorlanadi. modelDecisionRequired bo‘lsa egasining aniq model qarorisiz API chaqirmang; pending-owner-approval faqat designated sample uchun. Exact-token tekshiruvi va haqiqiy word timestamp saqlansin. Boshqa TTS/transkripsiya provayderiga o‘tmang. Har bir tilning to‘liq review paketini tekshiring; qisman natijani ikki til tayyor deb aytmang. Публикуйте только через подключённый Zernio MCP после отдельного явного подтверждения каждого exact language/platform preview с аккаунтом, metadata/settings и временем. Instagram Reels и YouTube Shorts разрешены; TikTok publishing не разрешён.",
    },
  );

  const dateSchema = z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Используйте дату YYYY-MM-DD, часовой пояс календаря — Asia/Shanghai.",
    );

  // Every read/edit/approval is scoped independently; production tools default
  // to both languages and manage their own per-language scopes below.
  const registerTool = server.registerTool.bind(server);
  server.registerTool = (name, config, handler) => {
    if (["prepare_video_for_date", "prepare_today_video"].includes(name))
      return registerTool(name, config, handler);
    return registerTool(name, {
      ...config,
      description: `${config.description ?? ""} Language is ru or tg (default ru); edits and approvals apply only to that language.`,
      inputSchema: config.inputSchema.safeExtend({ language: z.enum(["ru", "tg"]).optional() }),
    }, (args, ...rest) => {
      const { language = "ru", ...data } = args;
      return withLanguage(language, () => handler(data, ...rest));
    });
  };

  const visualBeatSchema = z
    .object({
      hero: z.string().max(120),
      pinyin: z.string().max(120).optional(),
      meaning: z.string().max(160).optional(),
      chinese: z.boolean().optional(),
      brandLogo: z.boolean().optional(),
      screenImage: z.string().min(1).max(240).optional(),
      screenImageWidthPx: z.number().int().min(100).max(1080).optional(),
      screenImageHeightPx: z.number().int().min(100).max(1500).optional(),
      screenHighlight: z.object({
        leftPercent: z.number().min(0).max(100),
        topPercent: z.number().min(0).max(100),
        widthPercent: z.number().min(1).max(100),
        heightPercent: z.number().min(1).max(100),
      }).optional(),
      ctaButton: z.string().max(80).optional(),
      motion: z.enum(["pop", "slide", "pulse", "reveal"]).optional(),
      visualFocus: z
        .enum([
          "friend",
          "teacher",
          "elder",
          "shopkeeper",
          "group",
          "single-person",
          "book",
          "person-with-book",
          "coffee",
          "coffee-refusal",
          "empty-cup",
          "apple-near",
          "apple-far",
          "apple-pair",
        ])
        .optional(),
      syncCueText: z.string().min(1).max(120).optional(),
    syncCueOccurrence: z.number().int().min(1).max(100).optional(),
    semanticAction: z.object({
      type: z.enum(["approach-camera", "move-away", "enter", "exit", "give", "take", "open", "close", "appear", "disappear", "point-to", "compare", "show-blocked", "hold"]),
      subjectId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
      targetId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/).optional(),
      durationMs: z.number().int().min(160).max(2500).optional(),
    }).optional(),
      enterAtSceneStart: z.boolean().optional(),
      actionIcon: z
        .enum(["bookmark", "comment", "app-download", "direct-message"])
        .optional(),
      transitionStyle: z
        .enum(["mask-reveal", "slide-match", "type-reveal"])
        .optional(),
    })
    .refine((beat) => Boolean(beat.hero.trim() || beat.actionIcon), {
      message: "Provide hero text or an actionIcon.",
      path: ["hero"],
    });

  const actionModelSchema = z.object({
    kind:z.enum(["quantity","phrase","numeral","ordinal","graphic"]).optional(),
    title:z.string().max(180),hanzi:z.string().max(180),pinyin:z.string().max(180),meaning:z.string().max(180),
    object:z.enum(["tea-cup","book","apple"]).optional(),count:z.number().int().min(1).max(6).optional(),
    grouped:z.boolean().optional(),focus:z.string().max(32).optional(),
    parts:z.array(z.string().min(1).max(32)).min(2).max(6).optional(),value:z.number().int().min(1).max(30).optional(),
    graphic:graphicSceneSchema.optional(),
  });
  const sceneEditSchema = z.object({
    sceneId: z.string().min(1).max(64),
    headline: z.string().min(1).max(120).optional(),
    narration: z.string().min(1).max(1200).optional(),
    screenCaption: z.string().max(240).optional(),
    editPlan: z.string().max(1200).optional(),
    semanticShot: z.object({
      environmentId: z.enum(["street", "home", "campus", "cafe", "pool", "transport-stop", "room", "neutral"]),
      shotType: z.enum(["wide", "medium", "closeup", "object-focus", "split-contrast"]),
      cameraStyle: z.enum(["static", "follow", "push-in", "pull-back", "side-track"]),
      actorIds: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/)).max(12).optional(),
      objectIds: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/)).max(12).optional(),
    }).optional(),
    visualBeats: z.array(visualBeatSchema).max(12).optional(),
    motionBeats: z.array(z.object({
      id: z.string().regex(/^[a-z][a-z0-9-]*$/),
      kind: z.enum(MOTION_KINDS),
      cueText: z.string().min(1).max(120),
      cueOccurrence: z.number().int().min(1).max(100).optional(),
      explains:z.string().min(1).max(500).optional(),
      visual:actionModelSchema.extend({
        choices:z.array(z.string().min(1).max(32)).length(2).optional(),selected:z.string().max(32).optional(),
        models:z.array(actionModelSchema).length(2).optional(),
      }).optional(),
    })).max(16).optional(),
    captionStyleId: z.enum(["headline", "pill", "highlight"]).optional(),
    durationSec: z.number().positive().optional(),
  });
  const factSourceSchema = z.object({
    title: z.string().min(1).max(180),
    url: z.string().url(),
    checkedAt: dateSchema,
    supports: z.array(z.string().min(1).max(240)).min(1).max(10),
  });
  const hookExperimentSchema = z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    formatId: z.enum(["question", "contrast", "scenario"]),
    hypothesis: z.string().min(20).max(500),
    primaryMetric: z.enum([
      "three-second-hold-rate",
      "average-watch-ratio",
      "chose-to-view-rate",
    ]),
    fallbackMetric: z.enum([
      "three-second-hold-rate",
      "average-watch-ratio",
      "chose-to-view-rate",
    ]),
    registeredAt: dateSchema,
  });
  const identifierSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const ctaExperimentSchema = z.object({
    id: identifierSchema,
    formatId: identifierSchema,
    ruleVersion: z.string().regex(/^cta-policy-v\d+$/),
    offerId: identifierSchema,
    keyword: z.union([z.literal("HSK"), z.null()]),
    hypothesis: z.string().min(1).max(1000),
    changedVariable: z.enum(["baseline", "wording", "visual", "placement"]),
    comparisonGroupId: identifierSchema,
    registeredAt: z.iso.datetime({ offset: true }),
    copyHash: z.string().regex(/^[a-f0-9]{64}$/),
    acknowledgedCorrectionIds: z.array(identifierSchema).max(1000),
  });
  const publicationTargetSchema = z.object({
    platform: z.enum(APPROVED_PUBLICATION_PLATFORMS),
    accountId: z.string().min(1).max(180),
    accountName: z.string().min(1).max(180),
    caption: z.string().min(1).max(2200),
    scheduledFor: z.iso.datetime({ offset: true }).optional(),
    instagramSettings: z
      .object({ shareToFeed: z.boolean(), isAiGenerated: z.boolean() })
      .optional(),
    youtubeSettings: z
      .object({
        title: z.string().trim().min(1).max(100),
        visibility: z.enum(["public", "private", "unlisted"]),
        madeForKids: z.boolean(),
        containsSyntheticMedia: z.boolean(),
      })
      .optional(),
  });
  const publicationIntentSchema = z
    .object({
      mode: z.enum(["now", "scheduled"]),
      timezone: z.literal("Asia/Shanghai"),
      scheduledFor: z.iso.datetime({ offset: true }).optional(),
      platforms: z.array(publicationTargetSchema).min(1).max(2),
    })
    .superRefine((intent, context) => {
      const platforms = intent.platforms.map((target) => target.platform);
      if (new Set(platforms).size !== platforms.length)
        context.addIssue({
          code: "custom",
          path: ["platforms"],
          message: "Use at most one account per selected platform.",
        });
      for (const [index, target] of intent.platforms.entries()) {
        for (const message of validatePublicationTarget(target))
          context.addIssue({
            code: "custom",
            path: ["platforms", index],
            message,
          });
      }
      for (const message of validatePublicationSchedule(intent)) {
        context.addIssue({
          code: "custom",
          path: ["scheduledFor"],
          message,
        });
      }
    });
  const publicationResultSchema = z
    .object({
      platform: z.enum(APPROVED_PUBLICATION_PLATFORMS),
      accountId: z.string().min(1).max(180),
      accountName: z.string().min(1).max(180),
      postId: z.string().min(1).max(180).optional(),
      postUrl: z.string().url().optional(),
      status: z.enum(["published", "scheduled", "processing", "pending", "failed"]),
      scheduledFor: z.iso.datetime({ offset: true }).optional(),
    })
    .superRefine((result, context) => {
      if (result.status !== "failed" && !result.postId)
        context.addIssue({
          code: "custom",
          path: ["postId"],
          message: "A successful Zernio result must include its post ID.",
        });
    });

  function toolResult(value) {
    return {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
    };
  }

  function errorResult(error) {
    const message = error instanceof Error ? error.message : String(error);
    return { isError: true, content: [{ type: "text", text: message }] };
  }

  async function withToolErrors(work) {
    try {
      return toolResult(await work());
    } catch (error) {
      return errorResult(error);
    }
  }

  async function currentEpisode(date) {
    const {
      item,
      episode: planned,
      filePath: planPath,
    } = await getPlannedEpisode(date);
    const filePath = path.join(reviewDir(item.id), "episode.json");
    try {
      const saved = normalizeEpisode(await readJson(filePath));
      assertEpisodeLanguage(saved);
      const episode = synchronizeAutoStoryboard(saved, planned, await readStatus(item.id));
      validateEpisode(episode);
      return { item, episode, filePath, isRunCopy: true, planPath };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      return { item, episode: planned, filePath, isRunCopy: false, planPath };
    }
  }

  function runScript(scriptName, episodeId, ...scriptArgs) {
    const scriptPath = path.join(PROJECT_ROOT, "scripts", scriptName);
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [scriptPath, episodeId, ...scriptArgs],
        {
          cwd: PROJECT_ROOT,
          env: languageEnvironment(),
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      const maxCapture = 32_000;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout = `${stdout}${chunk}`.slice(-maxCapture);
      });
      child.stderr.on("data", (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-maxCapture);
      });
      child.on("error", reject);
      child.on("close", (code, signal) => {
        const log = `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();
        if (code === 0) resolve({ script: scriptName, log });
        else
          reject(
            new Error(
              `${scriptName} завершился с кодом ${code ?? signal ?? "unknown"}.\n${log.slice(-12_000)}`,
            ),
          );
      });
    });
  }

  async function ensureRunCopy(date) {
    return getRunEpisodeByDate(date);
  }

  server.registerTool(
    "recommend_skills",
    {
      title: "Recommend task-appropriate video and Instagram editorial skills",
      description:
        "Call before a video creation/edit/render task or explicit Instagram hook, post-caption or competitor-research task. Uses content/SKILLS.md to choose scoped skills and preserve the Remotion/HyperFrames boundary. Returns recommendations only; never runs, installs, publishes or changes a canonical CTA.",
      inputSchema: z.object({
        task: z.string().min(3).max(2000),
        existingEngine: z.enum(["unknown", "remotion", "hyperframes"]).optional(),
      }),
    },
    async ({ task, existingEngine }) =>
      withToolErrors(async () => recommendSkills(task, { existingEngine })),
  );

  server.registerTool(
    "get_promo_plan",
    {
      title: "Read an original promo story and its minimal frame plan",
      description: "Read-only validation of content/promos/<id>.json using the canonical advertising policy. Reports evidence, drawings and media work still required; never generates voice, renders, schedules or publishes.",
      inputSchema: z.object({id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)}),
    },
    async ({id})=>withToolErrors(async()=>reviewPromoPlan(id,{language:activeLanguage()})),
  );

  server.registerTool(
    "preview_semantic_shots",
    {
      title: "Review semantic shot candidates without editing lesson files",
      description:
        "P3 read-only suggestions: scene-specific environments, framing, and narration-supported action candidates. Never writes episodes, creates Gemini cues, changes CTA or permits publication. Human review plus imported word cue verification required.",
      inputSchema: z.object({date: dateSchema}),
    },
    async ({date}) => withToolErrors(async () => {
      const {item,episode} = await getPlannedEpisode(date);
      const status = await readStatus(item.id);
      const eligibility = item.status === "planned" ? status.stage : item.status;
      return suggestSemanticShots(episode,{eligibility});
    }),
  );

  server.registerTool(
    "list_planned_dates",
    {
      title: "List planned HSK AI videos",
      description:
        "Показывает даты, темы и текущий статус из content/calendar.json.",
      inputSchema: z.object({}),
    },
    async () =>
      withToolErrors(async () => {
        const calendar = await readJson(CALENDAR_PATH);
        return {
          timezone: calendar.timezone,
          seriesPolicy: calendar.seriesPolicy,
          dates: await Promise.all(
            calendar.items.map(async (item) => ({
              date: item.date,
              id: item.id,
              topic: item.topic,
              level: item.level,
              ...(item.series ? {series:item.series} : {}),
              status: await readStatus(item.id),
            })),
          ),
        };
      }),
  );

  server.registerTool(
    "get_voice_profile",
    {
      title: "Get the series voice profile",
      description:
        "Показывает единственный production voice profile, статус подтверждения и путь к пробному MP3.",
      inputSchema: z.object({}),
    },
    async () =>
      withToolErrors(async () => {
        const profile = await readVoiceProfile();
        return {
          profile,
          sampleAudioPath: profile.sampleAudio ? path.join(PROJECT_ROOT, profile.sampleAudio) : null,
          approvalAction:
            profile.status === "approved"
              ? "already-approved; reuse the exact profile for every episode"
              : profile.auditionApproval?.approvedBy === "owner"
                ? "owner already accepted the heard sample; finish exact-caption validation without requesting the same approval again"
              : "owner must listen to the sample before one-time series approval",
        };
      }),
  );

  server.registerTool(
    "approve_voice_profile",
    {
      title: "Approve the voice for the whole series",
      description:
        "One-time approval of the selected language’s actual owner-listened sample. Does not inherit another language’s approval or authorize publishing.",
      inputSchema: z.object({
        confirmation: z.literal("Tasdiqlayman"),
      }),
    },
    async ({ confirmation }) =>
      withToolErrors(async () => {
        if (confirmation !== "Tasdiqlayman")
          throw new Error(
            "Ожидалось явное подтверждение владельца: Tasdiqlayman.",
          );
        const profile = await readVoiceProfile();
        if (profile.status === "approved") {
          return {
            profile,
            message:
              "Этот голос уже закреплён для серии; повторное подтверждение не требуется.",
          };
        }
        if (profile.status !== "pending-owner-approval")
          throw new Error(
            "Профиль не ожидает подтверждения; проверьте его вручную.",
          );
        if (profile.modelDecisionRequired || !profile.sampleAudio || !profile.sampleCaptions)
          throw new Error("Approve the exact configured model for a sample first, then generate and listen to that language's real sample before approving its series voice.");
        const samplePath = path.resolve(PROJECT_ROOT, profile.sampleAudio);
        if (!samplePath.startsWith(PROJECT_ROOT + path.sep))
          throw new Error("Путь к пробному голосу выходит за пределы проекта.");
        await fs.access(samplePath);
        if (path.extname(samplePath).toLowerCase() !== ".mp3")
          throw new Error("Профиль требует MP3 sample.");
        const metadataPath = path.join(path.dirname(samplePath), "metadata.json");
        const sampleMetadata = await readJson(metadataPath);
        if (
          sampleMetadata.sampleOnly !== true ||
          sampleMetadata.status !== "ready-for-owner-audition" ||
          sampleMetadata.provider !== profile.provider ||
          sampleMetadata.ttsModel !== profile.ttsModel ||
          sampleMetadata.voice !== profile.voiceName ||
          (activeLanguage() !== "ru" && (sampleMetadata.languageCode !== profile.locale || sampleMetadata.voiceProfileId !== profile.profileId || sampleMetadata.episodeId !== profile.sampleEpisodeId))
        )
          throw new Error("Пробный MP3 metadata не совпадает с текущим voice profile.");
        const sampleCaptionsPath = path.resolve(PROJECT_ROOT, profile.sampleCaptions);
        if (!sampleCaptionsPath.startsWith(PROJECT_ROOT + path.sep))
          throw new Error("Путь к пробным субтитрам выходит за пределы проекта.");
        await fs.access(sampleCaptionsPath);
        const approvedAt = new Date().toISOString();
        profile.status = "approved";
        profile.approval = { approvedAt, approvedBy: "owner" };
        await writeJson(languageSettings().voiceProfilePath, profile);
        return {
          profile,
          message:
            "This language’s current voice profile is approved for future videos. Changed settings require a new owner decision and sample.",
        };
      }),
  );

  server.registerTool(
    "approve_voice_model_for_sample",
    {
      title: "Approve the configured voice model for one sample",
      description: "Only after the owner's explicit model decision, authorize the configured pending locale model for its designated sample. This does not approve the series voice or publication.",
      inputSchema: z.object({ confirmation: z.literal("Tasdiqlayman"), ttsModel: z.string().min(1) }),
    },
    async ({ ttsModel }) => withToolErrors(async () => {
      const profile = await readVoiceProfile();
      if (profile.status !== "pending-owner-approval" || !profile.modelDecisionRequired || profile.ttsModel !== ttsModel)
        throw new Error("The pending profile and exact model must match the owner's decision.");
      profile.modelDecisionRequired = false;
      profile.modelDecision = { approvedBy: "owner", approvedAt: new Date().toISOString(), ttsModel };
      await writeJson(languageSettings().voiceProfilePath, profile);
      return { profile, nextAction: "Generate only the designated sample and request owner audition before series use." };
    }),
  );

  server.registerTool(
    "get_production_plan",
    {
      title: "Get dated production plan",
      description:
        "Возвращает полный сценарий, китайские примеры и покадровый план монтажа на дату.",
      inputSchema: z.object({ date: dateSchema }),
    },
    async ({ date }) =>
      withToolErrors(async () => {
        const { item, episode, isRunCopy } = await currentEpisode(date);
        const ctaLab = await readCtaLab();
        return {
          timezone: "Asia/Shanghai",
          date,
          calendarItem: item,
          planState: isRunCopy ? "review-copy" : "planned",
          voiceProfile: await readVoiceProfile(),
          status: await readStatus(item.id),
          episode,
          ctaLearning: {
            ...summarizeCtaLab(ctaLab),
            applicableCorrections: getActiveCtaCorrections(ctaLab, {
              episodeId: item.id,
              formatId: episode.ctaExperiment?.formatId,
            }),
            validation: validateCtaEpisode(episode, ctaLab),
          },
        };
      }),
  );

  server.registerTool(
    "update_production_plan",
    {
      title: "Edit a production plan",
      description:
        "Правит сценарий, CTA и монтаж в review-копии. Изменение речи сбрасывает звук/тайминги, любое изменение сбрасывает рендер/одобрение. Новую CTA регистрируйте через register_cta_experiment; metadata должна точно соответствовать реестру.",
      inputSchema: z.object({
        date: dateSchema,
        title: z.string().min(1).max(180).optional(),
        caption: z.string().max(1200).optional(),
        cta: z.string().max(500).optional(),
        learningFactSources: z.array(factSourceSchema).max(12).optional(),
        hookExperiment: hookExperimentSchema.optional(),
        ctaExperiment: ctaExperimentSchema.optional(),
        semanticVisual: z.object({schemaVersion: z.literal(1), mode: z.literal("review-only")}).optional(),
        motionDesign: z.boolean().optional(),
        motionDesignStyle: z.enum(["le-context-v1","explain-actions-v1"]).optional(),
        storytelling: z.object({
          schemaVersion: z.literal(1),
          pattern: z.enum(["direct", "single-rehook", "layered"]),
          situation: z.object({setting:z.string().min(3),learnerGoal:z.string().min(3),obstacle:z.string().min(3)}).optional(),
          selectionReason: z.string().min(15).optional(),
          firstPayoff: z.object({sceneId:z.string().min(1),cueText:z.string().min(1)}),
          reHooks: z.array(z.object({sceneId:z.string().min(1),cueText:z.string().min(1),
            payoffSceneId:z.string().min(1),payoffCueText:z.string().min(1),reason:z.string().min(15)})).max(2),
        }).optional(),
        sceneEdits: z.array(sceneEditSchema).max(12).optional(),
      }),
    },
    async ({
      date,
      title,
      caption,
      cta,
      learningFactSources,
      hookExperiment,
      ctaExperiment,
      semanticVisual,
      motionDesign,
      motionDesignStyle,
      storytelling,
      sceneEdits = [],
    }) =>
      withToolErrors(async () => {
        const { item, episode, filePath } = await ensureRunCopy(date);
        const before = JSON.stringify(episode);
        let narrationChanged = false;
        if (title !== undefined) episode.title = title;
        if (caption !== undefined) episode.caption = caption;
        if (cta !== undefined) episode.cta = cta;
        if (learningFactSources !== undefined)
          episode.learningFactSources = learningFactSources;
        if (hookExperiment !== undefined)
          episode.hookExperiment = hookExperiment;
        if (ctaExperiment !== undefined) episode.ctaExperiment = ctaExperiment;
        if (semanticVisual !== undefined) episode.semanticVisual = semanticVisual;
        if (motionDesign !== undefined) episode.motionDesign = motionDesign;
        if (motionDesignStyle !== undefined) episode.motionDesignStyle = motionDesignStyle;
        if (storytelling !== undefined) episode.storytelling = storytelling;

        for (const edit of sceneEdits) {
          const scene = episode.scenes.find(
            (entry) => entry.id === edit.sceneId,
          );
          if (!scene)
            throw new Error(
              `Сцена “${edit.sceneId}” не найдена в плане на ${date}.`,
            );
          for (const key of [
            "headline",
            "narration",
            "screenCaption",
            "editPlan",
            "semanticShot",
            "visualBeats",
            "motionBeats",
            "captionStyleId",
            "durationSec",
          ]) {
            if (edit[key] === undefined) continue;
            if (key === "narration" && edit[key] !== scene.narration)
              narrationChanged = true;
            scene[key] = edit[key];
          }
          if (edit.visualBeats) {
            scene.cards = edit.visualBeats
              .filter((beat) => beat.chinese)
              .map((beat) => ({
                hanzi: beat.hero,
                pinyin: beat.pinyin ?? "",
                meaning: beat.meaning ?? "",
              }));
          }
        }

        validateEpisode(episode);
        const ctaValidation = validateCtaEpisode(episode, await readCtaLab());
        if (ctaExperiment !== undefined && !ctaValidation.valid)
          throw new Error(ctaValidation.errors.join("\n"));
        if (before === JSON.stringify(episode))
          return {
            date,
            episodeId: item.id,
            episode,
            changed: false,
            ctaValidation,
            status: await readStatus(item.id),
          };
        episode.publishingStatus = "pending-owner-review";
        if (narrationChanged) {
          episode.captions = [];
          episode.captionSource = "pending-gemini-generation";
          delete episode.audioSrc;
          delete episode.audioDurationMs;
          delete episode.sourceAudioDurationMs;
          delete episode.audioTrimAfterFrames;
          delete episode.voiceTextHash;
          for (const scene of episode.scenes) {
            delete scene.audioSrc;
            delete scene.audioHash;
            delete scene.audioDurationMs;
            delete scene.durationFrames;
            delete scene.startMs;
            delete scene.endMs;
          }
        }
        await writeJson(filePath, episode);
        await invalidateReviewArtifacts(item.id, { narrationChanged });
        await writeStatus(item.id, {
          stage: "plan-edited",
          updatedAt: new Date().toISOString(),
          narrationChanged,
          needsNewVoiceAndCaptions: narrationChanged,
          previousRenderInvalidated: true,
          videoNeedsRefresh: true,
          ctaNeedsRegistration: !ctaValidation.valid,
        });
        return {
          date,
          episodeId: item.id,
          episode,
          narrationChanged,
          needsNewVoiceAndCaptions: narrationChanged,
          ctaValidation,
          status: await readStatus(item.id),
        };
      }),
  );

  server.registerTool(
    "generate_voice",
    {
      title: "Generate Gemini voice and word-timed captions",
      description:
        "Automatically generates MP3 and word-timed VTT with the approved Gemini TTS and Transcribe settings in content/voice-profile.json. A normalized exact-token match is required before media is imported. The script and generated audio are sent to Google.",
      inputSchema: z.object({ date: dateSchema }),
    },
    async ({ date }) =>
      withToolErrors(async () => {
        const { item, episode } = await currentEpisode(date);
        const { item: runItem } = await ensureRunCopy(date);
        const voiceProfile = await requireApprovedVoiceProfile(item.id);
        if (episode.voiceProvider !== voiceProfile.provider)
          throw new Error(
            "Episode voice provider does not match the approved Gemini profile.",
          );
        const result = await runScript("generate-voice-gemini.mjs", runItem.id);
        return {
          date,
          episodeId: item.id,
          status: await readStatus(item.id),
          log: result.log,
          requiresHumanAction: false,
          nextAgentAction:
            "Voice and Gemini word-timed VTT were generated and imported automatically. Continue by rendering the Remotion review package, then inspect the complete video and both platform exports.",
        };
      }),
  );

  server.registerTool(
    "import_voice_artifacts",
    {
      title: "Import Gemini voice and word-timed captions",
      description:
        "Imports Gemini-generated MP3/WAV and exact-script SRT/VTT into the dated review package and maps word timings to lesson scenes. Approved or published packages are protected.",
      inputSchema: z.object({
        date: dateSchema,
        audioPath: z.string().min(1),
        captionsPath: z.string().min(1),
      }),
    },
    async ({ date, audioPath, captionsPath }) =>
      withToolErrors(async () => {
        const { item, episode } = await currentEpisode(date);
        const voiceProfile = await requireApprovedVoiceProfile(item.id);
        if (voiceProfile.provider !== "gemini-api")
          throw new Error("Faol ovoz profili Gemini API emas.");
        const { item: runItem } = await ensureRunCopy(date);
        const result = await runScript(
          "import-voice.mjs",
          runItem.id,
          audioPath,
          captionsPath,
        );
        return {
          date,
          episodeId: item.id,
          status: await readStatus(item.id),
          log: result.log,
        };
      }),
  );

  server.registerTool(
    "render_video_package",
    {
      title: "Render review package",
      description:
        "Автоматически собирает Instagram и YouTube 9:16 MP4: один общий урок, два утверждённых CTA-окончания, непрерывный общий звук, синхронные субтитры, SRT и тексты постов. Ничего не публикует.",
      inputSchema: z.object({ date: dateSchema }),
    },
    async ({ date }) =>
      withToolErrors(async () => {
        const { item, episode } = await currentEpisode(date);
        const voiceProfile = await requireApprovedVoiceProfile(item.id);
        if (
          episode.audioSrc &&
          episode.voiceProfileId !== voiceProfile.profileId
        )
          throw new Error(
            "Импортированный звук сделан по другому профилю. Не заменяйте утверждённый голос.",
          );
        if (
          episode.captionSource !== "gemini-word-timestamps" ||
          !episode.captions?.length
        ) {
          throw new Error(
            "Review package requires imported Gemini word-timed captions.",
          );
        }
        const result = await runScript("render-episode.mjs", item.id);
        const status = await readStatus(item.id);
        return {
          date,
          episodeId: item.id,
          reviewFolder: reviewDir(item.id),
          status,
          exports: status.platformPackages,
          log: result.log,
        };
      }),
  );


  // Same exact-date preparation routine powers explicit and relative commands.
  // Gemini voice generation, import and rendering run automatically; nothing is published.
  async function prepareReviewForDate(date) {
        // Provider-confirmed publication overrides the calendar's stale
        // "planned" status. Never re-render or re-publish the same post ID.
        const plannedItem = await getCalendarItemByDate(date);
        const alreadyPublished = confirmedPublishedFor(plannedItem.id);
        if (alreadyPublished.length) {
          return {
            date, episodeId:plannedItem.id, status:{
              stage:"externally-verified-published",
              verifiedOn:alreadyPublished[0].verifiedOn,
              records:alreadyPublished,
              creativeFormatVerified:alreadyPublished.every(r=>r.creativeFormatVerified)
            },
            reviewFolder:reviewDir(plannedItem.id),
            nextAgentAction:"Do not regenerate or publish this episode. It is already published on the verified platforms. An old published MP4 cannot be labelled as the new cinematic format without an actual render audit. For a new version, request a distinct calendar slot and episode ID.",
            publicationVerifiedFrom:"Zernio posts_get",
            publishing:"already-published; no action taken"
          };
        }
        const sourceRevision = requireFreshGitMain();
        const { item, episode } = await currentEpisode(date);
        const { item: runItem } = await ensureRunCopy(date);
        const folder = reviewDir(item.id);
        const visualSystem = await readJson(path.join(PROJECT_ROOT, "content", "visual-system.json"));
        try {
          validateLessonPresentation(episode, visualSystem.lessonPresentation);
        } catch (error) {
          return {
            date, episodeId: item.id, reviewFolder: folder,
            stage: "action-plan-required",
            reason: error.message,
            episode,
            nextAgentAction: "Read content/EDITING_SPEC.md, content/EPISODE_SCHEMA.md and content/GRAPHIC_SCENES.md. Author every scene's complete meaning-linked motionBeats with update_production_plan. Use graphic nodes/tracks for new drawings/actions instead of substituting a cup or leaving a blank stage. Register the new immutable CTA context, then retry preparation. No additional format approval is needed.",
            publishing: "nothing was published",
          };
        }
        const voiceProfile = await requireApprovedVoiceProfile(item.id);
        const needsVoice =
          !episode.audioSrc ||
          episode.voiceProfileId !== voiceProfile.profileId ||
          episode.captionSource !== "gemini-word-timestamps" ||
          !episode.captions?.length;
        const stages = [];
        if (needsVoice) {
          const voice = await runScript("generate-voice-gemini.mjs", runItem.id);
          stages.push(voice.script);
        }
        // Child renderer repeats the remote-main check immediately before rendering.
        const render = await runScript("render-episode.mjs", item.id);
        stages.push(render.script);
        const renderedStatus = await readStatus(item.id);
        return {
          date,
          episodeId: item.id,
          stage: "ready-for-review",
          reviewFolder: folder,
          sourceRevision,
          files: {
            video: path.join(folder, "video.mp4"),
            subtitles: path.join(folder, "captions.srt"),
            postText: path.join(folder, "post.md"),
            script: path.join(folder, "episode.json"),
            status: path.join(folder, "status.json"),
            platforms: renderedStatus.platformPackages,
          },
          status: renderedStatus,
          stages,
          voiceApproval: { status: voiceProfile.status, sampleOnly: voiceProfile.status !== "approved" },
          publishing: "manual-review-required; nothing was published",
        };
  }

  server.registerTool(
    "prepare_video_for_date",
    {
      title: "Prepare complete video package for a date",
      description:
        "Defaults to Russian AND Tajik versions of the same dated lesson. Each has its own source, voice profile, exact word cues, CTA and Instagram/YouTube review packages. Reports missing translation/voice/action plans per language; never claims both complete when one is blocked. language ru/tg selects one version. Nothing is published.",
      inputSchema: z.object({ date: dateSchema, language: z.enum(["all", "ru", "tg"]).optional() }),
    },
    async ({ date, language = "all" }) => withToolErrors(async () => ({
      date, ...await prepareLanguagePackages(requestedLanguages(language), () => prepareReviewForDate(date)),
    })),
  );

  server.registerTool(
    "prepare_today_video",
    {
      title: "Prepare today's HSK video or the next planned episode",
      description:
        "For «Бугунги видеони тайёрла» / bugungi videoni tayyorla: prepare BOTH Russian and Tajik versions by default, for ONE shared calendar lesson. Skip an episode only when all requested languages are verified published. If no eligible today slot exists, use the nearest future planned slot and disclose its date. Report each language's package or blocker. Never publish or claim both ready before real voice and renders exist.",
      inputSchema: z.object({ language: z.enum(["all", "ru", "tg"]).optional() }),
    },
    async ({ language = "all" }) =>
      withToolErrors(async () => {
        const languages = requestedLanguages(language);
        const resolved = resolveTodayVideo(await readJson(CALENDAR_PATH), new Date(), { confirmedPublishedEpisodeIds: confirmedPublishedInAllLanguages(languages) });
        const prepared = await prepareLanguagePackages(languages, () => prepareReviewForDate(resolved.selectedDate));
        return {
          ...prepared,
          requestedDate: resolved.requestedDate,
          selectedDate: resolved.selectedDate,
          selection: resolved.selection,
          selectedTopic: resolved.topic,
          timezone: resolved.timezone,
          dateNotice:
            resolved.selection === "today"
              ? "Today's calendar episode was selected."
              : `No eligible unpublished video for ${resolved.requestedDate}. Automatically selected ${resolved.selectedDate}. Previously published calendar episodes skipped: ${JSON.stringify(resolved.skippedPublished ?? [])}.`,
          publishedEpisodesSkipped: resolved.skippedPublished ?? [],
          publishing: prepared.publishing,
        };
      }),
  );

  server.registerTool(
    "get_video_status",
    {
      title: "Get video package status",
      description:
        "Возвращает этап производства и состояние пакета на выбранную дату.",
      inputSchema: z.object({ date: dateSchema }),
    },
    async ({ date }) =>
      withToolErrors(async () => {
        const item = await getCalendarItemByDate(date);
        const status = await readStatus(item.id);
        const verifiedPosts = confirmedPublishedFor(item.id);
        if (verifiedPosts.length) return {
          date, episodeId:item.id, topic:item.topic,
          status, verifiedPublishedPosts:verifiedPosts,
          publicationExternallyConfirmed:true,
          creativeFormatPublicationVerified:verifiedPosts.every(r=>r.creativeFormatVerified),
          packageCurrent:false,
          note:"Published post IDs were verified through Zernio; historical creative format and current local review package were not verified. No render or publication action taken."
        };
        const { episode } = await currentEpisode(date);
        const ctaValidation = validateCtaEpisode(episode, await readCtaLab());
        const platformPackageErrors = {};
        for (const platform of Object.keys(status.platformPackages ?? {})) {
          try {
            await requirePlatformPackage(episode, status, platform);
          } catch (error) {
            platformPackageErrors[platform] = error.message;
          }
        }
        let approval = null;
        try {
          approval = await readJson(
            path.join(reviewDir(item.id), "approval.json"),
          );
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
        return {
          date,
          episodeId: item.id,
          topic: item.topic,
          status,
          verifiedPublishedPosts:verifiedPosts,
          publicationExternallyConfirmed:verifiedPosts.length>0,
          creativeFormatPublicationVerified:verifiedPosts.length>0 && verifiedPosts.every(r=>r.creativeFormatVerified),
          approval,
          ctaValidation,
          platformPackageErrors,
          packageCurrent:
            ctaValidation.valid &&
            Object.keys(platformPackageErrors).length === 0 &&
            status.contentHash === episodeContentHash(episode) &&
            [
              "rendered-pending-owner-approval",
              "owner-approved-for-zernio-publishing",
              "zernio-published",
              "zernio-scheduled",
              "zernio-publication-processing",
              "zernio-publication-partial",
              "zernio-publication-failed",
            ].includes(status.stage),
        };
      }),
  );

  server.registerTool(
    "get_platform_cta_status",
    {
      title: "Inspect platform-specific CTA readiness",
      description:
        "Read the single canonical CTA Lab for Instagram, TikTok and YouTube. Reports each variant's copy/scene readiness separately from publication authorization. TikTok's owner-approved manual-DM variant has an effect-led local review scene; it does not verify a link, automate DMs, or authorize TikTok publishing. Instagram Reels and YouTube Shorts remain the only authorized publishing destinations. Never sends a DM or publishes.",
      inputSchema: z.object({
        platform: z.enum(["instagram", "tiktok", "youtube"]).optional(),
      }),
    },
    async ({ platform }) =>
      withToolErrors(async () => {
        const lab = await readCtaLab();
        return {
          canonicalSource: "content/cta-lab.json",
          variants: (platform ? [platform] : CTA_PLATFORMS).map(
            (name) => getPlatformCtaStatus(lab, name),
          ),
          note: "The normal render produces Instagram and YouTube packages automatically: one shared lesson render, separate approved CTA endings, and reused continuous audio/word cues. Each destination is bound to its exact exported file and CTA registration. YouTube Shorts publishing requires exact-preview approval.",
        };
      }),
  );

  server.registerTool(
    "get_cta_learning_status",
    {
      title: "Read CTA rules, corrections and evidence",
      description:
        "Read before every CTA edit. Returns exact owner corrections, active rule version, immutable CTA registrations and measured/unmeasured evidence. No platform connection or DM delivery.",
      inputSchema: z.object({ date: dateSchema.optional() }),
    },
    async ({ date }) =>
      withToolErrors(async () => {
        const lab = await readCtaLab();
        const result = {
          ...summarizeCtaLab(lab),
          revision: lab.revision,
          platformVariants: CTA_PLATFORMS.map((name) => getPlatformCtaStatus(lab, name)),
          correctionHistory: lab.corrections,
        };
        if (date) {
          const { episode } = await currentEpisode(date);
          result.episodeId = episode.id;
          result.applicableCorrections = getActiveCtaCorrections(lab, {
            episodeId: episode.id,
            formatId: episode.ctaExperiment?.formatId,
          });
          result.validation = validateCtaEpisode(episode, lab);
          result.registration =
            lab.experiments.find(
              (entry) => entry.id === episode.ctaExperiment?.id,
            ) ?? null;
        }
        return result;
      }),
  );

  server.registerTool(
    "record_cta_correction",
    {
      title: "Keep an owner CTA correction permanently",
      description:
        "Appends exact owner wording and an actionable mandatory rule. Preserve spelling and whitespace in ownerWording. Scope/supersedes preserve history; this is owner policy, not measured performance.",
      inputSchema: z.object({
        ownerWording: z.string().min(1).max(12000),
        rule: z.string().min(1).max(3000),
        scope: z
          .discriminatedUnion("type", [
            z.object({ type: z.literal("series") }),
            z.object({
              type: z.literal("episode"),
              episodeId: identifierSchema,
            }),
            z.object({ type: z.literal("format"), formatId: identifierSchema }),
          ])
          .default({ type: "series" }),
        supersedes: z.array(identifierSchema).max(100).default([]),
      }),
    },
    async (data) =>
      withToolErrors(async () => {
        const lab = await readCtaLab();
        if (data.scope.type === "episode") {
          const calendar = await readJson(CALENDAR_PATH);
          if (!calendar.items.some((item) => item.id === data.scope.episodeId))
            throw new Error(
              "Episode-scoped correction must reference a calendar episode.",
            );
        }
        const correction = createCtaCorrection({ lab, ...data });
        lab.corrections.push(correction);
        const saved = await writeCtaLab(lab);
        return {
          correction,
          revision: saved.revision,
          learning: summarizeCtaLab(saved),
          nextAction:
            "Read the active rules, revise affected CTA plans and register a new version before voice preparation/render/approval.",
        };
      }),
  );

  server.registerTool(
    "register_cta_experiment",
    {
      title: "Register the current CTA copy and visual plan",
      description:
        "Preregisters an immutable version of the current dated CTA after editorial review. Supply every applicable correction ID explicitly. CTA narration edits must be made with update_production_plan first. No publishing or DM action.",
      inputSchema: z.object({
        date: dateSchema,
        id: identifierSchema,
        formatId: identifierSchema.default("benefit-profile-link-download"),
        hypothesis: z.string().min(20).max(1000),
        changedVariable: z
          .enum(["baseline", "wording", "visual", "placement"])
          .default("baseline"),
        comparisonGroupId: identifierSchema.default("hsk-profile-link-download-v1"),
        acknowledgedCorrectionIds: z.array(identifierSchema).max(1000),
        supersedes: identifierSchema.nullable().optional(),
      }),
    },
    async ({ date, ...data }) =>
      withToolErrors(async () => {
        const { item, episode, filePath } = await ensureRunCopy(date);
        const lab = await readCtaLab();
        const registration = createCtaExperiment({ lab, episode, ...data });
        lab.experiments.push(registration);
        const saved = await writeCtaLab(lab);
        episode.ctaExperiment = ctaExperimentMetadata(registration);
        episode.publishingStatus = "pending-owner-review";
        await writeJson(filePath, episode);
        await invalidateReviewArtifacts(item.id);
        await writeStatus(item.id, {
          stage: "cta-registered",
          updatedAt: new Date().toISOString(),
          ctaExperimentId: registration.id,
          ctaRuleVersion: registration.ruleVersion,
          ctaPerformanceStatus: "unmeasured",
          videoNeedsRefresh: true,
          needsNewVoiceAndCaptions:
            !episode.audioSrc || !episode.captions?.length,
        });
        return {
          date,
          episodeId: item.id,
          registration,
          revision: saved.revision,
          ctaValidation: validateCtaEpisode(episode, saved),
          status: await readStatus(item.id),
        };
      }),
  );

  server.registerTool(
    "record_cta_analytics",
    {
      title: "Record metrics for the exact published CTA version",
      description:
        "Append owner-entered 24h/7d counts, attributed to the immutable CTA version and its package approval. Missing counts remain unknown; corrections use supersedes. Post references are owner-supplied local labels/IDs; no credentials or private links are needed.",
      inputSchema: z.object({
        experimentId: identifierSchema,
        platform: z.string().min(1).max(80),
        window: z.enum(["24h", "7d"]),
        postReference: z.string().min(1).max(180),
        publishedAt: z.iso.datetime({ offset: true }),
        capturedAt: z.iso.datetime({ offset: true }),
        videoDurationSeconds: z.number().positive(),
        metricDefinition: z.string().min(5).max(1000),
        views: z.number().int().min(0).max(1_000_000_000),
        hskCommenters: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
        profileLinkClickers: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
        deliveredDms: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
        linkClicks: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
        downloads: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
        supersedes: identifierSchema.nullable().optional(),
        notes: z.string().max(3000).optional(),
        ownerConfirmedPublished: z.literal(true).optional(),
        ownerConfirmedManuallyPublished: z.literal(true).optional(),
      }).superRefine((data, context) => {
        if (
          data.ownerConfirmedPublished !== true &&
          data.ownerConfirmedManuallyPublished !== true
        )
          context.addIssue({
            code: "custom",
            path: ["ownerConfirmedPublished"],
            message:
              "Confirm that this version was actually published before entering its metrics.",
          });
      }),
    },
    async ({
      ownerConfirmedPublished: _publishedConfirmation,
      ownerConfirmedManuallyPublished: _legacyManualConfirmation,
      ...data
    }) =>
      withToolErrors(async () => {
        if (
          Date.parse(data.capturedAt) > Date.now() ||
          Date.parse(data.publishedAt) > Date.now()
        )
          throw new Error(
            "Published/captured analytics times cannot be in the future.",
          );
        const lab = await readCtaLab();
        const experiment = lab.experiments.find(
          (entry) => entry.id === data.experimentId,
        );
        if (!experiment)
          throw new Error(
            "Unknown CTA version; use its registered experiment ID.",
          );
        const approvalPath = path.join(
          reviewDir(experiment.episodeId),
          "approvals",
          `${experiment.id}.json`,
        );
        let approval;
        try {
          approval = await readJson(approvalPath);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
          throw new Error(
            "This exact CTA version has no owner-approved package or publication record. Confirm the final Zernio preview and publish before adding analytics.",
          );
        }
        if (
          approval.ctaExperimentId !== experiment.id ||
          approval.ctaCopyHash !== experiment.copyHash ||
          !["approved-for-zernio-publishing", "approved-for-manual-publishing"].includes(approval.state)
        )
          throw new Error("Approval evidence does not match this CTA version.");
        if (Date.parse(approval.approvedAt) > Date.parse(data.publishedAt))
          throw new Error(
            "Publication cannot predate owner package approval.",
          );
        const readback = createCtaReadback({ lab, ...data });
        lab.readbacks.push(readback);
        const saved = await writeCtaLab(lab);
        return {
          readback,
          revision: saved.revision,
          learning: summarizeCtaLab(saved),
        };
      }),
  );

  server.registerTool(
    "promote_cta_pattern",
    {
      title: "Record the owner's evidence-backed CTA pattern decision",
      description:
        "Only after the owner explicitly selects a candidate supported by matched readbacks. Exact owner wording is retained. Never treat a tool suggestion as owner confirmation.",
      inputSchema: z.object({
        candidateFormatId: identifierSchema,
        changedVariable: z.enum(["wording", "visual", "placement"]),
        evidenceReadbackIds: z.array(identifierSchema).min(1).max(1000),
        ownerWording: z.string().min(1).max(12000),
        ownerConfirmed: z.literal(true),
      }),
    },
    async (data) =>
      withToolErrors(async () => {
        const lab = await readCtaLab();
        const promotion = createCtaPromotion({ lab, ...data });
        lab.promotions.push(promotion);
        const saved = await writeCtaLab(lab);
        return {
          promotion,
          revision: saved.revision,
          learning: summarizeCtaLab(saved),
        };
      }),
  );

  server.registerTool(
    "get_hook_learning_status",
    {
      title: "Review hook experiments and readbacks",
      description:
        "Shows active owner hook corrections, registered hypotheses, manually entered platform readbacks, comparable medians, and whether evidence is sufficient. Does not fetch analytics or publish anything.",
      inputSchema: z.object({}),
    },
    async () =>
      withToolErrors(async () => {
        const calendar = await readJson(CALENDAR_PATH);
        const experiments = [];
        for (const item of calendar.items) {
          let episode;
          try {
            episode = await readJson(
              path.join(reviewDir(item.id), "episode.json"),
            );
          } catch (error) {
            if (error?.code !== "ENOENT") throw error;
            try { episode = await readJson(path.join(languageSettings().contentRoot, item.episodeFile)); }
            catch (sourceError) { if (sourceError.code === "ENOENT") continue; throw sourceError; }
          }
          if (episode.hookExperiment)
            experiments.push({
              episodeId: item.id,
              date: item.date,
              level: item.level,
              formatId: episode.hookExperiment.formatId,
              hypothesis: episode.hookExperiment.hypothesis,
              primaryMetric: episode.hookExperiment.primaryMetric,
              registeredAt: episode.hookExperiment.registeredAt,
            });
        }
        return summarizeHookLab(await readHookLab(), experiments);
      }),
  );

  server.registerTool(
    "record_hook_correction",
    {
      title: "Save a permanent hook correction",
      description:
        "Appends the owner's exact hook feedback and its durable series rule. A newer rule can supersede an active rule; history is preserved and the correction applies to future episode hooks.",
      inputSchema: z.object({
        ownerWording: z.string().min(1).max(12000),
        rule: z.string().min(1).max(12000),
        supersedes: z.array(identifierSchema).max(100).default([]),
      }),
    },
    async (data) =>
      withToolErrors(async () => {
        const lab = await readHookLab();
        const correction = createHookCorrection({ lab, ...data });
        lab.ownerCorrections ??= [];
        lab.ownerCorrections.push(correction);
        const saved = await writeHookLab(lab);
        return {
          correction,
          revision: saved.revision,
          activeCorrections: getActiveHookCorrections(saved),
          message:
            "Hook tuzatishi doimiy xotiraga qo‘shildi; yangi qoida kelgusi ssenariylar uchun amal qiladi, oldingi yozuv tarixda qoldi.",
        };
      }),
  );

  server.registerTool(
    "record_hook_analytics",
    {
      title: "Record a hook analytics readback",
      description:
        "Records owner-entered platform dashboard metrics for a published video. No analytics API call, upload, or post is made.",
      inputSchema: z
        .object({
          date: dateSchema,
          platform: z.enum([
            "instagram-reels",
            "youtube-shorts",
            "tiktok",
            "other",
          ]),
          platformName: z.string().max(80).optional(),
          window: z.enum(["24h", "7d"]),
          publishedAt: z.iso.datetime({ offset: true }),
          snapshotAt: z.iso.datetime({ offset: true }),
          primaryMetric: z.enum([
            "three-second-hold-rate",
            "average-watch-ratio",
            "chose-to-view-rate",
          ]),
          metricDefinition: z.string().min(5).max(240),
          views: z.number().int().min(1).max(1_000_000_000),
          viewsAt3Seconds: z
            .number()
            .int()
            .min(0)
            .max(1_000_000_000)
            .optional(),
          averageViewDurationSeconds: z.number().min(0).max(3600).optional(),
          choseToViewRatePercent: z.number().min(0).max(100).optional(),
          shownInFeed: z.number().int().min(0).max(1_000_000_000).optional(),
          completedViews: z.number().int().min(0).max(1_000_000_000).optional(),
          saves: z.number().int().min(0).max(1_000_000_000).optional(),
          shares: z.number().int().min(0).max(1_000_000_000).optional(),
          comments: z.number().int().min(0).max(1_000_000_000).optional(),
          likes: z.number().int().min(0).max(1_000_000_000).optional(),
          followersGained: z
            .number()
            .int()
            .min(0)
            .max(1_000_000_000)
            .optional(),
        })
        .superRefine((data, context) => {
          if (
            data.primaryMetric === "three-second-hold-rate" &&
            data.viewsAt3Seconds === undefined
          )
            context.addIssue({
              code: "custom",
              path: ["viewsAt3Seconds"],
              message: "3-second hold rate requires viewsAt3Seconds.",
            });
          if (
            data.primaryMetric === "average-watch-ratio" &&
            data.averageViewDurationSeconds === undefined
          )
            context.addIssue({
              code: "custom",
              path: ["averageViewDurationSeconds"],
              message:
                "Average watch ratio requires averageViewDurationSeconds.",
            });
          if (
            data.primaryMetric === "chose-to-view-rate" &&
            data.choseToViewRatePercent === undefined
          )
            context.addIssue({
              code: "custom",
              path: ["choseToViewRatePercent"],
              message:
                "YouTube chose-to-view rate requires its dashboard percentage.",
            });
          if (
            data.viewsAt3Seconds !== undefined &&
            data.viewsAt3Seconds > data.views
          )
            context.addIssue({
              code: "custom",
              path: ["viewsAt3Seconds"],
              message: "viewsAt3Seconds cannot exceed views.",
            });
          if (
            data.completedViews !== undefined &&
            data.completedViews > data.views
          )
            context.addIssue({
              code: "custom",
              path: ["completedViews"],
              message: "completedViews cannot exceed views.",
            });
          if (Date.parse(data.snapshotAt) < Date.parse(data.publishedAt))
            context.addIssue({
              code: "custom",
              path: ["snapshotAt"],
              message: "snapshotAt must be after publishedAt.",
            });
          if (data.platform === "other" && !data.platformName)
            context.addIssue({
              code: "custom",
              path: ["platformName"],
              message: "Name the platform when platform is other.",
            });
        }),
    },
    async (data) =>
      withToolErrors(async () => {
        const { item, episode } = await currentEpisode(data.date);
        if (!episode.hookExperiment)
          throw new Error(
            "Bu rejada hookExperiment qaydi yo‘q; avval hook format va taxminini ro‘yxatdan o‘tkazing.",
          );
        if (
          ![
            episode.hookExperiment.primaryMetric,
            episode.hookExperiment.fallbackMetric,
          ].includes(data.primaryMetric)
        )
          throw new Error(
            "Kiritilgan metrika oldindan belgilangan hook metrikasi yoki fallback metrikasiga mos emas.",
          );
        const status = await readStatus(item.id);
        const approvalStages = new Set([
          "zernio-publication-recorded",
          "zernio-published",
          "zernio-scheduled",
          "zernio-publication-processing",
          "zernio-publication-partial",
          "owner-approved-for-manual-publishing",
        ]);
        if (!approvalStages.has(status.stage))
          throw new Error(
            "Avval aynan shu video uchun egasining tasdig‘i va Zernio/manual publish natijasi bo‘lishi kerak; analytics hozir yozilmadi.",
          );
        if (status.stage.startsWith("zernio-")) {
          const publicationLog = await readJson(
            path.join(reviewDir(item.id), "publications.json"),
          );
          const expectedPlatform =
              data.platform === "instagram-reels" ? "instagram" : data.platform === "youtube-shorts" ? "youtube" : data.platform;
          const hasPublishedPost = publicationLog.records?.some(
            (record) =>
              record.contentHash === status.contentHash &&
              record.platforms?.some(
                (entry) =>
                  entry.status === "published" &&
                  entry.platform === expectedPlatform,
              ),
          );
          if (!hasPublishedPost)
            throw new Error(
              "Zernio bu platformada published holatini qaytarmagan.",
            );
        }
        if (Date.parse(data.snapshotAt) > Date.now())
          throw new Error("snapshotAt kelajak vaqtiga qo‘yilmasligi kerak.");
        const lab = await readHookLab();
        const platform =
          data.platform === "other" ? data.platformName : data.platform;
        const readback = createHookReadback({
          episode,
          level: episode.level,
          topic: episode.topic,
          ...data,
          platform,
          capturedAt: new Date().toISOString(),
        });
        const key = (entry) =>
          `${entry.episodeId}|${entry.hookExperimentId}|${entry.platform}|${entry.window}`;
        const previousCount = lab.readbacks.length;
        lab.readbacks = lab.readbacks.filter(
          (entry) => key(entry) !== key(readback),
        );
        lab.readbacks.push(readback);
        lab.status = "measured";
        await writeHookLab(lab);
        return {
          date: data.date,
          episodeId: item.id,
          replacedExistingSnapshot: lab.readbacks.length === previousCount,
          readback,
          message:
            "Hook ko‘rsatkichlari lokal faylga yozildi. Bu ma’lumot keyingi taqqoslash uchun; hech narsa joylanmadi.",
        };
      }),
  );

  server.registerTool(
    "approve_video_package",
    {
      title: "Confirm the final preview for Zernio publishing",
      description:
        "Call only after the owner says yes to the immediately preceding preview with the exact video, Instagram Reels or YouTube Shorts account, caption/description, all platform-specific settings (including YouTube title, visibility, audience and synthetic-media disclosure), and immediate/scheduled time. Records that precise approval; this tool does not upload or publish. The following action must use the connected Zernio MCP tools.",
      inputSchema: z.object({
        date: dateSchema,
        publicationIntent: publicationIntentSchema,
      }),
    },
    async ({ date, publicationIntent }) =>
      withToolErrors(async () => {
        const { item } = await currentEpisode(date);
        const status = await readStatus(item.id);
        if (status.stage !== "rendered-pending-owner-approval") {
          throw new Error(
            "Текущая версия сценария ещё не собрана в пакет для проверки. Импортируйте аудио и word-level субтитры, затем заново выполните Remotion.",
          );
        }
        const result = await runScript(
          "approve-package.mjs",
          item.id,
          JSON.stringify(publicationIntent),
        );
        return {
          date,
          episodeId: item.id,
          approval: await readJson(
            path.join(reviewDir(item.id), "approval.json"),
          ),
          status: await readStatus(item.id),
          log: result.log,
          publishing: "owner-approved for this exact Zernio preview; no media uploaded yet",
        };
      }),
  );

  server.registerTool(
    "record_zernio_publication",
    {
      title: "Record a Zernio publishing result",
      description:
        "After an owner-approved Zernio create/schedule call succeeds, records the returned post ID, account, URL, status, and scheduled time in the dated review package. It never calls Zernio or publishes by itself. Use the same post ID to update a scheduled/processing result later; do not record a new ID for the same package/platform/account.",
      inputSchema: z.object({
        date: dateSchema,
        platforms: z.array(publicationResultSchema).min(1).max(2),
      }),
    },
    async ({ date, platforms }) =>
      withToolErrors(async () => {
        const { item, episode, filePath } = await currentEpisode(date);
        const status = await readStatus(item.id);
        if (status.contentHash !== episodeContentHash(episode))
          throw new Error("The current rendered package hash does not match its episode.");
        const folder = reviewDir(item.id);
        const approval = await readJson(path.join(folder, "approval.json"));
        if (
          approval.state !== "approved-for-zernio-publishing" ||
          approval.contentHash !== status.contentHash
        )
          throw new Error("A current owner-approved Zernio preview is required before recording publication.");
        await requireApprovedPlatformPackages(episode, status, approval);
        if (
          ![
            "owner-approved-for-zernio-publishing",
            "zernio-publication-recorded",
            "zernio-published",
            "zernio-scheduled",
            "zernio-publication-processing",
            "zernio-publication-partial",
            "zernio-publication-failed",
          ].includes(status.stage)
        )
          throw new Error("This package is not awaiting a Zernio publish result.");
        const approvedTargets = approval.publicationIntent?.platforms ?? [];
        const publicationsPath = path.join(folder, "publications.json");
        let publications;
        try {
          publications = await readJson(publicationsPath);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
          publications = { schemaVersion: 1, episodeId: item.id, records: [] };
        }
        let record = publications.records.find(
          (entry) => entry.contentHash === status.contentHash,
        );
        if (!record && platforms.length !== approvedTargets.length)
          throw new Error(
            "Initial Zernio results must cover every platform in the approved preview.",
          );
        if (!record) {
          record = {
            contentHash: status.contentHash,
            createdAt: new Date().toISOString(),
            platforms: [],
          };
        }
        const seenTargets = new Set();
        for (const result of platforms) {
          const key = `${result.platform}|${result.accountId}`;
          if (seenTargets.has(key))
            throw new Error("Each platform/account result may appear only once.");
          seenTargets.add(key);
          const target = approvedTargets.find(
            (entry) =>
              entry.platform === result.platform &&
              entry.accountId === result.accountId &&
              entry.accountName === result.accountName,
          );
          if (!target)
            throw new Error("The Zernio result account is not part of the approved preview.");
          const existing = record.platforms.find(
            (entry) =>
              entry.platform === result.platform &&
              entry.accountId === result.accountId,
          );
          if (
            approval.publicationIntent.mode === "now" &&
            result.status === "scheduled"
          )
            throw new Error(
              "Zernio qaytargan schedule tasdiqlangan ‘hozir joylash’ rejimiga mos emas.",
            );
          if (
            approval.publicationIntent.mode === "scheduled" &&
            result.status === "published" &&
            !existing?.postId
          )
            throw new Error(
              "Zernio published-now natijasi tasdiqlangan jadvalga mos emas.",
            );
          if (
            approval.publicationIntent.mode === "scheduled" &&
            result.scheduledFor &&
            Date.parse(result.scheduledFor) !==
              Date.parse(publicationScheduledFor(approval.publicationIntent, result.platform))
          )
            throw new Error("Zernio schedule time differs from the approved preview.");
        }

        if (!publications.records.includes(record))
          publications.records.push(record);
        for (const result of platforms) {
          const existing = record.platforms.find(
            (entry) =>
              entry.platform === result.platform &&
              entry.accountId === result.accountId,
          );
          if (
            existing?.postId &&
            result.postId &&
            existing.postId !== result.postId
          )
            throw new Error("A different Zernio post ID is already recorded for this package and account.");
          const savedResult = {
            ...result,
            ...(approval.platformPackages?.[result.platform] ? {
              contentHash: approval.platformPackages[result.platform].contentHash,
              ctaExperimentId: approval.platformPackages[result.platform].ctaExperimentId,
              video: approval.platformPackages[result.platform].video,
              videoSha256: approval.platformPackages[result.platform].videoSha256,
            } : {}),
            ...(approval.publicationIntent.mode === "scheduled" &&
            !result.scheduledFor
              ? { scheduledFor: publicationScheduledFor(approval.publicationIntent, result.platform) }
              : {}),
            updatedAt: new Date().toISOString(),
          };
          if (existing)
            Object.assign(existing, savedResult);
          else record.platforms.push(savedResult);
        }
        record.updatedAt = new Date().toISOString();
        publications.updatedAt = record.updatedAt;
        await writeJson(publicationsPath, publications);

        const statuses = record.platforms.map((entry) => entry.status);
        const stage = statuses.every((value) => value === "published")
          ? "zernio-published"
          : statuses.every((value) => value === "scheduled")
            ? "zernio-scheduled"
            : statuses.some((value) => value === "processing" || value === "pending")
              ? "zernio-publication-processing"
              : statuses.every((value) => value === "failed")
                ? "zernio-publication-failed"
                : "zernio-publication-partial";
        await writeStatus(item.id, {
          ...status,
          stage,
          publicationRecords: record.platforms,
          updatedAt: record.updatedAt,
        });
        episode.publishingStatus = stage;
        await writeJson(filePath, episode);
        return {
          date,
          episodeId: item.id,
          status: await readStatus(item.id),
          publications,
          message: "Zernio natijasi joriy video versiyasiga biriktirildi.",
        };
      }),
  );

  return server;
};

if (process.argv[1] && await fs.realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) serveStdio(() => createServer(), {
  onerror: (error) =>
    process.stderr.write(`[hsk-ai-content] ${error.message}\n`),
});
