// Логика показов для страниц городов и спектаклей (src/lib/performances.ts).
import { describe, expect, it } from 'vitest';
import {
  buildDate,
  effectiveStatus,
  formatDateRu,
  formatPrice,
  splitByDate,
  ticketUrl,
  todayInMoscow,
} from '../src/lib/performances';

const p = (date: string, status: 'on_sale' | 'sold_out' | 'soon' | 'past', time: string | null = '19:00') => ({
  id: `${date}-${status}`,
  date,
  time,
  status,
});

describe('todayInMoscow', () => {
  it('берёт дату по Москве, а не по UTC', () => {
    // 22:30 UTC 31 декабря — в Москве уже 1 января
    expect(todayInMoscow(new Date('2026-12-31T22:30:00Z'))).toBe('2027-01-01');
    expect(todayInMoscow(new Date('2026-12-31T20:30:00Z'))).toBe('2026-12-31');
  });

  it('SHAGALI_TODAY подменяет дату сборки', () => {
    expect(buildDate({ SHAGALI_TODAY: '2030-05-05' })).toBe('2030-05-05');
    expect(buildDate({})).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('effectiveStatus', () => {
  const today = '2026-11-17';

  it('показ с прошедшей датой — прошедший, даже если в данных on_sale', () => {
    expect(effectiveStatus(p('2026-11-16', 'on_sale'), today)).toBe('past');
    expect(effectiveStatus(p('2026-08-01', 'sold_out'), today)).toBe('past');
  });

  it('показ сегодня ещё в продаже', () => {
    expect(effectiveStatus(p('2026-11-17', 'on_sale'), today)).toBe('on_sale');
  });

  it('будущий показ — статус из данных', () => {
    expect(effectiveStatus(p('2026-12-01', 'sold_out'), today)).toBe('sold_out');
    expect(effectiveStatus(p('2026-12-01', 'soon'), today)).toBe('soon');
    expect(effectiveStatus(p('2026-12-01', 'past'), today)).toBe('past');
  });
});

describe('splitByDate', () => {
  const today = '2026-11-17';
  const list = [
    p('2026-12-10', 'on_sale'),
    p('2026-08-01', 'past'),
    p('2026-12-01', 'soon', null),
    p('2026-11-10', 'on_sale'), // дата прошла — в прошедшие
    p('2026-12-01', 'on_sale', '12:00'),
  ];

  it('будущие — по возрастанию даты и времени, прошедшие — от свежих к старым', () => {
    const { upcoming, past } = splitByDate(list, today);
    expect(upcoming.map((x) => x.id)).toEqual(['2026-12-01-on_sale', '2026-12-01-soon', '2026-12-10-on_sale']);
    expect(past.map((x) => x.id)).toEqual(['2026-11-10-on_sale', '2026-08-01-past']);
  });

  it('не меняет исходный массив', () => {
    const copy = [...list];
    splitByDate(list, today);
    expect(list).toEqual(copy);
  });
});

describe('форматирование', () => {
  it('дата по-русски с днём недели', () => {
    expect(formatDateRu('2099-01-15')).toBe('чт, 15 января 2099');
    expect(formatDateRu('2026-08-01')).toBe('сб, 1 августа 2026');
  });

  it('цена «от» с неразрывными пробелами', () => {
    expect(formatPrice(1200)).toBe('от 1 200 ₽');
    expect(formatPrice(900)).toBe('от 900 ₽');
  });

  it('ссылка на покупку в cbiletom', () => {
    expect(ticketUrl(14088)).toBe('https://cbiletom.ru/widget/1/frame.php?id=14088&mode=1');
  });
});
