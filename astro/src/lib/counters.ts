// Счётчики статистики. Грузятся ТОЛЬКО после «Принять» в cookie-плашке (CookieBanner.astro): до согласия на странице
// нет ни их скриптов, ни пикселей (noscript-пиксель Метрики не используем — он обходит согласие). Счётчики:
// Яндекс.Метрика (114626453) и Top.Mail.Ru. Google Analytics и Tag Manager убраны.
// Цели Метрики — reachGoal(): до загрузки счётчика они копятся в очереди, при отказе не уходят никогда.
import { isCounterCookie } from './consent';

const TOP_MAIL_RU_ID = '3745960';
const TOP_MAIL_RU_SRC = 'https://top-fwz1.mail.ru/js/code.js';
const YM_ID = 114626453;
const YM_SRC = `https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`;

export type Goal = 'city_view' | 'buy_click' | 'widget_loaded' | 'purchase' | 'waitlist_submit' | 'feedback_submit';

declare global {
  interface Window {
    _tmr?: unknown[];
    ym?: ((...args: unknown[]) => void) & { a?: unknown[]; l?: number };
    __countersLoaded?: boolean;
    __goalsLive?: boolean;
    __goalQueue?: Goal[];
  }
}

function loadYandexMetrika(): void {
  // Стандартный код счётчика, но без Вебвизора (он записывает действия на странице, в том числе в формах с ПДн)
  // и без noscript-пикселя. ym до загрузки tag.js — очередь вызовов.
  const ym =
    window.ym ||
    (window.ym = Object.assign(
      function (...args: unknown[]) {
        (ym.a = ym.a || []).push(args);
      },
      { l: Date.now() },
    ));
  if (![...document.scripts].some((s) => s.src === YM_SRC)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = YM_SRC;
    document.head.append(script);
  }
  ym(YM_ID, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
    referrer: document.referrer,
    url: location.href,
  });
}

// Цель Метрики. Пока счётчик не загружен (нет согласия) — в очередь; отказавшемуся она так и не уйдёт.
export function reachGoal(goal: Goal): void {
  if (window.__goalsLive && window.ym) window.ym(YM_ID, 'reachGoal', goal);
  else (window.__goalQueue = window.__goalQueue || []).push(goal);
}

export function loadCounters(): void {
  if (window.__countersLoaded) return;
  window.__countersLoaded = true;

  loadYandexMetrika();
  window.__goalsLive = true;
  for (const goal of window.__goalQueue ?? []) window.ym?.(YM_ID, 'reachGoal', goal);
  window.__goalQueue = [];

  const queue = (window._tmr = window._tmr || []);
  queue.push({ id: TOP_MAIL_RU_ID, type: 'pageView', start: Date.now() });

  const script = document.createElement('script');
  script.id = 'tmr-code';
  script.async = true;
  script.src = TOP_MAIL_RU_SRC;
  document.head.append(script);
}

// Удаляет cookie счётчиков для текущего домена и его родительских (счётчик мог поставить их на .домен).
export function purgeCounterCookies(): void {
  const names = document.cookie
    .split(';')
    .map((c) => c.trim().split('=')[0])
    .filter((n) => n && isCounterCookie(n));
  if (names.length === 0) return;

  const host = location.hostname;
  const labels = host.split('.');
  const domains = new Set<string | undefined>([undefined, host, `.${host}`]);
  for (let i = 1; i < labels.length - 1; i++) domains.add(`.${labels.slice(i).join('.')}`);

  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ''}`;
    }
  }
}
