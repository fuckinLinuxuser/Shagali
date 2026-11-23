// Заглушка «Сайт в разработке» и вход по паролю: /api/gate.php и страница /zastavka (та же заглушка, что на / в закрытом режиме).
// Пароль стенда: stand-gate-pw (docker/init-config.sh). Лимит неудач (10 за 10 минут) общий, поэтому тесты идут по очереди и только в desktop.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';
import { watch } from './helpers';

const COMPOSE = fileURLToPath(new URL('../../../docker-compose.yml', import.meta.url));
const GOOD = 'stand-gate-pw';
const resetLimit = () =>
  execFileSync('docker', ['compose', '-f', COMPOSE, 'exec', '-T', 'web', 'sh', '-c', 'rm -f /tmp/shagali-gate-*'], { encoding: 'utf8' });

test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'общий лимит неудач: гоняем один раз');
  resetLimit();
});

test('gate.php: неверный пароль → 401 без cookie', async ({ request }) => {
  const res = await request.post('/api/gate.php', { data: { password: 'wrong' } });
  expect(res.status()).toBe(401);
  expect(res.headers()['set-cookie'] ?? '').not.toContain('shagali_preview');
});

test('gate.php: верный пароль → 200 и cookie', async ({ request }) => {
  const res = await request.post('/api/gate.php', { data: { password: GOOD } });
  expect(res.status()).toBe(200);
  expect(res.headers()['set-cookie']).toContain('shagali_preview=1');
});

test('gate.php: GET → 405, пустой пароль → 401', async ({ request }) => {
  expect((await request.get('/api/gate.php')).status()).toBe(405);
  expect((await request.post('/api/gate.php', { data: {} })).status()).toBe(401);
});

test('gate.php: после 10 неудач → 429, даже с верным паролем', async ({ request }) => {
  for (let i = 0; i < 10; i++) expect((await request.post('/api/gate.php', { data: { password: `x${i}` } })).status()).toBe(401);
  expect((await request.post('/api/gate.php', { data: { password: 'x11' } })).status()).toBe(429);
  expect((await request.post('/api/gate.php', { data: { password: GOOD } })).status()).toBe(429);
});

test('заглушка: заголовок, ссылка «войдите» открывает окно пароля; страница закрыта от индексации', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/zastavka');
  await expect(page.locator('h1')).toContainText('в разработке');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: 'войдите' }).click();
  await expect(page.getByLabel('Пароль')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('заглушка: неверный пароль — ошибка и остаёмся на месте', async ({ page }) => {
  await page.goto('/zastavka');
  await page.getByRole('button', { name: 'войдите' }).click();
  await page.getByLabel('Пароль').fill('wrong');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('[data-gate-error]')).toBeVisible();
  await expect(page).toHaveURL(/\/zastavka/);
});

test('заглушка: верный пароль пускает на сайт, повторный заход сразу ведёт на сайт', async ({ page }) => {
  await page.goto('/zastavka');
  await page.getByRole('button', { name: 'войдите' }).click();
  await page.getByLabel('Пароль').fill(GOOD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('[data-stage]')).toBeVisible(); // главная (на стенде /preview → /)
  await page.goto('/zastavka');
  await expect(page.locator('[data-stage]')).toBeVisible(); // cookie есть — заглушку не показываем
});

test('/preview в открытом режиме ведёт на главную', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.locator('[data-stage]')).toBeVisible();
  await expect(page).toHaveURL(/localhost:8080\/?$/);
});
