// Слайдер спектаклей на главной не обрезается на ноутбуках: заголовок и кнопки целиком внутри блока.
// Баг: aspect-ratio 16/9 + max-height 90vh в Safari (WebKit) растягивал слайд до 16/9 от ширины, а блок
// обрезался по max-height — кнопки оказывались за нижним краем. В Chromium то же ломало низкие окна (до ~650px):
// длинное описание выталкивало заголовок за верхний край. Тест гоняется в Chromium и в WebKit (проект safari).
import { expect, test } from './fixtures';

// Типичные окна браузера на MacBook (без панелей браузера) и большой монитор.
const LAPTOP_VIEWPORTS = [
  { width: 1280, height: 600 },
  { width: 1280, height: 650 },
  { width: 1366, height: 680 },
  { width: 1440, height: 780 },
  { width: 1512, height: 860 },
  { width: 1920, height: 1080 },
];

for (const viewport of LAPTOP_VIEWPORTS) {
  test(`слайдер целиком в блоке: ${viewport.width}×${viewport.height}`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'мобильную вёрстку слайдера проверяет mobile-часть ниже');
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('#projects .swiper-slide').first().waitFor();

    const slides = await page.evaluate(() => {
      const slider = document.querySelector('#projects')!.getBoundingClientRect();
      return [...document.querySelectorAll('#projects .swiper-slide')].map((slide) => {
        const s = slide.getBoundingClientRect();
        const info = slide.querySelector('.info-block')!.getBoundingClientRect();
        const buttons = slide.querySelector('.buttons-row')!.getBoundingClientRect();
        return {
          title: slide.querySelector('h2')!.textContent!.trim(),
          slideOverflow: s.height - slider.height, // слайд выше блока — часть слайда обрезана
          titleAbove: slider.top - info.top, // >0: заголовок вылез за верхний край
          buttonsBelow: buttons.bottom - slider.bottom, // >0: кнопки вылезли за нижний край
        };
      });
    });

    expect(slides.length).toBeGreaterThan(0);
    for (const s of slides) {
      expect.soft(s.slideOverflow, `${s.title}: слайд выше блока`).toBeLessThanOrEqual(1);
      expect.soft(s.titleAbove, `${s.title}: заголовок за верхним краем`).toBeLessThanOrEqual(0);
      expect.soft(s.buttonsBelow, `${s.title}: кнопки за нижним краем`).toBeLessThanOrEqual(0);
    }
  });
}

test('на ноутбуке кнопки слайда видны в окне при прокрутке к блоку', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto('/');
  const first = page.locator('#projects .swiper-slide-active .buttons-row .tickets-btn, #projects .swiper-slide .buttons-row .tickets-btn').first();
  await first.scrollIntoViewIfNeeded();
  await expect(first).toBeInViewport({ ratio: 1 });
});

test('телефон: слайд целиком в блоке', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.goto('/');
  await page.locator('#projects .swiper-slide').first().waitFor();
  const m = await page.evaluate(() => {
    const slider = document.querySelector('#projects')!.getBoundingClientRect();
    const slide = document.querySelector('#projects .swiper-slide')!;
    const buttons = slide.querySelector('.buttons-row')!.getBoundingClientRect();
    return { slideOverflow: slide.getBoundingClientRect().height - slider.height, buttonsBelow: buttons.bottom - slider.bottom };
  });
  expect(m.slideOverflow).toBeLessThanOrEqual(1);
  expect(m.buttonsBelow).toBeLessThanOrEqual(0);
});
