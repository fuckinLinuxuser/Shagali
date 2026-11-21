// Главная строится из данных: слайдер (shows + ближайший показ), карта (cities), таймлайн (tour-plan).
// Чистые функции — их гоняет Vitest (tests/home.test.ts).
import type { z } from 'astro/zod';
import type { citySchema, tourPlanSchema } from '../content/schemas';

type City = z.infer<typeof citySchema>;
type TourPlan = z.infer<typeof tourPlanSchema>;

interface UpcomingPerformance {
  status: string;
  cbiletomId: number | null;
  date: string;
  city: { name: string };
}

const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// «Тюмень, 1 августа» — подпись над кнопкой на слайде.
export function eventLabel(cityName: string, iso: string): string {
  return `${cityName}, ${dayMonth.format(new Date(`${iso}T12:00:00Z`))}`;
}

export type SlideAction =
  | { kind: 'buy'; cbiletomId: number; eventDate: string }
  | { kind: 'waitlist' };

// Кнопка слайда: «Купить» только если есть будущий показ в продаже с cbiletomId.
// Всё остальное (нет показов, sold_out, soon) — «Заявка». `upcoming` — уже без прошедших, по возрастанию даты.
export function slideAction(upcoming: readonly UpcomingPerformance[]): SlideAction {
  const next = upcoming.find((p) => p.status === 'on_sale' && p.cbiletomId !== null);
  if (!next) return { kind: 'waitlist' };
  return { kind: 'buy', cbiletomId: next.cbiletomId as number, eventDate: eventLabel(next.city.name, next.date) };
}

export interface MapDot {
  id: string;
  name: string;
  x: number;
  y: number;
  visited: boolean;
  href: string;
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

// Точка карты — у города с координатами, где мы были или есть показы. Города без показов (пока только
// в плане гастролей) на карте не рисуем — иначе на ней появятся пустые точки; точка возникнет вместе с показом.
export function mapDots(cities: readonly City[], citiesWithPerformances: ReadonlySet<string>): MapDot[] {
  return cities.flatMap((c) => {
    if (!c.map || !(c.visited || citiesWithPerformances.has(c.id))) return [];
    const { x, y, label } = c.map;
    return [
      {
        id: c.id,
        name: c.name,
        x,
        y,
        visited: c.visited,
        href: `/goroda/${c.id}`,
        label: label ? { x: x + label.dx, y: y + label.dy, anchor: label.anchor } : { x: x + 14, y: y + 6, anchor: 'start' },
      },
    ];
  });
}

export function sortTourPlan<T extends Pick<TourPlan, 'period'>>(plan: readonly T[]): T[] {
  return [...plan].sort((a, b) => a.period.localeCompare(b.period));
}
