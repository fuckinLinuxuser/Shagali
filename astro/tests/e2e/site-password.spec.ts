// Прод закрыт паролем на весь домен (HTTP Basic Auth из .htaccess), пока на сервере есть файл .htpasswd.
// На стенде файла нет и стоит SHAGALI_STAND=1 — сайт открыт, чтобы работали остальные тесты. Здесь файл создаётся
// на время теста. Проект site-password идёт после всех остальных (playwright.config.ts): пока файл есть, стенд закрыт.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const COMPOSE = fileURLToPath(new URL('../../../docker-compose.yml', import.meta.url));
const HTPASSWD = '/var/www/u3413841/data/.htpasswd';
const USER = 'tester';
const PASS = 'stand-only-pw';

const web = (cmd: string) => execFileSync('docker', ['compose', '-f', COMPOSE, 'exec', '-T', 'web', 'sh', '-c', cmd], { encoding: 'utf8' });
const lock = () => web(`mkdir -p "$(dirname ${HTPASSWD})" && htpasswd -bcB ${HTPASSWD} ${USER} ${PASS} && chmod 644 ${HTPASSWD}`);
const unlock = () => web(`rm -f ${HTPASSWD}`);

test.describe.configure({ mode: 'serial' });
test.beforeAll(unlock);
test.afterAll(unlock);

test('без файла паролей (стенд) сайт открыт', async ({ request }) => {
  expect((await request.get('/')).status()).toBe(200);
});

test('с файлом паролей без пароля — 401 на странице, API и служебных файлах', async ({ request }) => {
  lock();
  for (const path of ['/', '/goroda', '/spasibo', '/sitemap-index.xml', '/api.php', '/robots.txt']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(401);
    expect(res.headers()['www-authenticate'], path).toMatch(/^Basic /);
  }
  expect((await request.post('/api/forms.php', { data: {} })).status()).toBe(401);
});

test('неверный пароль — 401, верный — 200 и настоящая страница', async ({ playwright, baseURL }) => {
  lock();
  const bad = await playwright.request.newContext({ baseURL, httpCredentials: { username: USER, password: 'wrong' } });
  expect((await bad.get('/')).status()).toBe(401);
  const good = await playwright.request.newContext({ baseURL, httpCredentials: { username: USER, password: PASS, send: 'always' } });
  const res = await good.get('/');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('<html');
  expect((await good.get('/goroda')).status()).toBe(200);
});

test('в браузере: запрос пароля у чужого, обычная страница у своего', async ({ browser, baseURL }) => {
  lock();
  const stranger = await browser.newContext({ baseURL });
  const res = await (await stranger.newPage()).goto('/').catch(() => null);
  // Basic Auth без учётных данных: браузер получает 401 (диалог входа в headless не показывается)
  expect(res === null || res.status() === 401).toBe(true);
  const owner = await browser.newContext({ baseURL, httpCredentials: { username: USER, password: PASS } });
  const page = await owner.newPage();
  expect((await page.goto('/'))?.status()).toBe(200);
  await expect(page.locator('body')).toBeVisible();
});

test('служебные файлы по-прежнему закрыты (403) и под паролем', async ({ playwright, baseURL }) => {
  lock();
  const good = await playwright.request.newContext({ baseURL, httpCredentials: { username: USER, password: PASS, send: 'always' } });
  expect((await good.get('/sql/001_init.sql')).status()).toBe(403);
});

test('после удаления файла паролей сайт снова открыт', async ({ request }) => {
  unlock();
  expect((await request.get('/')).status()).toBe(200);
});
