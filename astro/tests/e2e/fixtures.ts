// e2e не должны зависеть от внешнего интернета: шрифты Google, карта и скрипты третьих сторон
// иногда подвисают, а страница ждёт событие load. Чужие домены отрезаем — проверяем только наш сайт.
import { expect, test as base } from '@playwright/test';

// Выбор в cookie-плашке: по умолчанию «отклонено» — плашка не мешает кликам и не попадает в кадры,
// а счётчики не грузятся. Тесты самой плашки ставят consent: 'none' (первый визит) или 'accepted'.
export type Consent = 'none' | 'declined' | 'accepted';
export const CONSENT_COOKIE = 'shagali_cookie_consent';

export const test = base.extend<{ consent: Consent }>({
  consent: ['declined', { option: true }],
  context: async ({ context, baseURL, consent }, use) => {
    const own = new URL(baseURL!).origin;
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === own ? route.continue() : route.abort(),
    );
    if (consent !== 'none') {
      await context.addCookies([{ name: CONSENT_COOKIE, value: `v1:${consent}`, url: baseURL! }]);
    }
    await use(context);
  },
});

export { expect };
