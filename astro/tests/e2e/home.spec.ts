// Главная в новом дизайне: шапка с кулисами, слайдер спектаклей, «Афиша», «Гастроли», «Люди», подвал.
// Стенд — сборка с фикстурами (tests/fixtures/content): Тестоград — Кукушонок в продаже (событие 2717, 15.01.2099),
// «Мамочка, купи собаку» распродан, «Растворимый Индиго» скоро; Второй Тестоград — Папа Карло в продаже (01.04.2099).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';
import { watch } from './helpers';

const CONTENT = fileURLToPath(new URL('../../src/content', import.meta.url));
const load = <T,>(dir: string) =>
  readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(CONTENT, dir, f), 'utf8')) as T);

const SHOWS = load<{ id: string; title: string; order: number }>('shows').sort((a, b) => a.order - b.order);
const CITIES = load<{ id: string; name: string; visited?: boolean; map?: { x: number; y: number } }>('cities');
// Точка — у города с координатами, где были (visited) или есть показ в src/content (фикстуры стенда в src/content не лежат).
const PERFORMED = new Set(load<{ city: string }>('performances').map((p) => p.city));
const DOTS = CITIES.filter((c) => c.map && (c.visited || PERFORMED.has(c.id)));

test('блоки главной по порядку: слайдер → афиша → антракт → гастроли → люди → подвал', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/');
  const tops = await page.evaluate(() =>
    ['#stage', '#afisha', '[role="separator"]', '#gastroli', '#lyudi', '#contacts'].map((sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    }),
  );
  expect(tops.every((y) => y !== null)).toBe(true);
  for (let i = 1; i < tops.length; i++) expect(tops[i]!).toBeGreaterThan(tops[i - 1]!);
  await expect(page.getByRole('separator')).toContainText('Антракт');
  await expect(page.locator('#lyudi h1, #lyudi h2').first()).toContainText('Драйверы проекта');
  expect(errors).toEqual([]);
});

test('в дизайне нет заглушек: ни «ДД.ММ», ни «00+»', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('ДД.ММ');
  expect(text).not.toContain('00+');
});

test('скрытые блоки не выводятся', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#blog')).toHaveCount(0);
  await expect(page.locator('#collaboration-teaser')).toHaveCount(0);
  await expect(page.locator('.timeline-tours')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Пройденные спектакли' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Условия сотрудничества' })).toHaveCount(0);
});

test('гастроли: карта и кнопка листа ожидания на месте', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#gastroli')).toContainText('Гастроли и выступления');
  await expect(page.locator('#gastroli')).toContainText('План гастролей 2026–2027');
  await expect(page.locator('#gastroli .map-container svg')).toHaveCount(1);
  await expect(page.locator('#gastroli #openForm')).toHaveCount(1);
});

test('карта: ровно одна точка на город, где были или есть показы', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('.map-container svg a[href^="/goroda/"]');
  await expect(links).toHaveCount(DOTS.length);
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs.sort()).toEqual(DOTS.map((c) => `/goroda/${c.id}`).sort());
});

test('карта: каждая точка ведёт на существующую страницу города', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('.map-container svg a[href^="/goroda/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href') as string),
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    const city = CITIES.find((c) => `/goroda/${c.id}` === href)!;
    expect(await res.text(), href).toContain(city.name);
  }
});

test('карта: клик по точке открывает страницу города', async ({ page }) => {
  await page.goto('/');
  const dot = page.locator('.map-container svg a[href="/goroda/tyumen"] circle');
  await dot.scrollIntoViewIfNeeded();
  await dot.click({ force: true });
  await expect(page).toHaveURL(/\/goroda\/tyumen\/?$/);
  await expect(page.locator('h1')).toContainText('Тюмень');
});

test('/collaboration скрыта от поисковиков: noindex и нет в карте сайта', async ({ page, request }) => {
  const res = await page.goto('/collaboration');
  expect(res?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).not.toContain('/collaboration');
  expect(sitemap).toContain('/goroda');
});

// ───────────────────────── Шапка, меню, кулисы ─────────────────────────

const LINKS = ['/#afisha', '/#gastroli', '/#lyudi', '/#contacts'];

test('шапка: логотип и ссылки меню по дизайну; ссылки есть и в подвале', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.locator('header .logo')).toContainText('Мир за');
  await expect(page.locator('header .logo')).toContainText('Сценой');
  if (!isMobile) {
    const hrefs = await page.locator('header nav[aria-label="Основное"] a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs).toEqual(['/#gastroli', '/#lyudi', '/#contacts']);
    await expect(page.locator('header a[href="/#afisha"]').first()).toBeVisible(); // «Проекты» слева
  }
  await expect(page.locator('footer a[href="/#afisha"]')).toHaveCount(1);
});

test('меню по бургеру: открывается, содержит все ссылки, закрывается Esc и кнопкой, фокус возвращается', async ({ page, isMobile }) => {
  await page.goto('/');
  const burger = page.getByRole('button', { name: 'Меню', exact: true });
  const drawer = page.locator('[data-menu-drawer]');
  await expect(drawer).toBeHidden();
  await burger.click();
  await expect(drawer).toBeVisible();
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
  const hrefs = await drawer.locator('a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs).toEqual(LINKS);

  await drawer.getByRole('button', { name: 'Закрыть меню' }).click();
  await expect(drawer).toBeHidden();
  await expect(burger).toBeFocused();

  await burger.click();
  await expect(drawer).toBeVisible();
  if (!isMobile) {
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(burger).toBeFocused();
  }
});

test('пункт меню ведёт к блоку и закрывает меню', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.locator('[data-menu-drawer] a[href="/#gastroli"]').click();
  await expect(page.locator('[data-menu-drawer]')).toBeHidden();
  await expect(page).toHaveURL(/#gastroli$/);
});

test('кулисы: открываются при загрузке, не перекрывают шапку, «Занавес» проигрывает заново', async ({ page }) => {
  await page.goto('/');
  const root = page.locator('[data-curtain-root]');
  await expect(root).toHaveAttribute('data-curtain-state', 'open', { timeout: 6000 });

  const vw = page.viewportSize()!.width;
  // сложены у края, а не закрывают экран (ждём конец анимации раскрытия, около 2,8 с)
  await expect
    .poll(async () => (await page.locator('[data-curtain="left"]').boundingBox())!.width, { timeout: 6000 })
    .toBeLessThanOrEqual(vw * 0.25);
  await expect(page.locator('[data-curtain="left"]')).toHaveCSS('pointer-events', 'none');

  await page.getByRole('button', { name: 'Показать занавес ещё раз' }).click();
  await expect(root).toHaveAttribute('data-curtain-state', 'closed');
  await expect(root).toHaveAttribute('data-curtain-state', 'open', { timeout: 6000 });
});

test('кулисы: при prefers-reduced-motion без анимации, сразу сложены', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', baseURL });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-curtain-root]')).toHaveAttribute('data-curtain-state', 'open');
  const dur = await page.locator('[data-curtain="left"]').evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(['0s', '0.01ms', '1e-05s']).toContain(dur);
  await context.close();
});

test('без JS кулисы сложены, а контент доступен', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/');
  const left = await page.locator('[data-curtain="left"]').boundingBox();
  expect(left!.width).toBeLessThanOrEqual(page.viewportSize()!.width * 0.25);
  await expect(page.locator('[data-stage-slide]').first()).toBeVisible();
  await context.close();
});

// ───────────────────────── Слайдер спектаклей ─────────────────────────

test('слайдер: спектакли из коллекции shows в порядке order, виден один, счётчик «1 / N»', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/');
  const slides = page.locator('[data-stage-slide]');
  await expect(slides).toHaveCount(SHOWS.length);
  const titles = await slides.evaluateAll((els) => els.map((e) => e.querySelector('h2')!.textContent!.trim()));
  expect(titles).toEqual(SHOWS.map((s) => s.title));
  await expect(page.locator('[data-stage-slide]:not([hidden])')).toHaveCount(1);
  await expect(page.locator('[data-stage-counter]')).toHaveText(`1 / ${SHOWS.length}`);
  expect(errors).toEqual([]);
});

test('слайдер: стрелки листают по кругу, счётчик обновляется', async ({ page }) => {
  await page.goto('/');
  const next = page.getByRole('button', { name: 'Следующий спектакль' });
  const prev = page.getByRole('button', { name: 'Предыдущий спектакль' });
  const visibleTitle = () => page.locator('[data-stage-slide]:not([hidden]) h2').textContent();

  await next.click();
  expect((await visibleTitle())!.trim()).toBe(SHOWS[1].title);
  await expect(page.locator('[data-stage-counter]')).toHaveText(`2 / ${SHOWS.length}`);
  await prev.click();
  await prev.click(); // с первого — на последний
  expect((await visibleTitle())!.trim()).toBe(SHOWS[SHOWS.length - 1].title);
  await expect(page.locator('[data-stage-counter]')).toHaveText(`${SHOWS.length} / ${SHOWS.length}`);
  await next.click(); // с последнего — на первый
  expect((await visibleTitle())!.trim()).toBe(SHOWS[0].title);
});

test('слайдер: Кукушонок — город и дата ближайшего показа и «Купить»; остальные без покупки', async ({ page }) => {
  await page.goto('/');
  const kuk = page.locator('[data-stage-slide][data-slide-id="kukushonok"]');
  await expect(kuk.locator('[data-stage-kicker]')).toHaveText('Тестоград');
  await expect(kuk.locator('[data-stage-date]')).toHaveText('15.01');
  await expect(kuk.locator('[data-ticket-id]')).toHaveAttribute('data-ticket-id', '2717');
  await expect(kuk.locator('.ghost')).toHaveText('Кукушонок');

  for (const id of ['doggy', 'indigo']) {
    await expect(page.locator(`[data-stage-slide][data-slide-id="${id}"] [data-ticket-id]`)).toHaveCount(0);
  }
  // возрастного знака в данных нет — значит, нет и в разметке
  await expect(page.locator('[data-stage-slide] [data-age]')).toHaveCount(0);
});

// ───────────────────────── Афиша ─────────────────────────

test('афиша: карточки будущих показов по дате, без «Скоро»-заглушек', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('#afisha [data-afisha-card]');
  await expect(cards).toHaveCount(4); // 3 показа в Тестограде + 1 во Втором Тестограде
  const dates = await cards.locator('[data-card-date]').allTextContents();
  expect(dates.map((d) => d.trim())).toEqual(['15.01', '01.02', '01.03', '01.04']);
  await expect(page.locator('#afisha h1')).toHaveText('Афиша');
});

test('афиша: «Купить» только у показа в продаже и открывает модалку', async ({ page, context }) => {
  await context.route('https://cbiletom.ru/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>cbiletom</p>' }));
  await page.goto('/');
  const buy = page.locator('#afisha [data-afisha-card] [data-ticket-id]');
  await expect(buy).toHaveCount(2); // Кукушонок (2717) и Папа Карло во Втором Тестограде (14090)
  await expect(buy.first()).toHaveAttribute('data-ticket-id', '2717');

  const soldOut = page.locator('#afisha [data-afisha-card][data-status="sold_out"]');
  await expect(soldOut.getByRole('link', { name: 'Встать в лист ожидания' })).toHaveAttribute('href', /\/waitlist\?city=test-gorod/);
  const soon = page.locator('#afisha [data-afisha-card][data-status="soon"]');
  await expect(soon.getByRole('button', { name: 'Скоро в продаже' })).toBeDisabled();

  await buy.first().click();
  await expect(page.getByRole('dialog').locator('iframe')).toHaveAttribute('src', 'https://cbiletom.ru/widget/1/frame.php?id=2717&mode=1');
});

test('афиша: фильтр по городу — «Все» и города, остальные карточки скрываются', async ({ page }) => {
  await page.goto('/');
  const tabs = page.getByRole('group', { name: 'Фильтр по городу' }).getByRole('button');
  await expect(tabs).toHaveText(['Все', 'Тестоград', 'Второй Тестоград']);
  const cards = page.locator('#afisha [data-afisha-card]:not([hidden])');
  await expect(cards).toHaveCount(4);

  await tabs.nth(2).click();
  await expect(cards).toHaveCount(1);
  await expect(tabs.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.first().locator('[data-card-city]')).toHaveText('Второй Тестоград');

  await tabs.nth(1).click();
  await expect(cards).toHaveCount(3);
  await tabs.nth(0).click();
  await expect(cards).toHaveCount(4);
});

test('карточка афиши ведёт на страницу города', async ({ page }) => {
  await page.goto('/');
  await page.locator('#afisha [data-afisha-card] a[data-card-link]').first().click();
  await expect(page).toHaveURL(/\/goroda\/test-gorod\/?$/);
});
