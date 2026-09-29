import { expect, test } from '@playwright/test';
import { API, PUBLISHABLE_KEY, ageSessions, createAccount, signIn, uniqueAccount } from './support/accounts';
import { codeFrom, linkFrom, waitForMail } from './support/mailpit';

test('email change: both addresses confirm, then only the new one signs in', async ({ page }) => {
  const account = await createAccount();
  const next = uniqueAccount('new').email;
  await signIn(page, account.email, account.password, '/settings/account');
  await expect(page).toHaveURL(/\/ru\/settings\/account$/);

  const started = Date.now();
  await page.getByRole('button', { name: 'Сменить почту' }).click();
  await page.getByRole('dialog').getByLabel('Новая почта').fill(next);
  await page.getByRole('dialog').getByRole('button', { name: 'Сменить почту' }).click();
  await expect(page.getByText('Мы отправили подтверждения на старый и новый адрес')).toBeVisible();

  const toOld = await waitForMail(account.email, { after: started - 2000 });
  const toNew = await waitForMail(next, { after: started - 2000 });

  await page.goto(linkFrom(toOld, '/auth/confirm'));
  await expect(page.getByRole('heading', { name: 'Осталось подтвердить второй адрес' })).toBeVisible();
  await page.goto(linkFrom(toNew, '/auth/confirm'));
  await expect(page.getByRole('heading', { name: 'Почта изменена' })).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, account.email, account.password);
  await expect(page.getByText('Неверная почта или пароль')).toBeVisible();
  await page.getByLabel('Почта').fill(next);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/profile$/);
});

test('password change after an old sign-in asks for the code from the email', async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password, '/settings/account');
  await expect(page).toHaveURL(/\/ru\/settings\/account$/);
  ageSessions(account.id);

  const started = Date.now();
  await page.getByRole('button', { name: 'Сменить пароль' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Новый пароль').fill('Galaktika77');
  await dialog.getByLabel('Повторите пароль').fill('Galaktika77');
  await dialog.getByRole('button', { name: 'Сменить пароль' }).click();
  await expect(dialog.getByRole('heading', { name: 'Подтвердите, что это вы' })).toBeVisible();

  const mail = await waitForMail(account.email, { after: started - 2000 });
  await dialog.getByLabel('Код из письма').fill('000000');
  await dialog.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(dialog.getByText('Неверный или устаревший код')).toBeVisible();
  await dialog.getByLabel('Код из письма').fill(codeFrom(mail));
  await dialog.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByText('Пароль изменён')).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, account.email, 'Galaktika77');
  await expect(page).toHaveURL(/\/ru\/profile$/);
});

test('the account API refuses strangers: no session, no data', async ({ request }) => {
  const res = await request.get(`${API()}/rest/v1/profiles?select=*`, {
    headers: { apikey: PUBLISHABLE_KEY() },
  });
  // Anonymous visitors have no read grant at all: PostgREST answers "permission denied".
  expect(res.status()).toBe(401);
  expect((await res.json()).code).toBe('42501');
  const del = await request.post(`${API()}/functions/v1/delete-account`, {
    headers: { apikey: PUBLISHABLE_KEY(), 'Content-Type': 'application/json' },
    data: { confirm: 'anyone' },
  });
  expect(del.status()).toBe(401);
});
