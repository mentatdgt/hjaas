import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { headersForEndpoint } from './scripts/security-headers.mjs';

// Relative base: the built site works from any folder (GitHub Pages project sites, Netlify, Vercel).
export default defineConfig(({ command, mode }) => {
  const endpoint = command === 'build' ? loadEnv(mode, process.cwd(), 'VITE_').VITE_FORM_ENDPOINT : undefined;
  return {
    base: './',
    server: { port: 5173, strictPort: true, host: true },
    preview: { port: 4173, strictPort: true, host: true },
    build: { target: 'es2022' },
    plugins: [{
      name: 'hjaas-security-headers',
      apply: 'build',
      generateBundle() {
        const source = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8');
        this.emitFile({ type: 'asset', fileName: '_headers', source: headersForEndpoint(source, endpoint) });
      },
    }],
  };
});
