import { defineConfig } from 'vite';

// Relative base: the built site works from any folder (GitHub Pages project sites, Netlify, Vercel).
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true, host: true },
  preview: { port: 4173, strictPort: true, host: true },
  build: { target: 'es2022' },
});
