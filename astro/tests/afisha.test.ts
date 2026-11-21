// Редизайн: слайдер и «Афиша» главной строятся из данных (src/lib/afisha.ts). Заглушек («ДД.ММ», «00+») нет.
import { describe, expect, it } from 'vitest';
import { ageLabel, buildAfisha, cityTabs, dayMonth, ghostWord, stageSlide } from '../src/lib/afisha';

describe('ghostWord: «призрачное» слово слайда', () => {
  it('явное слово из данных важнее вычисленного', () => {
    expect(ghostWord({ title: 'Откуда взялся папа Карло?', ghost: 'Карло' })).toBe('Карло');
  });
  it('без явного — самое длинное слово названия без знаков препинания', () => {
    expect(ghostWord({ title: 'Родной мой Кукушонок' })).toBe('Кукушонок');
    expect(ghostWord({ title: 'Мамочка, купи собаку!' })).toBe('Мамочка');
  });
});

describe('dayMonth', () => {
  it('ДД.ММ из ISO-даты, без часовых поясов', () => {
    expect(dayMonth('2099-01-05')).toBe('05.01');
    expect(dayMonth('2026-12-31')).toBe('31.12');
  });
});

describe('ageLabel: возрастной знак только с реальным значением', () => {
  it('нет значения — нет знака', () => {
    expect(ageLabel({})).toBeNull();
    expect(ageLabel({ ageRating: '' })).toBeNull();
  });
  it('есть — как в данных', () => {
    expect(ageLabel({ ageRating: '12+' })).toBe('12+');
  });
});

const show = (id: string, order: number, extra = {}) => ({
  id, order, title: id.toUpperCase(), quote: `цитата ${id}`, ageRating: undefined, ghost: undefined, ...extra,
});
const perf = (id: string, showId: string, cityId: string, date: string, status = 'on_sale', extra = {}) => ({
  id, status, date, time: '19:00', cbiletomId: 1, priceFrom: 1000,
  show: { id: showId, title: showId.toUpperCase() }, city: { id: cityId, name: cityId.toUpperCase() }, ...extra,
});

describe('buildAfisha', () => {
  const shows = [show('a', 1), show('b', 2)];

  it('есть будущие показы — карточки показов по дате, без карточек «Скоро»', () => {
    const cards = buildAfisha(shows as never, [perf('p2', 'b', 'omsk', '2099-03-01'), perf('p1', 'a', 'tmn', '2099-02-01')] as never);
    expect(cards.map((c) => c.key)).toEqual(['p1', 'p2']);
    expect(cards[0]).toMatchObject({ kind: 'performance', dateLabel: '01.02', city: { id: 'tmn' }, href: '/goroda/tmn' });
  });

  it('показов нет — карточки «Скоро» по спектаклям, без даты и города', () => {
    const cards = buildAfisha(shows as never, []);
    expect(cards.map((c) => c.key)).toEqual(['a', 'b']);
    expect(cards[0]).toMatchObject({ kind: 'soon', dateLabel: null, city: null, href: '/spektakli/a' });
  });

  it('купить только у показа в продаже с cbiletomId', () => {
    const cards = buildAfisha(shows as never, [
      perf('p1', 'a', 'tmn', '2099-02-01'),
      perf('p2', 'a', 'tmn', '2099-02-02', 'sold_out'),
      perf('p3', 'a', 'tmn', '2099-02-03', 'soon', { cbiletomId: null }),
      perf('p4', 'a', 'tmn', '2099-02-04', 'on_sale', { cbiletomId: null }),
    ] as never);
    expect(cards.map((c) => c.canBuy)).toEqual([true, false, false, false]);
  });

  it('возрастной знак переносится из данных, если он есть', () => {
    const cards = buildAfisha([show('a', 1, { ageRating: '6+' })] as never, []);
    expect(cards[0].age).toBe('6+');
    expect(buildAfisha([show('a', 1)] as never, [])[0].age).toBeNull();
  });
});

describe('cityTabs: фильтр по городу', () => {
  it('один город — фильтра нет', () => {
    const cards = buildAfisha([show('a', 1)] as never, [perf('p1', 'a', 'tmn', '2099-02-01')] as never);
    expect(cityTabs(cards)).toEqual([]);
  });
  it('два города и больше — вкладки в порядке появления', () => {
    const cards = buildAfisha([show('a', 1)] as never, [
      perf('p1', 'a', 'tmn', '2099-02-01'),
      perf('p2', 'a', 'omsk', '2099-02-02'),
      perf('p3', 'a', 'tmn', '2099-02-03'),
    ] as never);
    expect(cityTabs(cards)).toEqual([{ id: 'tmn', name: 'TMN' }, { id: 'omsk', name: 'OMSK' }]);
  });
});

describe('stageSlide: слайд спектакля', () => {
  const s = show('a', 1, { quote: 'цитата', ghost: 'Призрак' });
  it('нет ближайшего показа — «Скоро» без даты, кнопки покупки нет', () => {
    expect(stageSlide(s as never, [])).toMatchObject({ ghost: 'Призрак', kicker: 'Скоро', dateLabel: null, buy: null, href: '/spektakli/a' });
  });
  it('есть показ — город и дата из данных', () => {
    const slide = stageSlide(s as never, [perf('p1', 'a', 'tmn', '2099-01-15')] as never);
    expect(slide).toMatchObject({ kicker: 'TMN', dateLabel: '15.01' });
    expect(slide.buy).toMatchObject({ cbiletomId: 1 });
  });
  it('первый показ распродан — кнопки покупки нет, дата ближайшего остаётся', () => {
    const slide = stageSlide(s as never, [perf('p1', 'a', 'tmn', '2099-01-15', 'sold_out')] as never);
    expect(slide.buy).toBeNull();
    expect(slide.dateLabel).toBe('15.01');
  });
});
