/**
 * Renders the intro film with the real shader, frame by frame (software GL is
 * fine, just slow), for devices that cannot run the scene live and for
 * graphics "Off". Writes public/cinema/intro-<landscape|portrait>-<1080|720>.webm
 * (VP9: every open browser build plays it) and .mp4 (H.264, for Safari), and
 * the score as docs/review/v2/intro/intro-score.wav.
 *
 *   node scripts/cinema/render-intro.mjs landscape|portrait [--fps 30] [--samples 1] [--from 0] [--to 10]
 *   node scripts/cinema/render-intro.mjs landscape|portrait --encode-only   (frames already rendered)
 *
 * Needs the dev server (the /cinema page) on BASE_URL and ffmpeg (see scripts/video/recorder.mjs).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { findFfmpeg } from '../video/recorder.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const orientation = args[0] === 'portrait' ? 'portrait' : 'landscape';
const fps = Number(flag('fps', '30'));
const samples = Number(flag('samples', '1'));
const from = Number(flag('from', '0'));
const to = Number(flag('to', '10'));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const [width, height] = orientation === 'portrait' ? [1080, 1920] : [1920, 1080];
const frames = path.resolve(`.cache/intro-frames/${orientation}`);
await mkdir(frames, { recursive: true });

const encodeOnly = args.includes('--encode-only');
if (!encodeOnly) await renderFrames();

async function renderFrames() {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(e.message));
  await page.goto(`${BASE}/ru/cinema?intro=frames`);
  await page.waitForFunction(() => document.body.dataset.ready === 'intro', null, {
    timeout: 120_000,
  });

  if (orientation === 'landscape') {
    await mkdir('docs/review/v2/intro', { recursive: true });
    const wav = await page.evaluate(() => window.__introScore());
    await writeFile('docs/review/v2/intro/intro-score.wav', Buffer.from(wav, 'base64'));
    console.log('score: docs/review/v2/intro/intro-score.wav');
  }

  const total = Math.round(10 * fps);
  const started = Date.now();
  for (let i = Math.round(from * fps); i <= Math.min(total, Math.round(to * fps)); i += 1) {
    const file = path.join(frames, `f${String(i).padStart(4, '0')}.png`);
    if (existsSync(file)) continue;
    const t = i / fps;
    const url = await page.evaluate(({ t, samples }) => window.__introFrame(t, samples), {
      t,
      samples,
    });
    await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
    if (i % 10 === 0) {
      const per = (Date.now() - started) / 1000 / (i - Math.round(from * fps) + 1);
      console.log(
        `  ${orientation} frame ${i}/${total} (t=${t.toFixed(2)} s, ~${per.toFixed(1)} s/frame)`,
      );
    }
  }
  await browser.close();
}

const ffmpeg = findFfmpeg();
for (const [size, crf, vp9crf, scale] of [
  [1080, 21, 31, orientation === 'portrait' ? '1080:1920' : '1920:1080'],
  [720, 24, 35, orientation === 'portrait' ? '720:1280' : '1280:720'],
]) {
  const input = [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(fps),
    '-i',
    path.join(frames, 'f%04d.png'),
    '-vf',
    `scale=${scale}:flags=lanczos`,
  ];
  const outputs = [
    [
      `public/cinema/intro-${orientation}-${size}.mp4`,
      [
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        String(crf),
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      ],
    ],
    [
      `public/cinema/intro-${orientation}-${size}.webm`,
      [
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        '0',
        '-crf',
        String(vp9crf),
        '-row-mt',
        '1',
        '-deadline',
        'good',
        '-cpu-used',
        '2',
        '-pix_fmt',
        'yuv420p',
      ],
    ],
  ];
  for (const [out, codec] of outputs) {
    const result = spawnSync(ffmpeg, [...input, ...codec, out], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`ffmpeg failed for ${out}`);
    console.log(out);
  }
}
