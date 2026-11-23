// Задача 2.1: API форм /api/forms.php — лист ожидания и обратная связь. Против docker-стенда (PHP + MySQL).
// Тесты делят одну БД и лимит по IP, поэтому идут по очереди и только в одном проекте.
import { expect, test } from './fixtures';
import { count, sql } from './db';

const URL = '/api/forms.php';
const valid = (extra: Record<string, unknown> = {}) => ({
  type: 'waitlist',
  name: 'Тест Тестович',
  email: 'test@example.com',
  city: 'Тестоград',
  project: 'Мамочка, купи собаку!',
  consent: true,
  website: '',
  filled_ms: 10_000,
  ...extra,
});

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'общая БД: гоняем один раз');
  sql('TRUNCATE waitlist; TRUNCATE feedback; TRUNCATE rate_limit');
});

test('валидная заявка в лист ожидания → 201 и строка в БД с согласием', async ({ request }) => {
  const res = await request.post(URL, { data: valid() });
  expect(res.status()).toBe(201);
  expect(await res.json()).toMatchObject({ ok: true });
  expect(count('waitlist')).toBe(1);
  expect(sql('SELECT name, email, city FROM waitlist')).toBe('Тест Тестович\ttest@example.com\tТестоград');
  expect(sql('SELECT consent_at IS NOT NULL, consent_version <> "" FROM waitlist')).toBe('1\t1');
});

test('обратная связь → 201 и строка в feedback', async ({ request }) => {
  const res = await request.post(URL, { data: valid({ type: 'feedback', message: 'Отличный спектакль' }) });
  expect(res.status()).toBe(201);
  expect(count('feedback')).toBe(1);
  expect(sql('SELECT message FROM feedback')).toBe('Отличный спектакль');
  expect(count('waitlist')).toBe(0);
});

test('без согласия → 422, в БД ничего', async ({ request }) => {
  const res = await request.post(URL, { data: valid({ consent: false }) });
  expect(res.status()).toBe(422);
  expect((await res.json()).errors).toHaveProperty('consent');
  expect(count('waitlist')).toBe(0);
});

test('плохой email, пустое имя, неизвестный тип → 422', async ({ request }) => {
  expect((await request.post(URL, { data: valid({ email: 'не-почта' }) })).status()).toBe(422);
  expect((await request.post(URL, { data: valid({ name: '  ' }) })).status()).toBe(422);
  expect((await request.post(URL, { data: valid({ type: 'drop' }) })).status()).toBe(422);
  expect(count('waitlist')).toBe(0);
});

test('заполнено за секунду (меньше минимума) → 422, в БД ничего', async ({ request }) => {
  const res = await request.post(URL, { data: valid({ filled_ms: 500 }) });
  expect(res.status()).toBe(422);
  expect(count('waitlist')).toBe(0);
});

test('заполнен honeypot → 200, в БД ничего', async ({ request }) => {
  const res = await request.post(URL, { data: valid({ website: 'http://spam.example' }) });
  expect(res.status()).toBe(200);
  expect(count('waitlist')).toBe(0);
});

test('6-й запрос за минуту → 429', async ({ request }) => {
  for (let i = 1; i <= 5; i++) {
    const res = await request.post(URL, { data: valid({ email: `u${i}@example.com` }) });
    expect(res.status()).toBe(201);
  }
  const sixth = await request.post(URL, { data: valid({ email: 'u6@example.com' }) });
  expect(sixth.status()).toBe(429);
  expect(count('waitlist')).toBe(5);
});

test("'; DROP TABLE waitlist;-- в имени сохраняется как текст, таблица жива", async ({ request }) => {
  const evil = "'; DROP TABLE waitlist;--";
  const res = await request.post(URL, { data: valid({ name: evil }) });
  expect(res.status()).toBe(201);
  expect(sql('SELECT name FROM waitlist')).toBe(evil);
  expect(count('waitlist')).toBe(1);
});

test('GET отвечает 405, в БД ничего', async ({ request }) => {
  expect((await request.get(URL)).status()).toBe(405);
});

test('в IP-лимите хранится хеш, а не сам адрес', async ({ request }) => {
  await request.post(URL, { data: valid() });
  expect(sql('SELECT LENGTH(ip_hash) FROM rate_limit LIMIT 1')).toBe('64');
});

test('sql/ и служебные файлы закрыты из веба: 403', async ({ request }) => {
  for (const path of ['/sql/001_init.sql', '/sql/', '/api/_db.php', '/shagali-config.php']) {
    expect((await request.get(path)).status(), path).toBe(403);
  }
});
