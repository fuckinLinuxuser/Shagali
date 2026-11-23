// Письма стенда: mailpit (docker-compose), веб-интерфейс и API на :8025. В тестах читаем отправленное API-запросами.
const BASE = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export async function clearMail() {
  await fetch(`${BASE}/api/v1/messages`, { method: 'DELETE' });
}

type Summary = { ID: string; To: { Address: string }[]; Subject: string };

export async function listMail(): Promise<Summary[]> {
  const res = await fetch(`${BASE}/api/v1/messages`);
  return ((await res.json()) as { messages: Summary[] }).messages ?? [];
}

// Ждёт письмо адресату (до 8 с) и возвращает текст последнего.
export async function waitForMail(to: string, timeoutMs = 8000): Promise<{ subject: string; text: string }> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const hit = (await listMail()).find((m) => m.To.some((t) => t.Address.toLowerCase() === to.toLowerCase()));
    if (hit) {
      const full = (await (await fetch(`${BASE}/api/v1/message/${hit.ID}`)).json()) as { Text: string; Subject: string };
      return { subject: full.Subject, text: full.Text };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`письмо для ${to} не пришло за ${timeoutMs} мс`);
}

export const tokenFrom = (text: string): string => /token=([a-f0-9]{64})/.exec(text)?.[1] ?? '';
