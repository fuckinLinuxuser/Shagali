// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://shagali.ru',
  integrations: [sitemap()],

  output: 'server',                    // включаем серверный режим
  adapter: node({
    mode: 'standalone'
  }),

  // Рекомендуемые настройки
  trailingSlash: 'never',
  build: {
    format: 'directory'
  }
});