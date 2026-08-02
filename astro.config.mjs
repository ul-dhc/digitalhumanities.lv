import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL || 'https://digitalhumanities.lv',
  base: process.env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'always',
});
