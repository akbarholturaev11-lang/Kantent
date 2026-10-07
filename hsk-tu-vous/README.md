# HSK AI Content Studio

Локальный MCP-проект готовит русскоязычные видео HSK 1–2 по датам из `content/calendar.json`; количество выпусков всегда берётся из этого файла, а не фиксируется в README. После ясной команды на дату агент сам применяет сохранённые правила, получает озвучку через browser automation на text-to-speech.online по единому голосовому профилю, импортирует MP3 и word-level SRT/VTT, а Remotion собирает и проверяет пакет для review. Затем агент показывает точный Zernio preview и ждёт явное «да»; после него может опубликовать или запланировать видео на Instagram Reels и TikTok. Без подтверждения файл не загружается в Zernio.

## Источник актуальных правил

Активные изменяемые правила находятся в `AI_RULES.md`. `PROJECT_MEMORY.md` хранит только текущее состояние, а `content/calendar.json` — актуальные даты и episode ID. Если владелец меняет правило, агент обязан в той же задаче заменить новое правило и удалить или обновить все противоречащие активные копии по репозиторию. Старое значение может остаться только в явно исторических append-only записях.

## Запуск

1. Установите Node.js 20+ и зависимости командой npm install.
2. Откройте проект в Codex или Claude Code: MCP сервер HSK AI запускается локально через stdio.
3. Получите календарь через list_planned_dates и план через get_production_plan с датой YYYY-MM-DD.
4. Проверьте текущий закреплённый голосовой профиль через `get_voice_profile`; для обычных выпусков уже утверждённый профиль используется автоматически без повторного вопроса владельцу.
5. Попросите подготовить нужную дату. Агент сам открывает `tts-input.txt` на утверждённом speech-сайте, применяет настройки из `content/voice-profile.json` и скачивает MP3 и пословный VTT либо SRT.
6. Агент сохраняет оба файла в `review/<episode-ID>/incoming/`, вызывает `import_voice_artifacts`, затем собирает MP4, встроенные титры, отдельный SRT, post.md и status.json через `prepare_video_for_date`.
7. Посмотрите ролик и финальный preview: видео, аккаунты, caption/хештеги для каждой платформы, disclosure и время. approve_video_package записывает подтверждение только этого варианта. После «да» агент использует подключённый Zernio MCP, публикует или планирует пост и записывает результат; без «да» публикации нет.

Текущий голосовой профиль уже закреплён и повторно не подтверждается для каждого выпуска. Новый образец и новое подтверждение нужны только если владелец явно меняет голос/провайдера. Если утверждённый сайт или голос стали недоступны, процесс останавливается без самовольной замены.

## MCP инструменты

- get_voice_profile — единый голос, его настройки и путь к образцу.
- approve_voice_profile — однократное закрепление голоса для всех видео после явного решения владельца.
- list_planned_dates, get_production_plan, update_production_plan — календарь, сценарий и правки для конкретной даты.
- generate_voice — готовит точный TTS-ввод как промежуточный этап; агент затем сам продолжает browser-based генерацию по `WORKFLOW.md`.
- import_voice_artifacts — принимает MP3/WAV и word-level VTT/SRT из сайта.
- render_video_package, prepare_video_for_date — создают/собирают пакет Remotion, не публикуют.
- get_video_status, approve_video_package — статус и подтверждение точного Zernio preview; само подтверждение не публикует.
- record_zernio_publication — записывает post ID, статус, аккаунт, время и ссылку, вернувшиеся от Zernio.
- get_hook_learning_status, record_hook_analytics — локальная hook-аналитика по данным платформы; readback вносит владелец.

Постоянные правила для любого нового чата находятся в AGENTS.md, AI_RULES.md и PROJECT_MEMORY.md. Подробный порядок — content/WORKFLOW.md; дизайн-референсы — content/reference-sources.md и content/visual-system.json. Zernio доступен как подключённый OAuth MCP в Codex; проект не хранит ключи или токены. Внешние аккаунты подключите к Zernio отдельно.

Локальные навыки видео и анимации находятся в `.agents/skills/`. Перед их применением прочитайте [порядок выбора skills](content/SKILLS.md): текущая серия использует Remotion, сохранённый бренд и утверждённый голос.

Hooklar bo‘yicha qoida, ro‘yxatdan o‘tgan gipotezalar va o‘lchov jarayoni `content/HOOK_LAB.md` hamda `content/hook-lab.json`da. Nashr faqat aniq preview ko‘rsatilgach va egasi “ha” degach Zernio orqali Instagram Reels/TikTok’ka yuboriladi. Platforma ko‘rsatkichlarini egasi kiritadi.
