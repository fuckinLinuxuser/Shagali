// Задача 1.5: страница «Спасибо» — на неё cbiletom возвращает после покупки.
import { expect, test } from './fixtures';
import { watch } from './helpers';

test('/spasibo открывается без ошибок, с понятным заголовком', async ({ page }) => {
  const errors = watch(page);
  const res = await page.goto('/spasibo', { waitUntil: 'load' });
  expect(res?.status()).toBe(200);
  await expect(page.locator('h1')).toContainText('Спасибо');
  expect(errors).toEqual([]);
});

test('/spasibo закрыта от индексации и не лежит в sitemap', async ({ page, request }) => {
  await page.goto('/spasibo');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  const index = await (await request.get('/sitemap-index.xml')).text();
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const map of maps) {
    const xml = await (await request.get(map)).text();
    expect(xml).not.toContain('/spasibo');
  }
});

test('/spasibo ведёт дальше: афиша городов и главная, без пустых ссылок', async ({ page }) => {
  await page.goto('/spasibo');
  await expect(page.locator('main a[href="/goroda"]')).toHaveCount(1);
  await expect(page.locator('main a[href="/"]')).toHaveCount(1);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
});

test('остальные страницы по-прежнему индексируются', async ({ page }) => {
  await page.goto('/goroda');
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});
