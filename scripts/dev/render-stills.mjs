/**
 * Renders the intro key frames with the real black-hole shader (software GL
 * is fine, just slow) at desktop and phone sizes.
 *
 *   node scripts/dev/render-stills.mjs docs/review/v2/intro [desktop,phone] [darkness,lensing,horizon,logo] [samples]
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'docs/review/v2/intro';
const devices = (process.argv[3] ?? 'desktop,phone').split(',');
const shots = (process.argv[4] ?? 'darkness,lensing,horizon,logo').split(',');
const samples = process.argv[5] ?? '4';
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const viewports = {
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true },
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
for (const device of devices) {
  await mkdir(path.join(out, device), { recursive: true });
  const context = await browser.newContext(viewports[device]);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`  ${device}: ${e.message}`));
  for (const shot of shots) {
    await page.goto(`${BASE}/ru/cinema?shot=${shot}&samples=${samples}`);
    const handle = await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 30 * 60_000, polling: 1000 });
    const ms = await handle.jsonValue();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, device, `${shot}.png`) });
    console.log(`  ${device}/${shot} (${ms} ms)`);
  }
  await context.close();
}
await browser.close();
