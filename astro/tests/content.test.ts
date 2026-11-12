// Задача 1.1: единый источник данных — src/content/{shows,cities,performances,tour-plan}.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  citySchema,
  performanceSchema,
  showSchema,
  tourPlanSchema,
} from '../src/content/schemas';

const ROOT = resolve(__dirname, '../src/content');

function load(collection: string): Record<string, unknown>[] {
  const dir = join(ROOT, collection);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ ...JSON.parse(readFileSync(join(dir, f), 'utf8')), __file: f }));
}

const strip = ({ __file, ...rest }: Record<string, unknown>) => rest;

const shows = load('shows');
const cities = load('cities');
const performances = load('performances');
const tourPlan = load('tour-plan');

describe('данные проходят схемы', () => {
  it.each(shows.map((s) => [s.__file, s]))('shows/%s', (_f, s) => {
    expect(showSchema.safeParse(strip(s as never)).error?.issues).toBeUndefined();
  });
  it.each(cities.map((s) => [s.__file, s]))('cities/%s', (_f, s) => {
    expect(citySchema.safeParse(strip(s as never)).error?.issues).toBeUndefined();
  });
  it.each(performances.map((s) => [s.__file, s]))('performances/%s', (_f, s) => {
    expect(performanceSchema.safeParse(strip(s as never)).error?.issues).toBeUndefined();
  });
  it.each(tourPlan.map((s) => [s.__file, s]))('tour-plan/%s', (_f, s) => {
    expect(tourPlanSchema.safeParse(strip(s as never)).error?.issues).toBeUndefined();
  });
});

describe('целостность', () => {
  it('в каждой коллекции есть данные', () => {
    expect(shows.length).toBeGreaterThan(0);
    expect(cities.length).toBeGreaterThan(0);
    expect(performances.length).toBeGreaterThan(0);
    expect(tourPlan.length).toBeGreaterThan(0);
  });

  it('каждый показ ссылается на существующие спектакль и город', () => {
    const showIds = new Set(shows.map((s) => s.id));
    const cityIds = new Set(cities.map((c) => c.id));
    for (const p of performances) {
      expect(showIds.has(p.show), `${p.__file}: нет спектакля "${p.show}"`).toBe(true);
      expect(cityIds.has(p.city), `${p.__file}: нет города "${p.city}"`).toBe(true);
    }
  });

  it('нет дублей id внутри коллекций', () => {
    for (const [name, items] of Object.entries({ shows, cities, performances, tourPlan })) {
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size, `дубли id в ${name}`).toBe(ids.length);
    }
  });

  it('id совпадает с именем файла', () => {
    for (const item of [...shows, ...cities, ...performances, ...tourPlan]) {
      expect(`${item.id}.json`).toBe(item.__file);
    }
  });

  it('cbiletomId не повторяется между показами', () => {
    const ids = performances.map((p) => p.cbiletomId).filter((x) => x !== null);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('событие 14088 — показ в Тюмени со статусом past', () => {
    const p = performances.find((x) => x.cbiletomId === 14088);
    expect(p).toBeDefined();
    expect(p).toMatchObject({ city: 'tyumen', show: 'kukushonok', status: 'past', date: '2026-08-01' });
  });
});

describe('правила схемы показа', () => {
  const base = {
    id: 'x',
    show: 'kukushonok',
    city: 'tyumen',
    date: '2026-12-01',
    time: '19:00',
    venue: 'Театр',
    address: 'ул. Ленина, 1',
    cbiletomId: 1,
    status: 'on_sale',
    priceFrom: 1000,
  };
  const ok = (o: object) => performanceSchema.safeParse({ ...base, ...o }).success;

  it('on_sale с полными данными — ок', () => expect(ok({})).toBe(true));
  it('on_sale без cbiletomId — ошибка', () => expect(ok({ cbiletomId: null })).toBe(false));
  it('on_sale без цены/времени/площадки — ошибка', () => {
    expect(ok({ priceFrom: null })).toBe(false);
    expect(ok({ time: null })).toBe(false);
    expect(ok({ venue: null })).toBe(false);
    expect(ok({ address: null })).toBe(false);
  });
  it('past и soon могут не знать деталей', () => {
    const empty = { cbiletomId: null, time: null, venue: null, address: null, priceFrom: null };
    expect(ok({ ...empty, status: 'past' })).toBe(true);
    expect(ok({ ...empty, status: 'soon' })).toBe(true);
  });
  it('неизвестный статус — ошибка', () => expect(ok({ status: 'maybe' })).toBe(false));
  it('невалидные даты — ошибка', () => {
    expect(ok({ date: '2026-02-30' })).toBe(false);
    expect(ok({ date: '01.12.2026' })).toBe(false);
    expect(ok({ date: '2026-13-01' })).toBe(false);
  });
  it('невалидное время — ошибка', () => {
    expect(ok({ time: '25:00' })).toBe(false);
    expect(ok({ time: '7pm' })).toBe(false);
  });
  it('отрицательная цена и дробный cbiletomId — ошибка', () => {
    expect(ok({ priceFrom: -1 })).toBe(false);
    expect(ok({ cbiletomId: 1.5 })).toBe(false);
  });
});
