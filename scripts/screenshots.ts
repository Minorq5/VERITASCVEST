/**
 * Visual self-check: screenshots of routes at desktop (1920×1080) and phone
 * (393×852, iPhone-like) sizes for design review rounds.
 *
 *   npx tsx scripts/screenshots.ts --routes /ru,/ru/design --out review/stage-1/round-1 [--full]
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices, type BrowserContextOptions } from '@playwright/test';

interface Args {
  base: string;
  routes: string[];
  out: string;
  full: boolean;
  viewports: string[];
  wait: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    base: get('base') ?? 'http://localhost:3000',
    routes: (get('routes') ?? '/ru').split(',').filter(Boolean),
    out: get('out') ?? 'review/latest',
    full: argv.includes('--full'),
    viewports: (get('viewports') ?? 'desktop,mobile').split(','),
    wait: Number(get('wait') ?? 1800),
  };
}

const viewports: Record<string, BrowserContextOptions> = {
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  mobile: {
    ...devices['iPhone 15 Pro'],
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

function fileName(route: string) {
  const clean = route.replace(/^\//, '').replace(/[/?#=&]+/g, '_') || 'root';
  return clean;
}

async function main() {
  const args = parseArgs();
  await mkdir(args.out, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const vpName of args.viewports) {
      const options = viewports[vpName];
      if (!options) throw new Error(`Unknown viewport ${vpName}`);
      const context = await browser.newContext({
        ...options,
        locale: 'ru-RU',
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.error(`[console] ${msg.text()}`);
      });
      for (const route of args.routes) {
        const url = new URL(route, args.base).toString();
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(args.wait);
        if (!args.full) {
          const file = path.join(args.out, `${fileName(route)}.${vpName}.png`);
          await page.screenshot({ path: file });
          console.log(`saved ${file}`);
          continue;
        }
        // Screen-by-screen capture: full-page captures of very tall pages exceed
        // the software renderer's texture size and wrap around.
        const { scrollHeight, innerHeight } = await page.evaluate(() => ({
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
        }));
        const step = Math.floor(innerHeight * 0.92);
        let index = 0;
        for (let y = 0; y < scrollHeight; y += step) {
          await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
          await page.waitForTimeout(450);
          const file = path.join(
            args.out,
            `${fileName(route)}.${vpName}.${String(index).padStart(2, '0')}.png`,
          );
          await page.screenshot({ path: file });
          console.log(`saved ${file}`);
          index += 1;
          if (y + innerHeight >= scrollHeight) break;
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
