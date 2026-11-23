// Клиент форм сайта (лист ожидания, обратная связь): отправка в /api/forms.php и показ результата.
// Разметка — FormFooter.astro (согласие, honeypot, блоки результата). «Спасибо» показываем только после ответа 201.
const ENDPOINT = '/api/forms.php';

const MESSAGES = {
  rate: 'Слишком много попыток. Подождите минуту и отправьте ещё раз.',
  fail: 'Не удалось отправить. Проверьте соединение и попробуйте ещё раз чуть позже.',
  fast: 'Форма отправлена слишком быстро. Подождите пару секунд и нажмите ещё раз.',
  invalid: 'Проверьте поля формы и попробуйте ещё раз.',
};

export function bindForm(form: HTMLFormElement) {
  const error = form.querySelector<HTMLElement>('[data-form-error]');
  const success = form.querySelector<HTMLElement>('[data-form-success]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const openedAt = performance.now(); // сколько форма открыта — сервер отсекает ботов, отправляющих мгновенно

  const showError = (text: string) => {
    if (!error) return;
    error.textContent = text;
    error.hidden = false;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return; // required, email, галочка согласия — без запроса
    if (error) error.hidden = true;
    if (submit) submit.disabled = true;

    const data = new FormData(form);
    const payload = {
      ...Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === 'string')),
      consent: data.get('consent') === 'on',
      filled_ms: Math.round(performance.now() - openedAt),
    };

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 201) {
        form.reset();
        form.dataset.done = '';
        if (success) success.hidden = false;
        success?.focus();
        return;
      }
      if (res.status === 429) showError(MESSAGES.rate);
      else if (res.status === 422) {
        const body = await res.json().catch(() => ({}));
        const errors: Record<string, string> = body?.errors ?? {};
        showError(errors.time ? MESSAGES.fast : Object.values(errors).join(' ') || MESSAGES.invalid);
      } else showError(MESSAGES.fail);
    } catch {
      showError(MESSAGES.fail);
    }
    if (submit) submit.disabled = false;
  });
}
