import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import config from '../vite.config.ts';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

it('binds Vite development and preview to loopback by default with explicit LAN scripts', () => {
  expect(config({ command: 'serve', mode: 'development' })).toMatchObject({
    server: { host: '127.0.0.1', port: 5173 },
    preview: { host: '127.0.0.1', port: 4173 },
  });
  expect(readJson('../package.json').scripts).toMatchObject({
    dev: 'vite',
    preview: 'vite preview',
    'dev:lan': 'vite --host 0.0.0.0',
    'preview:lan': 'vite preview --host 0.0.0.0',
  });
});

it('launches the two MCP servers at the selected exact versions', () => {
  const { mcpServers } = readJson('../../.mcp.json');
  expect(mcpServers['chrome-devtools'].args).toEqual(['-y', 'chrome-devtools-mcp@1.14.0']);
  expect(mcpServers.playwright.args).toEqual(['-y', '@playwright/mcp@0.0.86']);
});
