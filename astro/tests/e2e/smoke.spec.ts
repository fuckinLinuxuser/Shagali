import { expect, test } from './fixtures';
import { watch } from './helpers';

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
