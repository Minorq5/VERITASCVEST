/** Captures interactive states of the design showcase (menus, dialogs, toasts). */
import { chromium, devices } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3000';
const out = process.argv[3] ?? 'review/stage-1/states';

async function main() {
  const browser = await chromium.launch();
  const desktop = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'ru-RU',
  });
  const page = await desktop.newPage();
  await page.goto(`${base}/ru/design`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const shot = async (name: string) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log(name);
  };

  // Menu with submenu
  await page.locator('#overlays').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Действия' }).click();
  await page.getByRole('menuitem', { name: 'Приоритет' }).hover();
  await page.waitForTimeout(400);
  await shot('menu-open');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Tooltip
  await page.getByRole('button', { name: 'Подсказка с горячей клавишей' }).hover();
  await page.waitForTimeout(900);
  await shot('tooltip');

  // Popover
  await page.getByRole('button', { name: 'Всплывающая панель' }).click();
  await shot('popover');
  await page.keyboard.press('Escape');

  // Select
  await page.locator('#inputs').scrollIntoViewIfNeeded();
  await page.getByRole('combobox').first().click();
  await shot('select-open');
  await page.keyboard.press('Escape');

  // Dialog
  await page.locator('#dialogs').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Открыть диалог' }).click();
  await shot('dialog');
  await page.keyboard.press('Escape');

  // Toasts stacked
  await page.locator('#toasts').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Показать уведомление' }).click();
  await page.getByRole('button', { name: 'Удалить с отменой' }).click();
  await page.getByRole('button', { name: 'Показать ошибку' }).click();
  await shot('toasts-collapsed');
  await page.locator('section[aria-label="Уведомления"] ol').hover();
  await shot('toasts-expanded');

  // Mobile sheet + toasts
  const phone = await browser.newContext({
    ...devices['iPhone 15 Pro'],
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    locale: 'ru-RU',
  });
  const m = await phone.newPage();
  await m.goto(`${base}/ru/design`, { waitUntil: 'networkidle' });
  await m.locator('#dialogs').scrollIntoViewIfNeeded();
  await m.getByRole('button', { name: 'Открыть шторку' }).click();
  await m.waitForTimeout(700);
  await m.screenshot({ path: `${out}/sheet-mobile.png` });
  console.log('sheet-mobile');
  await m.keyboard.press('Escape');
  await m.waitForTimeout(400);
  await m.locator('#toasts').scrollIntoViewIfNeeded();
  await m.getByRole('button', { name: 'Удалить с отменой' }).click();
  await m.waitForTimeout(600);
  await m.screenshot({ path: `${out}/toast-mobile.png` });
  console.log('toast-mobile');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
