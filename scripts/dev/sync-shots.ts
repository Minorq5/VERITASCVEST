/**
 * Design review captures of the sync states (stage 3.5): no network with
 * changes waiting, the phone's cloud badge, a conflict notice, the phone's
 * type menu. Local stack + `npm run dev`.
 *
 *   npx tsx scripts/dev/sync-shots.ts review/stage-3/sync-r1
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices, expect, type Browser, type Page } from '@playwright/test';
import { createAccount, signIn } from '../../tests/e2e/support/accounts';
import { addTask, card, completeBox, expectSaved, row, syncText } from '../../tests/e2e/support/tasks';

const out = process.argv[2] ?? 'review/stage-3/sync-latest';
const BASE = 'http://localhost:3000';

async function settle(page: Page, ms = 1500) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

async function device(browser: Browser, kind: 'desktop' | 'phone', email: string, password: string) {
  const context = await browser.newContext({
    ...(kind === 'phone'
      ? { ...devices['Pixel 7'], viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }),
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    baseURL: BASE,
  });
  const page = await context.newPage();
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/ru\/today$/, { timeout: 30_000 });
  await expectSaved(page);
  return { context, page };
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(`  ${name}`);
}

async function main() {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const account = await createAccount();
  const computer = await device(browser, 'desktop', account.email, account.password);
  const phone = await device(browser, 'phone', account.email, account.password);

  for (const title of ['Проверить отчёт по наблюдениям', 'Купить окуляр 25 мм', 'Позвонить в обсерваторию']) {
    await addTask(computer.page, title);
  }
  await expectSaved(computer.page);
  await expect(row(phone.page, 'Купить окуляр 25 мм')).toBeVisible({ timeout: 15_000 });

  // 1. No network, changes waiting on the device.
  await computer.context.setOffline(true);
  await phone.context.setOffline(true);
  await addTask(computer.page, 'Записать идею для доклада');
  await completeBox(computer.page, 'Купить окуляр 25 мм').click();
  await expect.poll(() => syncText(computer.page)).toMatch(/отправки/);
  await shot(computer.page, 'desktop-offline-pending');

  await addTask(phone.page, 'Взять зарядку для камеры');
  await phone.page.getByRole('button', { name: /^Состояние синхронизации/ }).click();
  await shot(phone.page, 'phone-offline-popover');
  await phone.page.keyboard.press('Escape');

  // 2. Both edited one task; the older edit loses and its device is told.
  await row(computer.page, 'Проверить отчёт по наблюдениям').click();
  const title = card(computer.page).getByRole('textbox', { name: 'Название задачи' });
  await title.fill('Проверить отчёт до пятницы');
  await title.press('Enter');
  await card(computer.page).getByRole('button', { name: 'Закрыть задачу' }).first().click();
  await row(phone.page, 'Проверить отчёт по наблюдениям').click();
  const phoneTitle = card(phone.page).getByRole('textbox', { name: 'Название задачи' });
  await phoneTitle.fill('Проверить отчёт и графики');
  await phoneTitle.press('Enter');
  await card(phone.page).getByRole('button', { name: 'Закрыть задачу' }).first().click();
  await phone.context.setOffline(false);
  await expectSaved(phone.page);
  await computer.context.setOffline(false);
  await expect(computer.page.getByText('Задачу изменили на другом устройстве')).toBeVisible({ timeout: 20_000 });
  await shot(computer.page, 'desktop-conflict');

  // The phone's type menu fits the screen: the last types stay reachable.
  await phone.page.getByRole('button', { name: /^Тип задачи:/ }).click();
  await phone.page.getByRole('menuitemradio', { name: /^Цепочка/ }).scrollIntoViewIfNeeded();
  await shot(phone.page, 'phone-type-menu');
  await phone.page.keyboard.press('Escape');

  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
