// A strip of stills from a finale recording, played in Chrome and grabbed every `step` ms: to check a video shows what
// it should (MediaRecorder's WebM cannot be seeked, so it is played through).
//   node qa/tools/finale-strip.mjs qa/finales/finale-build-desktop.webm [step=250] [out.jpg]
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
const [file, step = '250', out = file.replace(/\.webm$/, '-strip.jpg')] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: process.env.HJ_HEADLESS === '1' });
const page = await browser.newPage();
await page.goto('about:blank');
const b64 = (await readFile(file)).toString('base64');
const shots = await page.evaluate(async ({ b64, step }) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const video = document.createElement('video');
  video.muted = true;
  video.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
  document.body.append(video);
  await video.play();
  const canvas = document.createElement('canvas');
  const out = [];
  let next = 0;
  await new Promise((resolve) => {
    const grab = () => {
      if (video.ended) return resolve();
      if (video.currentTime * 1000 >= next) {
        canvas.width = 360;
        canvas.height = Math.round((360 * video.videoHeight) / video.videoWidth);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        out.push({ at: Math.round(video.currentTime * 1000), url: canvas.toDataURL('image/jpeg', 0.8) });
        next += step;
      }
      video.requestVideoFrameCallback(grab);
    };
    video.requestVideoFrameCallback(grab);
    video.onended = resolve;
  });
  return out;
}, { b64, step: Number(step) });
await browser.close();
const tiles = shots.map((s) => Buffer.from(s.url.split(',')[1], 'base64'));
const meta = await sharp(tiles[0]).metadata();
const cols = 8;
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: meta.width * cols, height: meta.height * rows, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * meta.width, top: Math.floor(i / cols) * meta.height })))
  .jpeg({ quality: 80 }).toFile(out);
console.log(out, shots.length, 'stills,', shots.at(-1)?.at, 'ms');
