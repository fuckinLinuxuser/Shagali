// Версия политики, которую PHP пишет в БД вместе с согласием (consent_version), одна для форм и кабинета.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../public/api/${p}`, import.meta.url), 'utf8');
const version = (src: string) => /POLICY_VERSION_DEFAULT = '([^']+)'/.exec(src)?.[1];

describe('версия политики по умолчанию', () => {
  it('в forms.php и _auth.php одна и та же', () => {
    expect(version(read('forms.php'))).toBeTruthy();
    expect(version(read('_auth.php'))).toBe(version(read('forms.php')));
  });
});
