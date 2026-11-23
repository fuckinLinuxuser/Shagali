// Задача 2.4: Яндекс.Метрика вместо Google Analytics. Счётчик 114626453 грузится только после «Принять»; цели —
// city_view, buy_click, widget_loaded, purchase (визит /spasibo), waitlist_submit, feedback_submit.
// На window.ym стоит шпион (addInitScript): настоящий mc.yandex.ru в тестах отрезан, нужны только вызовы.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const ID = 114626453;
const CARD = '[data-performance="test-gorod-2099-01-15-kukushonok"]';

async function spyYm(page: Page) {
  await page.addInitScript(() => {
    const calls: unknown[][] = [];
    (window as unknown as { __ym: unknown[][] }).__ym = calls;
    (window as unknown as { ym: unknown }).ym = (...args: unknown[]) => void calls.push(args);
  });
}
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __ym: unknown[][] }).__ym);
const goals = async (page: Page) => (await calls(page)).filter((c) => c[1] === 'reachGoal').map((c) => c[2]);

test.describe('до согласия', () => {
  test.use({ consent: 'none' });

  test('нет запросов к mc.yandex.ru и googletagmanager, нет вызовов ym, нет пикселя noscript', async ({ page, request }) => {
    const hits: string[] = [];
    page.on('request', (r) => {
      if (/mc\.yandex\.ru|googletagmanager\.com/.test(r.url())) hits.push(r.url());
    });
    await spyYm(page);
    for (const path of ['/', '/goroda/test-gorod', '/spasibo']) await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    expect(hits).toEqual([]);
    expect(await calls(page)).toEqual([]);
    for (const path of ['/', '/goroda', '/spasibo']) {
      const html = await (await request.get(path)).text();
      expect(html, path).not.toContain('mc.yandex.ru');
    }
  });
});

test.describe('после согласия', () => {
  test.use({ consent: 'accepted' });

  test('грузится tag.js счётчика, init с нужным номером; Вебвизор выключен (ПДн из форм)', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (r) => hits.push(r.url()));
    await spyYm(page);
    await page.goto('/');
    await expect.poll(() => hits.some((u) => u.startsWith(`https://mc.yandex.ru/metrika/tag.js?id=${ID}`))).toBe(true);
    const init = (await calls(page)).find((c) => c[1] === 'init');
    expect(init?.[0]).toBe(ID);
    expect(init?.[2]).toMatchObject({ webvisor: false, clickmap: true, trackLinks: true, accurateTrackBounce: true });
    expect(hits.filter((u) => /googletagmanager|google-analytics/.test(u))).toEqual([]);
  });

  test('city_view: визит на страницу города', async ({ page }) => {
    await spyYm(page);
    await page.goto('/goroda/test-gorod');
    await expect.poll(() => goals(page)).toContain('city_view');
  });

  test('purchase: визит на /spasibo', async ({ page }) => {
    await spyYm(page);
    await page.goto('/spasibo');
    await expect.poll(() => goals(page)).toContain('purchase');
  });

  test('buy_click при клике «Билеты» и widget_loaded, когда виджет загрузился', async ({ page, context }) => {
    await context.route('https://cbiletom.ru/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>cbiletom</p>' }));
    await spyYm(page);
    await page.goto('/goroda/test-gorod');
    expect(await goals(page)).not.toContain('buy_click');
    await page.locator(CARD).getByRole('button', { name: 'Билеты', exact: true }).click();
    await expect.poll(() => goals(page)).toContain('buy_click');
    await expect.poll(() => goals(page)).toContain('widget_loaded');
    const buy = (await calls(page)).find((c) => c[2] === 'buy_click');
    expect(buy?.[0]).toBe(ID);
  });

  test('цели главной и /goroda не шлют чужих целей', async ({ page }) => {
    await spyYm(page);
    await page.goto('/');
    await page.waitForTimeout(300);
    expect(await goals(page)).toEqual([]);
  });
});

test.describe('отказ', () => {
  test.use({ consent: 'declined' });

  test('после «Отклонить» цели не уходят даже на страницах с целями', async ({ page }) => {
    await spyYm(page);
    await page.goto('/spasibo');
    await page.goto('/goroda/test-gorod');
    await page.waitForTimeout(400);
    expect(await calls(page)).toEqual([]);
  });
});
