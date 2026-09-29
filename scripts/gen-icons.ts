/**
 * Rasterises the brand SVGs (public/brand) into favicons and PWA icons and,
 * with --og <base-url>, captures share cards from the running app.
 *
 *   npm run icons                        # icons only
 *   npm run icons -- --og http://localhost:3000
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const BRAND = 'public/brand';

async function png(svg: Buffer, size: number) {
  return sharp(svg, { density: Math.max(72, (size / 64) * 72 * 2) })
    .resize(size, size)
    .png()
    .toBuffer();
}

/** Minimal ICO writer: PNG-compressed entries (supported by all modern browsers). */
function ico(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function icons() {
  const app = await readFile(`${BRAND}/veritas-app-icon.svg`);
  const maskable = await readFile(`${BRAND}/veritas-maskable.svg`);
  // iOS masks the icon itself: give it a full-bleed square.
  const square = Buffer.from(
    app
      .toString()
      .replace(/rx="14"/g, 'rx="0"')
      .replace(/<rect x="0.5"[^>]+\/>/, ''),
  );

  await copyFile(`${BRAND}/veritas-app-icon.svg`, 'src/app/icon.svg');
  await writeFile('src/app/apple-icon.png', await png(square, 180));
  await writeFile(
    'src/app/favicon.ico',
    ico(
      await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(app, size) }))),
    ),
  );
  for (const size of [192, 512]) {
    await writeFile(`public/icons/icon-${size}.png`, await png(app, size));
    await writeFile(`public/icons/maskable-${size}.png`, await png(maskable, size));
  }
  console.log('icons: favicon.ico, icon.svg, apple-icon.png, icon-192/512, maskable-192/512');
}

async function ogCards(base: string) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  for (const locale of ['ru', 'en', 'bg']) {
    await page.goto(`${base}/${locale}/og-card`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2200);
    const buffer = await page.screenshot({ type: 'png' });
    await writeFile(
      `public/og/og-${locale}.jpg`,
      await sharp(buffer).jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
    );
    console.log(`og: public/og/og-${locale}.jpg`);
  }
  await browser.close();
}

async function main() {
  await icons();
  const i = process.argv.indexOf('--og');
  if (i >= 0) await ogCards(process.argv[i + 1] ?? 'http://localhost:3000');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
