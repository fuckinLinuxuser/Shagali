// Доступ к MySQL docker-стенда из e2e: проверяем, что API формы реально пишет (или не пишет) строки.
// Реквизиты — тестовые, только для локального стенда (см. docker-compose.yml).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COMPOSE = fileURLToPath(new URL('../../../docker-compose.yml', import.meta.url));

export function sql(query: string): string {
  return execFileSync(
    'docker',
    ['compose', '-f', COMPOSE, 'exec', '-T', '-e', 'MYSQL_PWD=local-root-only', 'db', 'mysql', '-uroot', '--default-character-set=utf8mb4', 'shagali', '-N', '-B', '-e', query],
    { encoding: 'utf8' },
  ).trim();
}

export const count = (table: string) => Number(sql(`SELECT COUNT(*) FROM ${table}`));
