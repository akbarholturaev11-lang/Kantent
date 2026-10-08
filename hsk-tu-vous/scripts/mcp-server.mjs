import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { recommendSkills } from "./skill-router.mjs";
import * as z from "zod/v4";
import {
  CALENDAR_PATH,
  PROJECT_ROOT,
  VOICE_PROFILE_PATH,
  getCalendarItemByDate,
  episodeContentHash,
  getPlannedEpisode,
  getRunEpisodeByDate,
  normalizeEpisode,
  normalizeVoiceProvider,
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

const createServer = () => {
  const server = new McpServer(
    { name: "hsk-ai-content", version: "1.0.0" },
    {
      instructions:
        "Для создания или редактирования видео сначала вызывайте recommend_skills, затем читайте выбранные SKILL.md и текущие правила из content/SKILLS.md. Не запускайте HyperFrames для обычного HSK-урока и не меняйте движок или провайдера без разрешения владельца. Работайте по AGENTS.md и AI_RULES.md. До hook edits читайте content/HOOK_LAB.md и get_hook_learning_status; пишите отдельный topic-specific hook до производства, сохраняйте точные слова владельца через record_hook_correction и не выдумывайте результаты без platform readback. До CTA edits читайте content/CTA_LAB.md и get_cta_learning_status; используйте единый CTA серии, сохраняйте точные слова владельца через record_cta_correction, регистрируйте датированный неизменный снимок до voice/render. Используйте только закреплённый профиль text-to-speech.online из content/voice-profile.json, не спрашивайте подтверждение для каждого эпизода. Не вызывайте OpenAI/Whisper, ElevenLabs, Gemini или другие TTS API. Импортируйте MP3 и word-timed SRT/VTT, проверьте burned-in captions и соберите Remotion-пакет. Публикуйте только через подключённый Zernio MCP и только после явного подтверждения владельца финального preview с точным роликом, аккаунтом, caption/xeshteg, disclosure и временем. Ограничьте публикацию Instagram/TikTok; не отправляйте DM.",
    },
  );

  const dateSchema = z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Используйте дату YYYY-MM-DD, часовой пояс календаря — Asia/Shanghai.",
    );

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
          "empty-cup",
        ])
        .optional(),
      syncCueText: z.string().min(1).max(120).optional(),
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

  const sceneEditSchema = z.object({
    sceneId: z.string().min(1).max(64),
    headline: z.string().min(1).max(120).optional(),
    narration: z.string().min(1).max(1200).optional(),
    screenCaption: z.string().max(240).optional(),
    editPlan: z.string().max(1200).optional(),
    visualBeats: z.array(visualBeatSchema).max(12).optional(),
    captionStyleId: z.enum(["headline", "pill", "highlight"]).optional(),
    durationSec: z.number().positive().max(35).optional(),
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
    platform: z.enum(["instagram", "tiktok"]),
    accountId: z.string().min(1).max(180),
    accountName: z.string().min(1).max(180),
    caption: z.string().min(1).max(2200),
    instagramSettings: z
      .object({ shareToFeed: z.boolean(), isAiGenerated: z.boolean() })
      .optional(),
    tiktokSettings: z
      .object({
        privacy_level: z.enum([
          "PUBLIC_TO_EVERYONE",
          "MUTUAL_FOLLOW_FRIENDS",
          "FOLLOWER_OF_CREATOR",
          "SELF_ONLY",
        ]),
        allow_comment: z.boolean(),
        allow_duet: z.boolean(),
        allow_stitch: z.boolean(),
        content_preview_confirmed: z.literal(true),
        express_consent_given: z.literal(true),
        video_made_with_ai: z.literal(true),
        commercialContentType: z.literal("brand_organic"),
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
        if (target.platform === "tiktok" && !target.tiktokSettings)
          context.addIssue({
            code: "custom",
            path: ["platforms", index, "tiktokSettings"],
            message:
              "Fetch TikTok creator info and include the exact settings shown in the preview.",
          });
        if (target.platform === "instagram" && !target.instagramSettings)
          context.addIssue({
            code: "custom",
            path: ["platforms", index, "instagramSettings"],
            message:
              "Include the Reel feed and AI-label settings shown in the preview.",
          });
      }
      if (intent.mode === "scheduled") {
        if (!intent.scheduledFor)
          context.addIssue({
            code: "custom",
            path: ["scheduledFor"],
            message: "A scheduled post needs an exact timestamp.",
          });
        else if (Date.parse(intent.scheduledFor) <= Date.now())
          context.addIssue({
            code: "custom",
            path: ["scheduledFor"],
            message: "The scheduled timestamp must be in the future.",
          });
      } else if (intent.scheduledFor) {
        context.addIssue({
          code: "custom",
          path: ["scheduledFor"],
          message: "Omit scheduledFor when publishing now.",
        });
      }
    });
  const publicationResultSchema = z
    .object({
      platform: z.enum(["instagram", "tiktok"]),
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
      const episode = normalizeEpisode(await readJson(filePath));
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
          env: process.env,
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
      title: "Recommend task-appropriate video skills",
      description:
        "Call before starting a video creation/edit/render task. Uses content/SKILLS.md to choose relevant skills and preserve the Remotion lesson/HyperFrames standalone promo boundary. Returns recommendations only; never runs or installs a skill. For a task that is not a video, it may return none.",
      inputSchema: z.object({
        task: z.string().min(3).max(2000),
        existingEngine: z.enum(["unknown", "remotion", "hyperframes"]).optional(),
      }),
    },
    async ({ task, existingEngine }) =>
      withToolErrors(async () => recommendSkills(task, { existingEngine })),
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
          dates: await Promise.all(
            calendar.items.map(async (item) => ({
              date: item.date,
              id: item.id,
              topic: item.topic,
              level: item.level,
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
        "Показывает единый голос и его статус. Dmitry – RU можно закрепить для серии только после того, как владелец прослушал приложенный пробный MP3.",
      inputSchema: z.object({}),
    },
    async () =>
      withToolErrors(async () => {
        const profile = await readVoiceProfile();
        return {
          profile,
          sampleAudioPath: path.join(PROJECT_ROOT, profile.sampleAudio),
          approvalAction:
            profile.status === "approved"
              ? "already-approved; reuse the exact profile for every episode"
              : "owner must listen to the sample before one-time series approval",
        };
      }),
  );

  server.registerTool(
    "approve_voice_profile",
    {
      title: "Approve the voice for the whole series",
      description:
        "Один раз закрепляет просмотренный владельцем пробный голос для всех русских видео. Вызывайте только после прямого подтверждения владельца; это не разрешение на публикацию.",
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
        const samplePath = path.resolve(PROJECT_ROOT, profile.sampleAudio);
        if (!samplePath.startsWith(PROJECT_ROOT + path.sep))
          throw new Error("Путь к пробному голосу выходит за пределы проекта.");
        await fs.access(samplePath);
        if (!path.basename(samplePath).toLowerCase().includes("dmitry"))
          throw new Error(
            "Пробный файл не подтверждает ожидаемый голос Dmitry – RU.",
          );
        const approvedAt = new Date().toISOString();
        profile.status = "approved";
        profile.approval = { approvedAt, approvedBy: "owner" };
        await writeJson(VOICE_PROFILE_PATH, profile);
        return {
          profile,
          message:
            "Dmitry – RU закреплён для всех будущих русских видео. Настройки менять или заменять голос нельзя без нового решения владельца.",
        };
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
            "visualBeats",
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
          episode.captionSource = "pending-tts-export";
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
      title: "Prepare text-to-speech input",
      description:
        "Подготавливает точный текст и проверяет единый профиль text-to-speech.online. Это промежуточный этап: агент должен сам продолжить через browser automation, сгенерировать и скачать MP3+word-level VTT/SRT, импортировать их и собрать видео. Не просите владельца экспортировать файлы; API-запросов нет.",
      inputSchema: z.object({ date: dateSchema }),
    },
    async ({ date }) =>
      withToolErrors(async () => {
        const { item, episode } = await currentEpisode(date);
        const { item: runItem } = await ensureRunCopy(date);
        if (normalizeVoiceProvider(episode.voiceProvider) !== "text-to-speech-online")
          throw new Error(
            "HSK AI разрешает только text-to-speech.online и утверждённый голосовой профиль.",
          );
        const result = await runScript("prepare-online-tts.mjs", runItem.id);
        return {
          date,
          episodeId: item.id,
          status: await readStatus(item.id),
          log: result.log,
          requiresHumanAction: false,
          nextAgentAction:
            "Continue in the browser now: enter this episode’s exact tts-input.txt at text-to-speech.online, verify the approved Dmitry – RU profile/settings, generate and download MP3 plus word-level VTT (preferred) or SRT into incoming/, import them with import_voice_artifacts, then render and inspect the review package. Do not ask the owner to do or move any of these files. Stop only for a concrete external access/permission gate or unavailable/changed approved voice.",
        };
      }),
  );

  server.registerTool(
    "import_voice_artifacts",
    {
      title: "Import text-to-speech.online MP3 and captions",
      description:
        "Copies downloaded MP3/WAV and SRT/VTT files into the dated review package and maps word timings to lesson scenes; no API key or upload is used.",
      inputSchema: z.object({
        date: dateSchema,
        audioPath: z.string().min(1),
        captionsPath: z.string().min(1),
      }),
    },
    async ({ date, audioPath, captionsPath }) =>
      withToolErrors(async () => {
        const { item, episode } = await currentEpisode(date);
        if (normalizeVoiceProvider(episode.voiceProvider) !== "text-to-speech-online") {
          throw new Error(
            "Bu sana text-to-speech.online provayderida sozlanmagan.",
          );
        }
        const { item: runItem } = await ensureRunCopy(date);
        const result = await runScript(
          "import-online-tts.mjs",
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
        "Собирает 9:16 MP4 с вшитыми синхронными субтитрами, sidecar SRT и текстом поста; ничего не публикует.",
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
          !["online-tts-srt", "online-tts-vtt"].includes(
            episode.captionSource,
          ) ||
          !episode.captions?.length
        ) {
          throw new Error(
            "Пакет нельзя собрать без импортированных word-level SRT/VTT из text-to-speech.online.",
          );
        }
        const result = await runScript("render-episode.mjs", item.id);
        return {
          date,
          episodeId: item.id,
          reviewFolder: reviewDir(item.id),
          status: await readStatus(item.id),
          log: result.log,
        };
      }),
  );

  server.registerTool(
    "prepare_video_for_date",
    {
      title: "Prepare complete video package for a date",
      description:
        "Готовит review-пакет для даты по единому профилю text-to-speech.online. Если голосовых файлов нет, агент должен сам продолжить через browser automation и скачать MP3+word-level SRT/VTT; не просите владельца экспортировать/переносить файлы. Затем импортируйте, соберите и проверьте Remotion-пакет 25–35 секунд. Ничего не публикуется.",
      inputSchema: z.object({ date: dateSchema }),
    },
    async ({ date }) =>
      withToolErrors(async () => {
        const { item, episode } = await currentEpisode(date);
        const { item: runItem } = await ensureRunCopy(date);
        const folder = reviewDir(item.id);
        const voiceProfile = await requireApprovedVoiceProfile(item.id);
        if (
          episode.audioSrc &&
          episode.voiceProfileId !== voiceProfile.profileId
        )
          throw new Error(
            "Импортированный звук сделан по другому профилю. Не заменяйте утверждённый голос.",
          );
        if (normalizeVoiceProvider(episode.voiceProvider) === "text-to-speech-online") {
          const runEpisode = (await currentEpisode(date)).episode;
          if (
            !runEpisode.audioSrc ||
            !["online-tts-srt", "online-tts-vtt"].includes(
              runEpisode.captionSource,
            ) ||
            !runEpisode.captions?.length
          ) {
            const preparation = await runScript(
              "prepare-online-tts.mjs",
              runItem.id,
            );
            return {
              date,
              episodeId: item.id,
              reviewFolder: folder,
              status: await readStatus(item.id),
              requiresHumanAction: false,
              nextAgentAction:
                "Continue this same production task in the browser: open text-to-speech.online, enter the exact tts-input.txt, verify Dmitry – RU / ru-RU / male / 0% speed / 0% pitch / MP3, generate and download the matching MP3 plus word-level VTT (preferred) or SRT into incoming/, import them, then render and inspect the review package. Do not ask the owner to click, download, rename, move, or import files. Stop only for a concrete external access/permission gate or unavailable/changed approved voice.",
              files: {
                script: path.join(folder, "tts-input.txt"),
                incoming: path.join(folder, "incoming"),
                episode: path.join(folder, "episode.json"),
              },
              log: preparation.log,
              publishing: "manual-review-required; nothing was published",
            };
          }
          const render = await runScript("render-episode.mjs", item.id);
          return {
            date,
            episodeId: item.id,
            reviewFolder: folder,
            files: {
              video: path.join(folder, "video.mp4"),
              subtitles: path.join(folder, "captions.srt"),
              postText: path.join(folder, "post.md"),
              script: path.join(folder, "episode.json"),
              status: path.join(folder, "status.json"),
            },
            status: await readStatus(item.id),
            stages: [render.script],
            publishing: "manual-review-required; nothing was published",
          };
        }
        throw new Error(
          "Неподдерживаемый голосовой провайдер. По правилам HSK AI можно использовать только профиль text-to-speech.online.",
        );
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
        const { episode } = await currentEpisode(date);
        const ctaValidation = validateCtaEpisode(episode, await readCtaLab());
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
          approval,
          ctaValidation,
          packageCurrent:
            ctaValidation.valid &&
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
        videoDurationSeconds: z.number().min(25).max(35),
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
            episode = await readJson(
              path.join(PROJECT_ROOT, "content", item.episodeFile),
            );
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
            data.platform === "instagram-reels" ? "instagram" : data.platform;
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
        "Call only after the owner says yes to the immediately preceding preview with the exact video, Instagram/TikTok account, caption including hashtags, platform disclosure/settings, and immediate/scheduled time. Records that precise approval; this tool does not upload or publish. The following action must use the connected Zernio MCP tools.",
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
              Date.parse(approval.publicationIntent.scheduledFor)
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
            ...(approval.publicationIntent.mode === "scheduled" &&
            !result.scheduledFor
              ? { scheduledFor: approval.publicationIntent.scheduledFor }
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

serveStdio(() => createServer(), {
  onerror: (error) =>
    process.stderr.write(`[hsk-ai-content] ${error.message}\n`),
});
