// Задача 1.4: модалка покупки билетов cbiletom. Стенд — сборка с фикстурами: тестовый показ Кукушонка
// в Тестограде (on_sale, событие 2717), на главной у слайда Кукушонка тоже «Билеты».
// Сам cbiletom не нужен: подменяем ответ и проверяем, что открывается нужное событие.
import { expect, test } from './fixtures';

const FRAME = 'https://cbiletom.ru/widget/1/frame.php?id=2717&mode=1';
const EVENT_PAGE = 'https://cbiletom.ru/event.php?event=2717';
const CARD = '[data-performance="test-gorod-2099-01-15-kukushonok"]';

async function mockCbiletom(context: import('@playwright/test').BrowserContext) {
  await context.route('https://cbiletom.ru/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<p>cbiletom</p>' }),
  );
}

test('до клика на странице нет ни iframe cbiletom, ни его скрипта', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('cbiletom.ru')) requests.push(r.url());
  });
  for (const path of ['/', '/goroda/test-gorod']) {
    await page.goto(path, { waitUntil: 'load' });
    // другие iframe на странице (форма заявки) не в счёт — только cbiletom
    await expect(page.locator('iframe[src*="cbiletom"]')).toHaveCount(0);
    await expect(page.locator('script[src*="cbiletom"]')).toHaveCount(0);
  }
  expect(requests).toEqual([]);
});

test('«Билеты» на странице города открывает модалку с нужным событием', async ({ page, context }) => {
  await mockCbiletom(context);
  await page.goto('/goroda/test-gorod');
  await page.locator(CARD).getByRole('button', { name: 'Билеты', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('iframe')).toHaveCount(1);
  await expect(dialog.locator('iframe')).toHaveAttribute('src', FRAME);
  await expect(dialog.getByRole('button', { name: 'Закрыть' })).toBeVisible();
});

test('виджет растянут на всю модалку, а не стандартные 300×150', async ({ page, context }) => {
  await mockCbiletom(context);
  await page.goto('/goroda/test-gorod');
  await page.locator(CARD).getByRole('button', { name: 'Билеты', exact: true }).click();
  const panel = (await page.locator('[data-ticket-panel]').boundingBox())!;
  const frame = (await page.locator('[data-ticket-panel] iframe').boundingBox())!;
  expect(frame.width).toBeGreaterThanOrEqual(panel.width - 2);
  // под шапкой модалки (~100–150px) остаётся почти вся высота
  expect(frame.height).toBeGreaterThanOrEqual(panel.height * 0.6);
});

test('«Билеты» на слайде главной открывает ту же модалку', async ({ page, context }) => {
  await mockCbiletom(context);
  await page.goto('/');
  await page.locator('[data-stage-slide][data-slide-id="kukushonok"] [data-ticket-id]').click();
  await expect(page.getByRole('dialog').locator('iframe')).toHaveAttribute('src', FRAME);
});

test('при открытой модалке страница не прокручивается; закрытие возвращает позицию и фокус', async ({ page, context }) => {
  await mockCbiletom(context);
  await page.goto('/goroda/test-gorod');
  const buy = page.locator(CARD).getByRole('button', { name: 'Билеты', exact: true });
  await buy.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 120));
  const before = await page.evaluate(() => window.scrollY);

  await buy.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  // попытка прокрутить страницу под модалкой ничего не двигает
  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(before + 1);

  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('iframe[src*="cbiletom"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(1);
  await expect(buy).toBeFocused();
});

test('Esc закрывает модалку, фокус возвращается на кнопку', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'Esc — клавиатура');
  await mockCbiletom(context);
  await page.goto('/goroda/test-gorod');
  const buy = page.locator(CARD).getByRole('button', { name: 'Билеты', exact: true });
  await buy.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('iframe[src*="cbiletom"]')).toHaveCount(0);
  await expect(buy).toBeFocused();
});

test('если cbiletom не отвечает — через 7 секунд ссылка «Открыть покупку на сайте cbiletom»', async ({ page }) => {
  // cbiletom.ru отрезан фикстюром (route abort) — так же выглядит блокировка у посетителя
  await page.clock.install();
  await page.goto('/goroda/test-gorod');
  await page.locator(CARD).getByRole('button', { name: 'Билеты', exact: true }).click();
  const link = page.getByRole('link', { name: 'Открыть покупку на сайте cbiletom' });

  await page.clock.runFor(6500);
  await expect(link).toBeHidden();
  await page.clock.runFor(1000);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', EVENT_PAGE);
  await expect(link).toHaveAttribute('target', '_blank');
});

test('на телефоне модалка занимает весь экран (100dvh), «Закрыть» в окне', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'только телефон');
  await mockCbiletom(context);
  await page.goto('/goroda/test-gorod');
  await page.locator(CARD).getByRole('button', { name: 'Билеты', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const vp = page.viewportSize()!;
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.y).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
  expect(box.height).toBeGreaterThanOrEqual(vp.height - 1);
  await expect(dialog.getByRole('button', { name: 'Закрыть' })).toBeInViewport({ ratio: 1 });
});

test('на десктопе модалка не на весь экран', async ({ page, context, isMobile }) => {
  test.skip(!!isMobile);
  await mockCbiletom(context);
  await page.goto('/goroda/test-gorod');
  await page.locator(CARD).getByRole('button', { name: 'Билеты', exact: true }).click();
  const box = (await page.locator('[data-ticket-panel]').boundingBox())!;
  expect(box.width).toBeLessThan(page.viewportSize()!.width);
});

test('распродано и скоро: без модалки', async ({ page }) => {
  await page.goto('/goroda/test-gorod');
  const soldOut = page.locator('[data-performance="test-gorod-2099-02-01-doggy"]');
  await expect(soldOut.getByRole('link', { name: 'Встать в лист ожидания' })).toHaveAttribute('href', '/waitlist?city=test-gorod');
  await expect(soldOut.locator('[data-ticket-id]')).toHaveCount(0);
  const soon = page.locator('[data-performance="test-gorod-2099-03-01-indigo"]');
  await expect(soon.getByRole('button', { name: 'Скоро в продаже' })).toBeDisabled();
  await expect(soon.locator('[data-ticket-id]')).toHaveCount(0);
});
