import { expect, test, type Browser, type Page } from '@playwright/test';
import { adminRows, API, createAccount, signIn } from './support/accounts';
import { addTask, card, completeBox, expectSaved, openPhone, row, serverTasks, syncText, toastWith } from './support/tasks';

/**
 * Two devices of one account: this computer (the test's page) and a phone
 * with its own storage. Runs only in the computer project (it opens the
 * phone itself). "Within seconds" means realtime, not the minute-long pull.
 */

const SOON = { timeout: 10_000 };

async function signedIn(page: Page) {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expectSaved(page);
  return account;
}

async function twoDevices(browser: Browser, page: Page, baseURL: string | undefined) {
  const account = await signedIn(page);
  const phone = await openPhone(browser, baseURL!, account.email, account.password);
  return { account, computer: page, phone: phone.page, phoneContext: phone.context };
}

async function rename(page: Page, from: string, to: string) {
  await row(page, from).click();
  const title = card(page).getByRole('textbox', { name: 'Название задачи' });
  await title.fill(to);
  await title.press('Enter');
}

test('computer ↔ phone: changes arrive by themselves within seconds', async ({ browser, page, baseURL }) => {
  const { computer, phone, phoneContext } = await twoDevices(browser, page, baseURL);

  await addTask(computer, 'Купить фильтр для телескопа');
  await expect(row(phone, 'Купить фильтр для телескопа')).toBeVisible(SOON);

  await completeBox(phone, 'Купить фильтр для телескопа').click();
  await expect(row(computer, 'Купить фильтр для телескопа')).toHaveCount(0, SOON);

  await addTask(phone, 'Проверить прогноз');
  await expect(row(computer, 'Проверить прогноз')).toBeVisible(SOON);
  await rename(computer, 'Проверить прогноз', 'Проверить прогноз облачности');
  await expect(row(phone, 'Проверить прогноз облачности')).toBeVisible(SOON);

  await phoneContext.close();
});

test('no network: edits wait on the device and arrive once, nothing lost or doubled', async ({ browser, page, baseURL }) => {
  const { account, computer, phone, phoneContext } = await twoDevices(browser, page, baseURL);
  const titles = ['Заправить генератор', 'Сверить карты', 'Позвонить на станцию'];

  await computer.context().setOffline(true);
  await expect.poll(() => syncText(computer)).toMatch(/Нет сети — изменения сохраняются на устройстве/);
  for (const title of titles) await addTask(computer, title);
  await completeBox(computer, 'Сверить карты').click();
  await expect.poll(() => syncText(computer)).toMatch(/\d+ изменени\S* жд\S+ отправки/);
  expect(await serverTasks(account.id)).toEqual([]);

  await computer.context().setOffline(false);
  await expectSaved(computer);
  const server = await serverTasks(account.id);
  expect(server.map((t) => t.title).sort()).toEqual([...titles].sort());
  expect(server.filter((t) => t.completed_at).map((t) => t.title)).toEqual(['Сверить карты']);
  for (const title of ['Заправить генератор', 'Позвонить на станцию']) await expect(row(phone, title)).toBeVisible(SOON);
  await expect(row(phone, 'Сверить карты')).toHaveCount(0);

  await phoneContext.close();
});

test('the server applied a batch but the answer was lost: the retry changes nothing twice', async ({ page }) => {
  const account = await signedIn(page);
  await page.context().setOffline(true);
  await addTask(page, 'Единственный экземпляр');
  await addTask(page, 'Второй экземпляр');
  await completeBox(page, 'Второй экземпляр').click();

  const calls: string[][] = [];
  await page.route('**/rest/v1/rpc/sync_push', async (route) => {
    const response = await route.fetch(); // the server receives the batch and applies it…
    const body = (await response.json()) as { results: { status: string }[] };
    calls.push(body.results.map((r) => r.status));
    if (calls.length === 1) await route.abort('connectionreset'); // …but the answer never comes back
    else await route.fulfill({ response });
  });
  await page.context().setOffline(false);
  await expectSaved(page);

  // The first call applied everything; the retry of the same batch was recognised as
  // already done (a change made in between may ride along as new).
  expect(calls.length).toBeGreaterThanOrEqual(2);
  const [first, retry] = calls as [string[], string[]];
  expect(first.every((s) => s === 'applied')).toBe(true);
  expect(retry.slice(0, first.length)).toEqual(first.map(() => 'duplicate'));

  const server = await serverTasks(account.id);
  expect(server.map((t) => t.title).sort()).toEqual(['Второй экземпляр', 'Единственный экземпляр']);
  expect(server.find((t) => t.title === 'Второй экземпляр')?.completed_at).not.toBeNull();
  const completed = await adminRows(`activity_log?owner_id=eq.${account.id}&action=eq.completed&select=id`);
  expect(completed).toHaveLength(1);
});

test('both devices edit one task offline: other fields both stay, the same field keeps the later edit', async ({ browser, page, baseURL }) => {
  const { account, computer, phone, phoneContext } = await twoDevices(browser, page, baseURL);
  await addTask(computer, 'Общий план');
  await expect(row(phone, 'Общий план')).toBeVisible(SOON);

  await computer.context().setOffline(true);
  await phoneContext.setOffline(true);

  // The computer edits first: a new title and a priority.
  await rename(computer, 'Общий план', 'Общий план — ПК');
  await card(computer).getByRole('button', { name: 'Без приоритета' }).click();
  await computer.getByRole('menuitemradio', { name: 'Высокий' }).click();

  // The phone edits later: its own title and a description.
  await rename(phone, 'Общий план', 'Общий план — телефон');
  await card(phone).getByRole('textbox', { name: 'Описание' }).click();
  await phone.keyboard.type('Сверить со вторым устройством');
  await card(phone).getByRole('button', { name: 'Закрыть задачу' }).first().click();

  // The phone reconnects first; then the computer, whose title is the older edit.
  await phoneContext.setOffline(false);
  await expectSaved(phone);
  await computer.context().setOffline(false);
  await expect(toastWith(computer, 'Задачу изменили на другом устройстве')).toBeVisible();
  await expectSaved(computer);

  for (const device of [computer, phone]) await expect(row(device, 'Общий план — телефон')).toBeVisible(SOON);
  const [task] = await serverTasks(account.id);
  expect(task).toMatchObject({ title: 'Общий план — телефон', priority: { system_key: 'high' } });
  const [text] = await adminRows<{ description_text: string }>(`tasks?id=eq.${task!.id}&select=description_text`);
  expect(text?.description_text).toContain('Сверить со вторым устройством');

  // The losing title is not thrown away: the task's history keeps it.
  const log = await adminRows<{ diff: { fields: unknown[] } }>(`activity_log?task_id=eq.${task!.id}&action=eq.conflict&select=diff`);
  expect(log).toHaveLength(1);
  expect(log[0]!.diff.fields).toEqual([
    expect.objectContaining({ field: 'title', kept: 'Общий план — телефон', lost: 'Общий план — ПК', winner: 'server' }),
  ]);

  await phoneContext.close();
});

test('server out of reach: after a reload the app opens from the device and sends the queue later', async ({ page }) => {
  const account = await signedIn(page);
  await addTask(page, 'Уже на сервере');
  await expectSaved(page);

  const rest = `${API()}/rest/v1/**`;
  await page.route(rest, (route) => route.abort('connectionrefused'));
  await addTask(page, 'Записано без сервера');
  await completeBox(page, 'Уже на сервере').click();
  await expect.poll(() => syncText(page)).toMatch(/Нет сети|Сервер не отвечает/);

  await page.reload();
  await expect(row(page, 'Записано без сервера')).toBeVisible();
  await expect.poll(() => syncText(page)).toMatch(/\d+ изменени\S* жд\S+ отправки/);
  expect((await serverTasks(account.id)).map((t) => t.title)).toEqual(['Уже на сервере']);

  await page.unroute(rest);
  // "Retry now" hurries the send; the engine's own retry may get there first
  // and hide the button.
  await page
    .getByRole('button', { name: 'Повторить сейчас' })
    .click({ timeout: 3000 })
    .catch(() => undefined);
  await expectSaved(page);
  const server = await serverTasks(account.id);
  expect(server.map((t) => [t.title, Boolean(t.completed_at)])).toEqual([
    ['Уже на сервере', true],
    ['Записано без сервера', false],
  ]);
});
