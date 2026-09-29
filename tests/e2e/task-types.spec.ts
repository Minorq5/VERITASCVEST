import { expect, test, type Page } from '@playwright/test';
import { adminRows, createAccount, signIn } from './support/accounts';
import { addTask, card, completeBox, expectSaved, moscowDate, quickAdd, row, serverTasks, toastWith } from './support/tasks';

/**
 * Every task type through its own controls; each result is checked on the
 * server. The plain type is covered in tasks.spec.ts.
 */

async function start(page: Page) {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expectSaved(page);
  return account;
}

/**
 * Opens the task just created. Habits, counters and "quit" goals have no
 * deadline, so from "Today" they land in the inbox and the toast offers
 * to open them.
 */
async function openCreated(page: Page, title: string, ongoing: boolean) {
  if (ongoing) await toastWith(page, 'Задача создана — она в разделе «Входящие»').getByRole('button', { name: 'Открыть' }).click();
  else await row(page, title).click();
  await expect(card(page)).toBeVisible();
  await expect(card(page).getByRole('textbox', { name: 'Название задачи' })).toHaveValue(title);
  return card(page);
}

/** Creates a task of a type chosen in the smart line's type menu, and opens it. */
async function addOfType(page: Page, type: string, title: string, ongoing = false) {
  await page.getByRole('button', { name: /^Тип задачи:/ }).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${type}`) }).click();
  await addTask(page, title);
  return openCreated(page, title, ongoing);
}

async function taskId(userId: string, title: string) {
  const task = (await serverTasks(userId)).find((t) => t.title === title);
  expect(task, `task «${title}» on the server`).toBeTruthy();
  return task!.id;
}

async function closeCard(page: Page) {
  await card(page).getByRole('button', { name: 'Закрыть задачу' }).first().click();
  await expect(card(page)).toBeHidden();
}

test('percent, numeric, counter and shared goals count progress', async ({ page }) => {
  const account = await start(page);

  // Percent: quick steps up to 100 % complete the task.
  let panel = await addOfType(page, 'Процентная', 'Изучить звёздный атлас');
  for (let i = 0; i < 4; i += 1) await panel.getByRole('button', { name: /^\+25/ }).click();
  await expect(toastWith(page, 'Цель достигнута — задача выполнена')).toBeVisible();
  await closeCard(page);

  // Numeric: the smart line offers the goal from "300 страниц".
  await quickAdd(page).fill('Прочитать 300 страниц');
  await page.getByRole('button', { name: /^Сделать числовой целью: 300 страниц/ }).click();
  await expect(page.getByRole('button', { name: /^Тип: Числовая цель/ })).toBeVisible();
  await quickAdd(page).press('Enter');
  panel = await openCreated(page, 'Прочитать 300 страниц', false);
  await panel.getByRole('spinbutton', { name: 'Сколько добавить' }).fill('120');
  await panel.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(panel).toContainText('страниц');
  await closeCard(page);

  // Counter: "8 стаканов" becomes a daily goal; three taps.
  await quickAdd(page).fill('Выпить 8 стаканов воды');
  await page.getByRole('button', { name: /^Сделать счётчиком: 8 стаканов/ }).click();
  await quickAdd(page).press('Enter');
  panel = await openCreated(page, 'Выпить 8 стаканов воды', true);
  for (let i = 0; i < 3; i += 1) await panel.getByRole('button', { name: 'Добавить 1' }).click();
  await closeCard(page);

  // Shared goal: a contribution with a note.
  panel = await addOfType(page, 'Совместная', 'Собрать каталог звёзд');
  await panel.getByRole('spinbutton', { name: 'Сколько', exact: true }).fill('15');
  await panel.getByRole('textbox', { name: 'Комментарий', exact: true }).fill('Первая ночь наблюдений');
  await panel.getByRole('button', { name: 'Добавить вклад' }).click();
  await expect(panel.getByText('Первая ночь наблюдений')).toBeVisible();
  await closeCard(page);

  await expectSaved(page);
  const tasks = await serverTasks(account.id);
  const byTitle = (title: string) => tasks.find((t) => t.title === title)!;
  expect(byTitle('Изучить звёздный атлас').completed_at).not.toBeNull();

  const numeric = await adminRows<{ progress_target: number; progress_unit: string; type: string }>(
    `tasks?id=eq.${byTitle('Прочитать 300 страниц').id}&select=type,progress_target,progress_unit`,
  );
  expect(numeric[0]).toMatchObject({ type: 'numeric', progress_target: 300, progress_unit: 'страниц' });
  const events = async (title: string) =>
    adminRows<{ kind: string; value: number; note: string | null }>(`progress_events?task_id=eq.${byTitle(title).id}&select=kind,value,note&order=occurred_at`);
  expect(await events('Прочитать 300 страниц')).toEqual([{ kind: 'delta', value: 120, note: null }]);
  expect(await events('Выпить 8 стаканов воды')).toEqual([1, 2, 3].map(() => ({ kind: 'delta', value: 1, note: null })));
  expect(await events('Собрать каталог звёзд')).toEqual([{ kind: 'contribution', value: 15, note: 'Первая ночь наблюдений' }]);
});

test('time, habit and abstain types keep their logs', async ({ page }) => {
  const account = await start(page);

  let panel = await addOfType(page, 'По времени', 'Наблюдение за Юпитером');
  await panel.getByRole('button', { name: 'Старт', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Стоп', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await panel.getByRole('button', { name: 'Стоп', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Удалить сессию' })).toHaveCount(1);
  await closeCard(page);

  panel = await addOfType(page, 'Привычка', 'Зарядка', true);
  await panel.getByRole('checkbox', { name: 'Отметить сегодня' }).click();
  await expect(panel.getByText('Сегодня выполнено')).toBeVisible();
  await closeCard(page);

  panel = await addOfType(page, 'Отказ', 'Без сладкого', true);
  await expect(panel).toContainText('0 дней без срыва');
  await panel.getByRole('button', { name: 'Срыв', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Отметить срыв?' });
  await confirm.getByRole('button', { name: 'Да, был срыв' }).click();
  await expect(confirm).toBeHidden();
  await expect(panel.getByText('Срывов не было')).toHaveCount(0);
  await closeCard(page);

  await expectSaved(page);
  const sessions = await adminRows<{ ended_at: string | null }>(
    `time_sessions?task_id=eq.${await taskId(account.id, 'Наблюдение за Юпитером')}&select=ended_at`,
  );
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.ended_at).not.toBeNull();
  const habit = await adminRows<{ date: string; status: string }>(`habit_logs?task_id=eq.${await taskId(account.id, 'Зарядка')}&select=date,status`);
  expect(habit).toEqual([{ date: moscowDate(), status: 'done' }]);
  const relapses = await adminRows<{ kind: string }>(`progress_events?task_id=eq.${await taskId(account.id, 'Без сладкого')}&select=kind`);
  expect(relapses).toEqual([{ kind: 'relapse' }]);
});

test('subtasks, stages and chain types move by their parts', async ({ page }) => {
  const account = await start(page);

  // By subtasks: done when every subtask is done.
  let panel = await addOfType(page, 'По подзадачам', 'Подготовить доклад');
  const subtask = panel.getByRole('textbox', { name: 'Добавить подзадачу' });
  for (const name of ['Собрать данные', 'Сделать слайды']) {
    await subtask.fill(name);
    await subtask.press('Enter');
    await expect(completeBox(page, name)).toBeVisible();
  }
  await completeBox(page, 'Собрать данные').click();
  await completeBox(page, 'Сделать слайды').click();
  await expect(toastWith(page, 'Цель достигнута — задача выполнена')).toBeVisible();
  await closeCard(page);

  // Stages with weights: one of two is half the way.
  panel = await addOfType(page, 'Этапная', 'Запуск сайта');
  const stage = panel.getByRole('textbox', { name: 'Добавить этап' });
  for (const name of ['Дизайн', 'Разработка']) {
    await stage.fill(name);
    await stage.press('Enter');
    await expect(panel.getByRole('textbox', { name, exact: true })).toBeVisible();
  }
  const item = (name: string) => panel.getByRole('listitem').filter({ has: page.getByRole('textbox', { name, exact: true }) });
  await item('Дизайн').getByRole('checkbox', { name: 'Отметить этап' }).click();
  await expect(item('Дизайн').getByRole('checkbox', { name: 'Вернуть этап' })).toBeVisible();
  await closeCard(page);
  await expect(page.getByLabel(/^Прогресс: 50\s?%/)).toBeVisible();

  // Chain: the second step opens only after the first.
  panel = await addOfType(page, 'Цепочка', 'Курс астрономии');
  const step = panel.getByRole('textbox', { name: 'Добавить шаг' });
  for (const name of ['Урок 1', 'Урок 2']) {
    await step.fill(name);
    await step.press('Enter');
    await expect(panel.getByRole('textbox', { name, exact: true })).toBeVisible();
  }
  const link = (name: string) => panel.getByRole('listitem').filter({ has: page.getByRole('textbox', { name, exact: true }) });
  await expect(link('Урок 2')).toContainText('Откроется после предыдущего шага');
  await expect(link('Урок 2').getByRole('checkbox')).toHaveCount(0);
  await link('Урок 1').getByRole('checkbox', { name: 'Пройти шаг' }).click();
  await link('Урок 2').getByRole('checkbox', { name: 'Пройти шаг' }).click();
  await expect(panel.getByText('Все шаги пройдены')).toBeVisible();
  await closeCard(page);

  await expectSaved(page);
  const tasks = await serverTasks(account.id);
  expect(tasks.find((t) => t.title === 'Подготовить доклад')?.completed_at).not.toBeNull();
  const milestones = async (title: string) =>
    adminRows<{ title: string; done_at: string | null }>(`task_milestones?task_id=eq.${await taskId(account.id, title)}&select=title,done_at&order=sort_key`);
  expect((await milestones('Запуск сайта')).map((m) => [m.title, Boolean(m.done_at)])).toEqual([
    ['Дизайн', true],
    ['Разработка', false],
  ]);
  expect((await milestones('Курс астрономии')).every((m) => m.done_at)).toBe(true);
  expect(tasks.find((t) => t.title === 'Курс астрономии')?.completed_at).not.toBeNull();
});
