import { expect, test, type Page } from '@playwright/test';

// Живёт только на сервере (images/, videos/ не в репозитории и не в dist) — на стенде их нет.
const SERVER_ONLY = ['/images/', '/videos/'];

// Собирает ошибки консоли, исключения страницы и ответы >=400 со своего домена.
// Внешние ресурсы (шрифты, тайлы карты) не проверяем: стенд может быть без интернета.
function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // сетевые сбои покрыты проверкой ответов ниже
    if (/Failed to load resource/i.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.origin !== new URL(page.url() || r.url()).origin) return;
    if (SERVER_ONLY.some((p) => url.pathname.startsWith(p))) return;
    if (r.status() >= 400) errors.push(`${r.status()} ${url.pathname}`);
  });
  return errors;
}

for (const path of ['/', '/collaboration']) {
  test(`smoke: ${path} открывается без ошибок`, async ({ page }) => {
    const errors = watch(page);
    const res = await page.goto(path, { waitUntil: 'load' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/\S/);
    expect(errors).toEqual([]);
  });
}

test('api.php: GET постов отдаёт JSON, запись без сессии закрыта', async ({ request }) => {
  const list = await request.get('/api.php');
  expect(list.status()).toBe(200);
  expect(Array.isArray(await list.json())).toBe(true);
  const write = await request.post('/api.php', { multipart: { title: 'x' } });
  expect(write.status()).toBe(401);
});
