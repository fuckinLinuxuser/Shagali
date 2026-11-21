// Счётчики статистики. Грузятся ТОЛЬКО после «Принять» в cookie-плашке (CookieBanner.astro): до согласия на странице
// нет ни их скриптов, ни пикселей. Сейчас один счётчик — Top.Mail.Ru. Google Analytics и Tag Manager убраны;
// Яндекс.Метрика подключается задачей 2.4 (нужен номер счётчика от заказчика).
import { isCounterCookie } from './consent';

const TOP_MAIL_RU_ID = '3745960';
const TOP_MAIL_RU_SRC = 'https://top-fwz1.mail.ru/js/code.js';

declare global {
  interface Window {
    _tmr?: unknown[];
    __countersLoaded?: boolean;
  }
}

export function loadCounters(): void {
  if (window.__countersLoaded) return;
  window.__countersLoaded = true;

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
