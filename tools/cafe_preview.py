"""Render a preview video of the café package: python3 -I tools/cafe_preview.py <pkgdir> <out.mp4> [seconds] [react_at_s]"""
import sys, json, random, subprocess, os, tempfile
import numpy as np
from PIL import Image
P, OUTF = sys.argv[1], sys.argv[2]
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 24
REACT = float(sys.argv[4]) if len(sys.argv) > 4 else 13
FPS = 24; SCALE = 0.5
man = json.load(open(f'{P}/frames.json')); rt = json.load(open(f'{P}/routine.json'))
random.seed(4)
def R(v): return random.randint(*v) if isinstance(v, list) else v
cache = {}
def img(p):
    if p not in cache: cache[p] = Image.open(f'{P}/{p}').convert('RGBA')
    return cache[p]
layers = {l['actor']: l for l in man['layers']}
def expand(steps):
    out = []
    for s in steps:
        if 'loop' in s:
            for _ in range(R(s['repeat'])): out += expand(s['steps'])
        elif 'clip' in s:
            c = man['clips'][s['clip']]; fr = c['frames'][::-1] if s.get('reverse') else c['frames']
            out += [(('clip', s['clip'], f), s['ms']) for f in fr]
        else:
            out.append((('still', s['still'], s.get('fade_ms', 0)), R(s['ms'])))
    return out
def timeline(actor, total_ms, react_ms=None):
    a = rt['actors'][actor]; tl = []; t = 0
    while t < total_ms:
        for ev, ms in expand(a['routine']):
            if actor == 'rachel' and react_ms is not None and t <= react_ms < t + ms:
                last = ev
                if last[0] == 'clip' and last[1] == 'sip' or (last[0] == 'still' and last[1] == 'R_B1_sip'):
                    for e2, m2 in expand([{"clip": "sip", "ms": 70, "reverse": True}]): tl.append((t, e2)); t += m2
                for e2, m2 in expand(a['reaction']['steps']): tl.append((t, e2)); t += m2
                react_ms = None; break
            tl.append((t, ev)); t += ms
            if t >= total_ms: break
    return tl
total = int(SECS * 1000)
TL = {a: timeline(a, total, int(REACT * 1000) if a == 'rachel' else None) for a in rt['actors']}
# Rachel blinks
blinks = []; t = random.randint(2000, 4000)
while t < total: blinks.append(t); t += random.randint(3000, 6000)
plate = img(man['plate'])
W, H = plate.size; ow, oh = int(W * SCALE) // 2 * 2, int(H * SCALE) // 2 * 2
tmp = tempfile.mkdtemp()
order = [l['actor'] for l in man['layers']]
def at(tl, ms):
    cur, prev, start = tl[0][1], None, 0
    for t0, ev in tl:
        if t0 <= ms: prev, cur, start = cur, ev, t0
        else: break
    return cur, prev, ms - start
for fi in range(int(SECS * FPS)):
    ms = fi * 1000 / FPS
    fr = plate.copy()
    for actor in order:
        L = layers[actor]; ev, pev, since = at(TL[actor], ms)
        kind, name, f = ev
        if kind == 'still':
            if name is None: continue
            if actor == 'rachel' and name == 'R_A1_sketch' and any(b <= ms < b + 90 for b in blinks): name = 'R_A1_blink'
            fade = f or 0
            if fade and pev and pev[0] == 'still' and pev[1] and since < fade and pev[1] != name:
                box = (L['x'], L['y'], L['x'] + L['w'], L['y'] + L['h'])
                a = fr.crop(box); b = fr.crop(box)
                a.alpha_composite(img(man['stills'][pev[1]])); b.alpha_composite(img(man['stills'][name]))
                t = since / fade; t = t * t * (3 - 2 * t)
                fr.paste(Image.blend(a, b, t), box[:2])
            else:
                fr.alpha_composite(img(man['stills'][name]), (L['x'], L['y']))
        else:
            c = man['clips'][name]
            fr.alpha_composite(img(man['stills'][c['base']]), (L['x'], L['y']))
            p = img(f); x, y = L['x'] + c['x'], L['y'] + c['y']
            if y < 0 or x < 0: p = p.crop((max(0, -x), max(0, -y), p.width, p.height)); x, y = max(x, 0), max(y, 0)
            fr.alpha_composite(p, (x, y))
    fr.convert('RGB').resize((ow, oh), Image.LANCZOS).save(f'{tmp}/{fi:05d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', f'{tmp}/%05d.png', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', OUTF], check=True)
print('wrote', OUTF)
