import { expect, test } from '@playwright/test';

// Скриншот-база главной: страховка для 1.2 (перевод слайдера, карты, таймлайна на данные)
// и 0.3 (чистка). Снимки — только из Linux-контейнера Playwright той же версии, что в CI:
//   npm run test:visual            — сверить
//   npm run test:visual:update     — переснять (см. scripts/visual.sh)
// Снимки с macOS в репозиторий не кладём: они не совпадут с CI.

// Главная живёт на таймерах: занавес через 350 мс, фраза через 2,1 с, видео через 2,65 с,
// слайдер листается каждые 5 с. Часы замораживаем и проматываем на 4 с: всё уже открылось,
// а слайдер ещё стоит на первом слайде — его содержимое попадает в сравнение.
const SETTLE_MS = 4000;

// Внешние ресурсы отрезаем: шрифты Google, счётчики и скрипт cbiletom грузятся с переменной
// скоростью и делали бы снимки нестабильными. Страница рисуется резервными шрифтами — всегда одинаково.
const OWN_ORIGIN_ONLY = (url: URL, base: string) => url.origin === new URL(base).origin;

test.describe('визуальная база', () => {
  // Только из контейнера (scripts/visual.sh ставит PW_VISUAL=1): обычный test:e2e на Mac и на раннере
  // CI рендерит иначе и сверять с базой не должен.
  test.skip(process.env.PW_VISUAL !== '1', 'скриншоты сверяются только в контейнере: npm run test:visual');

  test('главная', async ({ page, baseURL }) => {
    // плашка cookie в эталон не попадает: выбор уже сделан
    await page.context().addCookies([{ name: 'shagali_cookie_consent', value: 'v1:declined', url: baseURL! }]);
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return OWN_ORIGIN_ONLY(url, baseURL!) ? route.continue() : route.abort();
    });
    // install() сам время не останавливает — без pauseAt слайдер успевает перелистнуться между снимками.
    const START = new Date('2026-11-17T12:00:00+03:00').getTime();
    await page.clock.install({ time: START });
    await page.clock.pauseAt(START + 1000);

    await page.goto('/', { waitUntil: 'load' });
    await page.clock.runFor(SETTLE_MS);
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('home.png', {
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      // видео не грузится на стенде (videos/ только на сервере), но кадр плеера зависит от движка
      mask: [page.locator('video')],
      maxDiffPixelRatio: 0.002,
    });
  });
});
