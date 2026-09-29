import { expect, test, type Page } from '@playwright/test';
import { adminRows, createAccount, signIn } from './support/accounts';
import { addTask, expectSaved, row, serverTasks, toastWith } from './support/tasks';

/** Projects (planets): create, subprojects, archive, delete — tasks are never lost. */

interface ServerProject {
  id: string;
  name: string;
  parent_id: string | null;
  archived_at: string | null;
  deleted_at: string | null;
}

const serverProjects = (userId: string) =>
  adminRows<ServerProject>(`projects?owner_id=eq.${userId}&select=id,name,parent_id,archived_at,deleted_at&order=created_at`);

async function projectAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'Действия с проектом' }).click();
  await page.getByRole('menuitem', { name }).click();
}

test('a project with a subproject: archive hides its tasks, delete moves them to the inbox', async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expectSaved(page);

  // The first project, from the empty overview; a name is required.
  await page.goto('/ru/projects');
  await expect(page.getByText('Проектов пока нет')).toBeVisible();
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  const create = page.getByRole('dialog', { name: 'Новый проект' });
  await create.getByRole('button', { name: 'Создать проект' }).click();
  await expect(create.getByText('Назовите проект')).toBeVisible();
  await create.getByLabel('Название').fill('Обсерватория');
  await create.getByRole('button', { name: 'Создать проект' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Обсерватория' })).toBeVisible();
  await expect(page).toHaveURL(/\/ru\/projects\/[0-9a-f-]{36}$/);
  const projectUrl = page.url();

  // A task written on the project's page belongs to the project.
  await addTask(page, 'Настроить телескоп сегодня');
  await expect(row(page, 'Настроить телескоп')).toBeVisible();

  // A subproject opens on its own page, with a way back to its parent.
  await projectAction(page, 'Добавить подпроект');
  const sub = page.getByRole('dialog', { name: 'Новый подпроект' });
  await sub.getByLabel('Название').fill('Фото галактик');
  await sub.getByRole('button', { name: 'Создать проект' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Фото галактик' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Часть проекта «Обсерватория»' })).toBeVisible();
  await addTask(page, 'Снять туманность Ориона');
  await expect(row(page, 'Снять туманность Ориона')).toBeVisible();

  // The overview counts the subproject's tasks into its parent.
  await page.goto('/ru/projects');
  const planet = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Обсерватория' }) });
  await expect(planet).toContainText('2 задачи');
  await expect(planet.getByRole('link', { name: /Фото галактик/ })).toBeVisible();

  // Archived: the project's tasks leave "Today"; its own page says why.
  await page.goto('/ru/today');
  await expect(row(page, 'Настроить телескоп')).toBeVisible();
  await page.goto(projectUrl);
  await projectAction(page, 'Убрать в архив');
  await expect(page.getByText('Проект в архиве: его задачи не показываются в разделах.')).toBeVisible();
  await expect(row(page, 'Настроить телескоп')).toBeVisible();
  await page.goto('/ru/today');
  await expect(page.getByRole('heading', { level: 1, name: 'Сегодня' })).toBeVisible();
  await expect(row(page, 'Настроить телескоп')).toBeHidden();

  // Its subproject went to the archive with it; then back from the archive.
  await page.goto('/ru/projects');
  await expect(page.getByText('1 проект в архиве')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Фото галактик' })).toHaveCount(0);
  await page.getByText('Архив', { exact: true }).click();
  await page.getByRole('button', { name: 'Вернуть из архива' }).click();
  await expect(toastWith(page, 'Проект снова в работе')).toBeVisible();
  await expect(planet).toBeVisible();
  await page.goto('/ru/today');
  await expect(row(page, 'Настроить телескоп')).toBeVisible();

  // Delete — undo once, then for real: both projects go, their tasks move to the inbox.
  await page.goto(projectUrl);
  await projectAction(page, 'Удалить проект');
  let confirm = page.getByRole('dialog', { name: 'Удалить проект «Обсерватория»?' });
  await expect(confirm).toContainText('2 задачи переедут во «Входящие».');
  await confirm.getByRole('button', { name: 'Удалить проект' }).click();
  await expect(page).toHaveURL(/\/ru\/projects$/);
  await toastWith(page, 'Проект удалён').getByRole('button', { name: 'Отменить' }).click();
  await expect(planet.getByRole('link', { name: /Фото галактик/ })).toBeVisible();

  await page.goto(projectUrl);
  await projectAction(page, 'Удалить проект');
  confirm = page.getByRole('dialog', { name: 'Удалить проект «Обсерватория»?' });
  await confirm.getByRole('button', { name: 'Удалить проект' }).click();
  await expect(page.getByText('Проектов пока нет')).toBeVisible();
  await page.goto('/ru/inbox');
  await expect(row(page, 'Настроить телескоп')).toBeVisible();
  await expect(row(page, 'Снять туманность Ориона')).toBeVisible();
  await expectSaved(page);

  const projects = await serverProjects(account.id);
  expect(projects.map((p) => p.name).sort()).toEqual(['Обсерватория', 'Фото галактик']);
  expect(projects.every((p) => p.deleted_at && !p.archived_at)).toBe(true);
  const tasks = (await serverTasks(account.id)).filter((t) => !t.deleted_at);
  expect(tasks.map((t) => [t.title, t.project_id])).toEqual([
    ['Настроить телескоп', null],
    ['Снять туманность Ориона', null],
  ]);
});

test('project settings: rename, colour and moving under another project', async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/ru\/today$/);

  for (const name of ['Ремонт', 'Кухня']) {
    await page.goto('/ru/projects');
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });
    await dialog.getByLabel('Название').fill(name);
    await dialog.getByRole('button', { name: 'Создать проект' }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  }

  // "Кухня" is open: rename it, pick a colour, put it inside "Ремонт".
  await projectAction(page, 'Настройки проекта');
  const dialog = page.getByRole('dialog', { name: 'Настройки проекта' });
  await dialog.getByLabel('Название').fill('Кухня и ванная');
  await dialog.getByRole('radio', { name: 'Ледяной' }).click();
  await dialog.getByRole('combobox', { name: 'Внутри проекта' }).click();
  await page.getByRole('option', { name: 'Ремонт' }).click();
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Кухня и ванная' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Часть проекта «Ремонт»' })).toBeVisible();
  await expectSaved(page);

  const projects = await adminRows<ServerProject & { color: string }>(
    `projects?owner_id=eq.${account.id}&select=id,name,parent_id,color&order=created_at`,
  );
  const [parent, child] = projects;
  expect(child).toMatchObject({ name: 'Кухня и ванная', color: 'ice', parent_id: parent!.id });

  // A project cannot go inside itself or its own subproject.
  await page.goto(`/ru/projects/${parent!.id}`);
  await projectAction(page, 'Настройки проекта');
  await page.getByRole('dialog', { name: 'Настройки проекта' }).getByRole('combobox', { name: 'Внутри проекта' }).click();
  await expect(page.getByRole('option', { name: /Кухня и ванная/ })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Отдельный проект' })).toBeVisible();
});
