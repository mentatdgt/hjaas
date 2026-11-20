// Frame gaps through the intro, on a cold load, in Playwright WebKit (review 02, items 1 and 2).
// Needs the production build served: `npm run build && npm run preview` (4173).
//
//   node qa/tools/intro-frames.mjs [runs=3] [iphone|desktop] [load=0] [url]
//
// `load` keeps that many CPU cores busy during every run: a rough stand-in for a slower phone.
//
// Every run is a new browser and a new context: no HTTP cache, no saved progress, so the full intro plays.
// A requestAnimationFrame loop starts before any page script and logs every interval. The brush canvas
// (.hj-paint) going into the page marks the intro's start; the caption finishing its entrance marks the end.
// (Review 03: the markers follow the elegant version, where the caption replaced the counter.)
//
//   endGap   longest interval from the wash (4.0 s after the brush starts) to 1 s after the intro ends
//   fullGap  longest interval from the brush starting to 1 s after the intro ends
//   over50   intervals longer than 50 ms in that same span
//   slow     those intervals, as length@start (ms from the brush starting; the wash starts at 4060)
//   loopGap  longest interval in the 4 s after that (Rachel hammering), and loop50 the count over 50 ms
//   roomReq  when the room image request started (ms from navigation)
//   brush    when the brush canvas went in (ms from navigation)
import { Worker } from 'node:worker_threads';
import { webkit, devices } from 'playwright';

const runs = Number(process.argv[2] ?? 3);
const profile = process.argv[3] ?? 'iphone';
const load = Number(process.argv[4] ?? 0);
const url = process.argv[5] ?? 'http://localhost:4173/';
const burners = Array.from({ length: load }, () => new Worker('for (;;) {}', { eval: true }));
const contextOptions = profile === 'desktop' ? { viewport: { width: 1280, height: 760 } } : { ...devices['iPhone 13'] };

const probe = () => {
  const log = { gaps: [], paintIn: 0, paintOut: 0 };
  window.__frames = log;
  let last = performance.now();
  let counterHidden = false;
  const tick = (now) => {
    log.gaps.push([Math.round(last), Math.round(now - last)]);
    last = now;
    // The counter's entrance is the intro timeline's last tween: its opacity reaching 1 (or being cleared)
    // is the end of the intro, before and after the review 02 fix alike.
    if (log.paintIn && !log.paintOut) {
      const counter = document.querySelector('.hj-caption-main');
      const opacity = counter?.style.opacity;
      if (opacity !== undefined && opacity !== '' && Number(opacity) < 1) counterHidden = true;
      else if (counterHidden && (opacity === '' || opacity === '1')) log.paintOut = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) if (n.classList?.contains('hj-paint')) log.paintIn = performance.now();
    }
  }).observe(document, { childList: true, subtree: true });
};

const results = [];
for (let i = 0; i < runs; i++) {
  const browser = await webkit.launch();
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(probe);
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__frames.paintOut > 0, null, { timeout: 60000 });
  await page.waitForTimeout(5200);
  const r = await page.evaluate(() => {
    const { gaps, paintIn, paintOut } = window.__frames;
    const span = (from, to) => gaps.filter(([at, len]) => at + len >= from && at <= to);
    const max = (list) => list.reduce((m, [at, len]) => (len > m.len ? { at, len } : m), { at: 0, len: 0 });
    const end = span(paintIn + 4000, paintOut + 1000);
    const full = span(paintIn, paintOut + 1000);
    const room = performance.getEntriesByType('resource').find((e) => e.name.includes('room.webp'));
    const loop = span(paintOut + 1000, paintOut + 5000);
    const worst = max(end);
    return {
      endGap: worst.len,
      endGapAt: Math.round(worst.at - paintIn),
      fullGap: max(full).len,
      over50: full.filter(([, len]) => len > 50).length,
      slow: full.filter(([, len]) => len > 50).map(([at, len]) => `${len}ms@${Math.round(at - paintIn)}`),
      loopGap: max(loop).len,
      loop50: loop.filter(([, len]) => len > 50).length,
      roomReq: room ? Math.round(room.startTime) : null,
      roomDone: room ? Math.round(room.responseEnd) : null,
      brush: Math.round(paintIn),
      introMs: Math.round(paintOut - paintIn),
    };
  });
  results.push(r);
  console.log(`run ${i + 1}: ${JSON.stringify(r)}`);
  await browser.close();
}

await Promise.all(burners.map((worker) => worker.terminate()));
const pick = (key) => results.map((r) => r[key]);
console.log(
  JSON.stringify({ profile, load, url, endGap: pick('endGap'), fullGap: pick('fullGap'), over50: pick('over50'), loopGap: pick('loopGap'), loop50: pick('loop50'), roomReq: pick('roomReq'), brush: pick('brush') }),
);
