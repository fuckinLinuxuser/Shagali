// Целостность ссылок между коллекциями: Astro не проверяет reference(), пока запись не запрошена,
// а сломанная ссылка не должна доезжать до прода. Интеграция роняет сборку (и dev) на старте.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function ids(contentDir, collection) {
  const dir = join(contentDir, collection);
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).id ?? f.replace(/\.json$/, '')),
  );
}

export function findBrokenReferences(contentDir) {
  const shows = ids(contentDir, 'shows');
  const cities = ids(contentDir, 'cities');
  const dir = join(contentDir, 'performances');
  const problems = [];
  if (!existsSync(dir)) return problems;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const p = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (!shows.has(p.show)) problems.push(`performances/${f}: спектакля "${p.show}" нет в коллекции shows`);
    if (!cities.has(p.city)) problems.push(`performances/${f}: города "${p.city}" нет в коллекции cities`);
  }
  return problems;
}

export default function contentIntegrity() {
  return {
    name: 'shagali-content-integrity',
    hooks: {
      'astro:config:setup': ({ config }) => {
        const problems = findBrokenReferences(join(fileURLToPath(config.root), 'src/content'));
        if (problems.length) {
          throw new Error(`Битые ссылки в данных (src/content):\n  ${problems.join('\n  ')}`);
        }
      },
    },
  };
}
