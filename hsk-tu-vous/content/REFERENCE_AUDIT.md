# Референсы и решения по инструментам

Скриншоты владельца задают три разные роли. Не смешивать их и не приписывать референсу то, что не было просмотрено.

| Источник | Роль в HSK AI | Что подтверждено | Статус и граница |
| --- | --- | --- | --- |
| HeroUI Native MCP | Инструмент изучения дизайн-системы | Официальная документация подтверждает stdio-сервер, имя heroui-native и команду npx -y @heroui/native-mcp@latest | Настройка проекта соответствует официальному примеру; HeroUI не становится runtime-зависимостью Remotion |
| Pinterest | Визуальный источник | В проекте сохранён кандидат pin с названием “past now future” | Скриншот владельца показывает пустую страницу сохранённых идей, а сам pin не открылся для проверки; его конкретные визуальные приёмы не подтверждены |
| posts.design | Референс анимации | Скриншот показывает общий feed Recent без выбранной карточки | Старый адрес Folder animation не подтвердился и удалён; конкретную анимацию этому источнику не приписываем |
| HSK-AI-Bot app palette | Источник цветов видео | Точные цвета проверены в `app/static/course-v3.html` и `branding/README.md` репозитория владельца | Применяется палитра `content/visual-system.json`; не использовать сэмплирование цветов с превью |

В HSK AI сохраняются логотип, тёплая бумажная основа и cinnabar/jade/gold акценты из source palette владельца. Субтитры используют тёмный ink без подложки, группами максимум по два слова. Текущая layered-card motion — собственная Remotion-анимация, а не заявленная копия конкретного поста.

Production voice uses Gemini TTS and Gemini Transcribe through the owner-authorized API profile in `content/voice-profile.json`. The workflow sends narration and generated audio to Google, checks the transcript against the script, and imports only exact word matches. The rendered sample remains pending owner voice approval; only its designated episode can use the pending profile.

Из трёх роликов пользователя нельзя вывести доступ к чужим MCP, аккаунтам или API. Интеграция локального HSK MCP и HeroUI MCP настроена отдельно в проектной конфигурации; Pinterest и posts.design — только ссылки-референсы.

## Что пока не настроено

Платформа публикации и аккаунты не выбраны. Поэтому выдаётся нейтральный вертикальный 9:16 пакет: MP4, SRT и текст поста. Обложка/thumbnail, площадочные варианты, описание accessibility и сбор статистики будут осмысленны после выбора площадки и не подменяются выдуманными настройками.

Для Pinterest нужен открытый просмотр конкретного pin; для posts.design — конкретный выбранный post. До этого стиль HSK AI остаётся оригинальным и опирается только на собственную дизайн-систему.
