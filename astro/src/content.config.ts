import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  citySchema,
  onSaleRequiresDetails,
  performanceFields,
  showSchema,
  tourPlanSchema,
} from './content/schemas';

// Фикстуры стенда (tests/fixtures/content) — только при SHAGALI_FIXTURES=1, т. е. в `npm run build:stand`.
// В dist для деплоя их нет: это проверяет check:content.
const WITH_FIXTURES = process.env.SHAGALI_FIXTURES === '1';

// id записи = поле id (оно же имя файла — это проверяют тесты), а не путь: путей теперь два.
const json = (dir: string) =>
  glob({
    pattern: WITH_FIXTURES
      ? [`src/content/${dir}/*.json`, `tests/fixtures/content/${dir}/*.json`]
      : `src/content/${dir}/*.json`,
    base: '.',
    generateId: ({ data }) => String(data.id),
  });

// Ошибка в данных роняет сборку (CLAUDE.md, «Данные»): схема строгая, пустых карточек не будет.
const shows = defineCollection({ loader: json('shows'), schema: showSchema });
const cities = defineCollection({ loader: json('cities'), schema: citySchema });
const tourPlan = defineCollection({ loader: json('tour-plan'), schema: tourPlanSchema });

// show/city здесь — настоящие ссылки на коллекции; те же поля и правила, что в performanceSchema.
const performances = defineCollection({
  loader: json('performances'),
  schema: z
    .object({
      ...performanceFields,
      show: reference('shows'),
      city: reference('cities'),
    })
    .superRefine(onSaleRequiresDetails),
});

export const collections = { shows, cities, performances, 'tour-plan': tourPlan };
