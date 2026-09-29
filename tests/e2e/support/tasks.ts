import { devices, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { adminRows, signIn } from './accounts';

/** The smart line above every list. */
export const quickAdd = (page: Page) => page.getByRole('combobox', { name: 'Новая задача' });

/** Types a phrase into the smart line and sends it. */
export async function addTask(page: Page, text: string) {
  const input = quickAdd(page);
  await input.click();
  await input.fill(text);
  await input.press('Enter');
  await expect(input).toHaveValue('');
}

export const row = (page: Page, title: string) => page.getByRole('button', { name: `Открыть «${title}»`, exact: true });
export const completeBox = (page: Page, title: string) => page.getByRole('checkbox', { name: `Выполнить «${title}»`, exact: true });
export const reopenBox = (page: Page, title: string) => page.getByRole('checkbox', { name: `Вернуть «${title}»`, exact: true });

/** The open task: a side panel on computers, a sheet on phones. */
export const card = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Задача' }).or(page.getByRole('dialog', { name: 'Задача' }));

/** A toast by its text. */
export const toastWith = (page: Page, text: string | RegExp) =>
  page.getByRole('region', { name: 'Уведомления' }).getByRole('listitem').filter({ hasText: text });

/** What the sync indicator says right now (sidebar line on computers, cloud badge on phones). */
export function syncText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('[aria-label^="Состояние синхронизации"]')];
    const shown = all.find((el) => el.getClientRects().length > 0);
    // Interface texts keep short words together with no-break spaces.
    return shown ? `${shown.getAttribute('aria-label')} ${shown.textContent}`.replace(/\u00a0/g, ' ') : '';
  });
}

/** Waits until everything changed on this device has reached the server. */
export async function expectSaved(page: Page, timeout = 30_000) {
  await expect.poll(() => syncText(page), { timeout, message: 'sync indicator says "Всё сохранено"' }).toMatch(/Всё сохранено/);
}

export interface ServerTask {
  id: string;
  title: string;
  completed_at: string | null;
  deleted_at: string | null;
  due_date: string | null;
  parent_id: string | null;
  project_id: string | null;
  priority: { system_key: string | null } | null;
}

/** The account's tasks as the server has them. */
export const serverTasks = (userId: string) =>
  adminRows<ServerTask>(
    `tasks?owner_id=eq.${userId}&select=id,title,completed_at,deleted_at,due_date,parent_id,project_id,priority:priorities(system_key)&order=created_at`,
  );

/** A second device: a phone with its own storage, signed in to the same account. */
export async function openPhone(browser: Browser, baseURL: string, email: string, password: string) {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: { width: 393, height: 852 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    baseURL,
  });
  const page = await context.newPage();
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expectSaved(page);
  return { context, page };
}

/** Today's date in the tests' time zone (Moscow), as the app sees it. */
export function moscowDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now);
}

/** Attaches a small text file to the open task and waits until it is uploaded. */
export async function attachFile(page: Page, name: string, text = 'Наблюдения: Юпитер, 4 спутника.') {
  await card(page).locator('input[type="file"]').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(card(page).getByText(name)).toBeVisible();
  await expect(card(page).getByText(/Загружаем/)).toHaveCount(0);
}
