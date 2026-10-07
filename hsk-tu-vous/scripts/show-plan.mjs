import { readJson, CALENDAR_PATH } from "./lib.mjs";

const calendar = await readJson(CALENDAR_PATH);
const rows = calendar.items.map(
  (item) =>
    `${item.date}  W${item.week}  ${item.id.padEnd(20)} ${item.level.padEnd(8)} ${item.topic}`,
);
console.log(
  "HSK AI · план русских видео · 3 ролика в неделю · Asia/Shanghai\n",
);
console.log(rows.join("\n"));
console.log(
  "\nСценарий можно получить по дате через MCP-инструмент get_production_plan.",
);
console.log(
  "Для генерации пакета используйте prepare_video_for_date после просмотра и согласования сценария.",
);
