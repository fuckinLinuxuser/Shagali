// /api/health.php — диагностика настройки сервера: на каком шаге ломается (конфиг, блок db, подключение, таблицы, ключи).
// Отдаёт только булевы значения и категорию ошибки подключения — ни путей, ни логинов, ни текстов исключений.
import { expect, test } from './fixtures';

test('health: на настроенном стенде всё true, значений секретов в ответе нет', async ({ request }) => {
  const res = await request.get('/api/health.php');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('no-store');
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, config_file: true, db_config: true, db_connect: true, db_error: null });
  for (const t of ['schema_migrations', 'waitlist', 'feedback', 'rate_limit', 'users', 'login_attempts', 'agent_codes']) {
    expect(body.tables[t], t).toBe(true);
  }
  expect(body.keys).toMatchObject({ rate_salt: true, site_url: true, mail_from: true, notify_email: false, gate_password_hash: true });
  const text = JSON.stringify(body);
  for (const secret of ['local-root-only', 'local-stand-salt', 'root', 'mysql:host']) expect(text).not.toContain(secret);
});

test('health: только GET', async ({ request }) => {
  expect((await request.post('/api/health.php', { data: {} })).status()).toBe(405);
});
