import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PAPER } from './paper';

it('the paper is the stylesheet’s', () => {
  const css = readFileSync(new URL('./site.css', import.meta.url), 'utf8');
  expect(css).toContain(`--hj-paper: #${PAPER.map((value) => value.toString(16).padStart(2, '0')).join('')};`);
});
