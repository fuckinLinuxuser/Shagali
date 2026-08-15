// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://shagali.ru',
  integrations: [sitemap()],

  // Переключаем Astro в полностью статический режим
  output: 'static',

  // Рекомендуемые настройки для корректных URL без косой черты в конце
  trailingSlash: 'never',
  build: {
    format: 'directory'
  },

  // В деве api.php выполняется отдельным PHP-сервером (см. README/скрипт dev:php),
  // проксируем запросы к нему, чтобы фронтенд работал как на проде через один порт.
  vite: {
    server: {
      proxy: {
        '/api.php': 'http://localhost:8000'
      }
    }
  }
});
