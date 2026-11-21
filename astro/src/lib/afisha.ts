// Главная в новом дизайне: слайдер спектаклей и «Афиша» строятся из данных. Чистые функции — их гоняет
// Vitest (tests/afisha.test.ts). Заглушек («ДД.ММ», «00+») нет: нет даты или возраста в данных — нет и надписи.
import { slideAction } from './home';

interface ShowLike {
  id: string;
  title: string;
  quote?: string;
  order?: number;
  ghost?: string;
  ageRating?: string;
}

interface PerformanceLike {
  id: string;
  date: string;
  status: string;
  cbiletomId: number | null;
  priceFrom: number | null;
  show: { id: string; title: string };
  city: { id: string; name: string };
}

// «Призрачное» слово на слайде: из данных, а если не задано — самое длинное слово названия.
export function ghostWord(show: Pick<ShowLike, 'title' | 'ghost'>): string {
  if (show.ghost) return show.ghost;
  const words = show.title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.reduce((best, w) => (w.length > best.length ? w : best), '');
}

// «15.01» из ISO-даты: без Date, чтобы часовой пояс сборки не сдвигал день.
export function dayMonth(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}.${month}`;
}

// Возрастной знак — только если он есть в данных.
export function ageLabel(show: { ageRating?: string }): string | null {
  return show.ageRating ? show.ageRating : null;
}

export interface AfishaCard {
  key: string;
  kind: 'performance' | 'soon';
  title: string;
  quote: string;
  ghost: string;
  age: string | null;
  city: { id: string; name: string } | null;
  date: string | null; // ISO, для подписи в модалке покупки
  dateLabel: string | null;
  status: string;
  canBuy: boolean;
  cbiletomId: number | null;
  priceFrom: number | null;
  href: string;
}

const byDate = (a: PerformanceLike, b: PerformanceLike) => a.date.localeCompare(b.date);

// Карточки «Афиши»: будущие показы по дате; пока их нет — карточки спектаклей «Скоро» без даты и города.
export function buildAfisha(shows: readonly ShowLike[], upcoming: readonly PerformanceLike[]): AfishaCard[] {
  const showById = new Map(shows.map((s) => [s.id, s]));

  if (upcoming.length > 0) {
    return [...upcoming].sort(byDate).map((p) => {
      const show = showById.get(p.show.id);
      return {
        key: p.id,
        kind: 'performance',
        title: p.show.title,
        quote: show?.quote ?? '',
        ghost: ghostWord(show ?? { title: p.show.title }),
        age: show ? ageLabel(show) : null,
        city: p.city,
        date: p.date,
        dateLabel: dayMonth(p.date),
        status: p.status,
        canBuy: p.status === 'on_sale' && p.cbiletomId !== null,
        cbiletomId: p.cbiletomId,
        priceFrom: p.priceFrom,
        href: `/goroda/${p.city.id}`,
      };
    });
  }

  return [...shows]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({
      key: s.id,
      kind: 'soon' as const,
      title: s.title,
      quote: s.quote ?? '',
      ghost: ghostWord(s),
      age: ageLabel(s),
      city: null,
      date: null,
      dateLabel: null,
      status: 'soon',
      canBuy: false,
      cbiletomId: null,
      priceFrom: null,
      href: `/spektakli/${s.id}`,
    }));
}

// Вкладки фильтра по городу — только когда в афише два города и больше.
export function cityTabs(cards: readonly AfishaCard[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const c of cards) if (c.city && !seen.has(c.city.id)) seen.set(c.city.id, c.city.name);
  return seen.size >= 2 ? [...seen].map(([id, name]) => ({ id, name })) : [];
}

export interface StageSlide {
  id: string;
  title: string;
  quote: string;
  ghost: string;
  age: string | null;
  kicker: string; // город ближайшего показа или «Скоро»
  dateLabel: string | null;
  href: string;
  buy: { cbiletomId: number; subtitle: string } | null;
}

// Слайд спектакля: ближайший показ (если есть) даёт город и дату, «Купить» — только если он в продаже.
export function stageSlide(show: ShowLike, upcoming: readonly PerformanceLike[]): StageSlide {
  const next = upcoming[0];
  const action = slideAction(upcoming as never);
  return {
    id: show.id,
    title: show.title,
    quote: show.quote ?? '',
    ghost: ghostWord(show),
    age: ageLabel(show),
    kicker: next ? next.city.name : 'Скоро',
    dateLabel: next ? dayMonth(next.date) : null,
    href: `/spektakli/${show.id}`,
    buy: action.kind === 'buy' ? { cbiletomId: action.cbiletomId, subtitle: action.eventDate } : null,
  };
}
