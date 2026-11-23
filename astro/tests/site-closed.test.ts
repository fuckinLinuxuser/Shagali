// Закрытый режим сайта: на / заглушка, настоящая главная — на /preview, все страницы с noindex. Открытый — как обычно.
// Собираем настоящий проект во временную папку с флагом SHAGALI_CLOSED (занимает пару секунд).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ASTRO = resolve(__dirname, '..');
const dirs: string[] = [];

function build(closed: '0' | '1') {
  const out = mkdtempSync(join(tmpdir(), 'shagali-closed-'));
  dirs.push(out);
  const r = spawnSync('node', ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', out], {
    cwd: ASTRO,
    env: { ...process.env, SHAGALI_CLOSED: closed },
    encoding: 'utf8',
    timeout: 90_000,
  });
  expect(r.status, r.stderr).toBe(0);
  return (page: string) => readFileSync(join(out, page), 'utf8');
}
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('режим закрытого просмотра', { timeout: 120_000 }, () => {
  it('закрыт: на / заглушка без каталога, /preview — настоящая главная, везде noindex', () => {
    const html = build('1');
    const home = html('index.html');
    expect(home).toContain('data-gate');
    expect(home).not.toContain('data-stage');
    expect(home).toMatch(/name="robots" content="noindex/);
    const preview = html('preview/index.html');
    expect(preview).toContain('data-stage');
    expect(preview).toMatch(/name="robots" content="noindex/);
    expect(html('goroda/index.html')).toMatch(/name="robots" content="noindex/);
    expect(html('zastavka/index.html')).toContain('data-gate');
  });

  it('открыт: на / настоящая главная без noindex, /preview перенаправляет на /', () => {
    const html = build('0');
    const home = html('index.html');
    expect(home).toContain('data-stage');
    expect(home).not.toMatch(/content="noindex/);
    expect(html('preview/index.html')).toMatch(/http-equiv="refresh" content="0; ?url=\/"/);
    expect(html('goroda/index.html')).not.toMatch(/content="noindex/);
  });
});
