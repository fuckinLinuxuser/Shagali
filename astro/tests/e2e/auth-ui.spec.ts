// Задача 3.3: страницы кабинета на телефоне (375px): регистрация → письмо → подтверждение → вход → профиль → выход.
// Письма — mailpit на стенде. Общая БД: после auth-api.
import { expect, test } from './fixtures';
import { sql } from './db';
import { clearMail, tokenFrom, waitForMail } from './mail';
import { watch } from './helpers';

const EMAIL = 'boris@example.com';
const PASS = 'Correct-horse-1';
const XSS = '<script>window.__xss=1</script>';

test.describe.configure({ mode: 'serial' });
test.beforeEach(async () => {
  sql('TRUNCATE users; TRUNCATE login_attempts; TRUNCATE rate_limit');
  await clearMail();
});

async function fillRegister(page: import('@playwright/test').Page, firstName = 'Борис') {
  await page.goto('/lk/register');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel(/^Пароль/).fill(PASS);
  await page.getByLabel('Фамилия').fill('Тестов');
  await page.getByLabel('Имя').fill(firstName);
  await page.getByLabel('Город').fill('Тестоград');
  await page.getByLabel('Телефон').fill('8 900 123 45 67');
  await page.getByLabel(/Я согласен/).check();
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page.locator('[data-form-success]')).toBeVisible();
}

test('полный путь: регистрация → письмо → подтверждение → вход → профиль → выход', async ({ page }) => {
  const errors = watch(page);
  await fillRegister(page);

  const mail = await waitForMail(EMAIL);
  await page.goto(`/lk/verify?token=${tokenFrom(mail.text)}`);
  await expect(page.locator('[data-verify-status]')).toContainText('Почта подтверждена');

  await page.goto('/lk/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Пароль').fill(PASS);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/lk\/?$/);
  await expect(page.locator('[data-p="name"]')).toHaveText('Борис Тестов');
  await expect(page.locator('[data-p="phone"]')).toHaveText('79001234567');
  await expect(page.locator('[data-promo-text]')).toHaveText('Ваш промокод: STAND12');

  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/lk\/login/);
  await page.goto('/lk');
  await expect(page).toHaveURL(/\/lk\/login/); // без сессии кабинет не открывается
  expect(errors).toEqual([]);
});

test('<script> в имени выводится текстом и не исполняется', async ({ page }) => {
  await fillRegister(page, XSS);
  await page.goto(`/lk/verify?token=${tokenFrom((await waitForMail(EMAIL)).text)}`);
  await expect(page.locator('[data-verify-status]')).toContainText('Почта подтверждена');
  await page.goto('/lk/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Пароль').fill(PASS);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('[data-p="name"]')).toHaveText(`${XSS} Тестов`);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.locator('[data-profile] script')).toHaveCount(0);
});

test('неверный пароль и неподтверждённая почта — понятные сообщения', async ({ page }) => {
  await fillRegister(page);
  await page.goto('/lk/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Пароль').fill(PASS);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('[data-form-error]')).toContainText('Подтвердите почту');

  await page.getByLabel('Пароль').fill('wrong-pass-9');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('[data-form-error]')).toContainText('Неверная почта или пароль');
});

test('сброс пароля со страницы: письмо → новый пароль → вход', async ({ page }) => {
  await fillRegister(page);
  await page.goto(`/lk/verify?token=${tokenFrom((await waitForMail(EMAIL)).text)}`);
  await expect(page.locator('[data-verify-status]')).toContainText('Почта подтверждена');
  await clearMail();

  await page.goto('/lk/reset');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByRole('button', { name: 'Отправить ссылку' }).click();
  await expect(page.locator('[data-form-success]').first()).toBeVisible();

  const token = tokenFrom((await waitForMail(EMAIL)).text);
  await page.goto(`/lk/reset?token=${token}`);
  await page.getByLabel(/Новый пароль/).fill('Brand-new-pass-2');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await expect(page.locator('#reset-confirm-form [data-form-success]')).toBeVisible();

  await page.goto('/lk/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Пароль').fill('Brand-new-pass-2');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('[data-p="name"]')).toHaveText('Борис Тестов');
});

test('страницы кабинета: без горизонтальной прокрутки на 375px, закрыты от индексации, нет в sitemap', async ({ page, request }) => {
  for (const path of ['/lk/register', '/lk/login', '/lk/reset', '/lk/verify']) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  const index = await (await request.get('/sitemap-index.xml')).text();
  for (const m of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    expect(await (await request.get(new URL(m[1]).pathname)).text()).not.toContain('/lk');
  }
});

test('профиль: «Удалить аккаунт» с паролем удаляет данные и ведёт на регистрацию', async ({ page }) => {
  await fillRegister(page);
  await page.goto(`/lk/verify?token=${tokenFrom((await waitForMail(EMAIL)).text)}`);
  await expect(page.locator('[data-verify-status]')).toContainText('Почта подтверждена');
  await page.goto('/lk/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Пароль').fill(PASS);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('[data-p="name"]')).toHaveText('Борис Тестов');

  await page.getByText('Удалить аккаунт', { exact: true }).click();
  await page.getByLabel('Пароль для подтверждения').fill('wrong-pass-9');
  await page.getByRole('button', { name: 'Удалить аккаунт навсегда' }).click();
  await expect(page.locator('#delete-form [data-form-error]')).toContainText('Неверный пароль');
  expect(sql('SELECT COUNT(*) FROM users')).toBe('1');

  await page.getByLabel('Пароль для подтверждения').fill(PASS);
  await page.getByRole('button', { name: 'Удалить аккаунт навсегда' }).click();
  await expect(page).toHaveURL(/\/lk\/register/);
  expect(sql('SELECT COUNT(*) FROM users')).toBe('0');
});

test('профиль: не хватает данных — промокод скрыт, подсказка называет поле; после сохранения код виден', async ({ page }) => {
  await fillRegister(page);
  await page.goto(`/lk/verify?token=${tokenFrom((await waitForMail(EMAIL)).text)}`);
  await expect(page.locator('[data-verify-status]')).toContainText('Почта подтверждена');
  sql("UPDATE users SET city = ''");
  await page.goto('/lk/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Пароль').fill(PASS);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('[data-promo-text]')).toContainText('укажите город');
  await expect(page.locator('[data-promo-text]')).not.toContainText('STAND12');

  await page.getByLabel('Город').fill('Тюмень');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.locator('[data-promo-text]')).toHaveText('Ваш промокод: STAND12');
  await expect(page.locator('[data-p="city"]')).toHaveText('Тюмень');
});
