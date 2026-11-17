// Production build check: the form must not claim a send when no endpoint is configured.
// Run `npm run build && npm run preview` first. node qa/tools/prod-form.mjs out.png
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'qa/prod-form-error.png';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
await page.goto('http://localhost:4173/?intro=off&found=10');
await page.waitForSelector('.hj-pin-action:not([hidden])');
await page.waitForTimeout(1500);
await page.click('.hj-pin-action');
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
