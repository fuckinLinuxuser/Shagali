// Задачи 4.1, 4.3, 4.4: код 12% по заполненному профилю, агентские коды (админ), закулисье за сессией и доступом.
// Закулисье лежит вне dist и отдаётся PHP-ом: /api/backstage.php. Тестовые файлы — tests/fixtures/backstage.
import { expect, test } from './fixtures';
import { sql } from './db';
import { clearMail, tokenFrom, waitForMail } from './mail';

const AUTH = '/api/auth.php';
const AGENTS = '/api/admin-agents.php';
const BACKSTAGE = '/api/backstage.php';
const HTTPS = { 'X-Forwarded-Proto': 'https' };
const PASS = 'Correct-horse-1';

type Req = import('@playwright/test').APIRequestContext;
const csrf = async (r: Req) => (await (await r.get(`${AUTH}?action=csrf`, { headers: HTTPS })).json()).csrf as string;
const post = async (r: Req, action: string, data: Record<string, unknown>) =>
  r.post(`${AUTH}?action=${action}`, { data, headers: { ...HTTPS, 'X-CSRF-Token': await csrf(r) } });
const me = async (r: Req) => (await (await r.get(`${AUTH}?action=me`, { headers: HTTPS })).json()) as Record<string, any>;

async function userLoggedIn(r: Req, email = 'agent@example.com') {
  await clearMail();
  await post(r, 'register', { email, password: PASS, last_name: 'Агентова', first_name: 'Ася', city: 'Тестоград', phone: '89001112233', consent: true });
  await post(r, 'verify', { token: tokenFrom((await waitForMail(email)).text) });
  expect((await post(r, 'login', { email, password: PASS })).status()).toBe(200);
}

async function admin(playwright: import('@playwright/test').PlaywrightTestArgs['playwright'], baseURL: string) {
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post('/api.php?action=login', { data: { password: 'local-admin-pw' } });
  expect(res.status()).toBe(200);
  const token = (await res.json()).csrf as string;
  return { ctx, post: (path: string, data: Record<string, unknown>) => ctx.post(path, { data, headers: { 'X-CSRF-Token': token } }) };
}

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => sql('TRUNCATE users; TRUNCATE login_attempts; TRUNCATE rate_limit; TRUNCATE agent_codes'));

test('4.1: профиль заполнен → код 12% виден; не хватает поля → код скрыт и сказано, чего не хватает', async ({ request }) => {
  await userLoggedIn(request);
  let m = await me(request);
  expect(m.promo12).toBe('STAND12');
  expect(m.missing).toEqual([]);

  sql("UPDATE users SET city = '', phone = ''");
  m = await me(request);
  expect(m.promo12).toBeNull();
  expect(m.missing).toEqual(['city', 'phone']);

  expect((await post(request, 'update_profile', { last_name: 'Агентова', first_name: 'Ася', city: 'Тюмень', phone: '8 900 111 22 33' })).status()).toBe(200);
  m = await me(request);
  expect(m.promo12).toBe('STAND12');
  expect(m.user).toMatchObject({ city: 'Тюмень', phone: '79001112233' });
});

test('4.1: update_profile — нужен вход, поля проверяются', async ({ request }) => {
  expect((await post(request, 'update_profile', { last_name: 'А', first_name: 'Б', city: 'В', phone: '89001112233' })).status()).toBe(401);
  await userLoggedIn(request);
  expect((await post(request, 'update_profile', { last_name: '', first_name: 'Б', city: 'В', phone: '89001112233' })).status()).toBe(422);
  expect((await post(request, 'update_profile', { last_name: 'А', first_name: 'Б', city: 'В', phone: '1' })).status()).toBe(422);
});

test('4.3: админ выдаёт агентский код и вносит число использований; 9 → закулисья нет, 10 → есть', async ({ request, playwright, baseURL }) => {
  await userLoggedIn(request);
  const a = await admin(playwright, baseURL!);
  const issued = await a.post(AGENTS, { action: 'issue', email: 'agent@example.com' });
  expect(issued.status()).toBe(201);
  const { code } = await issued.json();
  expect(code).toMatch(/^[A-Z0-9]{8,}$/);
  expect((await me(request)).agent).toMatchObject({ code, uses: 0, backstage: false });

  expect((await a.post(AGENTS, { action: 'set_uses', code, uses: 9 })).status()).toBe(200);
  expect((await me(request)).agent).toMatchObject({ uses: 9, backstage: false });
  expect((await a.post(AGENTS, { action: 'set_uses', code, uses: 10 })).status()).toBe(200);
  expect((await me(request)).agent).toMatchObject({ uses: 10, backstage: true });

  const list = await (await a.ctx.get(AGENTS)).json();
  expect(list.codes).toEqual([expect.objectContaining({ code, uses: 10, email: 'agent@example.com' })]);
});

test('4.3: не-админ не может ни выдать код, ни изменить счётчик → 403', async ({ request, playwright, baseURL }) => {
  await userLoggedIn(request);
  const a = await admin(playwright, baseURL!);
  const { code } = await (await a.post(AGENTS, { action: 'issue', email: 'agent@example.com' })).json();

  // аноним
  const anon = await playwright.request.newContext({ baseURL });
  expect((await anon.post(AGENTS, { data: { action: 'set_uses', code, uses: 99 } })).status()).toBe(403);
  expect((await anon.get(AGENTS)).status()).toBe(403);
  // вошедший обычный пользователь (его сессия — не админская)
  expect((await request.post(AGENTS, { data: { action: 'set_uses', code, uses: 99 }, headers: { 'X-CSRF-Token': await csrf(request) } })).status()).toBe(403);
  // админ без CSRF
  expect((await a.ctx.post(AGENTS, { data: { action: 'set_uses', code, uses: 99 } })).status()).toBe(403);
  expect(sql('SELECT uses FROM agent_codes')).toBe('0');
});

test('4.3: счётчик проверяется (целое ≥ 0), код уникален, неизвестная почта/код → ошибка', async ({ request, playwright, baseURL }) => {
  await userLoggedIn(request);
  const a = await admin(playwright, baseURL!);
  const { code } = await (await a.post(AGENTS, { action: 'issue', email: 'agent@example.com' })).json();
  for (const uses of [-1, 1.5, 'x', 100001]) expect((await a.post(AGENTS, { action: 'set_uses', code, uses })).status(), String(uses)).toBe(422);
  expect((await a.post(AGENTS, { action: 'set_uses', code: 'NOSUCH', uses: 1 })).status()).toBe(404);
  expect((await a.post(AGENTS, { action: 'issue', email: 'nobody@example.com' })).status()).toBe(404);
  expect((await a.post(AGENTS, { action: 'issue', email: 'agent@example.com' })).status()).toBe(409); // у пользователя уже есть код
});

test('4.4: закулисье — без сессии 403; с сессией без доступа 403; с доступом 200', async ({ request, playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL });
  expect((await anon.get(`${BACKSTAGE}?file=hello.txt`)).status()).toBe(403);

  await userLoggedIn(request);
  expect((await request.get(`${BACKSTAGE}?file=hello.txt`, { headers: HTTPS })).status()).toBe(403);

  const a = await admin(playwright, baseURL!);
  const { code } = await (await a.post(AGENTS, { action: 'issue', email: 'agent@example.com' })).json();
  await a.post(AGENTS, { action: 'set_uses', code, uses: 9 });
  expect((await request.get(`${BACKSTAGE}?file=hello.txt`, { headers: HTTPS })).status()).toBe(403);
  await a.post(AGENTS, { action: 'set_uses', code, uses: 10 });

  const ok = await request.get(`${BACKSTAGE}?file=hello.txt`, { headers: HTTPS });
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toContain('закулисье');
  expect(ok.headers()['x-content-type-options']).toBe('nosniff');
  expect(ok.headers()['cache-control']).toMatch(/private|no-store/);
  const png = await request.get(`${BACKSTAGE}?file=pic.png`, { headers: HTTPS });
  expect(png.headers()['content-type']).toBe('image/png');
  const list = await (await request.get(`${BACKSTAGE}?list=1`, { headers: HTTPS })).json();
  expect(list.files).toEqual(expect.arrayContaining(['hello.txt', 'pic.png']));
});

test('4.4: путь вне папки, чужое расширение и несуществующий файл не отдаются', async ({ request, playwright, baseURL }) => {
  await userLoggedIn(request);
  const a = await admin(playwright, baseURL!);
  const { code } = await (await a.post(AGENTS, { action: 'issue', email: 'agent@example.com' })).json();
  await a.post(AGENTS, { action: 'set_uses', code, uses: 10 });
  for (const file of ['../hello.txt', '..%2Fhello.txt', '/etc/passwd', 'a/b.txt', '.htaccess', 'x.php', 'hello.txt%00.png']) {
    const status = (await request.get(`${BACKSTAGE}?file=${file}`, { headers: HTTPS })).status();
    expect([400, 404], file).toContain(status);
  }
  expect((await request.get(`${BACKSTAGE}?file=missing.txt`, { headers: HTTPS })).status()).toBe(404);
});

test('удаление аккаунта удаляет и агентский код', async ({ request, playwright, baseURL }) => {
  await userLoggedIn(request);
  const a = await admin(playwright, baseURL!);
  await a.post(AGENTS, { action: 'issue', email: 'agent@example.com' });
  expect(sql('SELECT COUNT(*) FROM agent_codes')).toBe('1');
  expect((await post(request, 'delete_account', { password: PASS })).status()).toBe(200);
  expect(sql('SELECT COUNT(*) FROM agent_codes')).toBe('0');
});
