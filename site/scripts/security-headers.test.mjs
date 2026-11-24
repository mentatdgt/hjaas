import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { headersForEndpoint } from './security-headers.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const template = read('../public/_headers');

it('ships a same-origin policy and adds only the configured form origin', () => {
  expect(headersForEndpoint(template)).toEqual(template);
  expect(headersForEndpoint(template, '/api/contact')).toEqual(template);
  const headers = headersForEndpoint(template, 'https://forms.example.org:8443/inbox?space=portfolio');
  expect(headers).toContain("connect-src 'self' https://forms.example.org:8443;");
  expect(headers).not.toMatch(/\/inbox|space=/);
  expect(headers).toContain("frame-ancestors 'none'");
  expect(headers).toContain("script-src 'self';");
  expect(headers).toContain("worker-src 'self';");
  expect(headers).not.toMatch(/unsafe-inline|unsafe-eval/);
});

it.each(['data:application/json,{}', 'https://user:pass@forms.example.org', 'https://forms.example;script-src/forms'])(
  'rejects an invalid form destination from the CSP: %s',
  (endpoint) => expect(() => headersForEndpoint(template, endpoint)).toThrow('VITE_FORM_ENDPOINT'),
);

it('uses external scripts and styles in the page shell', () => {
  const html = read('../index.html');
  expect(html).toContain('src="/room-route.js"');
  expect(html).toContain('href="/shell.css"');
  expect(html).not.toMatch(/<script(?![^>]*\bsrc=)|<style[\s>]/i);
});
