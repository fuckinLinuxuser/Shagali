import { defineConfig, devices } from '@playwright/test';

const DB_SPECS = /(forms-(api|ui)|auth-(api|ui)|data-export)\.spec\.ts/;

// Против docker-стенда (docker compose up -d → :8080). Другой адрес — STAND_URL.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.STAND_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', testIgnore: DB_SPECS, use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'desktop', testIgnore: DB_SPECS, use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    // Тесты форм пишут в общую БД и лимит по IP — гоняем по очереди: сначала API, потом формы на телефоне (375px).
    { name: 'forms-api', testMatch: /forms-api\.spec\.ts/, use: { browserName: 'chromium' } },
    {
      name: 'forms-ui',
      testMatch: /forms-ui\.spec\.ts/,
      dependencies: ['forms-api'],
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
    // Вход и регистрация (БД, письма, лимиты): по очереди после форм.
    { name: 'auth-api', testMatch: /auth-api\.spec\.ts/, dependencies: ['forms-ui'], use: { browserName: 'chromium' } },
    {
      name: 'auth-ui',
      testMatch: /auth-ui\.spec\.ts/,
      dependencies: ['auth-api'],
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
    // Выгрузка заявок (CSV, админ): последней в цепочке — она чистит таблицы форм.
    { name: 'data-export', testMatch: /data-export\.spec\.ts/, dependencies: ['auth-ui'], use: { browserName: 'chromium' } },
    // Safari (WebKit) рендерит иначе: на Mac им открывают сайт чаще всего. Гоняем только проверки вёрстки (слайдер спектаклей).
    { name: 'safari', testMatch: /stage-fit\.spec\.ts/, use: { ...devices['Desktop Safari'] } },
  ],
});
