import { expect, test, type Page } from '@playwright/test';
import { adminRows, createAccount, signIn } from './support/accounts';
import { addTask, expectSaved, row, serverTasks, toastWith } from './support/tasks';

/** Tags, the filter bar, smart lists and sorting (stage 4.3). */

async function start(page: Page) {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expectSaved(page);
  return account;
}

/** Titles of the rows on screen, top to bottom. */
const rowTitles = (page: Page) =>
  page
    .locator('main [data-row-open]')
    .evaluateAll((els) => els.map((el) => (el.getAttribute('aria-label') ?? '').replace(/^Открыть «(.*)»$/, '$1')));

interface ServerTag {
  id: string;
  name: string;
  color: string;
  deleted_at: string | null;
}

test('tags: a tag page lists and tags new tasks; rename, name clash, delete keeps the tasks', async ({ page }) => {
  const account = await start(page);
  await addTask(page, 'Позвонить маме #семья');
  await addTask(page, 'Сдать отчёт #работа');

  await page.goto('/ru/tags');
  const family = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'семья', exact: true }) });
  await expect(family).toContainText('1 задача');
  await family.getByRole('link', { name: 'семья', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'семья' })).toBeVisible();
  await expect(row(page, 'Позвонить маме')).toBeVisible();
  await expect(row(page, 'Сдать отчёт')).toBeHidden();

  // Written on the tag's page — gets the tag.
  await addTask(page, 'Купить торт');
  await expect(row(page, 'Купить торт')).toBeVisible();

  // Rename; a name another tag has is refused.
  await page.getByRole('button', { name: 'Действия с тегом' }).click();
  await page.getByRole('menuitem', { name: 'Название и цвет' }).click();
  let dialog = page.getByRole('dialog', { name: 'Тег' });
  await dialog.getByLabel('Название').fill('Работа');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog.getByText('Тег «работа» уже есть')).toBeVisible();
  await dialog.getByLabel('Название').fill('родные люди');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'родные-люди' })).toBeVisible();

  // Delete: the tag leaves both tasks, the tasks stay.
  await page.getByRole('button', { name: 'Действия с тегом' }).click();
  await page.getByRole('menuitem', { name: 'Удалить тег' }).click();
  dialog = page.getByRole('dialog', { name: 'Удалить тег «родные-люди»?' });
  await expect(dialog).toContainText('Тег снимется с 2 задач. Сами задачи останутся.');
  await dialog.getByRole('button', { name: 'Удалить тег' }).click();
  await expect(page).toHaveURL(/\/ru\/tags$/);
  await expect(toastWith(page, 'Тег удалён')).toBeVisible();
  await expect(page.getByRole('link', { name: 'родные-люди' })).toHaveCount(0);
  await page.goto('/ru/today');
  await expect(row(page, 'Позвонить маме')).toBeVisible();
  await expectSaved(page);

  const tags = await adminRows<ServerTag>(`tags?owner_id=eq.${account.id}&select=id,name,color,deleted_at&order=name`);
  const gone = tags.find((t) => t.name === 'родные-люди');
  expect(gone?.deleted_at).toBeTruthy();
  const links = await adminRows<{ deleted_at: string | null }>(`task_tags?tag_id=eq.${gone!.id}&select=deleted_at`);
  expect(links).toHaveLength(2);
  expect(links.every((l) => l.deleted_at)).toBe(true);
  expect((await serverTasks(account.id)).filter((t) => !t.deleted_at).map((t) => t.title).sort()).toEqual(['Купить торт', 'Позвонить маме', 'Сдать отчёт']);
});

test('filter bar → smart list: conditions, new tasks fit the list, edit, delete', async ({ page }) => {
  const account = await start(page);
  await addTask(page, 'Сдать отчёт !высокий');
  await addTask(page, 'Полить цветы');
  await addTask(page, 'Позвонить в банк !высокий #работа');

  // "Today" narrowed to high priority.
  await page.getByRole('button', { name: 'Фильтр', exact: true }).click();
  await page.getByRole('button', { name: 'Приоритет', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Высокий' }).click();
  await page.keyboard.press('Escape');
  await expect(row(page, 'Полить цветы')).toBeHidden();
  await expect(row(page, 'Сдать отчёт')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Фильтр: 1 условие' })).toBeVisible();

  // …saved as a smart list: the day comes along with the priority.
  await page.getByRole('button', { name: 'Сохранить как умный список' }).click();
  const save = page.getByRole('dialog', { name: 'Сохранить умный список' });
  await save.getByLabel('Название').fill('Срочное');
  await save.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page).toHaveURL(/\/ru\/lists\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Срочное' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Срок: Просрочено, Сегодня' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Приоритет: Высокий' })).toBeVisible();
  expect((await rowTitles(page)).sort()).toEqual(['Позвонить в банк', 'Сдать отчёт']);
  const listUrl = page.url();

  // The filter on "Today" was used up by the list.
  await page.goto('/ru/today');
  await expect(row(page, 'Полить цветы')).toBeVisible();

  // Conditions change on the list's page and are saved.
  await page.goto(listUrl);
  await page.getByRole('button', { name: 'Тег', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: '#работа' }).click();
  await page.keyboard.press('Escape');
  await expect(row(page, 'Сдать отчёт')).toBeHidden();
  await page.getByRole('button', { name: 'Сохранить условия' }).click();
  await expect(page.getByRole('button', { name: 'Сохранить условия' })).toBeHidden();
  await page.reload();
  await expect(row(page, 'Позвонить в банк')).toBeVisible();
  await expect(row(page, 'Сдать отчёт')).toBeHidden();

  // A task written here gets what the list asks for: high priority, the tag, today.
  await addTask(page, 'Отправить договор');
  await expect(row(page, 'Отправить договор')).toBeVisible();
  await expectSaved(page);
  const created = (await serverTasks(account.id)).find((t) => t.title === 'Отправить договор');
  expect(created?.priority?.system_key).toBe('high');
  expect(created?.due_date).toBeTruthy();

  const [stored] = await adminRows<{ name: string; query: Record<string, unknown>; deleted_at: string | null }>(
    `saved_filters?owner_id=eq.${account.id}&select=name,query,deleted_at`,
  );
  expect(stored?.name).toBe('Срочное');
  expect(stored?.query).toMatchObject({ due: ['overdue', 'today'] });
  expect((stored?.query.tags as string[]).length).toBe(1);

  // Deleting the list keeps every task.
  await page.getByRole('button', { name: 'Действия со списком' }).click();
  await page.getByRole('menuitem', { name: 'Удалить список' }).click();
  await page.getByRole('dialog', { name: 'Удалить умный список «Срочное»?' }).getByRole('button', { name: 'Удалить список' }).click();
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expect(row(page, 'Отправить договор')).toBeVisible();
  await expectSaved(page);
  const [deleted] = await adminRows<{ deleted_at: string | null }>(`saved_filters?owner_id=eq.${account.id}&select=deleted_at`);
  expect(deleted?.deleted_at).toBeTruthy();
});

test('sorting: sections remember it on the device, a project in the account', async ({ page }) => {
  const account = await start(page);
  await page.goto('/ru/inbox');
  for (const title of ['Бетон', 'Арматура !высокий', 'Гвозди']) await addTask(page, title);
  expect(await rowTitles(page)).toEqual(['Бетон', 'Арматура', 'Гвозди']);

  await page.getByRole('button', { name: 'Сортировка: Вручную' }).click();
  await page.getByRole('menuitemradio', { name: 'По алфавиту' }).click();
  await expect.poll(() => rowTitles(page)).toEqual(['Арматура', 'Бетон', 'Гвозди']);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Сортировка: По алфавиту' })).toBeVisible();
  await expect.poll(() => rowTitles(page)).toEqual(['Арматура', 'Бетон', 'Гвозди']);

  await page.getByRole('button', { name: 'Сортировка: По алфавиту' }).click();
  await page.getByRole('menuitemradio', { name: 'Сначала новые' }).click();
  await expect.poll(() => rowTitles(page)).toEqual(['Гвозди', 'Арматура', 'Бетон']);

  // A project's order travels with the account.
  await page.goto('/ru/projects');
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Новый проект' });
  await dialog.getByLabel('Название').fill('Дача');
  await dialog.getByRole('button', { name: 'Создать проект' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Дача' })).toBeVisible();
  for (const title of ['Покрасить забор', 'Вскопать грядки !высокий']) await addTask(page, title);
  await page.getByRole('button', { name: 'Сортировка: Вручную' }).click();
  await page.getByRole('menuitemradio', { name: 'По приоритету' }).click();
  await expect.poll(() => rowTitles(page)).toEqual(['Вскопать грядки', 'Покрасить забор']);
  await expectSaved(page);
  const [project] = await adminRows<{ view_settings: Record<string, unknown> }>(`projects?owner_id=eq.${account.id}&select=view_settings`);
  expect(project?.view_settings).toMatchObject({ sort: 'priority' });
});
