// Задача 3.3: регистрация и вход — /api/auth.php. Письма — через mailpit на стенде. Общая БД: идёт после forms-ui.
import { expect, test } from './fixtures';
import { count, sql } from './db';
import { clearMail, listMail, tokenFrom, waitForMail } from './mail';

const API = '/api/auth.php';
const HTTPS = { 'X-Forwarded-Proto': 'https' }; // стенд на http: так cookie получает Secure, как на проде
const PASS = 'Correct-horse-1';

test.describe.configure({ mode: 'serial' });
test.beforeEach(async () => {
  sql('TRUNCATE users; TRUNCATE login_attempts; TRUNCATE rate_limit');
  await clearMail();
});

type Req = import('@playwright/test').APIRequestContext;
const csrf = async (request: Req) => (await (await request.get(`${API}?action=csrf`, { headers: HTTPS })).json()).csrf as string;
const post = async (request: Req, action: string, data: Record<string, unknown>, token?: string) =>
  request.post(`${API}?action=${action}`, { data, headers: { ...HTTPS, 'X-CSRF-Token': token ?? (await csrf(request)) } });

const reg = (over: Record<string, unknown> = {}) => ({
  email: 'anna@example.com',
  password: PASS,
  last_name: 'Тестова',
  first_name: 'Анна',
  city: 'Тестоград',
  phone: '+7 (900) 123-45-67',
  consent: true,
  ...over,
});

async function registerAndVerify(request: Req, over: Record<string, unknown> = {}) {
  const data = reg(over);
  expect((await post(request, 'register', data)).status()).toBe(201);
  const mail = await waitForMail(data.email as string);
  const v = await post(request, 'verify', { token: tokenFrom(mail.text) });
  expect(v.status()).toBe(200);
  return data;
}

test('csrf: токен выдаётся, cookie сессии HttpOnly + Secure + SameSite=Lax, ответ не кэшируется', async ({ request }) => {
  const res = await request.get(`${API}?action=csrf`, { headers: HTTPS });
  expect(res.status()).toBe(200);
  expect((await res.json()).csrf).toMatch(/^[a-f0-9]{32,}$/);
  const cookie = res.headers()['set-cookie'] ?? '';
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/Secure/i);
  expect(cookie).toMatch(/SameSite=Lax/i);
  expect(res.headers()['cache-control']).toContain('no-store');
});

test('POST без CSRF-токена и с чужим токеном → 403', async ({ request }) => {
  await csrf(request);
  expect((await request.post(`${API}?action=register`, { data: reg(), headers: HTTPS })).status()).toBe(403);
  expect((await request.post(`${API}?action=login`, { data: {}, headers: { ...HTTPS, 'X-CSRF-Token': 'x'.repeat(32) } })).status()).toBe(403);
  expect(count('users')).toBe(0);
});

test('регистрация → письмо со ссылкой; пароль в БД хешем; до подтверждения почты войти нельзя', async ({ request }) => {
  const res = await post(request, 'register', reg());
  expect(res.status()).toBe(201);
  expect(count('users')).toBe(1);
  expect(sql('SELECT password_hash LIKE "$2y$%" FROM users')).toBe('1');
  expect(sql('SELECT password_hash FROM users')).not.toContain(PASS);
  expect(sql('SELECT consent_at IS NOT NULL, consent_version <> "", email_verified_at IS NULL FROM users')).toBe('1\t1\t1');
  const mail = await waitForMail('anna@example.com');
  expect(tokenFrom(mail.text)).toHaveLength(64);
  expect(mail.text).toContain('/lk/verify?token=');

  const login = await post(request, 'login', { email: 'anna@example.com', password: PASS });
  expect(login.status()).toBe(403);
});

test('подтверждение почты → вход → me → выход; id сессии меняется после входа', async ({ request }) => {
  await registerAndVerify(request);
  const before = (await request.storageState()).cookies.find((c) => c.name === 'shagali_sid')?.value;
  const login = await post(request, 'login', { email: 'ANNA@example.com', password: PASS });
  expect(login.status()).toBe(200);
  const after = (await request.storageState()).cookies.find((c) => c.name === 'shagali_sid')?.value;
  expect(after).toBeTruthy();
  expect(after).not.toBe(before);

  const me = await (await request.get(`${API}?action=me`, { headers: HTTPS })).json();
  expect(me.user).toMatchObject({ email: 'anna@example.com', first_name: 'Анна', last_name: 'Тестова', city: 'Тестоград', phone: '79001234567' });
  expect(me.user).not.toHaveProperty('password_hash');

  expect((await post(request, 'logout', {})).status()).toBe(200);
  expect((await request.get(`${API}?action=me`, { headers: HTTPS })).status()).toBe(401);
});

test('неверный пароль → 401 без подсказки, какой именно логин существует', async ({ request }) => {
  await registerAndVerify(request);
  const wrong = await post(request, 'login', { email: 'anna@example.com', password: 'nope-nope-1' });
  const unknown = await post(request, 'login', { email: 'nobody@example.com', password: 'nope-nope-1' });
  expect(wrong.status()).toBe(401);
  expect(unknown.status()).toBe(401);
  expect(await wrong.json()).toEqual(await unknown.json());
});

test('5 неудачных входов за 15 минут → 6-я попытка 429, даже с верным паролем', async ({ request }) => {
  await registerAndVerify(request);
  for (let i = 0; i < 5; i++) expect((await post(request, 'login', { email: 'anna@example.com', password: `bad-${i}-pass` })).status()).toBe(401);
  expect((await post(request, 'login', { email: 'anna@example.com', password: 'bad-6-pass' })).status()).toBe(429);
  expect((await post(request, 'login', { email: 'anna@example.com', password: PASS })).status()).toBe(429);
});

test('валидация регистрации: нет согласия, слабый пароль, плохие почта и телефон → 422, в БД ничего', async ({ request }) => {
  for (const over of [{ consent: false }, { password: 'short1' }, { email: 'not-mail' }, { phone: '12' }, { first_name: '' }, { last_name: ' ' }, { city: '' }]) {
    expect((await post(request, 'register', reg(over))).status(), JSON.stringify(over)).toBe(422);
  }
  expect(count('users')).toBe(0);
});

test('повторная регистрация той же почты: ответ тот же, второй записи нет, пользователь получает письмо «уже зарегистрированы»', async ({ request }) => {
  await registerAndVerify(request);
  await clearMail();
  const again = await post(request, 'register', reg({ first_name: 'Другая' }));
  expect(again.status()).toBe(201);
  expect(count('users')).toBe(1);
  expect(sql('SELECT first_name FROM users')).toBe('Анна');
  const mail = await waitForMail('anna@example.com');
  expect(mail.text).not.toContain('token=');
  expect(mail.text).toContain('/lk/login');
});

test('сброс пароля: письмо → новый пароль → старый не работает, ссылка одноразовая', async ({ request }) => {
  await registerAndVerify(request);
  await clearMail();
  expect((await post(request, 'reset_request', { email: 'anna@example.com' })).status()).toBe(200);
  const mail = await waitForMail('anna@example.com');
  const token = tokenFrom(mail.text);
  expect(mail.text).toContain('/lk/reset?token=');

  expect((await post(request, 'reset_confirm', { token, password: 'short' })).status()).toBe(422);
  expect((await post(request, 'reset_confirm', { token, password: 'Brand-new-pass-2' })).status()).toBe(200);
  expect((await post(request, 'reset_confirm', { token, password: 'Another-pass-3' })).status()).toBe(400);
  expect((await post(request, 'login', { email: 'anna@example.com', password: PASS })).status()).toBe(401);
  expect((await post(request, 'login', { email: 'anna@example.com', password: 'Brand-new-pass-2' })).status()).toBe(200);
});

test('сброс пароля для неизвестной почты: тот же ответ, писем нет', async ({ request }) => {
  const res = await post(request, 'reset_request', { email: 'ghost@example.com' });
  expect(res.status()).toBe(200);
  await new Promise((r) => setTimeout(r, 800));
  expect(await listMail()).toHaveLength(0);
});

test('неверный и просроченный токен подтверждения → 400', async ({ request }) => {
  expect((await post(request, 'verify', { token: 'a'.repeat(64) })).status()).toBe(400);
  await post(request, 'register', reg());
  const token = tokenFrom((await waitForMail('anna@example.com')).text);
  sql('UPDATE users SET verify_expires = NOW() - INTERVAL 1 MINUTE');
  expect((await post(request, 'verify', { token })).status()).toBe(400);
});

test('SQL-инъекция в почте и имени сохраняется как текст, таблица жива', async ({ request }) => {
  const evil = "x'; DROP TABLE users;--";
  expect((await post(request, 'login', { email: evil, password: 'whatever-1' })).status()).toBe(401);
  expect((await post(request, 'register', reg({ first_name: evil }))).status()).toBe(201);
  expect(sql('SELECT first_name FROM users')).toBe(evil);
});

test('GET на действия записи → 405; неизвестное действие → 404', async ({ request }) => {
  expect((await request.get(`${API}?action=login`, { headers: HTTPS })).status()).toBe(405);
  expect((await request.get(`${API}?action=nothing`, { headers: HTTPS })).status()).toBe(404);
});
