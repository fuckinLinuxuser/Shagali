// Задача 2.2: формы на сайте — лист ожидания (/waitlist) и обратная связь (/feedback) поверх /api/forms.php.
// Проект forms-ui: телефон 375px, после forms-api (общая БД). Минимум заполнения — 3 с, поэтому тесты ждут.
import { expect, test } from './fixtures';
import { watch } from './helpers';
import { count, sql } from './db';

const FILL_WAIT_MS = 3200;

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => sql('TRUNCATE waitlist; TRUNCATE feedback; TRUNCATE rate_limit'));

test('лист ожидания со страницы города: город подставлен, заявка в БД с этим городом', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/goroda/test-gorod');
  await page.getByRole('link', { name: /лист ожидания/i }).first().click();
  await expect(page).toHaveURL(/\/waitlist\/?\?city=test-gorod/);
  await expect(page.getByLabel('Желаемый город')).toHaveValue('Тестоград');

  await page.getByLabel('Имя').fill('Анна Тестова');
  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByLabel(/Я согласен/).check();
  await page.waitForTimeout(FILL_WAIT_MS);
  await page.getByRole('button', { name: /Записаться/ }).click();

  await expect(page.locator('[data-form-success]')).toBeVisible();
  await expect(page.locator('[data-form-error]')).toBeHidden();
  expect(sql('SELECT name, email, city FROM waitlist')).toBe('Анна Тестова\tanna@example.com\tТестоград');
  expect(sql('SELECT consent_at IS NOT NULL FROM waitlist')).toBe('1');
  expect(errors).toEqual([]);
});

test('ошибка сервера: видно сообщение об ошибке, а не «Спасибо»', async ({ page }) => {
  await page.route('**/api/forms.php', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }),
  );
  await page.goto('/waitlist');
  await page.getByLabel('Имя').fill('Анна');
  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByLabel(/Я согласен/).check();
  await page.waitForTimeout(FILL_WAIT_MS);
  await page.getByRole('button', { name: /Записаться/ }).click();

  await expect(page.locator('[data-form-error]')).toBeVisible();
  await expect(page.locator('[data-form-success]')).toBeHidden();
  await expect(page.getByRole('button', { name: /Записаться/ })).toBeEnabled(); // можно повторить
});

test('нет сети: сообщение об ошибке, не «Спасибо»', async ({ page }) => {
  await page.route('**/api/forms.php', (route) => route.abort());
  await page.goto('/waitlist');
  await page.getByLabel('Имя').fill('Анна');
  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByLabel(/Я согласен/).check();
  await page.waitForTimeout(FILL_WAIT_MS);
  await page.getByRole('button', { name: /Записаться/ }).click();
  await expect(page.locator('[data-form-error]')).toBeVisible();
  await expect(page.locator('[data-form-success]')).toBeHidden();
});

for (const path of ['/waitlist', '/feedback']) {
  test(`${path}: без галочки согласия форма не отправляется (запроса нет)`, async ({ page }) => {
    let requests = 0;
    await page.route('**/api/forms.php', (route) => {
      requests += 1;
      return route.abort();
    });
    await page.goto(path);
    await page.getByLabel('Имя').fill('Анна');
    await page.getByLabel('Email').fill('anna@example.com');
    if (path === '/feedback') await page.getByLabel('Сообщение').fill('Здравствуйте');
    await page.waitForTimeout(FILL_WAIT_MS);
    await page.locator('form button[type="submit"]').click();
    expect(requests).toBe(0);
    expect(count('waitlist') + count('feedback')).toBe(0);
  });

  test(`${path}: у согласия есть ссылки на /consent и /privacy`, async ({ page }) => {
    await page.goto(path);
    const consent = page.locator('.form-consent');
    await expect(consent.locator('a[href="/consent"]')).toHaveCount(1);
    await expect(consent.locator('a[href="/privacy"]')).toHaveCount(1);
  });
}

test('обратная связь: сообщение уходит в БД, город из ссылки подставлен', async ({ page }) => {
  await page.goto('/feedback?city=test-gorod');
  await expect(page.getByLabel('Город')).toHaveValue('Тестоград');
  await page.getByLabel('Имя').fill('Борис');
  await page.getByLabel('Email').fill('boris@example.com');
  await page.getByLabel('Сообщение').fill('Когда будут новые даты?');
  await page.getByLabel(/Я согласен/).check();
  await page.waitForTimeout(FILL_WAIT_MS);
  await page.getByRole('button', { name: /Отправить/ }).click();
  await expect(page.locator('[data-form-success]')).toBeVisible();
  expect(sql('SELECT name, city, message FROM feedback')).toBe('Борис\tТестоград\tКогда будут новые даты?');
});

test('слишком быстро: сервер отклонил — пользователь видит понятную ошибку', async ({ page }) => {
  await page.goto('/waitlist');
  await page.getByLabel('Имя').fill('Анна');
  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByLabel(/Я согласен/).check();
  await page.getByRole('button', { name: /Записаться/ }).click();
  await expect(page.locator('[data-form-error]')).toBeVisible();
  expect(count('waitlist')).toBe(0);
});

test('на 375px нет горизонтальной прокрутки', async ({ page }) => {
  for (const path of ['/waitlist', '/feedback']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
