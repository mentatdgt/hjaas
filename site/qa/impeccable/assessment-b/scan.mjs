// Assessment B: Impeccable browser overlay scan + independent mechanical checks.
// Read-only against the project. Run: cd /Users/dgt/hjaas/site && node qa/impeccable/assessment-b/scan.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(OUT, 'screenshots');
const PORT = Number(process.env.IMP_PORT || 8400);
const DETECT_URL = `http://localhost:${PORT}/detect.js`;
const BASE = 'http://localhost:5173/';

const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

const UNLOCKED = '?debug&intro=off&found=10';
const STATES = [
  { id: 'counter', query: '?debug&reset&intro=off', steps: [] },
  { id: 'unlocked', query: UNLOCKED, steps: [] },
  { id: 'form-open', query: UNLOCKED, steps: ['.hj-pin-action'] },
  { id: 'form-errors', query: UNLOCKED, steps: ['.hj-pin-action', '.hj-form .hj-send'] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- in-page measurement ----------
function measureInPage() {
  const parse = (str) => {
    const m = /rgba?\(([^)]+)\)/.exec(str || '');
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => {
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

  const sel = (el) => {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 4) {
      let s = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${s}#${node.id}`);
        break;
      }
      const cls = [...node.classList].filter((c) => c.startsWith('hj-')).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const firstGradientStops = (bgImage) => {
    if (!bgImage || bgImage === 'none' || !bgImage.includes('gradient')) return null;
    // Split top-level layers; the first layer is the one painted on top.
    const layers = [];
    let depth = 0;
    let cur = '';
    for (const ch of bgImage) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        layers.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) layers.push(cur.trim());
    const first = layers.find((l) => l.includes('gradient'));
    if (!first) return null;
    return (first.match(/rgba?\([^)]+\)/g) || []).map(parse);
  };

  const cumulativeOpacity = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    return o;
  };

  const hiddenReason = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (n.hidden || cs.display === 'none') return 'display-none';
      if (cs.visibility !== 'visible') return 'visibility-hidden';
      if (cs.clipPath && cs.clipPath.includes('inset(50%')) return 'sr-only-clip';
    }
    return '';
  };

  // Stack of background layers under an element: translucent layers (top first) and the opaque bottoms.
  const backgroundFor = (el) => {
    const translucent = [];
    const trail = [];
    let node = el;
    const pin = el.closest('.hj-pin');
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const stops = firstGradientStops(cs.backgroundImage);
      if (stops && stops.length) {
        trail.push(`${sel(node)} gradient`);
        if (stops.every((s) => s.a === 1)) return { translucent, bottoms: stops, source: trail.join(' <- '), kind: 'gradient', overImage: false };
      }
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        trail.push(`${sel(node)} ${cs.backgroundColor}`);
        if (bg.a === 1) return { translucent, bottoms: [bg], source: trail.join(' <- '), kind: 'color', overImage: false };
        translucent.push(bg);
      }
      if (node === pin) {
        // The pin paints its enamel face as a sibling layer, not as an ancestor background.
        const unlocked = pin.closest('.hj-counter')?.dataset.state === 'unlocked';
        const face = pin.querySelector(unlocked ? '.hj-pin-face--go' : '.hj-pin-face:not(.hj-pin-face--go)');
        const faceStops = face && firstGradientStops(getComputedStyle(face).backgroundImage);
        if (faceStops && faceStops.length) {
          trail.push(`${sel(face)} gradient (sibling face layer)`);
          return { translucent, bottoms: faceStops, source: trail.join(' <- '), kind: 'gradient', overImage: false };
        }
      }
      node = node.parentElement;
    }
    // Nothing opaque in the ancestor chain: the text sits over the illustrated scene / page background.
    const page = parse(getComputedStyle(document.body).backgroundColor);
    const html = parse(getComputedStyle(document.documentElement).backgroundColor);
    const base = page && page.a === 1 ? page : html && html.a === 1 ? html : { r: 255, g: 255, b: 255, a: 1 };
    return {
      translucent,
      bottoms: [base, { r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }],
      source: (trail.join(' <- ') || 'none') + ' <- (no opaque ancestor: page background, then black and white as bounds; see pixel sample)',
      kind: 'unknown-image',
      overImage: true,
    };
  };

  const contrastOf = (fgRaw, opacity, bgInfo) => {
    const fg = { ...fgRaw, a: fgRaw.a * opacity };
    const values = bgInfo.bottoms.map((bottom) => {
      let bg = bottom;
      for (let i = bgInfo.translucent.length - 1; i >= 0; i--) bg = over(bgInfo.translucent[i], bg);
      const text = over(fg, bg);
      return { bg: hex(bg), text: hex(text), ratio: round(ratio(text, bg)) };
    });
    const ratios = values.map((v) => v.ratio);
    return { min: Math.min(...ratios), max: Math.max(...ratios), stops: values };
  };

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ----- text -----
  const texts = [];
  const skipped = [];
  const all = [...document.querySelectorAll('body *')];
  for (const el of all) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(el.tagName)) continue;
    if (el.closest('svg')) continue;
    const isField = el.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea');
    const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!nodes.length && !isField) continue;
    const cs = getComputedStyle(el);
    const text = isField ? el.value || el.placeholder || '' : nodes.map((n) => n.textContent.trim()).join(' ');
    const reason = hiddenReason(el);
    const opacity = cumulativeOpacity(el);
    const color = parse(cs.color);
    const fill = parse(cs.webkitTextFillColor) || color;
    const rects = [];
    if (isField) {
      const r = el.getBoundingClientRect();
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
      rects.push({ x: r.x + padX, y: r.y + padY, w: r.width - 2 * padX, h: r.height - 2 * padY });
    } else {
      for (const n of nodes) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push({ x: r.x, y: r.y, w: r.width, h: r.height });
      }
    }
    const base = {
      selector: sel(el),
      text: text.slice(0, 80),
      role: isField ? (el.value ? 'field-value' : el.placeholder ? 'placeholder' : 'field-text-colour (empty field, no placeholder)') : 'text',
      fontSize: round(parseFloat(cs.fontSize)),
      fontWeight: Number(cs.fontWeight),
    };
    if (reason || opacity < 0.02 || !rects.length || fill.a === 0) {
      skipped.push({ ...base, why: reason || (opacity < 0.02 ? `opacity ${round(opacity)}` : fill.a === 0 ? 'transparent text colour' : 'no rendered box') });
      continue;
    }
    const large = base.fontSize >= 24 || (base.fontSize >= 18.66 && base.fontWeight >= 700);
    const bgInfo = backgroundFor(el);
    const c = contrastOf(fill, opacity, bgInfo);
    texts.push({
      ...base,
      color: cs.color,
      effectiveOpacity: round(opacity),
      large,
      required: large ? 3 : 4.5,
      background: bgInfo.source,
      backgroundKind: bgInfo.kind,
      overImage: bgInfo.overImage,
      computedContrastMin: c.min,
      computedContrastMax: c.max,
      computedStops: c.stops,
      fg: { r: fill.r, g: fill.g, b: fill.b, a: round(fill.a * opacity, 3) },
      rects: rects.map((r) => ({ x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) })),
      inViewport: rects.some((r) => r.x < vw && r.y < vh && r.x + r.w > 0 && r.y + r.h > 0),
      // Inert page content dimmed by the open modal's backdrop: the pixel sample there measures the
      // backdrop, not the element's own colours, so it is excluded from the failure list.
      behindModalBackdrop: !!document.querySelector('dialog:modal') && !el.closest('dialog'),
    });
  }

  // ----- placeholder pseudo colours (reported even though no field declares a placeholder) -----
  const placeholders = [...document.querySelectorAll('input, textarea')]
    .filter((el) => el.placeholder)
    .map((el) => ({ selector: sel(el), placeholder: el.placeholder, color: getComputedStyle(el, '::placeholder').color }));

  // ----- interactive element sizes -----
  const interactive = [];
  for (const el of document.querySelectorAll('button, a, input, textarea, label.hj-chip')) {
    const reason = hiddenReason(el);
    const r = el.getBoundingClientRect();
    if (reason || r.width === 0 || r.height === 0) continue;
    const scope = el.closest('.hj-mushrooms') ? 'scene (mushroom hit area)' : el.closest('.hj-dialog') ? 'form' : el.closest('.hj-counter') ? 'counter' : el.closest('.hj-logo') || el.matches('.hj-logo') ? 'logo' : 'other';
    interactive.push({
      selector: sel(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      label: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 40),
      scope,
      w: round(r.width),
      h: round(r.height),
      x: round(r.x),
      y: round(r.y),
      disabled: !!el.disabled,
      note: el.matches('.hj-chip input') ? 'invisible checkbox stretched over its chip (inset:0, opacity:0)' : '',
    });
  }

  // ----- accessible names -----
  const nameOf = (el) => {
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent.trim() || '').join(' ').trim();
      if (t) return { name: t, via: `aria-labelledby=${by}` };
      return { name: '', via: `aria-labelledby=${by} (target missing or empty)` };
    }
    const al = el.getAttribute('aria-label');
    if (al && al.trim()) return { name: al.trim(), via: 'aria-label' };
    if (el.labels && el.labels.length) {
      const t = [...el.labels].map((l) => l.textContent.trim()).join(' ').trim();
      if (t) return { name: t, via: el.id && document.querySelector(`label[for="${el.id}"]`) ? 'label[for]' : 'wrapping label' };
    }
    if (el.tagName === 'BUTTON' || el.tagName === 'A') {
      const t = el.textContent.trim();
      if (t) return { name: t, via: 'text content' };
    }
    if (el.tagName === 'FIELDSET') {
      const t = el.querySelector(':scope > legend')?.textContent.trim();
      if (t) return { name: t, via: 'legend' };
    }
    if (el.title) return { name: el.title, via: 'title' };
    if (el.placeholder) return { name: el.placeholder, via: 'placeholder (weak)' };
    return { name: '', via: 'none' };
  };
  const dialog = document.querySelector('dialog.hj-dialog');
  const names = {
    dialog: dialog ? { open: dialog.open, modal: dialog.matches(':modal'), ...nameOf(dialog) } : null,
    controls: [...document.querySelectorAll('.hj-dialog input, .hj-dialog textarea, .hj-dialog select, .hj-dialog button, .hj-dialog fieldset, .hj-pin-action, a.hj-logo')].map((el) => ({
      selector: sel(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      ...nameOf(el),
      describedBy: el.getAttribute('aria-describedby') || '',
      describedByText: (el.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => {
          const t = document.getElementById(id);
          return t ? (t.hidden ? '(hidden)' : t.textContent.trim()) : '(missing)';
        })
        .join(' | '),
      ariaInvalid: el.getAttribute('aria-invalid') || '',
      required: !!el.required,
      hiddenAncestor: !!hiddenReason(el),
    })),
  };

  // ----- overflow -----
  const root = document.documentElement;
  const wide = [];
  for (const el of all) {
    if (hiddenReason(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width > vw + 0.5 || r.right > vw + 0.5 || r.left < -0.5) {
      wide.push({
        selector: sel(el),
        left: round(r.left),
        right: round(r.right),
        width: round(r.width),
        insideSceneScroller: !!el.closest('.hj-viewport') || el.matches('.hj-viewport'),
        insideClippedScene: !!el.closest('.hj-scene'),
        position: getComputedStyle(el).position,
      });
    }
  }
  const overflow = {
    innerWidth: vw,
    innerHeight: vh,
    docScrollWidth: root.scrollWidth,
    docScrollHeight: root.scrollHeight,
    bodyScrollWidth: document.body.scrollWidth,
    horizontalPageScroll: root.scrollWidth > vw,
    verticalPageScroll: root.scrollHeight > vh,
    elementsBeyondViewport: wide,
  };

  // ----- small fonts -----
  const smallFonts = [];
  for (const el of all) {
    if (el.closest('svg')) continue;
    const has = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!has) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) smallFonts.push({ selector: sel(el), text: el.textContent.trim().slice(0, 60), fontSize: round(fs), hidden: hiddenReason(el) || (cumulativeOpacity(el) < 0.02 ? 'opacity 0' : '') });
  }

  const sheet = document.querySelector('.hj-sheet');
  const dialogBox = dialog && dialog.open
    ? (() => {
        const r = dialog.getBoundingClientRect();
        return {
          x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height),
          sheetScrollHeight: sheet.scrollHeight, sheetClientHeight: sheet.clientHeight,
          sheetScrollsInternally: sheet.scrollHeight > sheet.clientHeight + 1,
          bottomGapToViewport: round(vh - r.bottom),
        };
      })()
    : null;

  return {
    counterState: document.querySelector('.hj-counter')?.dataset.state || null,
    noteText: document.querySelector('.hj-note.is-on')?.textContent || '',
    fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`),
    texts,
    skippedText: skipped,
    placeholders,
    interactive,
    names,
    overflow,
    smallFonts,
    dialogBox,
  };
}

// ---------- pixel sampling (Node side) ----------
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

async function pixelContrast(png, texts, scale) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const t of texts) {
    const ratios = [];
    let darkest = null;
    let lightest = null;
    for (const r of t.rects) {
      const x0 = Math.max(0, Math.floor(r.x * scale));
      const y0 = Math.max(0, Math.floor(r.y * scale));
      const x1 = Math.min(info.width, Math.ceil((r.x + r.w) * scale));
      const y1 = Math.min(info.height, Math.ceil((r.y + r.h) * scale));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * info.width + x) * 4;
          const br = data[i];
          const bg = data[i + 1];
          const bb = data[i + 2];
          const a = t.fg.a;
          const tr = t.fg.r * a + br * (1 - a);
          const tg = t.fg.g * a + bg * (1 - a);
          const tb = t.fg.b * a + bb * (1 - a);
          const lb = lum(br, bg, bb);
          const lt = lum(tr, tg, tb);
          ratios.push((Math.max(lb, lt) + 0.05) / (Math.min(lb, lt) + 0.05));
          if (!darkest || lb < darkest.l) darkest = { l: lb, hex: hex(br, bg, bb) };
          if (!lightest || lb > lightest.l) lightest = { l: lb, hex: hex(br, bg, bb) };
        }
      }
    }
    if (!ratios.length) {
      t.pixel = null;
      continue;
    }
    ratios.sort((a, b) => a - b);
    const at = (p) => Math.round(ratios[Math.min(ratios.length - 1, Math.floor(p * ratios.length))] * 100) / 100;
    t.pixel = { samples: ratios.length, min: at(0), p05: at(0.05), median: at(0.5), max: at(0.999), darkestBg: darkest.hex, lightestBg: lightest.hex };
  }
}

// ---------- run ----------
await fs.mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const overlay = [];
const mechanical = [];

for (const [sizeName, size] of Object.entries(SIZES)) {
  for (const state of STATES) {
    const key = `${sizeName}-${state.id}`;
    const url = BASE + state.query;
    const context = await browser.newContext(size);
    const page = await context.newPage();
    const consoleLog = [];
    const errors = [];
    page.on('console', (m) => consoleLog.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText || ''}`));
    const result = { key, size: sizeName, state: state.id, url, viewport: size.viewport };
    try {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      if (state.id === 'counter') {
        await page.waitForSelector('.hj-note.is-on', { timeout: 8000 }).catch(() => errors.push('prompt line (.hj-note.is-on) did not appear within 8 s'));
      } else {
        await page.waitForSelector('.hj-counter[data-state="unlocked"] .hj-pin-action:not([hidden])', { timeout: 8000 });
      }
      await sleep(900);
      for (const step of state.steps) {
        await page.click(step);
        await sleep(900);
      }
      await sleep(400);

      // --- mechanical checks (before the detector touches the page) ---
      const m = await page.evaluate(measureInPage);
      await page.screenshot({ path: path.join(SHOTS, `${key}.png`) });
      const style = await page.addStyleTag({
        content: '*,*::before,*::after,::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important;text-shadow:none!important}',
      });
      await sleep(500);
      const blank = await page.screenshot();
      await style.evaluate((node) => node.remove());
      await sleep(500);
      const scale = size.deviceScaleFactor || 1;
      await pixelContrast(blank, m.texts, scale);
      m.aria = await page.locator(state.steps.length ? 'dialog.hj-dialog' : '.hj-hud').ariaSnapshot().catch((e) => `ariaSnapshot failed: ${e.message}`);
      mechanical.push({ key, size: sizeName, state: state.id, url, viewport: size.viewport, deviceScaleFactor: scale, ...m });

      // --- detector overlay ---
      const mark = consoleLog.length;
      const injected = await page.evaluate(
        (src) =>
          new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve({ ok: true });
            s.onerror = () => resolve({ ok: false, error: 'script element fired onerror' });
            document.head.appendChild(s);
            setTimeout(() => resolve({ ok: false, error: 'no load/error event within 15 s' }), 15000);
          }),
        DETECT_URL,
      );
      await sleep(3000);
      const after = consoleLog.slice(mark);
      result.injected = injected;
      result.consoleAfterInjection = after;
      result.impeccableConsole = after.filter((c) => /impeccable/i.test(c.text));
      await page.screenshot({ path: path.join(SHOTS, `${key}-overlay.png`) });
      result.structured = await page.evaluate(async () => {
        const out = { hasApi: typeof window.impeccableDetect === 'function', coreError: window.__impeccableCoreError ? String(window.__impeccableCoreError) : null };
        if (!out.hasApi) return out;
        try {
          out.detect = window.impeccableDetect();
        } catch (e) {
          out.detectError = String(e);
        }
        try {
          out.detectAsync = await window.impeccableDetectAsync();
        } catch (e) {
          out.detectAsyncError = String(e);
        }
        try {
          out.visualContrast = window.impeccableGetLastVisualContrastAnalyses?.() ?? null;
        } catch (e) {
          out.visualContrastError = String(e);
        }
        return out;
      });
    } catch (e) {
      result.failed = String(e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e);
      await page.screenshot({ path: path.join(SHOTS, `${key}-FAILED.png`) }).catch(() => {});
    }
    result.errors = errors;
    result.consoleBeforeInjection = consoleLog.slice(0, result.consoleAfterInjection ? consoleLog.length - result.consoleAfterInjection.length : consoleLog.length).filter((c) => c.type === 'error' || c.type === 'warning');
    overlay.push(result);
    await context.close();
    console.log(`${key}: ${result.failed ? 'FAILED ' + result.failed : 'ok'}; impeccable console lines: ${(result.impeccableConsole || []).length}`);
  }
}
await browser.close();

await fs.writeFile(path.join(OUT, 'overlay.json'), JSON.stringify(overlay, null, 2));
// ---------- failure summary ----------
const summary = {};
for (const m of mechanical) {
  const minTarget = m.size === 'phone' ? 44 : 24;
  const contrast = m.texts
    .filter((t) => !t.behindModalBackdrop)
    .filter((t) => t.computedContrastMin < t.required || (t.pixel && t.pixel.min < t.required))
    .map((t) => ({ selector: t.selector, text: t.text, fontSize: t.fontSize, fontWeight: t.fontWeight, required: t.required, computedMin: t.computedContrastMin, pixelMin: t.pixel?.min ?? null }));
  const small = m.interactive.filter((i) => i.w < minTarget - 0.01 || i.h < minTarget - 0.01);
  summary[m.key] = {
    contrastFailures: contrast,
    lowestContrast: m.texts
      .filter((t) => !t.behindModalBackdrop)
      .map((t) => ({ selector: t.selector, text: t.text, required: t.required, computedMin: t.computedContrastMin, pixelMin: t.pixel?.min ?? null }))
      .sort((a, b) => Math.min(a.computedMin, a.pixelMin ?? 99) - Math.min(b.computedMin, b.pixelMin ?? 99))
      .slice(0, 3),
    targetSizeThreshold: `${minTarget}x${minTarget}`,
    targetSizeFailuresUi: small.filter((i) => !i.scope.startsWith('scene')),
    targetSizeFailuresScene: small.filter((i) => i.scope.startsWith('scene')),
    smallestTargetsUi: m.interactive.filter((i) => !i.scope.startsWith('scene')).sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 3).map((i) => ({ selector: i.selector, label: i.label, w: i.w, h: i.h })),
    controlsWithoutAccessibleName: m.names.controls.filter((c) => !c.name).map((c) => c.selector),
    dialogAccessibleName: m.names.dialog ? m.names.dialog.name || null : null,
    horizontalPageScroll: m.overflow.horizontalPageScroll,
    elementsBeyondViewportOutsideSceneScroller: m.overflow.elementsBeyondViewport.filter((w) => !w.insideSceneScroller),
    elementsBeyondViewportInsideSceneScroller: m.overflow.elementsBeyondViewport.filter((w) => w.insideSceneScroller).length,
    fontsBelow12px: m.smallFonts,
    placeholders: m.placeholders,
  };
}
await fs.writeFile(
  path.join(OUT, 'mechanical.json'),
  JSON.stringify(
    {
      generatedBy: 'site/qa/impeccable/assessment-b/scan.mjs',
      method: {
        contrast:
          'computed: text colour (x cumulative opacity) against the first non-transparent ancestor background; for gradients, against every colour stop of the top gradient layer (min and max reported). The pin text uses the sibling .hj-pin-face layer. pixel: the page is screenshotted with all text made transparent and the text boxes are sampled, so gradients, the translucent note and the painted scene are measured as rendered. A failure is computedMin or pixel.min below the requirement (4.5, or 3 for text >= 24 px or >= 18.66 px bold).',
        targetSize: 'getBoundingClientRect of button, a, input, textarea, label.hj-chip; thresholds 44x44 (phone) and 24x24 (desktop)',
        names: 'aria-labelledby, aria-label, label[for] / wrapping label, legend, text content; cross-checked with Playwright ariaSnapshot (the "aria" field)',
        overflow: 'documentElement.scrollWidth > innerWidth, plus every rendered element whose box crosses the viewport edge',
      },
      summary,
      states: mechanical,
    },
    null,
    2,
  ),
);
console.log('saved overlay.json, mechanical.json');
