// Задача 4.3: админ выдаёт агентские коды и вносит число использований прямо в /admin; там же — выгрузки CSV.
import { expect, test } from './fixtures';
import { sql } from './db';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => {
  sql('TRUNCATE users; TRUNCATE agent_codes; TRUNCATE waitlist');
  sql(`INSERT INTO users (email, password_hash, last_name, first_name, city, phone, email_verified_at, consent_at, consent_version)
       VALUES ('agent@example.com', 'x', 'Агентова', 'Ася', 'Тюмень', '79001112233', NOW(), NOW(), 'v')`);
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin');
  await page.getByPlaceholder('••••••••').fill('local-admin-pw');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('#adminPanel')).toBeVisible();
}

test('вход админа показывает блок «Агентские коды» и ссылки на выгрузки CSV', async ({ page }) => {
  await login(page);
  const block = page.locator('#agentsSection');
  await expect(block).toBeVisible();
  for (const type of ['waitlist', 'feedback', 'users']) {
    await expect(block.locator(`a[href="/api/admin-export.php?type=${type}"]`)).toHaveCount(1);
  }
});

test('выдать код по почте и внести число использований: 9 → без доступа, 10 → с доступом', async ({ page }) => {
  await login(page);
  const block = page.locator('#agentsSection');
  await block.getByLabel('Почта пользователя').fill('agent@example.com');
  await block.getByRole('button', { name: 'Выдать код' }).click();
  const row = block.locator('tbody tr', { hasText: 'agent@example.com' });
  await expect(row).toBeVisible();
  const code = sql('SELECT code FROM agent_codes');
  await expect(row).toContainText(code);

  await row.getByRole('spinbutton').fill('9');
  await row.getByRole('button', { name: 'Сохранить' }).click();
  await expect.poll(() => sql('SELECT uses FROM agent_codes')).toBe('9');
  await row.getByRole('spinbutton').fill('10');
  await row.getByRole('button', { name: 'Сохранить' }).click();
  await expect.poll(() => sql('SELECT uses FROM agent_codes')).toBe('10');
});

test('ошибки показываются: неизвестная почта, повторная выдача', async ({ page }) => {
  await login(page);
  const block = page.locator('#agentsSection');
  await block.getByLabel('Почта пользователя').fill('nobody@example.com');
  await block.getByRole('button', { name: 'Выдать код' }).click();
  await expect(block.locator('[data-agents-status]')).toContainText('не найден');
  await block.getByLabel('Почта пользователя').fill('agent@example.com');
  await block.getByRole('button', { name: 'Выдать код' }).click();
  await expect(block.locator('[data-agents-status]')).toContainText('Код выдан');
  await block.getByLabel('Почта пользователя').fill('agent@example.com');
  await block.getByRole('button', { name: 'Выдать код' }).click();
  await expect(block.locator('[data-agents-status]')).toContainText('уже есть код');
});
