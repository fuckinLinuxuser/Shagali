// Cookie-плашка: выбор посетителя хранится в cookie первой стороны и читается без сервера.
// Формат значения: v<версия>:accepted|declined. Другая версия (политика изменилась) = выбора нет, спросим заново.
// Чистые функции — их гоняет Vitest (tests/consent.test.ts).

export const CONSENT_COOKIE = 'shagali_cookie_consent';
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // год

export type ConsentChoice = 'accepted' | 'declined';

export function parseConsent(cookieString: string): ConsentChoice | null {
  for (const part of cookieString.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== CONSENT_COOKIE) continue;
    const match = /^v(\d+):(accepted|declined)$/.exec(rest.join('='));
    if (match && Number(match[1]) === CONSENT_VERSION) return match[2] as ConsentChoice;
  }
  return null;
}

export function serializeConsent(choice: ConsentChoice, secure: boolean): string {
  const parts = [
    `${CONSENT_COOKIE}=v${CONSENT_VERSION}:${choice}`,
    `Max-Age=${CONSENT_MAX_AGE}`,
    'Path=/',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

// Cookie счётчиков: при отказе после согласия их удаляем. Необходимые cookie сайта сюда не попадают.
export const COUNTER_COOKIE_PREFIXES = ['tmr_', '_tmr', '_ym_'];

export function isCounterCookie(name: string): boolean {
  return COUNTER_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix));
}
