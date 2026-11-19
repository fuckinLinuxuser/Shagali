// Задача 1.2: слайдер, карта и таймлайн главной построены из данных.
// Стенд — сборка с фикстурами: у Кукушонка показ в продаже (14088, 2099), у «Мамочка, купи собаку» — sold_out,
// у «Растворимого Индиго» — soon, у «Откуда взялся папа Карло?» прошедший показ.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';
import { watch } from './helpers';

const CONTENT = fileURLToPath(new URL('../../src/content', import.meta.url));
const load = <T,>(dir: string) =>
  readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(CONTENT, dir, f), 'utf8')) as T);

const SHOWS = load<{ id: string; title: string; order: number }>('shows').sort((a, b) => a.order - b.order);
const CITIES = load<{ id: string; name: string; visited?: boolean; map?: { x: number; y: number } }>('cities');
const PLAN = load<{ period: string; month: string; places: string[] }>('tour-plan').sort((a, b) =>
  a.period.localeCompare(b.period),
);
// Точка — у города с координатами, где были (visited) или есть показ в src/content (фикстуры стенда в src/content не лежат).
const PERFORMED = new Set(load<{ city: string }>('performances').map((p) => p.city));
const DOTS = CITIES.filter((c) => c.map && (c.visited || PERFORMED.has(c.id)));

test('главная: слайды идут из коллекции shows в порядке order', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/');
  const titles = await page.locator('#projects .swiper-slide h2').allTextContents();
  expect(titles.map((t) => t.trim())).toEqual(SHOWS.map((s) => s.title));
  expect(errors).toEqual([]);
});

test('слайдер: кнопка зависит от ближайшего показа', async ({ page }) => {
  await page.goto('/');
  const slide = (title: string) => page.locator('#projects .swiper-slide', { hasText: title });

  // в продаже (фикстура 14088) → «Купить билет» и подпись города и даты
  const kuk = slide('Родной мой Кукушонок');
  await expect(kuk.locator('.buy-btn')).toHaveCount(1);
  await expect(kuk.locator('.buy-btn')).toHaveAttribute('onclick', /openTicketModal\(14088/);
  await expect(kuk.locator('.event-date-badge')).toContainText('15 января');

  // sold_out, soon и только прошедший показ → «Заявка», без покупки
  for (const title of ['Мамочка, купи собаку!', 'Растворимый Индиго', 'Откуда взялся папа Карло?']) {
    await expect(slide(title).locator('.buy-btn')).toHaveCount(0);
    await expect(slide(title).locator('.waitlist-btn')).toHaveCount(1);
  }
});

test('карта: ровно одна точка на город с координатами, где были или есть показы', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('.map-container svg a[href^="/goroda/"]');
  await expect(links).toHaveCount(DOTS.length);
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs.sort()).toEqual(DOTS.map((c) => `/goroda/${c.id}`).sort());
});

test('карта: каждая точка ведёт на существующую страницу города', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('.map-container svg a[href^="/goroda/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href') as string),
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    const city = CITIES.find((c) => `/goroda/${c.id}` === href)!;
    expect(await res.text(), href).toContain(city.name);
  }
});

test('карта: клик по точке открывает страницу города, без всплывающих окон', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tour-popover')).toHaveCount(0);
  // кликаем по самой точке: подпись рядом не принимает клики (pointer-events: none)
  const dot = page.locator('.map-container svg a[href="/goroda/tyumen"] circle');
  await dot.scrollIntoViewIfNeeded();
  await dot.click({ force: true });
  await expect(page).toHaveURL(/\/goroda\/tyumen\/?$/);
  await expect(page.locator('h1')).toContainText('Тюмень');
});

test('таймлайн: пункты идут из tour-plan по порядку', async ({ page }) => {
  await page.goto('/');
  const dates = await page.locator('.timeline-tours .timeline-date').allTextContents();
  expect(dates.map((d) => d.trim())).toEqual(PLAN.map((p) => p.month));
  const first = page.locator('.timeline-tours .timeline-item').first();
  await expect(first).toContainText(PLAN[0].places[0]);
});
