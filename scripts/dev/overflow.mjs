// Reports elements that stick out horizontally (causing sideways scroll) on phone width.
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:3000/ru/design';
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const report = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    const childOverflows = [...el.children].some((c) => c.getBoundingClientRect().right > vw + 1);
    if (r.width > 0 && r.right > vw + 1 && !childOverflows && !el.closest('[aria-hidden="true"]')) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 90),
        right: Math.round(r.right),
        width: Math.round(r.width),
      });
    }
  }
  return {
    vw,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: offenders.slice(0, 25),
  };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
