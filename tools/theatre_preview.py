"""Scene 5 (theatre): render a preview video from the package, following routine.json with fixed random seeds.
Usage: python3 -I tools/theatre_preview.py <site_dir> <out.mp4> [seconds=32]
Shows: Rachel's loop and blinks, the lamp, the stagehand crossing and coming back, and four mushroom finds
(her salute and one more patch of the backdrop each time)."""
import sys, os, json, random, subprocess, tempfile, numpy as np
from PIL import Image

P, OUT = sys.argv[1], sys.argv[2]; SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 32.0
FPS = 30
m = json.load(open(f'{P}/frames.json')); r = json.load(open(f'{P}/routine.json'))['actors']
L = {l['actor']: l for l in m['layers']}
cache = {}
def still(k):
    if k not in cache: cache[k] = Image.open(f'{P}/{m["stills"][k]}').convert('RGBA')
    return cache[k]
rng = random.Random(7)
def pick(v): return rng.uniform(*v) if isinstance(v, list) else v

def timeline(actor, total_ms, finds=()):
    """list of (start_ms, still) for a routine actor, with reactions cut in at find times"""
    a = r[actor]; seq = []; t = 0.0
    blink = a.get('blink'); next_blink = pick(blink['every_ms']) if blink else 1e18
    def emit(s, ms):
        nonlocal t, next_blink
        if blink and s == blink['on'] and t + ms > next_blink > t:
            seq.append((t, s)); seq.append((next_blink, blink['frames'][0]['still']))
            seq.append((next_blink + blink['frames'][0]['ms'], s)); next_blink += blink['frames'][0]['ms'] + pick(blink['every_ms'])
        else: seq.append((t, s))
        t += ms
    while t < total_ms:
        for step in a['routine']:
            if 'loop' in step:
                for _ in range(int(round(pick(step['repeat'])))):
                    for s in step['steps']: emit(s['still'], pick(s['ms']))
                    if t > total_ms: break
            else: emit(step['still'], pick(step['ms']))
            if t > total_ms: break
    # cut reactions in
    for f in finds:
        steps = a.get('reaction', {}).get('steps', [])
        if not steps: continue
        dur = sum(pick(s['ms']) for s in steps)
        before = [x for x in seq if x[0] < f]; after = [x for x in seq if x[0] >= f + dur]
        rt = f; react = []
        for s in steps: react.append((rt, s['still'])); rt += pick(s['ms'])
        seq = before + react + after
    return sorted(seq)

def at(seq, t):
    cur = seq[0][1]
    for s0, s in seq:
        if s0 > t: break
        cur = s
    return cur

total = SECS * 1000
finds = [6500, 12500, 19500, 26000]
tl = {'rachel': timeline('rachel', total, finds), 'lamp': timeline('lamp', total)}
walk = json.load(open(f'{P}/stagehand/walk.json'))
gx, gy = walk['gap_mask_xy']; gmask = np.asarray(Image.open(f'{P}/stagehand/gap_mask.png')).astype(np.float32) / 255
spr = {k: Image.open(f'{P}/stagehand/{k}.png').convert('RGBA') for k in ('boot_L', 'boot_R')}
walks = [(3000, 'rtl'), (3000 + len(walk['rtl']['frames']) * 1000 / walk['rtl']['fps'] + 11000, 'ltr')]
plate = Image.open(f'{P}/plate.png').convert('RGBA')
patches = sorted([l for l in m['layers'] if l['actor'].startswith('backdrop_')], key=lambda l: l['hunt_progress'])
fade = r['backdrop']['fade_ms']

def boots_layer(t):
    for t0, d in walks:
        tr = walk[d]; i = int((t - t0) / 1000 * tr['fps'])
        if 0 <= i < len(tr['frames']):
            lay = Image.new('RGBA', plate.size, (0, 0, 0, 0)); s = spr[tr['sprite']]
            for b in tr['frames'][i]:
                im = s if not b['far'] else Image.fromarray((np.asarray(s).astype(np.float32) * [0.85, 0.85, 0.85, 1]).astype(np.uint8))
                # rotate about the bottom-centre: pad so that point is the centre, rotate, then place
                w, h = im.size; pad = Image.new('RGBA', (w, 2 * h), (0, 0, 0, 0)); pad.paste(im, (0, 0))
                rot = pad.rotate(-b['rot'], resample=Image.BICUBIC, center=(w / 2, h))
                lay.alpha_composite(rot, (int(round(b['x'] - w / 2)), int(round(b['y'] - h))))
            a = np.asarray(lay).astype(np.float32); mk = np.zeros(a.shape[:2], np.float32)
            mk[gy:gy + gmask.shape[0], gx:gx + gmask.shape[1]] = gmask; a[..., 3] *= mk
            return Image.fromarray(a.astype(np.uint8))
    return None

tmp = tempfile.mkdtemp()
n = int(SECS * FPS)
for f in range(n):
    t = f * 1000 / FPS; im = plate.copy()
    found = sum(1 for x in finds if x <= t)
    for k, l in enumerate(patches[:found]):
        p = still(l['stills'][0]); u = min(1.0, (t - finds[k]) / fade); u = 1 - (1 - u) ** 2
        if u < 1:
            a = np.asarray(p).astype(np.float32); a[..., 3] *= u; p = Image.fromarray(a.astype(np.uint8))
        im.alpha_composite(p, (l['x'], l['y']))
    b = boots_layer(t)
    if b: im.alpha_composite(b)
    for actor in ('lamp', 'rachel'):
        l = L[actor]; im.alpha_composite(still(at(tl[actor], t)), (l['x'], l['y']))
    im.convert('RGB').save(f'{tmp}/{f:05d}.png')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{tmp}/%05d.png', '-c:v', 'libx264', '-preset', 'slow',
                '-tune', 'animation', '-crf', '15', '-g', '12', '-pix_fmt', 'yuv420p', '-vf', 'scale=1672:940', OUT], check=True)
subprocess.run(['rm', '-rf', tmp])
print('wrote', OUT, 'finds at', finds, 'walks', walks)
