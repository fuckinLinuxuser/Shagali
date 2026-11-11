// Задача 0.1: запись в api.php доступна только админу (сессия + CSRF), CORS — только свой домен.
// Тест поднимает `php -S` на временной копии public/ и временном конфиге, боевой posts.json не трогает.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PASSWORD = 'test-only-password-' + Math.random().toString(36).slice(2);
const OWN_ORIGIN = 'https://shagali.ru';

let dir: string;
let base: string;
let server: ChildProcess;
let postsFile: string;

function freePort(): Promise<number> {
  return new Promise((res) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => res(port));
    });
  });
}

async function waitUp(url: string) {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('php -S не поднялся');
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'shagali-api-'));
  const web = join(dir, 'www');
  mkdirSync(web);
  copyFileSync(resolve(__dirname, '../public/api.php'), join(web, 'api.php'));
  postsFile = join(web, 'posts.json');
  writeFileSync(postsFile, '[]');

  const hash = spawnSync('php', ['-r', 'echo password_hash($argv[1], PASSWORD_DEFAULT);', PASSWORD])
    .stdout.toString();
  const configPath = join(dir, 'shagali-config.php');
  writeFileSync(configPath, `<?php return ['admin_password_hash' => '${hash}'];`);

  const port = await freePort();
  base = `http://127.0.0.1:${port}/api.php`;
  server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', web], {
    env: { ...process.env, SHAGALI_CONFIG: configPath },
    stdio: 'ignore',
  });
  await waitUp(base);
});

afterAll(() => {
  server?.kill();
  rmSync(dir, { recursive: true, force: true });
});

const snapshot = () => readFileSync(postsFile, 'utf8');

function postForm(extra: Record<string, string> = {}) {
  const f = new FormData();
  f.set('title', 'Тест');
  f.set('date', '2026-11-12');
  f.set('shortText', 'кратко');
  f.set('fullText', 'полный текст');
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

async function login(password = PASSWORD) {
  const res = await fetch(`${base}?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
  return { res, cookie };
}

async function csrfFor(cookie: string) {
  const res = await fetch(`${base}?action=csrf`, { headers: { cookie } });
  return { res, token: ((await res.json()) as { csrf?: string }).csrf ?? '' };
}

describe('запись без сессии', () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    it(`${method} → 401, posts.json не изменился`, async () => {
      const before = snapshot();
      const url = method === 'POST' ? base : `${base}?id=1`;
      const res = await fetch(url, {
        method,
        body: method === 'DELETE' ? undefined : postForm(),
        // старый статический токен больше ничего не открывает
        headers: { 'X-Admin-Token': 'any-static-token' },
      });
      expect(res.status).toBe(401);
      expect(snapshot()).toBe(before);
    });
  }

  it('GET постов остаётся публичным', async () => {
    const res = await fetch(base);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('вход', () => {
  it('неверный пароль → 401, cookie не выдаётся', async () => {
    const { res, cookie } = await login('wrong');
    expect(res.status).toBe(401);
    expect(cookie).not.toMatch(/PHPSESSID=\w+/);
  });

  it('верный пароль → 200, cookie httponly + samesite=Lax', async () => {
    const { res } = await login();
    expect(res.status).toBe(200);
    const raw = (res.headers.get('set-cookie') ?? '').toLowerCase();
    expect(raw).toContain('httponly');
    expect(raw).toContain('samesite=lax');
  });

  it('status без сессии → 200 authenticated:false, без токена', async () => {
    const res = await fetch(`${base}?action=status`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it('status с сессией → authenticated:true и csrf', async () => {
    const { cookie } = await login();
    const res = await fetch(`${base}?action=status`, { headers: { cookie } });
    const data = (await res.json()) as { authenticated: boolean; csrf: string };
    expect(data.authenticated).toBe(true);
    expect(data.csrf.length).toBeGreaterThanOrEqual(32);
  });

  it('csrf-токен без сессии не выдаётся', async () => {
    const res = await fetch(`${base}?action=csrf`);
    expect(res.status).toBe(401);
  });
});

describe('запись с сессией', () => {
  it('POST без CSRF → 403, файл не изменился', async () => {
    const { cookie } = await login();
    const before = snapshot();
    const res = await fetch(base, { method: 'POST', body: postForm(), headers: { cookie } });
    expect(res.status).toBe(403);
    expect(snapshot()).toBe(before);
  });

  it('POST с неверным CSRF → 403', async () => {
    const { cookie } = await login();
    const res = await fetch(base, {
      method: 'POST',
      body: postForm(),
      headers: { cookie, 'X-CSRF-Token': 'nope' },
    });
    expect(res.status).toBe(403);
  });

  it('DELETE без CSRF → 403', async () => {
    const { cookie } = await login();
    const res = await fetch(`${base}?id=1`, { method: 'DELETE', headers: { cookie } });
    expect(res.status).toBe(403);
  });

  it('POST с сессией и CSRF → 201, затем DELETE → 200', async () => {
    const { cookie } = await login();
    const { token } = await csrfFor(cookie);
    expect(token.length).toBeGreaterThanOrEqual(32);

    const created = await fetch(base, {
      method: 'POST',
      body: postForm(),
      headers: { cookie, 'X-CSRF-Token': token },
    });
    expect(created.status).toBe(201);

    const posts = JSON.parse(snapshot());
    expect(posts).toHaveLength(1);

    const removed = await fetch(`${base}?id=${posts[0].id}`, {
      method: 'DELETE',
      headers: { cookie, 'X-CSRF-Token': token },
    });
    expect(removed.status).toBe(200);
    expect(JSON.parse(snapshot())).toEqual([]);
  });

  it('после выхода сессия больше не даёт писать', async () => {
    const { cookie } = await login();
    const { token } = await csrfFor(cookie);
    await fetch(`${base}?action=logout`, { method: 'POST', headers: { cookie, 'X-CSRF-Token': token } });
    const res = await fetch(base, {
      method: 'POST',
      body: postForm(),
      headers: { cookie, 'X-CSRF-Token': token },
    });
    expect(res.status).toBe(401);
  });
});

describe('CORS', () => {
  it('нет Access-Control-Allow-Origin: *', async () => {
    const res = await fetch(base, { headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('свой домен разрешён, с credentials', async () => {
    const res = await fetch(base, { headers: { Origin: OWN_ORIGIN } });
    expect(res.headers.get('access-control-allow-origin')).toBe(OWN_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('preflight с чужого домена не получает разрешений', async () => {
    const res = await fetch(base, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
