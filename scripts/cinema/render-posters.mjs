/**
 * Renders the scene posters with the real black-hole shader (software GL is
 * fine, just slow) and writes them as WebP into public/cinema, plus the three
 * tiny thumbnails of the graphics-quality choice (cut from the small scene at
 * the resolutions the levels actually render at).
 *
 *   node scripts/cinema/render-posters.mjs [hero,auth,small] [--samples 4] [--scale 1] [--out public/cinema]
 *
 * --scale 0.4 --samples 1 gives a quick draft for composing a view.
 * Needs the dev server (the /cinema page) on BASE_URL.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const names = (args[0] && !args[0].startsWith('--') ? args[0] : 'hero,auth,small').split(',');
const samples = flag('samples', '4');
const scale = Number(flag('scale', '1'));
const out = flag('out', 'public/cinema');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

// Keep in step with scenePosters in src/features/cinema/black-hole/presets.ts.
const sizes = { hero: [1600, 1600], auth: [1920, 1200], small: [700, 500] };

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
for (const name of names) {
  const [w, h] = sizes[name].map((v) => Math.round(v * scale));
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`  ${name}: ${e.message}`));
  const started = Date.now();
  await page.goto(`${BASE}/ru/cinema?shot=${name}&samples=${samples}`);
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 60 * 60_000, polling: 1000 });
  await page.waitForTimeout(300);
  const png = await page.screenshot({ type: 'png' });
  await context.close();
  const webp = await sharp(png).webp({ quality: 82, effort: 6 }).toBuffer();
  await writeFile(path.join(out, `${name}.webp`), webp);
  console.log(`  ${name} ${w}×${h}: ${(webp.length / 1024).toFixed(0)} KB, ${((Date.now() - started) / 1000).toFixed(0)} s`);

  if (name === 'small') {
    // Ultra renders at full resolution (2× on a phone), high a little lower, low at half.
    for (const [file, tw, th] of [
      ['quality-ultra', 112, 80],
      ['quality-high', 56, 40],
      ['quality-low', 28, 20],
    ]) {
      const thumb = await sharp(png).resize(tw, th, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 88 }).toBuffer();
      await writeFile(path.join(out, `${file}.webp`), thumb);
    }
    console.log('  quality thumbnails');
  }
}
await browser.close();
