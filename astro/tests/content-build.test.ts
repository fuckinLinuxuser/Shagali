// Сломанные данные должны ронять сборку с понятной ошибкой (а не рендерить пустую карточку).
// Собираем минимальный проект во временной папке с копией src/content и подменёнными данными.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ASTRO = resolve(__dirname, '..');
const PERF = 'src/content/performances/tyumen-2026-08-01-kukushonok.json';
const tmpDirs: string[] = [];

function build(mutate?: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'shagali-build-'));
  tmpDirs.push(root);
  mkdirSync(join(root, 'src/pages'), { recursive: true });
  cpSync(join(ASTRO, 'src/content'), join(root, 'src/content'), { recursive: true });
  cpSync(join(ASTRO, 'src/content.config.ts'), join(root, 'src/content.config.ts'));
  mkdirSync(join(root, 'scripts'));
  cpSync(join(ASTRO, 'scripts/content-integrity.mjs'), join(root, 'scripts/content-integrity.mjs'));
  writeFileSync(
    join(root, 'astro.config.mjs'),
    "import integrity from './scripts/content-integrity.mjs';\nexport default { integrations: [integrity()] };\n",
  );
  writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
  writeFileSync(join(root, 'tsconfig.json'), readFileSync(join(ASTRO, 'tsconfig.json')));
  writeFileSync(join(root, 'src/pages/index.astro'), '---\n---\n<html><body>ok</body></html>\n');
  symlinkSync(join(ASTRO, 'node_modules'), join(root, 'node_modules'));
  mutate?.(root);
  const r = spawnSync('node', [join(ASTRO, 'node_modules/astro/bin/astro.mjs'), 'build', '--root', root], {
    encoding: 'utf8',
    timeout: 90_000,
  });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
}

function editPerformance(change: (p: Record<string, unknown>) => void) {
  return (root: string) => {
    const file = join(root, PERF);
    const p = JSON.parse(readFileSync(file, 'utf8'));
    change(p);
    writeFileSync(file, JSON.stringify(p, null, 2));
  };
}

afterAll(() => tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('сборка и данные', { timeout: 120_000 }, () => {
  it('корректные данные — сборка проходит', () => {
    const r = build();
    expect(r.out).not.toMatch(/InvalidContentEntryDataError/);
    expect(r.status).toBe(0);
  });

  it('on_sale без обязательных полей → сборка падает и называет поле', () => {
    const r = build(editPerformance((p) => (p.status = 'on_sale')));
    expect(r.status).not.toBe(0);
    expect(r.out).toContain('InvalidContentEntryDataError');
    expect(r.out).toContain('tyumen-2026-08-01-kukushonok');
    expect(r.out).toMatch(/on_sale поле time обязательно/);
  });

  it('несуществующая дата → сборка падает', () => {
    const r = build(editPerformance((p) => (p.date = '2026-02-30')));
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/такой даты не существует/);
  });

  it('показ со ссылкой на несуществующий спектакль → сборка падает', () => {
    const r = build(editPerformance((p) => (p.show = 'net-takogo')));
    expect(r.status).not.toBe(0);
    expect(r.out).toContain('Битые ссылки в данных');
    expect(r.out).toContain('net-takogo');
  });
});
