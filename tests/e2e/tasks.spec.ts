import { expect, test, type Page } from '@playwright/test';
import { createAccount, signIn, storageList } from './support/accounts';
import { addTask, attachFile, card, completeBox, expectSaved, moscowDate, reopenBox, row, serverTasks, toastWith } from './support/tasks';

async function start(page: Page) {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expectSaved(page);
  return account;
}

/** The whole row of a task (for its menu and its meta line). */
const rowOf = (page: Page, title: string) => page.locator('[data-task-id]').filter({ has: row(page, title) });

async function rowAction(page: Page, title: string, action: string) {
  await rowOf(page, title).getByRole('button', { name: 'Действия с задачей' }).click();
  // The name may end with the item's shortcut ("Удалить Del").
  await page.getByRole('menuitem', { name: new RegExp(`^${action}( |$)`) }).click();
}

test('smart line → task with a date, tag and priority; complete, undo, reopen', async ({ page }) => {
  const account = await start(page);
  await expect(page.getByText('На сегодня всё чисто')).toBeVisible();

  const title = 'Позвонить в обсерваторию';
  await addTask(page, `${title} #звонки !высокий сегодня`);
  await expect(row(page, title)).toBeVisible();
  await expect(rowOf(page, title)).toContainText('#звонки');
  await expectSaved(page);
  expect(await serverTasks(account.id)).toMatchObject([
    { title, due_date: moscowDate(), completed_at: null, priority: { system_key: 'high' } },
  ]);

  // Done by mistake: "Undo" in the toast brings it back.
  await completeBox(page, title).click();
  const done = toastWith(page, 'Выполнено');
  await expect(done).toBeVisible();
  await done.getByRole('button', { name: 'Отменить' }).click();
  await expect(completeBox(page, title)).toHaveAttribute('aria-checked', 'false');
  await expectSaved(page);
  expect((await serverTasks(account.id))[0]?.completed_at).toBeNull();

  // Done for real: it leaves "Today" and waits in "Completed".
  await completeBox(page, title).click();
  await expect(row(page, title)).toHaveCount(0, { timeout: 15_000 });
  await expectSaved(page);
  expect((await serverTasks(account.id))[0]?.completed_at).not.toBeNull();

  await page.goto('/ru/completed');
  await reopenBox(page, title).click();
  await expect(toastWith(page, 'Задача возвращена')).toBeVisible();
  await page.goto('/ru/today');
  await expect(completeBox(page, title)).toBeVisible();
  await expectSaved(page);
  expect((await serverTasks(account.id))[0]?.completed_at).toBeNull();
});

test('task card: title, priority, subtasks and description survive a reload', async ({ page }) => {
  const account = await start(page);
  await addTask(page, 'Собрать телескоп');
  await row(page, 'Собрать телескоп').click();

  const panel = card(page);
  await expect(panel).toBeVisible();
  const title = panel.getByRole('textbox', { name: 'Название задачи' });
  await title.fill('Собрать рефрактор');
  await title.press('Enter');

  await panel.getByRole('button', { name: 'Без приоритета' }).click();
  await page.getByRole('menuitemradio', { name: 'Критический' }).click();
  await expect(panel.getByRole('button', { name: 'Критический' })).toBeVisible();

  const subtask = panel.getByRole('textbox', { name: 'Добавить подзадачу' });
  for (const name of ['Протереть линзы', 'Выставить искатель']) {
    await subtask.fill(name);
    await subtask.press('Enter');
    await expect(completeBox(page, name)).toBeVisible();
  }
  await completeBox(page, 'Протереть линзы').click();
  await expect(reopenBox(page, 'Протереть линзы')).toBeVisible();

  const description = panel.getByRole('textbox', { name: 'Описание' });
  await description.click();
  await page.keyboard.type('Окуляр 25 мм лежит в синей коробке.');
  await panel.getByRole('button', { name: 'Закрыть задачу' }).first().click();
  await expect(panel).toBeHidden();

  await expectSaved(page);
  await page.reload();
  await expect(row(page, 'Собрать рефрактор')).toBeVisible();
  await expect(rowOf(page, 'Собрать рефрактор').getByLabel('Подзадачи: 1 из 2')).toBeVisible();
  await row(page, 'Собрать рефрактор').click();
  await expect(card(page).getByRole('textbox', { name: 'Описание' })).toContainText('Окуляр 25 мм лежит в синей коробке.');
  await expect(card(page).getByRole('button', { name: 'Критический' })).toBeVisible();

  const tasks = await serverTasks(account.id);
  const parent = tasks.find((t) => t.title === 'Собрать рефрактор');
  expect(parent?.priority?.system_key).toBe('critical');
  const children = tasks.filter((t) => t.parent_id === parent?.id);
  expect(children.map((t) => [t.title, Boolean(t.completed_at)]).sort()).toEqual([
    ['Выставить искатель', false],
    ['Протереть линзы', true],
  ]);
});

test('trash: delete, restore, empty for good', async ({ page }) => {
  const account = await start(page);
  const titles = ['Старый отчёт', 'Черновик письма', 'Лишняя встреча'];
  for (const title of titles) await addTask(page, title);

  for (const title of titles) {
    await rowAction(page, title, 'Удалить');
    await expect(row(page, title)).toHaveCount(0);
  }
  await expect(toastWith(page, 'Задача в корзине').first()).toBeVisible();

  await page.goto('/ru/trash');
  await expect(row(page, 'Черновик письма')).toBeVisible();
  await expect(rowOf(page, 'Старый отчёт')).toContainText(/Удалится через \d+ д/);
  await rowAction(page, 'Старый отчёт', 'Восстановить');
  await expect(toastWith(page, 'Задача восстановлена')).toBeVisible();
  await expect(row(page, 'Старый отчёт')).toHaveCount(0);

  await page.getByRole('button', { name: 'Очистить корзину' }).click();
  const confirm = page.getByRole('dialog', { name: 'Очистить корзину?' });
  await expect(confirm).toContainText('2 задачи будут удалены навсегда.');
  await confirm.getByRole('button', { name: 'Очистить корзину' }).click();
  await expect(toastWith(page, 'Корзина очищена')).toBeVisible();
  await expect(page.getByText('Корзина пуста')).toBeVisible();

  await page.goto('/ru/today');
  await expect(row(page, 'Старый отчёт')).toBeVisible();
  await expectSaved(page);
  expect((await serverTasks(account.id)).map((t) => [t.title, t.deleted_at])).toEqual([['Старый отчёт', null]]);
});

test('a task deleted for good takes its attached files with it', async ({ page }) => {
  const account = await start(page);
  await addTask(page, 'Отчёт с вложением');
  await row(page, 'Отчёт с вложением').click();
  await attachFile(page, 'nablyudeniya.txt');
  await card(page).getByRole('button', { name: 'Закрыть задачу' }).first().click();
  await expectSaved(page);
  const [task] = await serverTasks(account.id);
  expect(await storageList('attachments', `${task!.id}/`)).toHaveLength(1);

  await rowAction(page, 'Отчёт с вложением', 'Удалить');
  await page.goto('/ru/trash');
  await row(page, 'Отчёт с вложением').focus();
  await page.keyboard.press('Delete');
  const confirm = page.getByRole('dialog', { name: 'Удалить навсегда?' });
  await confirm.getByRole('button', { name: 'Удалить навсегда' }).click();
  await expect(toastWith(page, 'Удалено навсегда')).toBeVisible();
  await expectSaved(page);
  expect(await serverTasks(account.id)).toEqual([]);
  expect(await storageList('attachments', `${task!.id}/`)).toEqual([]);
});
