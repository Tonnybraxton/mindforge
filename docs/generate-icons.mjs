// Rasterize the project's own SVG mark. Run after `npx playwright install chromium`.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';

const mark = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    // The maskable icon keeps the full mark inside the central safe region.
    const scale = size === 512 ? '72%' : '100%';
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:#101514}body{display:flex;align-items:center;justify-content:center}svg{display:block;width:${scale};height:${scale}}</style>${mark}`);
    await page.screenshot({ path: fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)) });
    await page.close();
  }
} finally {
  await browser.close();
}
