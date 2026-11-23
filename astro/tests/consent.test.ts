// Cookie-плашка: хранение выбора посетителя (src/lib/consent.ts).
import { describe, expect, it } from 'vitest';
import { CONSENT_COOKIE, CONSENT_VERSION, COUNTER_COOKIE_PREFIXES, isCounterCookie, parseConsent, serializeConsent } from '../src/lib/consent';

describe('parseConsent: выбор из document.cookie', () => {
  it('нет cookie — нет выбора', () => {
    expect(parseConsent('')).toBeNull();
    expect(parseConsent('a=1; b=2')).toBeNull();
  });
  it('принято и отклонено', () => {
    expect(parseConsent(`${CONSENT_COOKIE}=v${CONSENT_VERSION}:accepted`)).toBe('accepted');
    expect(parseConsent(`x=1; ${CONSENT_COOKIE}=v${CONSENT_VERSION}:declined; y=2`)).toBe('declined');
  });
  it('другая версия или мусор — спрашиваем заново', () => {
    expect(parseConsent(`${CONSENT_COOKIE}=v0:accepted`)).toBeNull();
    expect(parseConsent(`${CONSENT_COOKIE}=v${CONSENT_VERSION + 1}:accepted`)).toBeNull();
    expect(parseConsent(`${CONSENT_COOKIE}=accepted`)).toBeNull();
    expect(parseConsent(`${CONSENT_COOKIE}=v${CONSENT_VERSION}:maybe`)).toBeNull();
  });
  it('cookie со схожим именем не путается', () => {
    expect(parseConsent(`x${CONSENT_COOKIE}=v${CONSENT_VERSION}:accepted`)).toBeNull();
  });
});

describe('serializeConsent: запись выбора', () => {
  it('на год, для всего сайта, SameSite=Lax', () => {
    const c = serializeConsent('accepted', false);
    expect(c).toContain(`${CONSENT_COOKIE}=v${CONSENT_VERSION}:accepted`);
    expect(c).toContain('Max-Age=31536000');
    expect(c).toContain('Path=/');
    expect(c).toContain('SameSite=Lax');
    expect(c).not.toContain('Secure');
  });
  it('по https — Secure', () => {
    expect(serializeConsent('declined', true)).toContain('Secure');
  });
  it('записанное читается обратно', () => {
    for (const choice of ['accepted', 'declined'] as const) {
      expect(parseConsent(serializeConsent(choice, false).split(';')[0])).toBe(choice);
    }
  });
});

describe('isCounterCookie: cookie счётчиков, которые удаляем при отказе', () => {
  it('cookie Top.Mail.Ru', () => {
    expect(isCounterCookie('tmr_lvid')).toBe(true);
    expect(isCounterCookie('_tmr')).toBe(true);
  });
  it('необходимые и чужие не трогаем', () => {
    expect(isCounterCookie(CONSENT_COOKIE)).toBe(false);
    expect(isCounterCookie('PHPSESSID')).toBe(false);
    expect(COUNTER_COOKIE_PREFIXES.length).toBeGreaterThan(0);
  });
});

describe('cookie Яндекс.Метрики считаются cookie счётчиков', () => {
  it('_ym_* удаляются при отказе, свои cookie сайта — нет', () => {
    for (const name of ['_ym_uid', '_ym_d', '_ym_isad', '_ym_visorc', 'tmr_lvid']) expect(isCounterCookie(name), name).toBe(true);
    for (const name of ['shagali_cookie_consent', 'shagali_preview', 'PHPSESSID']) expect(isCounterCookie(name), name).toBe(false);
  });
});
