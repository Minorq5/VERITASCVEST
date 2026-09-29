/**
 * Renders every interface sound offline (the same recipes the app plays) to
 * WAV, checks the levels, and joins them into one file to listen through:
 *
 *   node scripts/sound/render-sounds.mjs [out-dir]     (default docs/review/v2/sounds)
 *
 * Needs the app on BASE_URL. A sound must not be silent, must not clip, and
 * interface sounds stay quieter than effects.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'docs/review/v2/sounds';
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__soundLog = [];
  localStorage.setItem('vt:intro-force', '0');
});
await page.goto(`${BASE}/ru/login`);
await page.waitForFunction(() => Array.isArray(window.__vtSoundNames), null, { timeout: 60_000 });
const names = await page.evaluate(() => window.__vtSoundNames);

/** Peak and RMS (dBFS) of 16-bit stereo PCM. */
function levels(wav) {
  const samples = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2);
  let peak = 0;
  let sum = 0;
  for (const s of samples) {
    const v = Math.abs(s) / 32768;
    peak = Math.max(peak, v);
    sum += v * v;
  }
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { peak: db(peak), rms: db(Math.sqrt(sum / samples.length)) };
}

const rows = [];
const pcm = [];
const gap = Buffer.alloc(48000 * 2 * 2 * 0.5);
for (const name of names) {
  const params = name === 'progressStep' ? { value: 0.6 } : undefined;
  const b64 = await page.evaluate(({ name, params }) => window.__vtRenderSound(name, params), { name, params });
  const wav = Buffer.from(b64, 'base64');
  await writeFile(path.join(out, `${name}.wav`), wav);
  const { peak, rms } = levels(wav);
  rows.push({ name, peak, rms });
  pcm.push(wav.subarray(44), gap);
}
await browser.close();

// One file with every sound, half a second apart, in the order of the table.
const data = Buffer.concat(pcm);
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(48000, 24);
header.writeUInt32LE(48000 * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
await writeFile(path.join(out, '_all-sounds.wav'), Buffer.concat([header, data]));

let failed = 0;
for (const r of rows) {
  const problem = r.peak === -Infinity ? 'SILENT' : r.peak > -0.3 ? 'CLIPS' : '';
  if (problem) failed += 1;
  console.log(`${r.name.padEnd(18)} peak ${r.peak.toFixed(1).padStart(6)} dB  rms ${r.rms.toFixed(1).padStart(6)} dB ${problem}`);
}
console.log(`${rows.length} sounds → ${out}/ (and _all-sounds.wav)`);
if (failed) process.exit(1);
