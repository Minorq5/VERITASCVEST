/**
 * A walkthrough video of the site, from the first screen to signing out:
 * a new person registers, confirms the email and goes through the first
 * flight; then a person with a planned week signs in and works with tasks,
 * sections, the profile and the settings.
 *
 * Needs the local stack (npm run db:start) and the dev server on :3000.
 *
 *   node scripts/video/walkthrough.mjs <out.mp4> [desktop|phone] [--dry]
 */
import { randomBytes } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createDemoAccount } from '../dev/seed-demo.mjs';
import { overlayInit } from './overlay.mjs';
import { Recorder } from './recorder.mjs';

const out = process.argv[2] ?? 'walkthrough.mp4';
const device = process.argv[3] === 'phone' ? 'phone' : 'desktop';
const dry = process.argv.includes('--dry');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

const phone = device === 'phone';
const size = phone ? { width: 393, height: 852 } : { width: 1920, height: 1080 };
const scale = phone ? 2 : 1;

/** SPEED=4 runs the scenario four times faster (for checking the script, not for filming). */
const speed = Number(process.env.SPEED ?? 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms) / speed));
const rand = (a, b) => a + Math.random() * (b - a);

// --- mail -------------------------------------------------------------------

async function waitForMail(to, after) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=5`);
    const body = await res.json();
    const fresh = body.messages.find((m) => new Date(m.Created).getTime() >= after);
    if (fresh) return (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json();
    await sleep(500);
  }
  throw new Error(`no email for ${to}`);
}

// --- the director: a visible, human-paced pointer and keyboard ----------------

class Director {
  constructor(page) {
    this.page = page;
    this.x = size.width * 0.6;
    this.y = size.height * 0.55;
  }

  async caption(text) {
    await this.page.evaluate((t) => window.__vtCaption?.(t), text).catch(() => {});
  }

  async point(target, { dx = 0, dy = 0 } = {}) {
    if ('x' in target) return { x: target.x, y: target.y };
    await target.waitFor({ state: 'visible', timeout: 20_000 });
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    return { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy };
  }

  /** Eased movement from where the pointer is, at about 60 steps a second. */
  async moveTo(target, options = {}) {
    const { x, y } = await this.point(target, options);
    const distance = Math.hypot(x - this.x, y - this.y);
    const ms = options.ms ?? Math.min(950, Math.max(260, distance * (phone ? 1.4 : 0.65)));
    const steps = Math.max(6, Math.round(ms / 16));
    const [x0, y0] = [this.x, this.y];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      await this.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
      await sleep(ms / steps - 3);
    }
    this.x = x;
    this.y = y;
  }

  async click(target, options = {}) {
    await this.moveTo(target, options);
    await sleep(options.before ?? 160);
    // Lists move (a finished task leaves, a toast appears): aim again if the target shifted.
    if (!('x' in target)) {
      for (let i = 0; i < 3; i++) {
        const p = await this.point(target, options);
        if (Math.hypot(p.x - this.x, p.y - this.y) < 3) break;
        await this.moveTo(p, { ms: 220 });
        await sleep(120);
      }
    }
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
    await sleep(options.after ?? 250);
  }

  async type(text, { min = 38, max = 95 } = {}) {
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await sleep(ch === ' ' ? rand(min * 1.3, max * 1.6) : rand(min, max));
    }
  }

  async press(key, after = 300) {
    await this.page.keyboard.press(key);
    await sleep(after);
  }

  /** Smooth wheel scroll by dy pixels. */
  async scroll(dy, ms = 900) {
    const steps = Math.round(ms / 16);
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, dy / steps);
      await sleep(12);
    }
  }

  /** Lets the viewer read. */
  async hold(ms) {
    await sleep(ms);
  }
}

// --- the film -------------------------------------------------------------------

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: scale,
  isMobile: phone,
  hasTouch: phone,
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  colorScheme: 'dark',
});
await context.addInitScript(overlayInit);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
});
const d = new Director(page);

// Navigation differs: a sidebar and a user menu on a computer, a tab bar and the "More" sheet on a phone.
const phoneTabs = ['Сегодня', 'Входящие', 'Неделя'];
async function openMore() {
  await d.click(page.getByRole('button', { name: 'Ещё', exact: true }));
  await page.getByRole('dialog').waitFor();
  await d.hold(700);
}
async function goTo(label) {
  if (!phone) {
    await d.click(page.locator('aside').getByRole('link', { name: new RegExp(label) }));
    return;
  }
  if (phoneTabs.includes(label)) {
    await d.click(page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: new RegExp(label) }).first());
    return;
  }
  await openMore();
  await d.click(page.getByRole('dialog').getByRole('link', { name: new RegExp(label) }).first());
}
/** Profile, settings and sign-out: the user menu on a computer, the "More" sheet on a phone. */
async function account(item, name) {
  if (phone) {
    await openMore();
    const sheet = page.getByRole('dialog');
    await d.click(item === 'Выйти' ? sheet.getByRole('button', { name: item }) : sheet.getByRole('link', { name: item }));
    return;
  }
  await d.click(page.getByRole('button', { name }).last());
  await d.hold(500);
  await d.click(page.getByRole('menuitem', { name: item }));
}

// Accounts: a new person (registers on camera) and one with a planned week.
const id = randomBytes(3).toString('hex').slice(0, 4);
const fresh = { email: `alina.orlova.${id}@example.com`, username: `alina_${id}`, password: 'Zvezda2026k' };
const planned = await createDemoAccount({ tag: 'video' });

await page.goto(`${BASE}/ru`);
await page.waitForLoadState('networkidle');
await sleep(1500);
await page.mouse.move(d.x, d.y);

const rec = dry ? null : new Recorder(page, { out, width: size.width * scale, height: size.height * scale });
await rec?.start();
const started = Date.now();

try {
  // 01 — the landing page
  await d.caption('01 · Главная страница');
  await d.hold(2200);
  await d.moveTo({ x: size.width * 0.35, y: size.height * 0.4 }, { ms: 1400 });
  await d.moveTo({ x: size.width * 0.62, y: size.height * 0.32 }, { ms: 1400 });
  await d.hold(600);
  await d.click(page.getByRole('link', { name: 'Начать' }), { before: 500 });

  // 02 — registration
  await page.waitForURL(/\/ru\/register/);
  await d.caption('02 · Регистрация');
  await d.hold(1200);
  await d.click(page.getByLabel('Почта'));
  await d.type(fresh.email, { min: 30, max: 70 });
  await d.click(page.getByLabel('Имя пользователя'));
  await d.type(fresh.username);
  await page.getByText('Свободно').waitFor({ timeout: 15_000 });
  await d.hold(900);
  await d.click(page.getByLabel('Пароль', { exact: true }));
  await d.type(fresh.password, { min: 60, max: 120 });
  await d.hold(900);
  const mailAfter = Date.now() - 2000;
  await d.click(page.getByRole('button', { name: 'Создать аккаунт' }), { before: 400 });

  // 03 — the confirmation email
  await page.waitForURL(/\/ru\/check-email/);
  await d.caption('03 · Письмо с подтверждением');
  await d.hold(2600);
  const mail = await waitForMail(fresh.email, mailAfter);
  await page.setContent(mail.HTML, { waitUntil: 'load' });
  await page.evaluate(overlayInit);
  await d.caption('03 · Письмо с подтверждением');
  await page.mouse.move(d.x, d.y);
  await d.hold(2200);
  const confirm = page.locator('a[href*="/auth/confirm"]').first();
  await d.click(confirm, { before: 700 });

  // 04 — first flight (onboarding)
  await page.waitForURL(/\/ru\/onboarding/, { timeout: 30_000 });
  await d.caption('04 · Первый запуск');
  await page.getByLabel('Как к вам обращаться').waitFor();
  await d.hold(1500);
  const name = page.getByLabel('Как к вам обращаться');
  await d.click(name);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await d.type('Алина');
  await d.hold(1300);
  await d.click(page.getByRole('button', { name: 'Далее' }));
  await page.getByRole('heading', { name: 'Качество графики' }).waitFor();
  await d.hold(1600);
  await d.click(page.getByRole('radio', { name: /Высокое/ }));
  await d.hold(800);
  await d.click(page.getByRole('button', { name: 'Далее' }));
  await page.getByRole('heading', { name: 'Звук' }).waitFor();
  await d.hold(1800);
  await d.click(page.getByRole('button', { name: 'Далее' }));
  await page.getByRole('heading', { name: 'Первая задача' }).waitFor();
  await d.hold(1400);
  await d.click(page.getByRole('combobox', { name: 'Новая задача' }));
  await d.type('Позвонить маме сегодня в 19:00 #семья');
  await d.hold(1400);
  await d.press('Enter', 1800);
  await d.click(page.getByRole('button', { name: 'Начать полёт' }), { before: 400 });

  // 05 — the new person's Today
  await page.waitForURL(/\/ru\/today/, { timeout: 30_000 });
  await d.caption('05 · Сегодня');
  await d.hold(2500);
  await d.moveTo(page.getByRole('button', { name: 'Открыть «Позвонить маме»' }));
  await d.hold(1800);
  // Wait until the task is on the server, then sign out.
  await page.getByText('Всё сохранено').first().waitFor({ timeout: 30_000 }).catch(() => {});
  await account('Выйти', /Алина/);

  // 06 — a week later: sign in to an account with a planned day
  await page.waitForURL(/\/ru\/login/, { timeout: 30_000 });
  await d.caption('06 · Вход в аккаунт с планами');
  await d.hold(1600);
  await d.click(page.getByLabel('Почта'));
  await d.type(planned.email, { min: 25, max: 60 });
  await d.click(page.getByLabel('Пароль', { exact: true }));
  await d.type(planned.password, { min: 60, max: 110 });
  await d.hold(600);
  await d.click(page.getByRole('button', { name: 'Войти', exact: true }), { before: 300 });
  await page.waitForURL(/\/ru\/today/, { timeout: 30_000 });

  // 07 — the day at a glance
  await d.caption('07 · План на день');
  await page.getByRole('button', { name: 'Открыть «Написать главу диплома»' }).waitFor();
  await d.hold(2600);
  await d.moveTo(page.getByText('Выполнено', { exact: true }).first(), { ms: 900 });
  await d.hold(1200);
  await d.moveTo(page.getByText('Просрочено', { exact: true }).first(), { ms: 700 });
  await d.hold(1200);
  await d.moveTo(page.getByRole('button', { name: 'Открыть «Прочитать «Интерстеллар: наука за кадром»»' }), { ms: 900 });
  await d.hold(1400);

  // 08 — the smart line
  await d.caption('08 · Умная строка ввода');
  await d.click(page.getByRole('combobox', { name: 'Новая задача' }));
  await d.type('Отправить счёт клиенту сегодня в 16:00 #работа !высокий');
  await d.hold(2400);
  await d.press('Enter', 2200);

  // 09 — done and undo
  await d.caption('09 · Выполнение и отмена');
  await d.click(page.getByRole('checkbox', { name: 'Выполнить «Купить продукты на неделю»' }), { before: 500 });
  await d.hold(1600);
  await d.click(page.getByRole('button', { name: 'Отменить' }).first(), { before: 400 });
  await d.hold(2000);
  await d.click(page.getByRole('checkbox', { name: 'Выполнить «Отправить отчёт по кварталу»' }), { before: 500 });
  await d.hold(2600);

  // 10 — the task card
  await d.caption('10 · Карточка задачи');
  await d.click(page.getByRole('button', { name: 'Открыть «Написать главу диплома»' }));
  await d.hold(2200);
  await d.click(page.getByRole('button', { name: /\+10/ }).first(), { before: 400 });
  await d.hold(900);
  await d.click(page.getByRole('button', { name: /\+10/ }).first(), { before: 250 });
  await d.hold(1400);
  const subtask = page.getByPlaceholder('Название подзадачи');
  await d.click(subtask);
  await d.type('Список литературы');
  await d.press('Enter', 700);
  await d.type('Черновик введения');
  await d.press('Enter', 1500);
  await d.press('Escape', 1200);

  // 11 — task types
  await d.caption('11 · Привычки и счётчики');
  await goTo('Входящие');
  await page.waitForURL(/\/ru\/inbox/);
  await d.hold(1400);
  await d.click(page.getByRole('button', { name: 'Открыть «Медитация»' }));
  await d.hold(1800);
  await d.click(page.getByRole('checkbox', { name: 'Отметить сегодня' }).last(), { before: 400 });
  await d.hold(2400);
  await d.press('Escape', 900);
  await d.click(page.getByRole('button', { name: 'Открыть «Вода»' }));
  await d.hold(1500);
  const plus = page.getByRole('button', { name: 'Добавить 1' }).last();
  await d.click(plus, { before: 300 });
  await d.click(plus, { before: 200 });
  await d.hold(2000);
  await d.press('Escape', 900);

  // 12 — sections
  await d.caption('12 · Разделы');
  for (const [label, url] of [
    ['Завтра', /\/ru\/tomorrow/],
    ['Неделя', /\/ru\/week/],
    ['Запуск сайта', /\/ru\/projects\//],
    ['Выполненные', /\/ru\/completed/],
    ['Корзина', /\/ru\/trash/],
  ]) {
    await goTo(label);
    await page.waitForURL(url);
    await d.hold(1900);
  }

  // 13 — profile
  await d.caption('13 · Профиль');
  await account('Профиль', /Алина Орлова/);
  await page.waitForURL(/\/ru\/profile/);
  await d.hold(3200);

  // 14 — settings: accent and language
  await d.caption('14 · Настройки');
  await account('Настройки', /Алина Орлова/);
  await page.waitForURL(/\/ru\/settings/);
  await d.hold(1200);
  await d.click(page.getByRole('link', { name: 'Внешний вид' }).first());
  await page.waitForURL(/\/ru\/settings\/appearance/);
  await d.hold(1500);
  for (const accent of ['Голубой', 'Белый', 'Янтарь']) {
    await d.click(page.getByRole('radio', { name: accent }).first(), { before: 300 });
    await d.hold(1500);
  }
  if (phone) {
    await page.goBack();
    await page.waitForURL(/\/ru\/settings$/);
    await d.hold(900);
  }
  await d.click(page.getByRole('link', { name: 'Язык и регион' }).first());
  await page.waitForURL(/\/ru\/settings\/language/);
  await d.hold(1200);
  await d.click(page.getByRole('radio', { name: 'English' }));
  await page.waitForURL(/\/en\/settings\/language/);
  await d.hold(2200);
  await d.click(page.getByRole('radio', { name: 'Русский' }));
  await page.waitForURL(/\/ru\/settings\/language/);
  await d.hold(1500);

  // 15 — sign out
  await d.caption('15 · Выход');
  await account('Выйти', /Алина Орлова/);
  await page.waitForURL(/\/ru\/login/, { timeout: 30_000 });
  await d.hold(2000);
  await d.caption('');
  await d.hold(1200);
} finally {
  await rec?.stop();
  console.log(`${device}: ${((Date.now() - started) / 1000).toFixed(0)} s of film${rec ? `, ${rec.seconds.toFixed(1)} s written to ${out}` : ''}`);
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
}
