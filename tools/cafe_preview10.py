"""Preview video of a café package, playing routine.json the way the site's engine does (site/src/engine/clips.ts):
a loop's fade_ms only from the second step of the loop on (inside the loop, through its repeats); every other change a cut;
blinks only in the middle of a hold on a still the blink rule names (and only on holds marked blink_ok, if the routine
marks any), when one is due (every_ms) and it fits with 80 ms either side; dissolves eased with smoothstep.
Stills only (no clips, no reaction).
Usage: python3 -I tools/cafe_preview10.py <pkgdir> <out.mp4> [seconds=30] [width=1280] [fps=30] [seed=4]"""
import sys, json, random, subprocess
import numpy as np
from PIL import Image
P, OUTF = sys.argv[1], sys.argv[2]
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 30
WIDTH = int(sys.argv[4]) if len(sys.argv) > 4 else 1280
FPS = int(sys.argv[5]) if len(sys.argv) > 5 else 30
rnd = random.Random(int(sys.argv[6]) if len(sys.argv) > 6 else 4)
man = json.load(open(f'{P}/frames.json')); rt = json.load(open(f'{P}/routine.json'))
MARGIN = 80
def roll(v): return v[0] + rnd.random() * (v[1] - v[0]) if isinstance(v, list) else v
def count(v): return v[0] + int(rnd.random() * (v[1] - v[0] + 1)) if isinstance(v, list) else round(v)
def schedule(actor, total):
    """[(t0, pose or None, ms, fade_ms)] for one actor, as clipSchedule rolls it."""
    a = rt['actors'][actor]; routine = a['routine']
    rules = a.get('blink') or []; rules = rules if isinstance(rules, list) else [rules]
    every = next((r['every_ms'] for r in rules if 'every_ms' in r), None)
    free = not any(('steps' in it and any('blink_ok' in s for s in it['steps'])) or ('still' in it and 'blink_ok' in it) for it in routine)
    st = {'since': 0.0, 'next': roll(every) if every is not None else float('inf'), 't': 0.0}
    out = []
    def frames_for(rule, pose):
        if 'frames' in rule: return rule['frames']
        own = rule.get('still_for', {}).get(pose)
        return [{'still': own, 'ms': rule.get('ms', 90)}] if own else []
    def on(rule, pose):
        o = rule['on']; return (o == pose if isinstance(o, str) else pose in o) and frames_for(rule, pose)
    def emit(pose, ms, fade=0):
        out.append((st['t'], pose, ms, fade)); st['t'] += ms
    def hold(pose, ms, ok, fade=None):
        rule = next((r for r in rules if on(r, pose)), None) if (ok or free) and every is not None and pose else None
        fr = frames_for(rule, pose) if rule else []; bms = sum(f['ms'] for f in fr)
        lead = max(MARGIN, fade or 0)
        if rule and ms >= bms + lead + MARGIN and st['since'] + ms / 2 >= st['next']:
            first = lead + rnd.random() * (ms - bms - lead - MARGIN)
            emit(pose, first, fade or 0)
            for f in fr: emit(f['still'], f['ms'])
            emit(pose, ms - first - bms); st['since'] = ms - first - bms; st['next'] = roll(every); return
        st['since'] += ms; emit(pose, ms, fade or 0)
    while st['t'] < total:
        for it in routine:
            if 'steps' in it:
                inside = False
                for _ in range(max(1, count(it['repeat']))):
                    for s in it['steps']:
                        hold(s['still'], roll(s['ms']), s.get('blink_ok') is True, s.get('fade_ms') if inside else None); inside = True
            else:
                hold(it['still'], roll(it['ms']), it.get('blink_ok') is True)
    return out
total = SECS * 1000
order = [l['actor'] for l in man['layers']]; L = {l['actor']: l for l in man['layers']}
TL = {a: schedule(a, total) for a in order}
json.dump({a: [(round(t), p, round(ms), f) for t, p, ms, f in v if t < total] for a, v in TL.items()}, open(OUTF.rsplit('.', 1)[0] + '-timeline.json', 'w'))
cache = {}
def img(n):
    if n not in cache: cache[n] = np.asarray(Image.open(f"{P}/{man['stills'][n]}").convert('RGBA')).astype(np.float32) / 255
    return cache[n]
plate = np.asarray(Image.open(f"{P}/{man['plate']}").convert('RGB')).astype(np.float32) / 255
H0, W0 = plate.shape[:2]; OW = WIDTH; OH = int(round(H0 * WIDTH / W0 / 2)) * 2
def state(tl, ms):
    i = max(k for k, e in enumerate(tl) if e[0] <= ms); t0, pose, _, fade = tl[i]
    prev = tl[i - 1][1] if i else None
    if fade and prev != pose and ms - t0 < fade:
        u = (ms - t0) / fade; return pose, prev, u * u * (3 - 2 * u)
    return pose, None, 1.0
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OW}x{OH}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'animation', '-crf', '16', '-pix_fmt', 'yuv420p', OUTF], stdin=subprocess.PIPE)
for fi in range(int(SECS * FPS)):
    ms = fi * 1000 / FPS; fr = plate.copy()
    for actor in order:
        l = L[actor]; pose, prev, u = state(TL[actor], ms)
        y0, x0 = l['y'], l['x']; reg = fr[y0:y0 + l['h'], x0:x0 + l['w']]
        def pre(n):
            if not n: return np.zeros((l['h'], l['w'], 4), np.float32)
            v = img(n); return np.dstack([v[..., :3] * v[..., 3:], v[..., 3:]])
        c = pre(pose) if prev is None else pre(prev) * (1 - u) + pre(pose) * u    # premultiplied sum, as the engine draws it
        reg[...] = c[..., :3] + reg * (1 - c[..., 3:])
    im = Image.fromarray((np.clip(fr, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((OW, OH), Image.LANCZOS)
    ff.stdin.write(im.tobytes())
ff.stdin.close(); ff.wait(); print('wrote', OUTF, OW, OH)
