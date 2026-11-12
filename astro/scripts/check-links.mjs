// Проверка ссылок в astro/dist: битые внутренние ссылки, битые якоря и href="#".
// Запуск: npm run check:links [dist]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Живёт только на сервере (CLAUDE.md: images/, videos/ не в репозитории) — в dist их нет.
export const SERVER_ONLY_PREFIXES = ['/images/', '/videos/', '/posts.json'];

// Осознанные исключения: файл (относительно dist) → причина. Пустой href="#" — шаблон поповера,
// JS подставляет ссылку. TODO(1.4): заменить на данные cbiletom и убрать исключение.
export const ALLOW_EMPTY_HASH = {
  'index.html': 'шаблон #tour-popover (ссылку ставит JS), убрать в задаче 1.4',
};

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function resolvesInDist(dist, urlPath) {
  const rel = urlPath.replace(/^\/+/, '');
  const candidates = [rel, `${rel}.html`, join(rel, 'index.html')];
  return candidates.some((c) => {
    const p = join(dist, c);
    return existsSync(p) && (statSync(p).isFile());
  });
}

export function checkLinks(dist, { allowEmptyHash = ALLOW_EMPTY_HASH } = {}) {
  const problems = [];
  for (const file of walk(dist)) {
    if (!file.endsWith('.html')) continue;
    const page = relative(dist, file);
    const html = readFileSync(file, 'utf8');
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const pageUrl = '/' + page.replace(/index\.html$/, '').replace(/\.html$/, '');

    // Содержимое <script> — JS-шаблоны вроде src="${x}", не реальные ссылки.
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    for (const m of markup.matchAll(/\s(href|src)="([^"]*)"/g)) {
      const raw = m[2].trim();
      if (/^(https?:|\/\/|mailto:|tel:|data:|javascript:)/i.test(raw)) continue;

      if (raw === '#' || raw === '') {
        if (raw === '#' && !(page in allowEmptyHash)) problems.push(`${page}: href="#"`);
        continue;
      }
      if (raw.startsWith('#')) {
        if (!ids.has(raw.slice(1))) problems.push(`${page}: якорь ${raw} не найден на странице`);
        continue;
      }
      const [pathPart, fragment] = raw.split('#');
      const clean = pathPart.split('?')[0];
      const abs = clean.startsWith('/') ? clean : resolve(pageUrl.endsWith('/') ? pageUrl : dirname(pageUrl) + '/', clean);
      if (SERVER_ONLY_PREFIXES.some((p) => abs.startsWith(p))) continue;
      if (!resolvesInDist(dist, abs)) {
        problems.push(`${page}: битая ссылка ${raw}`);
        continue;
      }
      if (fragment) {
        const target = resolve(dist, abs.replace(/^\/+/, ''), existsSync(join(dist, abs, 'index.html')) ? 'index.html' : '');
        const targetFile = existsSync(target) && statSync(target).isFile() ? target : `${join(dist, abs)}.html`;
        if (existsSync(targetFile) && !readFileSync(targetFile, 'utf8').includes(`id="${fragment}"`)) {
          problems.push(`${page}: якорь #${fragment} не найден в ${abs}`);
        }
      }
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? 'dist');
  if (!existsSync(dist)) {
    console.error(`Нет ${dist}: сначала npm run build`);
    process.exit(2);
  }
  const problems = checkLinks(dist);
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\ncheck:links — проблем: ${problems.length}`);
    process.exit(1);
  }
  console.log('check:links — ок');
}
