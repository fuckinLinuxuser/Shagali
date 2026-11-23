// Задача 3.2/5.4: smoke-скрипт (scripts/smoke.mjs) против стенда — ключевые страницы 200, закрытое закрыто, honeypot ничего не пишет.
// Тот же скрипт запускается против прода: npm run smoke -- https://shagali.ru
import { expect, test } from './fixtures';
import { count } from './db';

test('smoke против стенда: ни одной проблемы', async ({ baseURL }) => {
  const { smoke } = await import('../../scripts/smoke.mjs');
  const report = await smoke(baseURL!);
  expect(report.failures, report.failures.join('\n')).toEqual([]);
  expect(report.checks).toBeGreaterThan(15);
});

test('smoke ловит проблему: страница, которой нет, и открытый служебный адрес', async () => {
  const { smoke } = await import('../../scripts/smoke.mjs');
  const report = await smoke('http://localhost:1'); // ничего не слушает
  expect(report.failures.length).toBeGreaterThan(5);
});

test('honeypot-проверка smoke не оставляет заявок в БД', async ({ baseURL }) => {
  const { smoke } = await import('../../scripts/smoke.mjs');
  const before = count('waitlist') + count('feedback');
  await smoke(baseURL!);
  expect(count('waitlist') + count('feedback')).toBe(before);
});
