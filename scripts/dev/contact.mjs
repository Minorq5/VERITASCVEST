// Contact sheets for review: tiles screenshots into grids.
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import path from 'node:path';
const [dir, pattern, cols = '2', width = '960', out = 'sheet'] = process.argv.slice(2);
const files = readdirSync(dir)
  .filter((f) => f.includes(pattern) && f.endsWith('.png') && !f.startsWith('sheet'))
  .sort();
const W = Number(width);
const C = Number(cols);
const perSheet = C * 2;
for (let s = 0; s * perSheet < files.length; s += 1) {
  const batch = files.slice(s * perSheet, (s + 1) * perSheet);
  const imgs = await Promise.all(
    batch.map((f) => sharp(path.join(dir, f)).resize(W).toBuffer({ resolveWithObject: true })),
  );
  const H = Math.max(...imgs.map((i) => i.info.height));
  const rows = Math.ceil(batch.length / C);
  const composite = imgs.map((img, i) => ({
    input: img.data,
    left: (i % C) * (W + 12),
    top: Math.floor(i / C) * (H + 12),
  }));
  const file = path.join(dir, `${out}-${pattern}-${s}.png`);
  await sharp({
    create: {
      width: C * W + (C - 1) * 12,
      height: rows * H + (rows - 1) * 12,
      channels: 3,
      background: '#2a2a2a',
    },
  })
    .composite(composite)
    .png()
    .toFile(file);
  console.log(file);
}
