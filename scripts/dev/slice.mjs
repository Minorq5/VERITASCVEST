// Slice a tall full-page screenshot into viewport-sized chunks for review.
import sharp from 'sharp';
import path from 'node:path';
const [file, chunkArg, outDir, scaleArg] = process.argv.slice(2);
const chunk = Number(chunkArg ?? 1200);
const scale = Number(scaleArg ?? 1);
const meta = await sharp(file).metadata();
const base = path.basename(file, '.png');
let i = 0;
for (let top = 0; top < meta.height; top += chunk) {
  const height = Math.min(chunk, meta.height - top);
  const out = path.join(
    outDir ?? path.dirname(file),
    `${base}.part${String(i).padStart(2, '0')}.png`,
  );
  let img = sharp(file).extract({ left: 0, top, width: meta.width, height });
  if (scale !== 1) img = img.resize(Math.round(meta.width * scale));
  await img.toFile(out);
  console.log(out);
  i += 1;
}
