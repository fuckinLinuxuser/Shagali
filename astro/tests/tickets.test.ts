// Задача 1.4: адреса виджета cbiletom (src/lib/tickets.ts).
import { describe, expect, it } from 'vitest';
import { FALLBACK_AFTER_MS, eventPageUrl, ticketFrameUrl } from '../src/lib/tickets';

describe('ticketFrameUrl', () => {
  it('модуль продаж cbiletom для события', () => {
    expect(ticketFrameUrl(2717)).toBe('https://cbiletom.ru/widget/1/frame.php?id=2717&mode=1');
  });
  it('принимает id строкой из data-атрибута', () => {
    expect(ticketFrameUrl('14088')).toBe('https://cbiletom.ru/widget/1/frame.php?id=14088&mode=1');
  });
  it('не пропускает мусор: нельзя подставить чужой адрес через id', () => {
    for (const bad of ['', 'abc', '1&evil=1', '2717/../x', '-5', '0', '1.5', 'javascript:alert(1)', null, undefined]) {
      expect(() => ticketFrameUrl(bad as never), String(bad)).toThrow();
    }
  });
});

describe('eventPageUrl', () => {
  it('страница события — запасная ссылка, если виджет не загрузился', () => {
    expect(eventPageUrl(2717)).toBe('https://cbiletom.ru/event.php?event=2717');
  });
  it('тоже проверяет id', () => {
    expect(() => eventPageUrl('x' as never)).toThrow();
  });
});

describe('FALLBACK_AFTER_MS', () => {
  it('запасная ссылка появляется через 7 секунд', () => {
    expect(FALLBACK_AFTER_MS).toBe(7000);
  });
});
