import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser } from '@playwright/test';
import { API, createAccount, PUBLISHABLE_KEY, uniqueAccount } from './support/accounts';
import { linkFrom, waitForMail } from './support/mailpit';

/**
 * Links from Supabase's own letter templates (the cloud project may still
 * have them): people sign up on a computer and open the letter on a phone.
 * Our templates carry `token_hash`; the defaults go through the server's
 * /verify and come back with tokens (or a code) — both must end well.
 */

const BASE = 'http://localhost:3000';

/** The token of our letter, sent through the server's own /verify like a default template would. */
function defaultLink(mailLink: string, type: 'signup' | 'recovery', flow: 'signup' | 'recovery') {
  const token = new URL(mailLink).searchParams.get('token_hash')!;
  const back = encodeURIComponent(`${BASE}/ru/auth/confirm?flow=${flow}`);
  return `${API()}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${back}`;
}

/** A second device: its own browser storage, nothing shared with the first. */
async function otherDevice(browser: Browser) {
  const context = await browser.newContext({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', baseURL: BASE });
  return { context, page: await context.newPage() };
}

test('sign-up letter opened on another device signs in there', async ({ page, browser }) => {
  const account = uniqueAccount();
  const started = Date.now();
  await page.goto('/ru/register');
  await page.getByLabel('Почта').fill(account.email);
  await page.getByLabel('Имя пользователя').fill(account.username);
  await expect(page.getByText('Свободно')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page).toHaveURL(/\/ru\/check-email/);

  const mail = await waitForMail(account.email, { after: started - 2000 });
  const phone = await otherDevice(browser);
  await phone.page.goto(defaultLink(linkFrom(mail, '/auth/confirm'), 'signup', 'signup'));
  await expect(phone.page).toHaveURL(/\/ru\/onboarding/);
  // The tokens do not stay in the address.
  expect(phone.page.url()).not.toContain('access_token');

  // The same link again: used up — the page says to just sign in.
  const again = await otherDevice(browser);
  await again.page.goto(defaultLink(linkFrom(mail, '/auth/confirm'), 'signup', 'signup'));
  await expect(again.page.getByRole('heading', { name: /Ссылка (устарела|не сработала)/ })).toBeVisible();
  // Interface texts keep short words together with no-break spaces: \s covers them.
  await expect(again.page.getByText(/подтвер\S+\s+почту?\S*\s+—\s+просто\s+войдите/)).toBeVisible();
  await Promise.all([phone.context.close(), again.context.close()]);
});

test('an older PKCE letter opened elsewhere: the address is confirmed, sign-in finishes it', async ({ page }) => {
  const account = uniqueAccount('pkce');
  const started = Date.now();
  // Signed up the way the app did before: PKCE, the verifier stays in "that" browser (here — nowhere).
  const storage = new Map<string, string>();
  const pkce = createClient(API(), PUBLISHABLE_KEY(), {
    auth: {
      flowType: 'pkce',
      persistSession: false,
      storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) },
    },
  });
  const { error } = await pkce.auth.signUp({
    email: account.email,
    password: account.password,
    options: { emailRedirectTo: `${BASE}/ru/auth/confirm?flow=signup`, data: { username: account.username, display_name: account.username, locale: 'ru' } },
  });
  expect(error).toBeNull();

  const mail = await waitForMail(account.email, { after: started - 2000 });
  await page.goto(defaultLink(linkFrom(mail, '/auth/confirm'), 'signup', 'signup'));
  await expect(page.getByRole('heading', { name: 'Почта подтверждена' })).toBeVisible();
  await expect(page.getByText(/Осталось\s+войти\s+—\s+здесь/)).toBeVisible();
  await page.getByRole('link', { name: 'Войти' }).click();
  await page.getByLabel('Почта').fill(account.email);
  await page.getByLabel('Пароль', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/onboarding/);
});

test('password letter opened on another device sets a new password there', async ({ page, browser }) => {
  const account = await createAccount();
  const started = Date.now();
  await page.goto('/ru/forgot-password');
  await page.getByLabel('Почта').fill(account.email);
  await page.getByRole('button', { name: 'Отправить ссылку' }).click();
  await expect(page.getByText('Письмо в пути')).toBeVisible();

  const mail = await waitForMail(account.email, { after: started - 2000 });
  const phone = await otherDevice(browser);
  await phone.page.goto(defaultLink(linkFrom(mail, '/auth/confirm'), 'recovery', 'recovery'));
  await expect(phone.page).toHaveURL(/\/ru\/reset-password/);
  await phone.page.getByLabel('Новый пароль').fill('Zvezda2026y');
  await phone.page.getByLabel('Повторите пароль').fill('Zvezda2026y');
  await phone.page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await expect(phone.page).toHaveURL(/\/ru\/today$/);
  await phone.context.close();
});
