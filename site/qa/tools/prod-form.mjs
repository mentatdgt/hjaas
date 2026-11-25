// Production build check: the form must not claim a send when no endpoint is configured.
// Run `VITE_FORM_ENDPOINT= npm run build && npm run preview` first (.env.production names one). node qa/tools/prod-form.mjs out.png
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const out = process.argv[2] ?? 'qa/prod-form-error.png';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
// Production ignores ?all=50, so start from saved progress instead: every spot of every scene, read from the sources.
const scenes = Object.fromEntries(['build', 'grow', 'design', 'film', 'set'].map((id) => {
  const found = [...readFileSync(new URL(`../../src/scenes/${id}.ts`, import.meta.url), 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1]);
  if (found.length !== 10) throw new Error(`${id}: ${found.length} spots read`);
  return [id, { found, seen: true, panX: null }];
}));
await page.addInitScript((saved) => {
  localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: saved, unlocked: false, panned: false }));
}, scenes);
await page.goto(process.env.HJ_PROD ?? 'http://localhost:4173/');
await page.waitForSelector('.hj-contact', { state: 'visible' });
await page.waitForTimeout(1500);
await page.click('.hj-contact');
await page.waitForTimeout(500);
const onOpen = await page.evaluate(() => ({
  notice: document.querySelector('.hj-notice').hidden ? null : document.querySelector('.hj-notice').textContent,
  sendDisabled: document.querySelector('.hj-form .hj-send').getAttribute('aria-disabled'),
}));
await page.fill('#hj-name', 'Wren');
await page.fill('#hj-email', 'wren@example.com');
await page.click('.hj-chip:nth-child(2)');
await page.fill('#hj-message', 'Testing the production build.');
await page.click('.hj-form .hj-send', { force: true }); // Send is switched off; press it anyway
await page.waitForTimeout(600);
const state = await page.evaluate(() => ({
  alert: document.querySelector('.hj-alert').hidden ? null : document.querySelector('.hj-alert').textContent,
  sentShown: !document.querySelector('.hj-sent').hidden,
  formKept: document.querySelector('#hj-message').value,
}));
await page.screenshot({ path: out });
await browser.close();
console.log(JSON.stringify({ onOpen, state, errors }, null, 1));
