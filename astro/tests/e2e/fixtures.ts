// e2e не должны зависеть от внешнего интернета: шрифты Google, карта и скрипты третьих сторон
// иногда подвисают, а страница ждёт событие load. Чужие домены отрезаем — проверяем только наш сайт.
import { expect, test as base } from '@playwright/test';

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const own = new URL(baseURL!).origin;
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === own ? route.continue() : route.abort(),
    );
    await use(context);
  },
});

export { expect };
