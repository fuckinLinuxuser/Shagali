// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import contentIntegrity from './scripts/content-integrity.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://shagali.ru',
  integrations: [sitemap(), contentIntegrity()],

  // Переключаем Astro в полностью статический режим
  output: 'static',

  // Рекомендуемые настройки для корректных URL без косой черты в конце
  trailingSlash: 'never',
  build: {
    format: 'directory'
  }
});
