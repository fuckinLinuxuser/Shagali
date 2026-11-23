// Задача 5.2: заголовки безопасности. Страницы — <meta name="referrer"> (статику на проде отдаёт nginx, .htaccess не читается);
// PHP-ответы — X-Content-Type-Options и Referrer-Policy из самих скриптов.
import { expect, test } from './fixtures';

test('страницы сайта и заглушка задают Referrer-Policy через meta', async ({ page }) => {
  for (const path of ['/', '/goroda', '/zastavka', '/lk/login', '/spasibo']) {
    await page.goto(path);
    await expect(page.locator('meta[name="referrer"]'), path).toHaveAttribute('content', 'strict-origin-when-cross-origin');
  }
});

test('PHP-ответы: nosniff и Referrer-Policy', async ({ request }) => {
  const urls = ['/api.php', '/api/auth.php?action=csrf', '/api/auth.php?action=me', '/api/backstage.php?file=x', '/api/admin-export.php?type=waitlist', '/api/admin-agents.php'];
  for (const url of urls) {
    const res = await request.get(url);
    expect(res.headers()['x-content-type-options'], url).toBe('nosniff');
    expect(res.headers()['referrer-policy'], url).toBe('strict-origin-when-cross-origin');
  }
  for (const url of ['/api/forms.php', '/api/gate.php']) {
    const res = await request.post(url, { data: {} });
    expect(res.headers()['x-content-type-options'], url).toBe('nosniff');
  }
});
