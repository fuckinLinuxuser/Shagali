// Адреса виджета cbiletom. Публичного API у cbiletom нет: сайт только показывает их модуль продаж в iframe.
// id приходит из data-атрибута в браузере — проверяем, что это число, иначе в адрес можно подставить что угодно.

// Через сколько после открытия модалки показываем запасную ссылку, если виджет не ответил.
export const FALLBACK_AFTER_MS = 7000;

function checkId(id: unknown): number {
  const s = String(id);
  if (!/^[1-9]\d*$/.test(s)) throw new Error(`Некорректный id события cbiletom: ${s}`);
  return Number(s);
}

// Модуль продаж — то, что показывается внутри модалки.
export function ticketFrameUrl(id: number | string): string {
  return `https://cbiletom.ru/widget/1/frame.php?id=${checkId(id)}&mode=1`;
}

// Страница события на cbiletom — запасная ссылка, если iframe не загрузился.
export function eventPageUrl(id: number | string): string {
  return `https://cbiletom.ru/event.php?event=${checkId(id)}`;
}
