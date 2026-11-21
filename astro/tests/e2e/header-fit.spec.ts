// Шапка-заставка (Header.astro) целиком видна на невысоких окнах: заголовок, фото, «Ёжик» и подпись внутри блока.
// Баг: height: 100vh + центрирование + overflow: hidden — в окне ниже ~700px содержимое выходило за верхний
// и нижний края и обрезалось: пропадал заголовок «Мир За Сценой», подпись резалась навигацией.
// Гоняется в Chromium и в WebKit (проект safari).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Заставка ~4 с выезжает на место (about-producer: translateY(40px) → 0). Меряем итоговую раскладку,
// а не кадр анимации: смещение transform снимаем.
async function settle(page: Page) {
  await page.locator('.header h1').waitFor();
  await page.addStyleTag({ content: '.header .about-producer { transform: none !important; transition: none !important; }' });
}

const VIEWPORTS = [
  { width: 1000, height: 450 },
  { width: 1000, height: 560 },
  { width: 1280, height: 600 },
  { width: 1366, height: 680 },
  { width: 1440, height: 780 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const viewport of VIEWPORTS) {
  test(`шапка целиком в блоке: ${viewport.width}×${viewport.height}`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'телефон — отдельный тест ниже');
    await page.setViewportSize(viewport);
    await page.goto('/');
    await settle(page);

    const m = await page.evaluate(() => {
      const header = document.querySelector('.header')!.getBoundingClientRect();
      const title = document.querySelector('.header h1')!.getBoundingClientRect();
      const frame = document.querySelector('.producer-frame')!.getBoundingClientRect();
      const quote = document.querySelector('.about-producer blockquote')!.getBoundingClientRect();
      return {
        titleAbove: header.top - title.top, // >0: заголовок вылез за верх шапки
        frameAbove: header.top - frame.top,
        quoteBelow: quote.bottom - header.bottom, // >0: подпись вылезла за низ шапки
        headerH: header.height,
      };
    });

    expect.soft(m.titleAbove, 'заголовок за верхним краем шапки').toBeLessThanOrEqual(1);
    expect.soft(m.frameAbove, 'фото за верхним краем шапки').toBeLessThanOrEqual(1);
    expect.soft(m.quoteBelow, 'подпись за нижним краем шапки').toBeLessThanOrEqual(1);
    // на высоких окнах шапка по-прежнему занимает экран, а не сжимается
    expect(m.headerH).toBeGreaterThanOrEqual(Math.min(viewport.height, 700) - 1);
  });
}

test('телефон: шапка целиком в блоке', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.goto('/');
  await settle(page);
  const m = await page.evaluate(() => {
    const header = document.querySelector('.header')!.getBoundingClientRect();
    const title = document.querySelector('.header h1')!.getBoundingClientRect();
    const quote = document.querySelector('.about-producer blockquote')!.getBoundingClientRect();
    return { titleAbove: header.top - title.top, quoteBelow: quote.bottom - header.bottom };
  });
  expect(m.titleAbove).toBeLessThanOrEqual(1);
  expect(m.quoteBelow).toBeLessThanOrEqual(1);
});
