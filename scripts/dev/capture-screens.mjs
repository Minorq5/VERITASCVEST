/**
 * Captures every finished screen on desktop (1920×1080) and phone (393×852)
 * against the local stack and the dev server — for design reviews and
 * before/after comparisons.
 *
 *   node scripts/dev/capture-screens.mjs docs/review/v2/before [desktop,phone] [screen,screen]
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createDemoAccount } from './seed-demo.mjs';

const out = process.argv[2] ?? 'docs/review/latest';
const only = (process.argv[3] ?? 'desktop,phone').split(',');
const screens = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const viewports = {
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const settle = (page, ms = 2500) => page.waitForTimeout(ms);

async function signIn(page, account) {
  await page.goto(`${BASE}/ru/login`);
  await page.getByLabel('Почта').fill(account.email);
  await page.getByLabel('Пароль', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/ru\/(today|onboarding)/, { timeout: 30_000 });
}

async function shot(page, dir, name) {
  if (screens && !screens.has(name)) return;
  await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' });
  console.log(`  ${name}`);
}

const browser = await chromium.launch();
const errors = [];
for (const kind of only) {
  const dir = path.join(out, kind);
  await mkdir(dir, { recursive: true });
  console.log(kind);
  const options = { ...viewports[kind], locale: 'ru-RU', timezoneId: 'Europe/Moscow', colorScheme: 'dark' };

  // Guest screens
  const guest = await browser.newContext(options);
  const g = await guest.newPage();
  g.on('pageerror', (e) => errors.push(`${kind} guest: ${e}`));
  for (const [name, url] of [
    ['landing', '/ru'],
    ['login', '/ru/login'],
    ['register', '/ru/register'],
    ['not-found', '/ru/за-горизонтом'],
    ['design', '/ru/design'],
  ]) {
    if (screens && !screens.has(name)) continue;
    await g.goto(`${BASE}${url}`);
    await settle(g, name === 'design' ? 4000 : 2500);
    await shot(g, dir, name);
  }
  await guest.close();

  // Onboarding (a fresh account)
  if (!screens || screens.has('onboarding')) {
    const fresh = await createDemoAccount({ tag: 'onb', tasks: false, onboarded: false });
    const ctx = await browser.newContext(options);
    const p = await ctx.newPage();
    await signIn(p, fresh);
    await settle(p);
    await shot(p, dir, 'onboarding');
    await ctx.close();
  }

  // The working app with a realistic day
  const account = await createDemoAccount({ tag: kind });
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${kind}: ${e}`));
  await signIn(page, account);
  await settle(page, 3500);
  await shot(page, dir, 'today');
  for (const [name, url] of [
    ['inbox', '/ru/inbox'],
    ['completed', '/ru/completed'],
    ['trash', '/ru/trash'],
    ['profile', '/ru/profile'],
    ['settings', kind === 'desktop' ? '/ru/settings/appearance' : '/ru/settings'],
  ]) {
    if (screens && !screens.has(name)) continue;
    await page.goto(`${BASE}${url}`);
    await settle(page);
    await shot(page, dir, name);
  }
  for (const [name, title, list] of [
    ['task-percent', 'Написать главу диплома', 'inbox'],
    ['task-habit', 'Медитация', 'inbox'],
    ['task-stages', 'Запуск лендинга', 'week'],
  ]) {
    if (screens && !screens.has(name)) continue;
    await page.goto(`${BASE}/ru/${list}`);
    await settle(page, 2000);
    await page.getByRole('button', { name: `Открыть «${title}»` }).click();
    await settle(page, 2000);
    await shot(page, dir, name);
  }
  await ctx.close();
}
await browser.close();
if (errors.length) console.log('page errors:', errors);
