import { expect, test } from '@playwright/test';
import { createAccount, leftovers, signIn, uniqueAccount, userExists } from './support/accounts';
import { linkFrom, waitForMail } from './support/mailpit';

test('registration: email link → onboarding → profile', async ({ page }) => {
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
  expect(mail.subject).toContain('Veritas');
  await page.goto(linkFrom(mail, '/auth/confirm'));
  await expect(page).toHaveURL(/\/ru\/onboarding/);

  await expect(page.getByRole('heading', { name: /Добро пожаловать на борт/ })).toBeVisible();
  await page.getByLabel('Как к вам обращаться').fill('Капитан Тест');
  await expect(page.getByRole('heading', { name: /Капитан Тест/ })).toBeVisible();
  await page.getByRole('button', { name: 'Далее' }).click();

  await expect(page.getByRole('heading', { name: 'Качество графики' })).toBeVisible();
  await page.getByRole('radio', { name: /Низкое/ }).click();
  await page.getByRole('button', { name: 'Далее' }).click();

  await expect(page.getByRole('heading', { name: 'Звук' })).toBeVisible();
  await page.getByRole('button', { name: 'Начать полёт' }).click();

  await expect(page).toHaveURL(/\/ru\/profile$/);
  await expect(page.getByText('Капитан Тест', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(`@${account.username}`)).toBeVisible();
  await expect(page.getByText(/^VT-[2-9A-HJ-NP-Z]{5}$/)).toBeVisible();
  const device = await page.evaluate(() => localStorage.getItem('vt:device'));
  expect(JSON.parse(device ?? '{}').state.quality).toBe('low');

  // Onboarding is done once: the app no longer sends there.
  await page.goto('/ru/settings');
  await expect(page).toHaveURL(/\/ru\/settings$/);
});

test('protected page → sign-in (wrong, then right password) → back to the page', async ({ page }) => {
  const account = await createAccount();
  await page.goto('/ru/settings/sound');
  await expect(page).toHaveURL(/\/ru\/login\?next=/);
  await page.getByLabel('Почта').fill(account.email);
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-pass-1');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByText('Неверная почта или пароль')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/settings\/sound$/);
  await expect(page.getByRole('heading', { name: 'Звук', level: 2 })).toBeVisible();
});

test('first sign-in goes through onboarding; "Skip" finishes it', async ({ page }) => {
  const account = await createAccount({ onboarded: false });
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/ru\/onboarding$/);
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await expect(page).toHaveURL(/\/ru\/profile$/);
  await page.reload();
  await expect(page).toHaveURL(/\/ru\/profile$/);
});

test('forgot password → email → new password → sign in with it', async ({ page }) => {
  const account = await createAccount();
  const started = Date.now();
  await page.goto('/ru/forgot-password');
  await page.getByLabel('Почта').fill(account.email);
  await page.getByRole('button', { name: 'Отправить ссылку' }).click();
  await expect(page.getByText('Письмо в пути')).toBeVisible();

  const mail = await waitForMail(account.email, { after: started - 2000 });
  await page.goto(linkFrom(mail, '/auth/confirm'));
  await expect(page).toHaveURL(/\/ru\/reset-password/);
  await page.getByLabel('Новый пароль').fill('Zvezda2026y');
  await page.getByLabel('Повторите пароль').fill('Zvezda2026y');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await expect(page).toHaveURL(/\/ru\/profile$/);

  await page.context().clearCookies();
  await signIn(page, account.email, account.password);
  await expect(page.getByText('Неверная почта или пароль')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill('Zvezda2026y');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/profile$/);
});

test('profile: name, username, bio and avatar are saved', async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/ru\/profile$/);

  await page.getByLabel('Имя', { exact: true }).fill('Вега');
  const username = `${account.username.slice(0, 21)}_v`;
  await page.getByLabel('Имя пользователя').fill(username);
  await expect(page.getByText('Свободно')).toBeVisible();
  await page.getByLabel('О себе').fill('Иду к звёздам');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Профиль сохранён')).toBeVisible();

  await page.locator('input[type=file]').setInputFiles('public/icons/icon-512.png');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить аватар' }).click();
  await expect(page.getByText('Аватар обновлён')).toBeVisible();

  await page.reload();
  await expect(page.getByText(`@${username}`)).toBeVisible();
  await expect(page.getByText('Иду к звёздам').filter({ visible: true }).first()).toBeVisible();
  const avatar = page.locator('img[src*="/storage/v1/object/public/avatars/"]').filter({ visible: true }).first();
  await expect(avatar).toBeVisible();
  const src = await avatar.getAttribute('src');
  const res = await fetch(src!);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toMatch(/image\/(webp|jpeg)/);
});

test('settings: language and accent follow the account', async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password, '/settings/language');
  await expect(page).toHaveURL(/\/ru\/settings\/language$/);
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/settings\/language$/);
  await expect(page.getByRole('heading', { level: 2, name: /Language/ })).toBeVisible();

  await page.goto('/en/settings/appearance');
  await page.getByRole('radio', { name: 'Nebula' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'nebula');

  // A fresh device: preferences arrive from the account.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/en\/profile$/);
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'nebula');
});

test('sign out on this device', async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password, '/settings/account');
  await expect(page).toHaveURL(/\/ru\/settings\/account$/);
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/login/);
  await page.goto('/ru/profile');
  await expect(page).toHaveURL(/\/ru\/login\?next=%2Fprofile/);
});

test('delete account: typed username confirms, the account is gone', async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password, '/settings/account');
  await expect(page).toHaveURL(/\/ru\/settings\/account$/);
  await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Удалить навсегда' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox').fill('someone_else');
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox').fill(account.username);
  await confirm.click();
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.getByText('Аккаунт удалён')).toBeVisible();
  expect(await userExists(account.email)).toBe(false);

  expect(await leftovers(account.id)).toEqual({ profiles: 0, settings: 0 });

  await signIn(page, account.email, account.password);
  await expect(page.getByText('Неверная почта или пароль')).toBeVisible();
});
