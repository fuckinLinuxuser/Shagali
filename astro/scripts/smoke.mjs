// Smoke-проверка работающего сайта (стенд или прод): ключевые страницы отвечают, закрытое закрыто, honeypot ничего не пишет.
// Запуск: npm run smoke -- https://shagali.ru   (без аргумента — http://localhost:8080)
// Ничего не меняет на сервере: единственный POST с данными — honeypot (отвечает 200 и не сохраняет).
import { fileURLToPath } from 'node:url';

export async function smoke(base) {
  const origin = base.replace(/\/+$/, '');
  const failures = [];
  let checks = 0;
  const check = (name, ok, detail = '') => {
    checks += 1;
    if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  };
  const get = async (path, init = {}) => {
    try {
      const res = await fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(20_000), ...init });
      return { status: res.status, headers: res.headers, text: await res.text().catch(() => '') };
    } catch (e) {
      return { status: 0, headers: new Headers(), text: '', error: String(e.cause?.code ?? e.message) };
    }
  };
  const ok2xx = (r) => r.status >= 200 && r.status < 300;
  // 301/308 на «/путь/» допустимы: Apache добавляет слеш к каталогу (см. задачу 2.6)
  const reachable = (r) => ok2xx(r) || [301, 308].includes(r.status);
  const json = (r) => { try { return JSON.parse(r.text); } catch { return null; } };

  // Закрытый режим (заглушка на /) или открытый — определяем по главной
  const home = await get('/');
  check('GET / отвечает 200', home.status === 200, home.error ?? `код ${home.status}`);
  const closed = /<main[^>]*data-gate/.test(home.text); // не просто строка: селектор [data-gate] есть и в CSS открытой главной
  if (closed) {
    check('закрытый режим: на / заглушка «в разработке»', home.text.includes('в разработке'));
    check('закрытый режим: на / нет каталога спектаклей', !home.text.includes('data-stage'));
    const preview = await get('/preview');
    check('GET /preview отвечает', reachable(preview), `код ${preview.status}`);
  } else {
    check('открытый режим: на / слайдер спектаклей', home.text.includes('data-stage'));
  }
  check('на всех страницах стоит Referrer-Policy (meta)', home.text.includes('name="referrer"'));

  for (const path of ['/goroda', '/cookies', '/sitemap-index.xml', '/robots.txt']) {
    const r = await get(path);
    check(`GET ${path} отвечает`, reachable(r), r.error ?? `код ${r.status}`);
  }

  // Публичный API постов читается, запись и админка — без входа закрыты
  const posts = await get('/api.php');
  check('GET /api.php отдаёт JSON-массив', ok2xx(posts) && Array.isArray(json(posts)));
  const write = await get('/api.php', { method: 'POST', body: new FormData() });
  check('POST /api.php без сессии → 401', write.status === 401, `код ${write.status}`);
  const status = await get('/api.php?action=status');
  check('админка: без входа authenticated=false', json(status)?.authenticated === false);
  check('GET /api/admin-export.php без админа → 401', (await get('/api/admin-export.php?type=waitlist')).status === 401);
  check('GET /api/admin-agents.php без админа → 403', (await get('/api/admin-agents.php')).status === 403);
  check('закулисье без сессии → 403', (await get('/api/backstage.php?file=x.txt')).status === 403);

  // Формы: honeypot отвечает 200 и ничего не сохраняет
  const hp = await get('/api/forms.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'waitlist', name: 'smoke', email: 'smoke@example.com', consent: true, website: 'bot', filled_ms: 9999 }),
  });
  check('форма: honeypot → 200 {ok:true}', hp.status === 200 && json(hp)?.ok === true, `код ${hp.status}`);

  // Настройка сервера: конфиг, блок db, подключение, таблицы, обязательные ключи (api/health.php — только булевы значения)
  const health = json(await get('/api/health.php'));
  if (!health) check('сервер настроен: /api/health.php отвечает JSON', false);
  else {
    const bad = [];
    if (!health.config_file) bad.push('нет shagali-config.php');
    if (!health.db_config) bad.push('нет блока db в конфиге');
    if (health.db_config && !health.db_connect) bad.push(`нет подключения к БД (${health.db_error})`);
    for (const [t, present] of Object.entries(health.tables ?? {})) if (health.db_connect && !present) bad.push(`нет таблицы ${t}`);
    for (const k of ['rate_salt', 'site_url', 'mail_from']) if (!health.keys?.[k]) bad.push(`нет ключа ${k}`);
    check('сервер настроен (конфиг, БД, таблицы, ключи)', bad.length === 0, bad.join('; '));
  }

  // Личный кабинет и вход
  const me = await get('/api/auth.php?action=me');
  check('кабинет: /me без входа → 200 с user=null', ok2xx(me) && json(me)?.user === null, `код ${me.status}`);
  check('кабинет: nosniff на ответах API', me.headers.get('x-content-type-options') === 'nosniff');
  const gate = await get('/api/gate.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: '\u0000smoke-wrong' }) });
  check('вход по паролю: неверный пароль → 401 (503 = пароль на сервере не задан)', gate.status === 401, `код ${gate.status}`);

  // Служебное из веба недоступно (404 или 403 — любой не-200)
  for (const path of ['/sql/001_init.sql', '/sql/', '/docker/config.local.php', '/shagali-config.php', '/.git/config', '/.env', '/api/_db.php']) {
    const r = await get(path);
    check(`${path} недоступен`, !ok2xx(r) || r.text.trim() === '', `код ${r.status}`);
  }
  return { checks, failures, closed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[2] ?? 'http://localhost:8080';
  const { checks, failures, closed } = await smoke(base);
  console.log(`smoke ${base}: режим ${closed ? 'закрытый' : 'открытый'}, проверок ${checks}, проблем ${failures.length}`);
  if (failures.length) {
    console.error(failures.map((f) => `  ✘ ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('smoke — ок');
}
