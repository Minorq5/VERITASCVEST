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
    ['forgot', '/ru/forgot-password'],
    ['check-email', '/ru/check-email'],
    ['confirm-invalid', '/ru/auth/confirm'],
    ['reset', '/ru/reset-password'],
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
  if (!screens || [...screens].some((s) => s.startsWith('onboarding') || s === 'empty')) {
    const fresh = await createDemoAccount({ tag: 'onb', tasks: false, onboarded: false });
    const ctx = await browser.newContext(options);
    const p = await ctx.newPage();
    await signIn(p, fresh);
    await settle(p);
    await shot(p, dir, 'onboarding');
    for (const n of [2, 3, 4]) {
      await p.getByRole('button', { name: 'Далее' }).click();
      await settle(p, 1200);
      await shot(p, dir, `onboarding-${n}`);
    }
    // A brand-new account: the empty planner.
    if (!screens || screens.has('empty')) {
      await p.getByRole('button', { name: 'Пропустить' }).click();
      await p.waitForURL(/\/ru\/today/);
      await settle(p, 2500);
      await shot(p, dir, 'empty');
    }
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
    ['settings-account', '/ru/settings/account'],
    ['settings-appearance', '/ru/settings/appearance'],
    ['settings-sound', '/ru/settings/sound'],
    ['settings-language', '/ru/settings/language'],
    ['settings-privacy', '/ru/settings/privacy'],
  ]) {
    if (screens && !screens.has(name)) continue;
    await page.goto(`${BASE}${url}`);
    await settle(page);
    await shot(page, dir, name);
  }
  for (const [name, url] of [
    ['tomorrow', '/ru/tomorrow'],
    ['week', '/ru/week'],
    ['overdue', '/ru/overdue'],
  ]) {
    if (screens && !screens.has(name)) continue;
    await page.goto(`${BASE}${url}`);
    await settle(page);
    await shot(page, dir, name);
  }
  if (!screens || screens.has('projects')) {
    await page.goto(`${BASE}/ru/projects`);
    await settle(page);
    await shot(page, dir, 'projects');
  }
  if (!screens || screens.has('project')) {
    await page.goto(`${BASE}/ru/today`);
    await settle(page, 1500);
    const link = page.getByRole('link', { name: /Запуск сайта/ }).first();
    if (kind === 'phone') {
      await page.getByRole('button', { name: 'Ещё', exact: true }).click();
      await settle(page, 800);
      await page.getByRole('dialog').getByRole('link', { name: /Запуск сайта/ }).click();
    } else await link.click();
    await page.waitForURL(/\/ru\/projects\//);
    await settle(page);
    await shot(page, dir, 'project');
  }
  if (!screens || screens.has('project-dialog')) {
    await page.goto(`${BASE}/ru/projects`);
    await settle(page, 1500);
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await settle(page, 800);
    await page.getByLabel('Название').fill('Телескоп на даче');
    await settle(page, 1000);
    await shot(page, dir, 'project-dialog');
    await page.keyboard.press('Escape');
  }
  // Tags, smart lists, the filter bar and the sort menu (stage 4.3)
  for (const [name, url] of [
    ['tags', '/ru/tags'],
    ['smart-new', '/ru/lists/new'],
  ]) {
    if (screens && !screens.has(name)) continue;
    await page.goto(`${BASE}${url}`);
    await settle(page);
    await shot(page, dir, name);
  }
  if (!screens || screens.has('tag')) {
    await page.goto(`${BASE}/ru/tags`);
    await settle(page, 1500);
    await page.getByRole('link', { name: 'работа', exact: true }).click();
    await page.waitForURL(/\/ru\/tags\//);
    await settle(page);
    await shot(page, dir, 'tag');
  }
  if (!screens || screens.has('smart-list')) {
    await page.goto(`${BASE}/ru/today`);
    await settle(page, 1500);
    if (kind === 'phone') {
      await page.getByRole('button', { name: 'Ещё', exact: true }).click();
      await settle(page, 800);
      await page.getByRole('dialog').getByRole('link', { name: 'Работа на неделю' }).click();
    } else await page.getByRole('link', { name: 'Работа на неделю' }).click();
    await page.waitForURL(/\/ru\/lists\//);
    await settle(page);
    await shot(page, dir, 'smart-list');
  }
  if (!screens || screens.has('filter-bar')) {
    await page.goto(`${BASE}/ru/today`);
    await settle(page, 1500);
    await page.getByRole('button', { name: 'Фильтр', exact: true }).click();
    await page.getByRole('button', { name: 'Приоритет', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Высокий' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Средний' }).click();
    await settle(page, 800);
    await shot(page, dir, 'filter-menu');
    await page.keyboard.press('Escape');
    await settle(page, 800);
    await shot(page, dir, 'filter-bar');
  }
  if (!screens || screens.has('sort-menu')) {
    await page.goto(`${BASE}/ru/inbox`);
    await settle(page, 1500);
    await page.getByRole('button', { name: /^Сортировка/ }).click();
    await settle(page, 800);
    await shot(page, dir, 'sort-menu');
    await page.keyboard.press('Escape');
  }
  if (kind === 'phone' && (!screens || screens.has('more'))) {
    await page.goto(`${BASE}/ru/today`);
    await settle(page, 1500);
    await page.getByRole('button', { name: 'Ещё', exact: true }).click();
    await settle(page, 1200);
    await shot(page, dir, 'more');
    await page.keyboard.press('Escape');
  }
  for (const [name, title, list] of [
    ['task-normal', 'Отправить отчёт по кварталу', 'inbox'],
    ['task-numeric', 'Прочитать «Интерстеллар: наука за кадром»', 'inbox'],
    ['task-percent', 'Написать главу диплома', 'inbox'],
    ['task-habit', 'Медитация', 'inbox'],
    ['task-counter', 'Вода', 'inbox'],
    ['task-time', 'Пробежка в парке', 'today'],
    ['task-stages', 'Запуск лендинга', 'week'],
  ]) {
    if (screens && !screens.has(name)) continue;
    await page.goto(`${BASE}/ru/${list}`);
    await settle(page, 2000);
    await page.getByRole('button', { name: `Открыть «${title}»` }).click();
    await settle(page, 2000);
    await shot(page, dir, name);
  }
  // Pickers and dialogs over the working app
  if (!screens || screens.has('date-picker')) {
    await page.goto(`${BASE}/ru/inbox`);
    await settle(page, 2000);
    await page.getByRole('button', { name: 'Открыть «Написать главу диплома»' }).click();
    await settle(page, 1500);
    await page.getByRole('button', { name: /^Сегодня/ }).last().click();
    await settle(page, 1200);
    await shot(page, dir, 'date-picker');
    await page.keyboard.press('Escape');
  }
  if (!screens || screens.has('templates')) {
    await page.goto(`${BASE}/ru/today`);
    await settle(page, 2000);
    await page.getByRole('button', { name: /Из шаблона/ }).first().click();
    await settle(page, 1200);
    await shot(page, dir, 'templates');
    await page.keyboard.press('Escape');
  }
  if (!screens || screens.has('bulk')) {
    await page.goto(`${BASE}/ru/today`);
    await settle(page, 2000);
    await page.getByRole('button', { name: /Выбрать несколько/ }).first().click();
    await settle(page, 600);
    for (const title of ['Купить продукты на неделю', 'Созвон с командой дизайна']) {
      await page.getByRole('checkbox', { name: `Выбрать «${title}»` }).click();
    }
    await settle(page, 1200);
    await shot(page, dir, 'bulk');
  }
  if (!screens || screens.has('quick-add')) {
    await page.goto(`${BASE}/ru/inbox`);
    await settle(page, 2000);
    if (kind === 'phone') await page.getByRole('button', { name: 'Новая задача' }).last().click();
    else await page.keyboard.press('n');
    await settle(page, 800);
    await page.keyboard.type('Сходить в зал завтра в 18:00 #спорт !высокий');
    await settle(page, 1200);
    await shot(page, dir, 'quick-add');
  }
  await ctx.close();
}
await browser.close();
if (errors.length) console.log('page errors:', errors);
