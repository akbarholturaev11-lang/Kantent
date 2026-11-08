#!/usr/bin/env node
/**
 * Renders the HSK AI character registry (content/characters/hsk-ai-characters.json,
 * exact SVGs copied from the HSK AI app) into transparent PNG references:
 * content/characters/<id>-<mood>.png and one overview sheet
 * content/characters/hsk-ai-characters.png. Uses the headless Chrome that
 * Remotion already installed; no network, no image model.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib.mjs";

const registryPath = path.join(PROJECT_ROOT, "content", "characters", "hsk-ai-characters.json");
const outDir = path.dirname(registryPath);

async function chromeBinary() {
  const base = path.join(PROJECT_ROOT, "node_modules", ".remotion", "chrome-headless-shell");
  for (const dir of await fs.readdir(base)) {
    const nested = path.join(base, dir);
    if (!(await fs.stat(nested)).isDirectory()) continue;
    for (const inner of await fs.readdir(nested)) {
      const candidate = path.join(nested, inner, "chrome-headless-shell");
      try { await fs.access(candidate); return candidate; } catch { /* next */ }
    }
  }
  throw new Error("Remotion headless Chrome not found; run a Remotion render once first.");
}

function screenshot(chrome, html, file, width, height, tmpDir) {
  const page = path.join(tmpDir, path.basename(file, ".png") + ".html");
  return fs.writeFile(page, html).then(() => execFileSync(chrome, [
    "--headless", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
    `--window-size=${width},${height}`, `--screenshot=${file}`, `file://${page}`,
  ], { stdio: ["ignore", "pipe", "pipe"] }));
}

const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
const chrome = await chromeBinary();
const tmpDir = await fs.mkdtemp(path.join(outDir, ".render-"));
try {
  const cells = [];
  for (const character of registry.characters) {
    for (const [mood, svg] of Object.entries(character.svg)) {
      const file = path.join(outDir, `${character.id}-${mood}.png`);
      await screenshot(chrome, `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", '<svg width="800" height="840" ')}</body></html>`, file, 800, 840, tmpDir);
      cells.push(svg.replace("<svg ", '<svg width="380" height="400" '));
      console.log("rendered", path.relative(PROJECT_ROOT, file));
    }
  }
  const sheet = path.join(outDir, "hsk-ai-characters.png");
  await screenshot(chrome, `<html><body style="margin:0;background:#F4EFE6;display:grid;grid-template-columns:repeat(3,380px);gap:20px;padding:20px">${cells.join("")}</body></html>`,
    sheet, 3 * 380 + 4 * 20, Math.ceil(cells.length / 3) * 420 + 20, tmpDir);
  console.log("rendered", path.relative(PROJECT_ROOT, sheet));
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}
