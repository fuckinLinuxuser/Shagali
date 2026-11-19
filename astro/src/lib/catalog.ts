// Данные для страниц городов и спектаклей: показы со спектаклем и городом, статус на дату сборки.
import { getCollection } from 'astro:content';
import { buildDate, effectiveStatus, splitByDate, type Status } from './performances';

export async function loadCatalog() {
  const today = buildDate();
  const [shows, cities, performances] = await Promise.all([
    getCollection('shows'),
    getCollection('cities'),
    getCollection('performances'),
  ]);

  const showById = new Map(shows.map((s) => [s.id, s.data]));
  const cityById = new Map(cities.map((c) => [c.id, c.data]));

  const perfs = performances.map(({ data: p }) => {
    const show = showById.get(p.show.id)!;
    const city = cityById.get(p.city.id)!;
    return {
      ...p,
      status: effectiveStatus(p, today) as Status,
      show: { id: show.id, title: show.title },
      city: { id: city.id, name: city.name },
    };
  });

  const byCity = (cityId: string) => splitByDate(perfs.filter((p) => p.city.id === cityId), today);
  const byShow = (showId: string) => splitByDate(perfs.filter((p) => p.show.id === showId), today);

  return {
    today,
    shows: shows.map((s) => s.data),
    cities: cities.map((c) => c.data),
    byCity,
    byShow,
  };
}

export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;
export type PerformanceView = ReturnType<Catalog['byCity']>['upcoming'][number];
