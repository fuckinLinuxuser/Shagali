// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import contentIntegrity from './scripts/content-integrity.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://shagali.ru',
  // /collaboration и /spasibo скрыты: страницы открываются по адресу, но в карту сайта не попадают
  integrations: [sitemap({ filter: (page) => !/\/(collaboration|spasibo)\/?$|\/lk(\/|$)/.test(page) }), contentIntegrity()],

  // Переключаем Astro в полностью статический режим
  output: 'static',

  // Рекомендуемые настройки для корректных URL без косой черты в конце
  trailingSlash: 'never',
  build: {
    format: 'directory'
  }
});
