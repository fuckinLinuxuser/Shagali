// В dist не должно быть изображений тяжелее 300 КБ (задача 2.6). Фото афиш и видео лежат на сервере и в dist не попадают,
// но всё, что собрано в dist (иконки, превью, картинки страниц), обязано быть лёгким.
// Запуск: npm run check:images [dist]
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_BYTES = 300 * 1024;
const IMAGE = /\.(jpe?g|png|gif|webp|avif|svg|ico)$/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

export function checkImages(dist, max = MAX_BYTES) {
  const problems = [];
  for (const file of walk(dist)) {
    if (!IMAGE.test(file)) continue;
    const size = statSync(file).size;
    if (size > max) problems.push(`${relative(dist, file)}: ${Math.round(size / 1024)} КБ (максимум ${Math.round(max / 1024)} КБ)`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? 'dist');
  if (!existsSync(dist)) {
    console.error(`Нет ${dist}: сначала npm run build`);
    process.exit(2);
  }
  const problems = checkImages(dist);
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\ncheck:images — слишком тяжёлых картинок: ${problems.length}`);
    process.exit(1);
  }
  console.log('check:images — ок');
}
