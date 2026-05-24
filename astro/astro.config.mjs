// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://shagali.ru',
  
  integrations: [sitemap()],

  adapter: node({
    mode: 'standalone'
  }),

  // Дополнительные настройки (рекомендуется)
  vite: {
    ssr: {
      noExternal: ['@astrojs/node']
    }
  }
});