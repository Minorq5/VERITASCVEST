/**
 * Design review captures for stage 2 (auth, onboarding, profile, settings)
 * against the local stack. Creates a demo account through the Auth admin API.
 *
 *   npx tsx scripts/dev/stage2-shots.ts review/stage-2/round-1 [desktop,mobile]
 */
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices, type BrowserContextOptions, type Page } from '@playwright/test';

const out = process.argv[2] ?? 'review/stage-2/latest';
const only = (process.argv[3] ?? 'desktop,mobile').split(',');
const BASE = 'http://localhost:3000';

function env(name: string): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing`);
  return line.slice(name.length + 1).trim();
}
const API = env('NEXT_PUBLIC_SUPABASE_URL');
const SECRET = env('SUPABASE_SECRET_KEY');

async function admin(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { apikey: SECRET, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${pathname}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function demoAccount(tag: string, onboarded: boolean) {
  const id = Date.now().toString(36);
  const email = `alina-${tag}-${id}@example.com`;
  const username = `alina_${tag}_${id}`.slice(0, 24);
  const user = (await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'Orbita2026x',
      email_confirm: true,
      user_metadata: { username, display_name: 'Алина Орлова', locale: 'ru', timezone: 'Europe/Moscow' },
    }),
  })) as { id: string };
  await admin(`/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ xp: 2050, level: 6, bio: 'Собираю свою галактику из маленьких побед. Утро — для глубокой работы.' }),
  });
  if (onboarded) {
    await admin(`/rest/v1/user_settings?user_id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ onboarding_completed_at: new Date().toISOString() }),
    });
  }
  return { email, username, password: 'Orbita2026x' };
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

// The sandbox renders without a GPU at a few frames per second: give animations time to land.
async function settle(page: Page, ms = 2200) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

async function main() {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const vp of only) {
      const context = await browser.newContext({ ...viewports[vp], locale: 'ru-RU', timezoneId: 'Europe/Moscow', colorScheme: 'dark' });
      const page = await context.newPage();
      page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error' && !m.text().includes('Failed to load resource')) console.error(`[console] ${m.text()}`);
      });
      const shot = async (name: string, ms?: number) => {
        await settle(page, ms);
        const file = path.join(out, `${name}.${vp}.png`);
        await page.screenshot({ path: file, animations: 'disabled' });
        console.log(`saved ${file}`);
      };

      // Signed out
      await page.goto(`${BASE}/ru/login`, { waitUntil: 'networkidle' });
      await shot('01-login');
      await page.goto(`${BASE}/ru/register`, { waitUntil: 'networkidle' });
      await page.getByLabel('Почта').fill('alina@example.com');
      await page.getByLabel('Имя пользователя').fill(`orbit_${Date.now().toString(36)}`);
      await page.getByLabel('Пароль', { exact: true }).fill('Luna2026');
      await page.getByText('Свободно').waitFor();
      await shot('02-register-filled');
      await page.goto(`${BASE}/ru/forgot-password`, { waitUntil: 'networkidle' });
      await shot('03-forgot');
      await page.evaluate(() => sessionStorage.setItem('vt:pending-email', 'alina@example.com'));
      await page.goto(`${BASE}/ru/check-email`, { waitUntil: 'networkidle' });
      await shot('04-check-email');
      await page.goto(`${BASE}/ru/auth/confirm?token_hash=expired&type=email`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /не сработала|устарела/ }).waitFor();
      await shot('05-confirm-invalid');

      // Onboarding
      const fresh = await demoAccount(vp.slice(0, 1), false);
      await page.goto(`${BASE}/ru/login`, { waitUntil: 'networkidle' });
      await page.getByLabel('Почта').fill(fresh.email);
      await page.getByLabel('Пароль', { exact: true }).fill(fresh.password);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await page.waitForURL(/\/onboarding$/);
      await shot('06-onboarding-1', 2600);
      await page.getByRole('button', { name: 'Далее' }).click();
      await shot('07-onboarding-2', 2600);
      await page.getByRole('button', { name: 'Далее' }).click();
      await shot('08-onboarding-3', 2600);
      await page.getByRole('button', { name: 'Начать полёт' }).click();
      await page.waitForURL(/\/profile$/);

      // Profile
      await shot('09-profile', 2600);
      if (vp === 'mobile') {
        await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
        await shot('09-profile-2');
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      }
      await page.locator('input[type=file]').setInputFiles('public/brand/veritas-email-logo.png');
      await shot('10-avatar-crop', 2600);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      if (vp === 'desktop') {
        await page.locator('aside').getByRole('button').last().click();
        await shot('11-user-menu', 1500);
        await page.keyboard.press('Escape');
      }

      // Settings
      await page.goto(`${BASE}/ru/settings`, { waitUntil: 'networkidle' });
      await shot('12-settings');
      for (const section of ['account', 'appearance', 'sound', 'language', 'privacy']) {
        await page.goto(`${BASE}/ru/settings/${section}`, { waitUntil: 'networkidle' });
        await shot(`13-settings-${section}`);
        const tall = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 40);
        if (tall) {
          await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
          await shot(`13-settings-${section}-end`);
        }
      }
      await page.goto(`${BASE}/ru/settings/language`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Часовой пояс/ }).click();
      await page.keyboard.type('лон');
      await shot('14-timezone-search', 1500);
      await page.keyboard.press('Escape');

      await page.goto(`${BASE}/ru/settings/account`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Сменить пароль' }).click();
      await page.getByLabel('Новый пароль').fill('Kometa2026');
      await shot('15-change-password', 1500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
      await shot('16-delete-account', 1500);
      await page.keyboard.press('Escape');

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
