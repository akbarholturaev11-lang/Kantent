import path from "node:path";
import {
  PROJECT_ROOT,
  getCalendarItem,
  readJson,
  reviewDir,
  validateEpisode,
  writeJson,
  writeStatus,
} from "./lib.mjs";

const id = process.argv[2];
if (!id)
  throw new Error("Использование: npm run content:draft -- <episode-ID>");
const item = await getCalendarItem(id);
const sourcePath = path.join(PROJECT_ROOT, "content", item.episodeFile);
const outputPath = path.join(reviewDir(id), "episode.json");
const episode = await readJson(sourcePath);
validateEpisode(episode);
await writeJson(outputPath, episode);
await writeStatus(id, {
  stage: "plan-ready",
  updatedAt: new Date().toISOString(),
});
console.log(`Русский сценарий скопирован для редактирования: ${outputPath}`);
