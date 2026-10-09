import { requireFreshGitMain } from './git-freshness.mjs';
import path from "node:path";
import {
  getCalendarItem,
  getPlannedEpisode,
  reviewDir,
  validateEpisode,
  writeJson,
  writeStatus,
} from "./lib.mjs";

const id = process.argv[2];
if (!id)
  throw new Error("Использование: npm run content:draft -- <episode-ID>");
const sourceRevision = requireFreshGitMain();
const item = await getCalendarItem(id);
const outputPath = path.join(reviewDir(id), "episode.json");
const { episode } = await getPlannedEpisode(item.date);
validateEpisode(episode);
await writeJson(outputPath, episode);
await writeStatus(id, {
  stage: "plan-ready",
  sourceRevision,
  updatedAt: new Date().toISOString(),
});
console.log(`Русский сценарий скопирован для редактирования: ${outputPath}`);
