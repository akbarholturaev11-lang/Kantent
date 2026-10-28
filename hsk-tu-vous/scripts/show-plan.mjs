import { readJson, CALENDAR_PATH } from "./lib.mjs";
import {contentTypeOf} from './content-schedule.mjs';
import {readLanguages} from './language-context.mjs';

const calendar = await readJson(CALENDAR_PATH);
const rows = calendar.items.map(
  (item) =>
    `${item.date}  ${contentTypeOf(item).padEnd(14)} ${item.id.padEnd(20)} ${(item.level??'').padEnd(8)} ${item.topic}`,
);
console.log(
  `HSK AI · ${readLanguages().defaultProductionLanguages.join(' + ')} · ${calendar.cadencePerWeek} slots/week · ${calendar.timezone}\n`,
);
if(calendar.weeklySchedule)console.log(calendar.weeklySchedule.days.map(day=>`${day.weekday}: ${day.contentType}${day.part?' '+day.part:''}`).join(' | '));
console.log(rows.join("\n"));
console.log(
  "\nСценарий можно получить по дате через MCP-инструмент get_production_plan.",
);
console.log(
  "Для генерации пакета используйте prepare_video_for_date после просмотра и согласования сценария.",
);
