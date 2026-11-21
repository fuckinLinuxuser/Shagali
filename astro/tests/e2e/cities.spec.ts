// Задача 1.3: страницы городов и спектаклей. Стенд — сборка с фикстурами (dist-stand):
// Тестоград (test-gorod) с показами on_sale, sold_out, soon и on_sale с прошедшей датой.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { watch } from './helpers';

const CONTENT = fileURLToPath(new URL('../../src/content', import.meta.url));
const ids = (collection: string) =>
  readdirSync(join(CONTENT, collection))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(CONTENT, collection, f), 'utf8')) as { id: string; name?: string; title?: string });

const CITIES = ids('cities');
const SHOWS = ids('shows');

// Тап на телефоне, клик на десктопе — считаем каждое действие посетителя.
async function tap(page: Page, locator: ReturnType<Page['locator']>, taps: { n: number }) {
  taps.n += 1;
  await locator.click();
}

test('/goroda: все города, город с показами — первым', async ({ page }) => {
  await page.goto('/goroda');
  for (const c of CITIES) {
    await expect(page.locator(`a[href="/goroda/${c.id}"]`)).toHaveCount(1);
  }
  const first = page.locator('[data-city-list] a').first();
  await expect(first).toHaveAttribute('href', '/goroda/test-gorod');
});

test('путь «Города → город → Купить» — 2 тапа, открывается модалка с событием cbiletom', async ({ page, context }) => {
  // Сам cbiletom в тесте не нужен: проверяем, что открывается нужное событие.
  await context.route('https://cbiletom.ru/**', (r) => r.fulfill({ status: 200, body: 'cbiletom' }));
  const taps = { n: 0 };
  await page.goto('/goroda');
  await tap(page, page.locator('a[href="/goroda/test-gorod"]'), taps);
  // Apache (стенд и reg.ru) добавляет к каталогу слеш редиректом 301 — убрать его: задача 2.6.
  await expect(page).toHaveURL(/\/goroda\/test-gorod\/?$/);

  const card = page.locator('[data-performance="test-gorod-2099-01-15-kukushonok"]');
  await expect(card).toContainText('15 января 2099');
  await expect(card).toContainText('19:00');
  await expect(card).toContainText('Тестовый драмтеатр');
  await expect(card).toContainText('от 1 200 ₽');

  await tap(page, card.getByRole('button', { name: 'Купить' }), taps);
  await expect(page.getByRole('dialog').locator('iframe')).toHaveAttribute(
    'src',
    'https://cbiletom.ru/widget/1/frame.php?id=2717&mode=1',
  );
  expect(taps.n).toBeLessThanOrEqual(2);
});

test('кнопки по статусу: распродано → лист ожидания, скоро → неактивна', async ({ page }) => {
  await page.goto('/goroda/test-gorod');
  const soldOut = page.locator('[data-performance="test-gorod-2099-02-01-doggy"]');
  await expect(soldOut.getByRole('link', { name: 'Встать в лист ожидания' })).toHaveAttribute(
    'href',
    '/waitlist?city=test-gorod',
  );
  await expect(soldOut.getByRole('button', { name: 'Купить' })).toHaveCount(0);

  const soon = page.locator('[data-performance="test-gorod-2099-03-01-indigo"]');
  await expect(soon.getByRole('button', { name: 'Скоро в продаже' })).toBeDisabled();
  await expect(soon.getByRole('button', { name: 'Купить' })).toHaveCount(0);
});

test('показ с прошедшей датой уходит в «Прошедшие» без кнопки «Купить», хотя в данных on_sale', async ({ page }) => {
  await page.goto('/goroda/test-gorod');
  const past = page.locator('[data-past] [data-performance="test-gorod-2020-01-10-papa-karlo"]');
  await expect(past).toHaveCount(1);
  await expect(past.getByRole('button', { name: 'Купить' })).toHaveCount(0);
  await expect(page.locator('[data-upcoming] [data-performance="test-gorod-2020-01-10-papa-karlo"]')).toHaveCount(0);
});

test('город без будущих показов: лист ожидания, а не пустота; прошедшие видны', async ({ page }) => {
  await page.goto('/goroda/tyumen');
  await expect(page.locator('[data-upcoming]')).toHaveCount(0);
  const empty = page.locator('[data-no-performances]');
  await expect(empty).toContainText('Тюмень: пока нет показов');
  await expect(empty.getByRole('link', { name: /лист ожидания/i })).toHaveAttribute('href', '/waitlist?city=tyumen');
  await expect(page.locator('[data-past]')).toContainText('Родной мой Кукушонок');
});

test('лист ожидания подставляет город из ссылки', async ({ page }) => {
  await page.goto('/waitlist?city=tyumen');
  await expect(page.locator('#city')).toHaveValue('Тюмень');
  await page.goto('/waitlist?city=no-such-city');
  await expect(page.locator('#city')).toHaveValue('');
});

test('город, где уже были, — блок «Спасибо»', async ({ page }) => {
  await page.goto('/goroda/vladivostok');
  await expect(page.getByRole('heading', { name: 'Спасибо, Владивосток!' })).toBeVisible();
});

test('страница спектакля: описание и все показы со ссылками на города, без пустых разделов', async ({ page }) => {
  await page.goto('/spektakli/kukushonok');
  await expect(page.getByRole('heading', { level: 1, name: 'Родной мой Кукушонок' })).toBeVisible();
  await expect(page.locator('a[href="/goroda/test-gorod"]').first()).toBeVisible();
  await expect(page.locator('a[href="/goroda/tyumen"]').first()).toBeVisible();
  await expect(page.getByText('Отзывы')).toHaveCount(0);
});

test('все страницы городов и спектаклей — в sitemap', async ({ request }) => {
  const xml = await (await request.get('/sitemap-0.xml')).text();
  for (const c of CITIES) expect(xml).toContain(`https://shagali.ru/goroda/${c.id}<`);
  for (const s of SHOWS) expect(xml).toContain(`https://shagali.ru/spektakli/${s.id}<`);
  expect(xml).toContain('https://shagali.ru/goroda<');
});

const PAGES = ['/goroda', ...CITIES.map((c) => `/goroda/${c.id}`), '/goroda/test-gorod', ...SHOWS.map((s) => `/spektakli/${s.id}`)];

for (const path of PAGES) {
  test(`${path}: без ошибок, без горизонтальной прокрутки, меню ведёт на главную`, async ({ page }) => {
    const errors = watch(page);
    const res = await page.goto(path, { waitUntil: 'load' });
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/\S/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('header a[href="/#afisha"]').first()).toBeAttached();
    expect(errors).toEqual([]);
  });
}
