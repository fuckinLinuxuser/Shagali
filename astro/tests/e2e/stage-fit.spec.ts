// Слайдер спектаклей и шапка целиком видны на невысоких окнах и в Safari (WebKit): дата, заголовок, цитата и кнопки
// внутри своего блока. Раньше aspect-ratio вместе с max-height в Safari растягивал слайд, а блок обрезался по высоте окна.
// Гоняется в Chromium (mobile, desktop) и в WebKit (проект safari).
import { expect, test } from './fixtures';

const VIEWPORTS = [
  { width: 1000, height: 450 },
  { width: 1280, height: 600 },
  { width: 1366, height: 680 },
  { width: 1440, height: 780 },
  { width: 1920, height: 1080 },
];

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const stageEl = document.querySelector('[data-stage]') as HTMLElement;
    const slides = [...document.querySelectorAll('[data-stage-slide]')] as HTMLElement[];
    const initial = slides.map((s) => s.hidden);
    const result = slides.map((el, index) => {
      slides.forEach((s, j) => (s.hidden = j !== index)); // показываем по одному слайду
      const stage = stageEl.getBoundingClientRect();
      const inside = (sel: string) => {
        const node = el.querySelector(sel);
        if (!node) return 0;
        const r = node.getBoundingClientRect();
        return Math.max(stage.top - r.top, r.bottom - stage.bottom, stage.left - r.left, r.right - stage.right);
      };
      return {
        title: el.querySelector('h2')!.textContent!.trim(),
        h2: inside('h2'),
        quote: inside('.quote'),
        actions: inside('.actions'),
        date: inside('[data-stage-date]'),
      };
    });
    slides.forEach((s, j) => (s.hidden = initial[j]));
    return result;
  });
}

for (const viewport of VIEWPORTS) {
  test(`слайдер целиком в блоке: ${viewport.width}×${viewport.height}`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'телефон — отдельный тест ниже');
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('[data-stage-slide]').first().waitFor();
    for (const s of await measure(page)) {
      for (const key of ['h2', 'quote', 'actions', 'date'] as const) {
        expect.soft(s[key], `${s.title}: ${key} вылезает за блок`).toBeLessThanOrEqual(1);
      }
    }
  });
}

test('телефон: слайдер целиком в блоке', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.goto('/');
  await page.locator('[data-stage-slide]').first().waitFor();
  for (const s of await measure(page)) {
    for (const key of ['h2', 'quote', 'actions', 'date'] as const) {
      expect.soft(s[key], `${s.title}: ${key} вылезает за блок`).toBeLessThanOrEqual(1);
    }
  }
});

test('горизонтальной прокрутки нет на всех размерах', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-stage-slide]').first().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
