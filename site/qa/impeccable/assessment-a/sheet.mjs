// Assessment A helper: lay chosen sequence frames out large, for close reading.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [, , name, cols, cellW, ...files] = process.argv;
const OUT = path.resolve('qa/impeccable/assessment-a/shots');
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: cols * (+cellW + 8) + 16, height: 600 } })).newPage();
await p.setContent(`<body style="margin:8px;background:#222;font:12px monospace;color:#fff"><div style="display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:8px">${files.map((f) => `<div><img src="data:image/png;base64,${fs.readFileSync(path.join(OUT, f)).toString('base64')}" style="width:${cellW}px;display:block"><div>${f}</div></div>`).join('')}</div></body>`);
await p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
await b.close();
