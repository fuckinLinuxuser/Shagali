// Клиент личного кабинета: запросы к /api/auth.php с CSRF-токеном из сессии. Весь вывод — только через textContent.
const API = '/api/auth.php';
let csrfToken: string | null = null;

async function getCsrf(force = false): Promise<string> {
  if (force || !csrfToken) {
    const res = await fetch(`${API}?action=csrf`, { credentials: 'same-origin' });
    csrfToken = ((await res.json()) as { csrf: string }).csrf;
  }
  return csrfToken;
}

export type ApiResult = { status: number; body: { error?: string; errors?: Record<string, string>; user?: Record<string, string>; csrf?: string } };

export async function authPost(action: string, data: Record<string, unknown>): Promise<ApiResult> {
  const send = async (token: string) =>
    fetch(`${API}?action=${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify(data),
    });
  let res = await send(await getCsrf());
  if (res.status === 403) res = await send(await getCsrf(true)); // токен мог устареть вместе с сессией
  const body = await res.json().catch(() => ({}));
  if (body?.csrf) csrfToken = body.csrf; // после входа токен новый
  return { status: res.status, body };
}

export async function authMe(): Promise<ApiResult> {
  const res = await fetch(`${API}?action=me`, { credentials: 'same-origin' });
  const body = await res.json().catch(() => ({}));
  if (body?.csrf) csrfToken = body.csrf;
  return { status: res.status, body };
}

const FALLBACK = 'Не удалось выполнить запрос. Проверьте соединение и попробуйте ещё раз.';

export function errorText(r: ApiResult): string {
  if (r.body.errors) return Object.values(r.body.errors).join(' ');
  return r.body.error ?? FALLBACK;
}

// Форма: проверка полей браузером → запрос → onOk при успехе, иначе текст ошибки в [data-form-error].
export function bindAuthForm(
  form: HTMLFormElement,
  opts: { action: string; payload?: (data: FormData) => Record<string, unknown>; ok: ReadonlyArray<number>; onOk: (r: ApiResult) => void },
) {
  const error = form.querySelector<HTMLElement>('[data-form-error]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (error) error.hidden = true;
    if (submit) submit.disabled = true;
    const data = new FormData(form);
    const payload = opts.payload
      ? opts.payload(data)
      : { ...Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === 'string')), consent: data.get('consent') === 'on' };
    try {
      const r = await authPost(opts.action, payload);
      if (opts.ok.includes(r.status)) {
        opts.onOk(r);
        return;
      }
      if (error) {
        error.textContent = errorText(r);
        error.hidden = false;
      }
    } catch {
      if (error) {
        error.textContent = FALLBACK;
        error.hidden = false;
      }
    }
    if (submit) submit.disabled = false;
  });
}
