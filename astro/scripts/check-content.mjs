// Плейсхолдеры контента не должны попасть в прод: ищем TODO(контент) в astro/dist.
// Запуск: npm run check:content [dist]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKER = /TODO\(контент\)/i;
const TEXT_EXT = /\.(html|js|css|json|xml|txt|svg|php)$/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

export function checkContent(dist) {
  const problems = [];
  for (const file of walk(dist)) {
    if (!TEXT_EXT.test(file)) continue;
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (MARKER.test(line)) problems.push(`${relative(dist, file)}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? 'dist');
  if (!existsSync(dist)) {
    console.error(`Нет ${dist}: сначала npm run build`);
    process.exit(2);
  }
  const problems = checkContent(dist);
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\ncheck:content — найдено плейсхолдеров: ${problems.length}`);
    process.exit(1);
  }
  console.log('check:content — ок');
}
