// Задача 5.3: ежедневный дамп БД (api/_backup.php, запускается планировщиком reg.ru).
// Проверяем главное: дамп восстанавливается в чистую базу, и данные в ней те же. Общая БД — идёт в конце цепочки.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';
import { count, sql } from './db';

const COMPOSE = fileURLToPath(new URL('../../../docker-compose.yml', import.meta.url));
const DIR = '/tmp/shagali-backups';
const compose = (service: string, args: string[], input?: string) =>
  execFileSync('docker', ['compose', '-f', COMPOSE, 'exec', '-T', ...(service === 'db' ? ['-e', 'MYSQL_PWD=local-root-only'] : []), service, ...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
const runBackup = () => compose('web', ['php', '/var/www/html/api/_backup.php']).trim();

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => {
  compose('web', ['sh', '-c', `rm -rf ${DIR}`]);
  sql('TRUNCATE users; TRUNCATE waitlist; TRUNCATE feedback; TRUNCATE agent_codes');
  sql(`INSERT INTO users (email, password_hash, last_name, first_name, city, phone, email_verified_at, consent_at, consent_version)
       VALUES ('backup@example.com', '$2y$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'Бэкапова', "О'Брайен \\\\ слэш", 'Тюмень', '79001112233', NOW(), NOW(), 'v1')`);
  sql("INSERT INTO waitlist (name, email, city, consent_at, consent_version) VALUES ('Анна', 'a@example.com', NULL, NOW(), 'v1'), ('Борис', 'b@example.com', 'Омск', NOW(), 'v1')");
});

test.afterAll(() => {
  sql('DROP DATABASE IF EXISTS shagali_restore');
});

test('дамп создаётся: файл .sql.gz с правами 600, внутри схема и данные', async () => {
  const file = runBackup();
  expect(file).toMatch(new RegExp(`^${DIR}/shagali-\\d{8}-\\d{6}\\.sql\\.gz$`));
  expect(compose('web', ['sh', '-c', `stat -c %a ${file}`]).trim()).toBe('600');
  const text = compose('web', ['sh', '-c', `gunzip -c ${file}`]);
  expect(text).toContain('CREATE TABLE `users`');
  expect(text).toContain('CREATE TABLE `waitlist`');
  expect(text).toContain('backup@example.com');
});

test('дамп восстанавливается в чистую базу, данные совпадают (в т.ч. NULL, кавычки, обратный слэш, кириллица)', async () => {
  const file = runBackup();
  const dump = compose('web', ['sh', '-c', `gunzip -c ${file}`]);
  compose('db', ['mysql', '-uroot', '-e', 'DROP DATABASE IF EXISTS shagali_restore; CREATE DATABASE shagali_restore CHARACTER SET utf8mb4']);
  compose('db', ['mysql', '-uroot', '--default-character-set=utf8mb4', 'shagali_restore'], dump);

  const q = (query: string) => compose('db', ['mysql', '-uroot', '--default-character-set=utf8mb4', 'shagali_restore', '-N', '-B', '-e', query]).trim();
  expect(q('SELECT COUNT(*) FROM users')).toBe('1');
  expect(q('SELECT COUNT(*) FROM waitlist')).toBe('2');
  expect(q('SELECT first_name FROM users')).toBe(sql('SELECT first_name FROM users'));
  expect(q("SELECT city IS NULL FROM waitlist WHERE name = 'Анна'")).toBe('1');
  expect(q("SELECT city FROM waitlist WHERE name = 'Борис'")).toBe('Омск');
  expect(q('SELECT password_hash FROM users')).toBe(sql('SELECT password_hash FROM users'));
  expect(q('SELECT COUNT(*) FROM schema_migrations')).toBe(sql('SELECT COUNT(*) FROM schema_migrations'));
  expect(count('users')).toBe(1); // боевая база не тронута
});

test('ротация: старше 14 дней удаляется, свежие остаются', async () => {
  compose('web', ['sh', '-c', `mkdir -p ${DIR} && touch -d '30 days ago' ${DIR}/shagali-20000101-000000.sql.gz && touch ${DIR}/shagali-20991231-000000.sql.gz`]);
  runBackup();
  const left = compose('web', ['sh', '-c', `ls ${DIR}`]);
  expect(left).not.toContain('20000101');
  expect(left).toContain('20991231');
});

test('по HTTP скрипт дамп не отдаёт', async ({ request }) => {
  const res = await request.get('/api/_backup.php');
  expect(await res.text()).not.toContain('CREATE TABLE');
  expect(await res.text()).not.toContain('backup@example.com');
});
