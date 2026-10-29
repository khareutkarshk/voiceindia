import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Static output: every page is rendered to HTML at build time, so crawlers and visitors
// get the full text in the first response. CSS is inlined so the first paint needs no extra request.
export default defineConfig({
  site: 'https://voiceindia.si',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'always', format: 'directory' },
  compressHTML: true,
  prefetch: false,
  vite: { plugins: [tailwindcss()], build: { modulePreload: { polyfill: false } } },
});
