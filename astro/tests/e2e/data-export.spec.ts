// Задача 4.5: выгрузка заявок (лист ожидания, обратная связь, пользователи) в CSV — только для админа.
// Админ входит так же, как в /admin: POST /api.php?action=login (пароль стенда — docker/init-config.sh).
import { expect, test } from './fixtures';
import { sql } from './db';

const EXPORT = '/api/admin-export.php';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => {
  sql('TRUNCATE waitlist; TRUNCATE feedback');
  sql(`INSERT INTO waitlist (name, email, city, project, consent_at, consent_version)
       VALUES ('Анна', 'anna@example.com', 'Тюмень', 'Кукушонок', NOW(), '2026-11-draft'),
              ('=HYPERLINK("http://evil")', 'x@example.com', NULL, NULL, NOW(), '2026-11-draft'),
              ('Имя, с запятой и "кавычками"', 'y@example.com', NULL, NULL, NOW(), '2026-11-draft')`);
});

const adminLogin = (request: import('@playwright/test').APIRequestContext) =>
  request.post('/api.php?action=login', { data: { password: 'local-admin-pw' } });

test('без сессии админа → 401, данных нет', async ({ request }) => {
  const res = await request.get(`${EXPORT}?type=waitlist`);
  expect(res.status()).toBe(401);
  expect(await res.text()).not.toContain('anna@example.com');
});

test('админ: CSV листа ожидания с заголовками, UTF-8 BOM для Excel и скачиванием', async ({ request }) => {
  expect((await adminLogin(request)).status()).toBe(200);
  const res = await request.get(`${EXPORT}?type=waitlist`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  expect(res.headers()['content-disposition']).toMatch(/attachment; filename="waitlist-\d{4}-\d{2}-\d{2}\.csv"/);
  const text = await res.text();
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).trim().split('\r\n');
  expect(lines[0]).toBe('id;name;email;city;project;consent_at;consent_version;created_at');
  expect(lines.some((l) => l.includes('Анна;anna@example.com;Тюмень;Кукушонок'))).toBe(true);
});

test('CSV безопасен: формулы (=, +, -, @) экранируются, запятые и кавычки — по правилам CSV', async ({ request }) => {
  await adminLogin(request);
  const text = await (await request.get(`${EXPORT}?type=waitlist`)).text();
  expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`);
  expect(text).toContain(`"Имя, с запятой и ""кавычками"""`);
});

test('неизвестный тип → 400; POST → 405', async ({ request }) => {
  await adminLogin(request);
  expect((await request.get(`${EXPORT}?type=passwords`)).status()).toBe(400);
  expect((await request.post(`${EXPORT}?type=waitlist`, { data: {} })).status()).toBe(405);
});
