// Схемы коллекций. Без импортов из astro:content, чтобы их можно было гонять в Vitest.
// Ссылки между коллекциями (show, city) в рантайме Astro заменяются на reference() — см. content.config.ts.
import { z } from 'astro/zod';

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'дата должна быть в формате ГГГГ-ММ-ДД')
  .refine(isRealDate, 'такой даты не существует');

export const timeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'время в формате ЧЧ:ММ');

export const PERFORMANCE_STATUSES = ['on_sale', 'sold_out', 'soon', 'past'] as const;

const idSlug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id: латиница в нижнем регистре, цифры и дефисы');

export const showSchema = z.object({
  id: idSlug,
  title: z.string().min(1),
  text: z.string().min(1),
  quote: z.string().min(1),
  cover: z.string().startsWith('/'),
  gallery: z.array(z.string().startsWith('/')).default([]),
  soon: z.boolean(),
  // порядок слайдов на главной (по возрастанию, без повторов)
  order: z.number().int().nonnegative(),
  // «призрачное» слово на слайде и карточке афиши (по умолчанию — самое длинное слово названия)
  ghost: z.string().min(1).optional(),
  // возрастной знак («6+»): выводится только если задан — выдумывать значение нельзя
  ageRating: z.string().regex(/^\d{1,2}\+$/, 'возраст в формате «12+»').optional(),
});

export const citySchema = z.object({
  id: idSlug,
  name: z.string().min(1),
  // координаты точки на SVG-карте; у города без точки на карте не заполняются
  map: z
    .object({
      x: z.number(),
      y: z.number(),
      // подпись по умолчанию — под точкой по центру; своя задаётся смещением от точки
      label: z.object({ dx: z.number(), dy: z.number(), anchor: z.enum(['start', 'middle', 'end']) }).optional(),
    })
    .optional(),
  visited: z.boolean().default(false),
  // «Спасибо, город!» для городов, где уже были
  thanks: z
    .object({ title: z.string().min(1), comment: z.string().min(1), img: z.string().startsWith('/') })
    .optional(),
});

export const performanceFields = {
  id: idSlug,
  show: z.string().min(1),
  city: z.string().min(1),
  date: isoDate,
  time: timeHHMM.nullable(),
  venue: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  cbiletomId: z.number().int().positive().nullable(),
  status: z.enum(PERFORMANCE_STATUSES),
  priceFrom: z.number().int().nonnegative().nullable(),
};

type PerformanceShape = {
  status: (typeof PERFORMANCE_STATUSES)[number];
  cbiletomId: number | null;
  time: string | null;
  venue: string | null;
  address: string | null;
  priceFrom: number | null;
};

// Для показа в продаже нужны все данные, иначе на странице получится пустая карточка.
export function onSaleRequiresDetails(p: PerformanceShape, ctx: z.RefinementCtx) {
  if (p.status !== 'on_sale') return;
  for (const key of ['cbiletomId', 'time', 'venue', 'address', 'priceFrom'] as const) {
    if (p[key] === null) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `для статуса on_sale поле ${key} обязательно (сейчас null)`,
      });
    }
  }
}

export const performanceSchema = z.object(performanceFields).superRefine(onSaleRequiresDetails);

export const tourPlanSchema = z.object({
  id: idSlug,
  // ГГГГ-ММ — для сортировки; month — подпись для посетителя
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'период в формате ГГГГ-ММ'),
  month: z.string().min(1),
  places: z.array(z.string().min(1)).min(1),
  note: z.string().default(''),
});
