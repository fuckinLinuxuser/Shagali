// Фикстуры стенда (tests/fixtures/content) и защита от их попадания в прод.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { citySchema, performanceSchema } from '../src/content/schemas';
// @ts-expect-error — .mjs без типов
import { checkNoFixtures } from '../scripts/check-content.mjs';
// @ts-expect-error — .mjs без типов
import { findBrokenReferences } from '../scripts/content-integrity.mjs';

const FIXTURES = resolve(__dirname, 'fixtures/content');
const CONTENT = resolve(__dirname, '../src/content');

function load(collection: string) {
  const dir = join(FIXTURES, collection);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, data: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

describe('фикстуры стенда', () => {
  const cities = load('cities');
  const performances = load('performances');

  it('проходят те же схемы, что и боевые данные', () => {
    for (const { data } of cities) expect(citySchema.safeParse(data).error?.issues).toBeUndefined();
    for (const { data } of performances) expect(performanceSchema.safeParse(data).error?.issues).toBeUndefined();
  });

  it('все id начинаются с test- и совпадают с именем файла', () => {
    for (const { file, data } of [...cities, ...performances]) {
      expect(data.id).toMatch(/^test-/);
      expect(file).toBe(`${data.id}.json`);
    }
  });

  it('есть показ в продаже, распроданный и «скоро» — для проверки всех кнопок', () => {
    const statuses = performances.map(({ data }) => data.status);
    expect(statuses).toEqual(expect.arrayContaining(['on_sale', 'sold_out', 'soon']));
  });

  it('ссылки фикстур на спектакли и города целы (вместе с боевыми данными)', () => {
    expect(findBrokenReferences([CONTENT, FIXTURES])).toEqual([]);
  });

  it('без боевых данных ссылки фикстур битые — значит, проверка их действительно смотрит', () => {
    expect(findBrokenReferences([FIXTURES]).length).toBeGreaterThan(0);
  });
});

describe('check:content — фикстуры не попадают в dist для деплоя', () => {
  let dirs: string[] = [];
  afterEach(() => {
    dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
    dirs = [];
  });
  function site(files: Record<string, string>) {
    const d = mkdtempSync(join(tmpdir(), 'shagali-dist-'));
    dirs.push(d);
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(dirname(join(d, name)), { recursive: true });
      writeFileSync(join(d, name), body);
    }
    return d;
  }

  it('чистая сборка — без проблем', () => {
    const d = site({ 'index.html': '<a href="/goroda/tyumen">Тюмень</a>', 'goroda/tyumen/index.html': 'ok' });
    expect(checkNoFixtures(d)).toEqual([]);
  });

  it('страница тестового города в dist — ошибка', () => {
    const d = site({ 'goroda/test-gorod/index.html': 'ok' });
    expect(checkNoFixtures(d).join('\n')).toMatch(/test-gorod/);
  });

  it('ссылка на тестовую страницу в dist — ошибка', () => {
    const d = site({ 'goroda/index.html': '<a href="/goroda/test-gorod">Тестоград</a>' });
    expect(checkNoFixtures(d).join('\n')).toMatch(/goroda\/index\.html/);
  });
});
