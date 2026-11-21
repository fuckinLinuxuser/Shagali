// Показы на страницах городов и спектаклей. Чистые функции — их гоняет Vitest (tests/performances.test.ts).
import type { PERFORMANCE_STATUSES } from '../content/schemas';

export type Status = (typeof PERFORMANCE_STATUSES)[number];

interface Dated {
  date: string; // ГГГГ-ММ-ДД
  time: string | null; // ЧЧ:ММ
  status: Status;
}

// Сегодняшняя дата по Москве: гастроли идут по России, а сборка в CI — по UTC.
export function todayInMoscow(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now);
}

// Дата, на которую собран сайт. SHAGALI_TODAY — для воспроизводимых тестов.
export function buildDate(env: Record<string, string | undefined> = process.env): string {
  return env.SHAGALI_TODAY ?? todayInMoscow();
}

// Статус, который видит посетитель. Сайт статический: показ, дата которого прошла, уходит
// в «Прошедшие» при следующей сборке (ночная пересборка в CI), даже если в данных он ещё on_sale.
export function effectiveStatus(p: Dated, today: string): Status {
  return p.date < today ? 'past' : p.status;
}

const key = (p: Dated) => `${p.date} ${p.time ?? '99:99'}`;

export function splitByDate<T extends Dated>(list: readonly T[], today: string) {
  const upcoming = list.filter((p) => effectiveStatus(p, today) !== 'past').sort((a, b) => key(a).localeCompare(key(b)));
  const past = list.filter((p) => effectiveStatus(p, today) === 'past').sort((a, b) => key(b).localeCompare(key(a)));
  return { upcoming, past };
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

// «чт, 15 января 2099» — без «г.» на конце, который добавляет Intl.
export function formatDateRu(iso: string): string {
  const parts = dateFmt.formatToParts(new Date(`${iso}T12:00:00Z`));
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  return `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}`;
}

const NBSP = ' ';

export function formatPrice(rub: number): string {
  const grouped = String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `от${' '}${grouped}${NBSP}₽`;
}
