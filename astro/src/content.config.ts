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

const json = (dir: string) => glob({ pattern: '*.json', base: `./src/content/${dir}` });

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
