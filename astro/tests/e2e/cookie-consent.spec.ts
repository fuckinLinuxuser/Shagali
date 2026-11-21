// Cookie-плашка: счётчики грузятся только после «Принять». Тесты стартуют как первый визит (consent: 'none').
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.use({ consent: 'none' });

const COOKIE = 'shagali_cookie_consent';
// Всё, что собирает статистику: Top.Mail.Ru (под согласием) и Google/Яндекс (убраны/не подключены)
const COUNTER_HOSTS = /top-fwz1\.mail\.ru|mail\.ru\/counter|googletagmanager\.com|google-analytics\.com|mc\.yandex\.ru/;
const GOOGLE_HOSTS = /googletagmanager\.com|google-analytics\.com/;

function trackCounters(page: Page) {
  const hits: string[] = [];
  page.on('request', (r) => {
    if (COUNTER_HOSTS.test(r.url())) hits.push(r.url());
  });
  return hits;
}

const banner = (page: Page) => page.getByRole('region', { name: 'Файлы cookie' });
const consentValue = async (page: Page) =>
  (await page.context().cookies()).find((c) => c.name === COOKIE)?.value ?? null;

test('первый визит: плашка видна на главной и внутренних страницах', async ({ page }) => {
  for (const path of ['/', '/goroda', '/cookies']) {
    await page.goto(path);
    await expect(banner(page), path).toBeVisible();
    await expect(banner(page).getByRole('button', { name: 'Принять' })).toBeVisible();
    await expect(banner(page).getByRole('button', { name: 'Отклонить' })).toBeVisible();
    await expect(banner(page).getByRole('link', { name: /Подробнее/ })).toHaveAttribute('href', '/cookies');
  }
});

test('до согласия счётчики не грузятся и cookie выбора нет', async ({ page }) => {
  const hits = trackCounters(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  expect(hits).toEqual([]);
  expect(await consentValue(page)).toBeNull();
});

test('«Принять»: плашка уходит, выбор запоминается, Top.Mail.Ru грузится, Google — никогда', async ({ page }) => {
  const hits = trackCounters(page);
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Принять' }).click();
  await expect(banner(page)).toBeHidden();
  expect(await consentValue(page)).toBe('v1:accepted');
  await expect.poll(() => hits.some((u) => /top-fwz1\.mail\.ru/.test(u))).toBe(true);

  await page.reload();
  await expect(banner(page)).toBeHidden();
  await expect.poll(() => hits.filter((u) => /top-fwz1\.mail\.ru\/js/.test(u)).length).toBeGreaterThanOrEqual(2);
  expect(hits.filter((u) => GOOGLE_HOSTS.test(u))).toEqual([]);
});

test('«Отклонить»: плашка уходит, выбор запоминается, счётчики не грузятся и после перезагрузки', async ({ page }) => {
  const hits = trackCounters(page);
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Отклонить' }).click();
  await expect(banner(page)).toBeHidden();
  expect(await consentValue(page)).toBe('v1:declined');

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  await expect(banner(page)).toBeHidden();
  expect(hits).toEqual([]);
});

test('выбор другой версии политики — спрашиваем заново', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: COOKIE, value: 'v0:accepted', url: baseURL! }]);
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
});

test('«Настройки cookie» в подвале возвращают плашку; отказ после согласия чистит cookie счётчика', async ({ page, baseURL }) => {
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Принять' }).click();
  await expect(banner(page)).toBeHidden();
  // имитируем cookie, которую поставил счётчик
  await page.context().addCookies([{ name: 'tmr_lvid', value: 'abc', url: baseURL! }]);

  await page.getByRole('button', { name: 'Настройки cookie' }).click();
  await expect(banner(page)).toBeVisible();
  await banner(page).getByRole('button', { name: 'Отклонить' }).click();

  await expect.poll(() => consentValue(page)).toBe('v1:declined');
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === 'tmr_lvid')).toBe(false);
  await expect(banner(page)).toBeHidden();
});

test('Google Analytics и Tag Manager убраны из разметки совсем', async ({ request }) => {
  for (const path of ['/', '/goroda', '/cookies']) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toMatch(/googletagmanager|G-YV1LNBH5XW|GTM-W4K95GQZ|dataLayer/);
    // и счётчик Top.Mail.Ru не вшит в страницу: нет ни скрипта, ни noscript-пикселя без согласия
    expect(html, path).not.toMatch(/<noscript>[^<]*<div><img[^>]*top-fwz1/);
    expect(html, path).not.toMatch(/<script[^>]+src="https:\/\/top-fwz1/);
  }
});

test('плашка ниже модалки билетов и не перекрывает страницу целиком', async ({ page }) => {
  await page.goto('/');
  const zBanner = await banner(page).evaluate((el) => Number(getComputedStyle(el).zIndex));
  const zModal = await page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-ticket-modal]')!).zIndex));
  expect(zBanner).toBeLessThan(zModal);
  const box = (await banner(page).boundingBox())!;
  expect(box.height).toBeLessThan(page.viewportSize()!.height * 0.5);
});

test('страница /cookies: перечисляет cookie по фактам и без заглушек', async ({ page }) => {
  const res = await page.goto('/cookies');
  expect(res?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Файлы cookie');
  const text = await page.locator('main').innerText();
  for (const fact of ['shagali_cookie_consent', 'PHPSESSID', 'Top.Mail.Ru', 'Google Fonts', 'cbiletom']) {
    expect(text, fact).toContain(fact);
  }
  expect(text).not.toMatch(/TODO/);
  await expect(page.getByRole('button', { name: 'Настройки cookie' }).first()).toBeVisible();
});
