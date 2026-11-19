// Задача 1.2: слайдер, карта и таймлайн главной строятся из данных (src/lib/home.ts).
import { describe, expect, it } from 'vitest';
import { eventLabel, mapDots, slideAction, sortTourPlan } from '../src/lib/home';

const perf = (o: Partial<{ status: string; cbiletomId: number | null; date: string; city: string }> = {}) => ({
  status: 'on_sale',
  cbiletomId: 14088,
  date: '2099-01-15',
  city: { id: 'tyumen', name: 'Тюмень' },
  ...o,
  ...(o.city ? { city: { id: 'x', name: o.city } } : {}),
});

describe('slideAction: кнопка слайда', () => {
  it('нет ближайших показов → заявка', () => {
    expect(slideAction([])).toEqual({ kind: 'waitlist' });
  });

  it('первый показ в продаже → покупка с cbiletomId и подписью', () => {
    expect(slideAction([perf()] as never)).toEqual({
      kind: 'buy',
      cbiletomId: 14088,
      eventDate: 'Тюмень, 15 января',
    });
  });

  it('sold_out и soon → заявка', () => {
    expect(slideAction([perf({ status: 'sold_out' })] as never)).toEqual({ kind: 'waitlist' });
    expect(slideAction([perf({ status: 'soon', cbiletomId: null })] as never)).toEqual({ kind: 'waitlist' });
  });

  it('берёт ближайший показ именно в продаже, а не первый по дате', () => {
    const list = [perf({ status: 'sold_out', date: '2099-01-10' }), perf({ date: '2099-02-01', cbiletomId: 7 })];
    expect(slideAction(list as never)).toMatchObject({ kind: 'buy', cbiletomId: 7 });
  });

  it('on_sale без cbiletomId не даёт кнопку «Купить»', () => {
    expect(slideAction([perf({ cbiletomId: null })] as never)).toEqual({ kind: 'waitlist' });
  });
});

describe('eventLabel', () => {
  it('«Город, день месяц» без года и дня недели', () => {
    expect(eventLabel('Тюмень', '2026-08-01')).toBe('Тюмень, 1 августа');
    expect(eventLabel('Омск', '2027-12-31')).toBe('Омск, 31 декабря');
  });
});

describe('mapDots', () => {
  const cities = [
    { id: 'tyumen', name: 'Тюмень', map: { x: 336, y: 607 }, visited: false },
    { id: 'spb', name: 'Санкт-Петербург', map: { x: 75, y: 577, label: { dx: 13, dy: 4, anchor: 'start' } }, visited: true },
    { id: 'omsk', name: 'Омск', map: { x: 470, y: 640 }, visited: false },
    { id: 'vladivostok', name: 'Владивосток', visited: true },
  ];

  it('точки — у городов с координатами, где были или есть показы', () => {
    const ids = (withPerf: string[]) => mapDots(cities as never, new Set(withPerf)).map((d) => d.id);
    expect(ids([])).toEqual(['spb']); // tyumen и omsk — только план, показов нет
    expect(ids(['tyumen'])).toEqual(['tyumen', 'spb']);
    expect(ids(['tyumen', 'omsk'])).toEqual(['tyumen', 'spb', 'omsk']);
  });

  it('город без координат точки не получает, даже если там были', () => {
    expect(mapDots(cities as never, new Set(['vladivostok'])).map((d) => d.id)).not.toContain('vladivostok');
  });

  it('подпись по умолчанию — под точкой по центру, свою можно задать в данных', () => {
    const [tyumen, spb] = mapDots(cities as never, new Set(['tyumen']));
    expect(tyumen.label).toEqual({ x: 336, y: 637, anchor: 'middle' });
    expect(spb.label).toEqual({ x: 88, y: 581, anchor: 'start' });
    expect(spb.visited).toBe(true);
  });

  it('каждая точка ведёт на страницу города', () => {
    for (const d of mapDots(cities as never, new Set(['tyumen', 'omsk']))) expect(d.href).toBe(`/goroda/${d.id}`);
  });
});

describe('sortTourPlan', () => {
  it('сортирует по периоду и не мутирует исходник', () => {
    const src = [{ period: '2027-02' }, { period: '2026-06' }, { period: '2026-10' }];
    expect(sortTourPlan(src as never).map((x) => x.period)).toEqual(['2026-06', '2026-10', '2027-02']);
    expect(src[0].period).toBe('2027-02');
  });
});
