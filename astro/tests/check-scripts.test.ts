import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs без типов
import { checkLinks } from '../scripts/check-links.mjs';
// @ts-expect-error — .mjs без типов
import { checkContent } from '../scripts/check-content.mjs';

let dirs: string[] = [];
function site(files: Record<string, string>) {
  const d = mkdtempSync(join(tmpdir(), 'shagali-dist-'));
  dirs.push(d);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(d, name)), { recursive: true });
    writeFileSync(join(d, name), body);
  }
  return d;
}
afterEach(() => {
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
  dirs = [];
});

describe('check:links', () => {
  it('чистый сайт — без проблем', () => {
    const d = site({
      'index.html': '<a href="/about">a</a><a href="#x">x</a><div id="x"></div><a href="https://t.me/x">t</a>',
      'about/index.html': '<a href="/">home</a>',
    });
    expect(checkLinks(d)).toEqual([]);
  });

  it('находит битую ссылку и битый якорь', () => {
    const d = site({ 'index.html': '<a href="/nope">n</a><a href="#missing">m</a>' });
    const p = checkLinks(d).join('\n');
    expect(p).toContain('битая ссылка /nope');
    expect(p).toContain('#missing');
  });

  it('находит href="#"', () => {
    const d = site({ 'about/index.html': '<a href="#">x</a>' });
    expect(checkLinks(d, { allowEmptyHash: {} })).toEqual(['about/index.html: href="#"']);
  });

  it('allowlist пропускает href="#" только в указанном файле', () => {
    const d = site({ 'index.html': '<a href="#">x</a>', 'b/index.html': '<a href="#">y</a>' });
    const p = checkLinks(d, { allowEmptyHash: { 'index.html': 'шаблон' } });
    expect(p).toEqual(['b/index.html: href="#"']);
  });

  it('шаблоны внутри <script> не считаются ссылками', () => {
    const d = site({ 'index.html': '<script>el.innerHTML = `<img src="${src}">`</script>' });
    expect(checkLinks(d)).toEqual([]);
  });

  it('server-only пути (images/videos) не считаются битыми', () => {
    const d = site({ 'index.html': '<img src="/images/a.jpg"><video src="/videos/v.mp4"></video>' });
    expect(checkLinks(d)).toEqual([]);
  });
});

describe('check:content', () => {
  it('находит TODO(контент) и указывает файл и строку', () => {
    const d = site({ 'index.html': '<p>ok</p>\n<p>TODO(контент): афиша</p>' });
    expect(checkContent(d)).toEqual([expect.stringContaining('index.html:2')]);
  });
  it('чистый dist проходит', () => {
    expect(checkContent(site({ 'index.html': '<p>текст</p>' }))).toEqual([]);
  });
});
