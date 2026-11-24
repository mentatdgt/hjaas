import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { SCENES } from '../scenes';

const script = readFileSync(new URL('../../public/room-route.js', import.meta.url), 'utf8');

it.each([
  ['', 'build', 'scene1'],
  ['#unknown', 'build', 'scene1'],
  ['#constructor', 'build', 'scene1'],
  ['#__proto__', 'build', 'scene1'],
  ['#%E0%A4%A', 'build', 'scene1'],
  ['#%67r%6fw', 'grow', 'scene2'],
])('normalises %j to %s for the router and preload', (fragment, id, folder) => {
  const window = {};
  runInNewContext(script, { window });
  expect(window.hjaasRoom(fragment)).toEqual({ id, folder });
});

it('keeps every route aligned with its scene plate', () => {
  const window = {};
  runInNewContext(script, { window });
  for (const scene of SCENES) {
    expect(window.hjaasRoom(`#${scene.id}`)).toEqual({ id: scene.id, folder: scene.assets.replace(/\/$/, '') });
  }
});
