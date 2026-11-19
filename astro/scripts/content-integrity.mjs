// Целостность ссылок между коллекциями: Astro не проверяет reference(), пока запись не запрошена,
// а сломанная ссылка не должна доезжать до прода. Интеграция роняет сборку (и dev) на старте.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function ids(contentDirs, collection) {
  const out = new Set();
  for (const contentDir of contentDirs) {
    const dir = join(contentDir, collection);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      out.add(JSON.parse(readFileSync(join(dir, f), 'utf8')).id ?? f.replace(/\.json$/, ''));
    }
  }
  return out;
}

// contentDirs — папка с данными или список папок (боевые данные + фикстуры стенда).
export function findBrokenReferences(contentDirs) {
  const roots = Array.isArray(contentDirs) ? contentDirs : [contentDirs];
  const shows = ids(roots, 'shows');
  const cities = ids(roots, 'cities');
  const problems = [];
  for (const root of roots) {
    const dir = join(root, 'performances');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const p = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (!shows.has(p.show)) problems.push(`performances/${f}: спектакля "${p.show}" нет в коллекции shows`);
      if (!cities.has(p.city)) problems.push(`performances/${f}: города "${p.city}" нет в коллекции cities`);
    }
  }
  return problems;
}

// Фикстуры стенда (tests/fixtures/content) подмешиваются только при SHAGALI_FIXTURES=1 — см. content.config.ts.
export const withFixtures = () => process.env.SHAGALI_FIXTURES === '1';

export default function contentIntegrity() {
  return {
    name: 'shagali-content-integrity',
    hooks: {
      'astro:config:setup': ({ config }) => {
        const root = fileURLToPath(config.root);
        const dirs = [join(root, 'src/content')];
        if (withFixtures()) dirs.push(join(root, 'tests/fixtures/content'));
        const problems = findBrokenReferences(dirs);
        if (problems.length) {
          throw new Error(`Битые ссылки в данных (src/content):\n  ${problems.join('\n  ')}`);
        }
      },
    },
  };
}
