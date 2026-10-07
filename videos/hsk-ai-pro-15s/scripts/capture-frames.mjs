import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hyperframesDist = '/Users/kaijimima1234/.npm/_npx/702923228c2ce1e6/node_modules/hyperframes/dist';
const { bundleWithLocalizedFonts } = await import(pathToFileURL(path.join(hyperframesDist, 'bundleWithLocalizedFonts-PMWWW5YG.js')));
const { serveStaticProjectHtml } = await import(pathToFileURL(path.join(hyperframesDist, 'chunk-T4Z4UNSX.js')));
const { openSettledCompositionPage, seekCompositionTimeline } = await import(pathToFileURL(path.join(hyperframesDist, 'chunk-QH6UFY2O.js')));

function pathToFileURL(filePath) {
  return new URL(`file://${filePath}`);
}

const outDir = path.join(projectDir, 'renders', 'png-frames');
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const html = await bundleWithLocalizedFonts(projectDir);
const server = await serveStaticProjectHtml(projectDir, html);
let browser;
try {
  const opened = await openSettledCompositionPage(html, server.url, {
    renderReadyTimeoutMs: 10000,
    renderReadyWarningSuffix: 'frame capture may be incomplete',
  });
  browser = opened.browser;
  const page = opened.page;
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const duration = await page.evaluate(() => window.__player?.getDuration?.() ?? 0);
  if (viewport.width !== 1080 || viewport.height !== 1920) {
    throw new Error(`Unexpected browser viewport ${viewport.width}x${viewport.height}`);
  }
  if (Math.abs(duration - 15) > 0.01) {
    throw new Error(`Expected 15-second composition, got ${duration}`);
  }
  console.log(`Capturing 450 frames at 30 fps from ${viewport.width}x${viewport.height} composition.`);

  for (let i = 0; i < 450; i++) {
    await seekCompositionTimeline(page, i / 30, {
      fallbackToBridgeAndTimelines: true,
      animationFrameSettle: 'double',
      waitForFontsMs: 0,
    });
    const filePath = path.join(outDir, `${String(i).padStart(6, '0')}.png`);
    await page.screenshot({ path: filePath, type: 'png', omitBackground: false });
    if ((i + 1) % 45 === 0) console.log(`Captured ${i + 1}/450 frames.`);
  }
} finally {
  await browser?.close().catch(() => {});
  await server.close().catch(() => {});
}

console.log(`Frame sequence saved to ${outDir}`);
