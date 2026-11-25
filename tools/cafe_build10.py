"""Café package v10 (user requests 2026-11-26): the old man blinks and turns his page in six drawn steps (O_1 > T1 > T2 > T2b > T3 > T3b > T4 > O_1,
one reading pose, so the newspaper never changes); the barista's polish runs through three in-betweens (cloth circles the cup);
the mum sips her coffee once per loop (v10b: at the start of her loop); the cat's tail flicks (F1/F2, cat_3 dropped).

Built like v7 (tools/cafe_build7.py): every pose = the layer's rest pose + ONLY the zone that moves. The zone is where Quinn's
pose differs from Quinn's own copy of the master (both brought back onto the canvas by tools/quinn_register.place, so the
two go through the same resampling); the pose's pixels are pasted, colour-fitted, onto the rest still AS DELIVERED in the
package. Fan, Rachel, child and the plate are copied byte for byte from the source package; so are the barista's B_1, B_2,
B_3, B_4, the old man's O_1, the cat's cat_1/cat_2 and the mum's blink patches (only re-cropped where a layer box grows).

Usage: python3 -I tools/cafe_build10.py <outdir> [src_pkg] [round10_dir]
  src_pkg     the package to start from (default frames/018-cafe-scene/site; may equal outdir: everything is read first)
  round10_dir Quinn's drawings and the masters they were drawn on (default frames/018-cafe-scene/round10)"""
import sys, os, json, shutil
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import cv2
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, f'{REPO}/tools')
from quinn_register import place, soft_key as q_soft_key
A = f'{REPO}/frames/018-cafe-scene/approved'
OUT = sys.argv[1]
SRC = sys.argv[2] if len(sys.argv) > 2 else f'{REPO}/frames/018-cafe-scene/site'
R10 = sys.argv[3] if len(sys.argv) > 3 else f'{REPO}/frames/018-cafe-scene/round10'
TRIM = 18; S = (1432, 2580)
# ---------------- v7 helpers (unchanged) ----------------
def soft_key(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return ndi.gaussian_filter(1 - np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1), 0.7)
def pm(x): return x[..., :3] * (x[..., 3:] / 255)
def box_mask(shape, x0, y0, x1, y1):
    m = np.zeros(shape[:2], bool); m[max(y0, 0):y1, max(x0, 0):x1] = True; return m
def hairish(x):
    r, g, b = x[..., 0], x[..., 1], x[..., 2]; v = x[..., :3].max(-1); sat = (v - x[..., :3].min(-1)) / np.maximum(v, 1)
    return (x[..., 3] > 200) & (r >= g) & (g >= b - 5) & (v > 45) & (v < 175) & (sat > 0.3)
def zone(base, src, thr=18, minsize=80, grow=6, region=None, smooth=0, keep_hair=False):
    if smooth:
        bb_, ss_ = [np.stack([ndi.gaussian_filter(pm(x)[..., c], smooth) for c in range(3)], -1) for x in (base, src)]
        d = (np.abs(bb_ - ss_).max(-1) > thr) | (np.abs(base[..., 3] - src[..., 3]) > 60)
    else:
        d = (np.abs(pm(base) - pm(src)).max(-1) > thr) | (np.abs(base[..., 3] - src[..., 3]) > 60)
    if keep_hair: d &= ~(hairish(base) & hairish(src))
    if region is not None: d &= region
    d = ndi.binary_opening(d, iterations=1); lab, n = ndi.label(d)
    if n: sz = ndi.sum(d, lab, range(1, n + 1)); d = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= minsize])
    d = ndi.binary_closing(d, iterations=4); d = ndi.binary_fill_holes(d)
    return ndi.binary_dilation(d, iterations=grow)
def fit(src, base, z):
    ring = ndi.binary_dilation(z, iterations=28) & ~ndi.binary_dilation(z, iterations=3) & (base[..., 3] > 250) & (src[..., 3] > 250)
    out = src.copy()
    if ring.sum() < 200: return out
    for c in range(3):
        x, y = src[..., c][ring], base[..., c][ring]; k, b = 1.0, 0.0
        for it in range(3):
            res = np.abs(x * k + b - y); ok = res < 22 if it else np.ones_like(res, bool)
            if ok.sum() < 50: break
            k, b = np.linalg.lstsq(np.vstack([x[ok], np.ones(ok.sum())]).T, y[ok], rcond=None)[0]
        out[..., c] = np.clip(src[..., c] * k + b, 0, 255)
    return out
def paste(base, src, z, feather=2.0, match=True):
    if match: src = fit(src, base, z)
    m = ndi.gaussian_filter(z.astype(np.float32), feather); m[m < 0.004] = 0; m = m[..., None]
    a = base[..., 3:] * (1 - m) + src[..., 3:] * m
    rgb = (pm(base) * (1 - m) + pm(src) * m) / np.maximum(a / 255, 1e-6)
    out = np.dstack([np.clip(rgb, 0, 255), a[..., 0]]); keep = m[..., 0] == 0; out[keep] = base[keep]; return out
def bbox_of(mask, pad=0):
    ys, xs = np.where(mask); return max(xs.min() - pad, 0), max(ys.min() - pad, 0), xs.max() + 1 + pad, ys.max() + 1 + pad
# ---------------- read the source package (all of it, before anything is written) ----------------
man0 = json.load(open(f'{SRC}/frames.json')); rt0 = json.load(open(f'{SRC}/routine.json'))
L0 = {l['actor']: l for l in man0['layers']}
raw = {}                                                     # file bytes of everything copied unchanged
for actor in ['fan', 'rachel', 'child']:
    for n in L0[actor]['stills']: raw[man0['stills'][n]] = open(f"{SRC}/{man0['stills'][n]}", 'rb').read()
raw['plate.png'] = open(f'{SRC}/plate.png', 'rb').read()
def full(actor, name):
    """A delivered still, back on the 2580x1432 canvas (float RGBA)."""
    l = L0[actor]; a = np.asarray(Image.open(f"{SRC}/{man0['stills'][name]}").convert('RGBA')).astype(np.float32)
    f = np.zeros(S + (4,), np.float32); x = l['x'] + TRIM; f[l['y']:l['y'] + l['h'], x:x + l['w']] = a; return f
plate = np.zeros(S + (3,), np.float32); plate[:, TRIM:S[1] - TRIM] = np.asarray(Image.open(f'{SRC}/plate.png').convert('RGB'))
REST = {'O_1': full('oldman', 'O_1'), 'B_1': full('barista', 'B_1'), 'B_2_polish': full('barista', 'B_2_polish'),
        'B_3_polish': full('barista', 'B_3_polish'), 'B_4_glance': full('barista', 'B_4_glance'),
        'cat_1': full('cat', 'cat_1'), 'cat_2': full('cat', 'cat_2'),
        'M_blink_half': full('mum', 'M_blink_half'), 'M_blink_closed': full('mum', 'M_blink_closed')}
BOX = json.load(open(f'{R10}/masters/boxes.json'))
poses, zones, reg = {}, {}, {}
def subpix(a, b, mask):
    """Residual shift (px) of b against a on the masked pixels: phase correlation of the premultiplied grey."""
    ys, xs = np.where(mask); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    g = lambda v: ((v[..., :3].mean(-1) * (v[..., 3] / 255)) * mask)[y0:y1, x0:x1].astype(np.float64)
    (dx, dy), r = cv2.phaseCorrelate(g(a), g(b), cv2.createHanningWindow((x1 - x0, y1 - y0), cv2.CV_64F)); return dx, dy
def register(name, P, rest, z, shift):
    """Check the non-moving parts of a placed pose against the rest still: residual shift and colour difference."""
    calm = (rest[..., 3] > 250) & (P[..., 3] > 250) & ~ndi.binary_dilation(z, iterations=10)
    dx, dy = subpix(rest, P, calm); d = np.abs(P[..., :3] - rest[..., :3]).max(-1)[calm]
    reg[name] = {'place_shift_px': list(shift[:2]), 'residual_dx': round(float(dx), 2), 'residual_dy': round(float(dy), 2),
                 'mean_diff': round(float(d.mean()), 2), 'p99_diff': round(float(np.percentile(d, 99)), 1), 'calm_px': int(calm.sum())}
def decontaminate(P):
    """No green left in the outline's anti-aliasing: near the edge, green may not exceed the larger of red and blue."""
    edge = ndi.binary_dilation(P[..., 3] < 250, iterations=2) & (P[..., 3] > 0)
    P = P.copy(); g = P[..., 1]; cap = np.maximum(P[..., 0], P[..., 2]); P[..., 1] = np.where(edge & (g > cap), cap, g); return P
def quinn(actor, name, ref_alpha):
    P, info = place(f'{R10}/{name}.png', BOX[actor], ref_alpha); return decontaminate(P), info
# ---------------- old man: blink + four-step page turn, all on O_1 ----------------
O1 = REST['O_1']; poses['O_1'] = O1
OM, _ = quinn('oldman', 'masters/oldman_MASTER', O1[..., 3] / 255)
for n, src in [('O_blink', 'oldman_O_blink'), ('T1', 'oldman_T1'), ('T2', 'oldman_T2'), ('T2b', 'oldman_T2b'), ('T3', 'oldman_T3'), ('T3b', 'oldman_T3b'), ('T4', 'oldman_T4')]:
    P, info = quinn('oldman', src, O1[..., 3] / 255)
    z = zone(OM, P, thr=24, smooth=1.0, minsize=40 if n == 'O_blink' else 120, grow=4 if n == 'O_blink' else 6)
    register(n, P, O1, z, info); poses[n] = paste(O1, P, z); zones[n] = z
# ---------------- barista: in-betweens P1..P3 on B_1; B_1..B_4 as delivered ----------------
B1 = REST['B_1']; BMq, _ = quinn('barista', 'masters/barista_MASTER', B1[..., 3] / 255)
ys, xs = np.where(B1[..., 3] > 128); bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max(), ys.max()
bhands = box_mask(S, bx0 - 10, by0 + int((by1 - by0) * 0.5), bx1 + 10, by1 + 6)
for n in ['B_1', 'B_2_polish', 'B_3_polish', 'B_4_glance']: poses[n] = REST[n]
for n in ['B_2_polish', 'B_3_polish', 'B_4_glance']: zones[n] = np.abs(REST[n] - B1).max(-1) > 0
for n, src in [('B_P1', 'barista_P1'), ('B_P2', 'barista_P2'), ('B_P3', 'barista_P3')]:
    P, info = quinn('barista', src, B1[..., 3] / 255)
    z = zone(BMq, P, region=bhands, thr=26, smooth=1.2, keep_hair=True, minsize=120)
    register(n, P, B1, z, info); poses[n] = paste(B1, P, z); zones[n] = z
# ---------------- cat: flick F1/F2 on cat_1; cat_2 as delivered; cat_3 dropped ----------------
C1 = REST['cat_1']; poses['cat_1'] = C1; poses['cat_2'] = REST['cat_2']; zones['cat_2'] = np.abs(REST['cat_2'] - C1).max(-1) > 0
CMq, _ = quinn('cat', 'masters/cat_MASTER', C1[..., 3] / 255)
for n, src in [('cat_F1', 'cat_F1'), ('cat_F2', 'cat_F2')]:
    P, info = quinn('cat', src, C1[..., 3] / 255)
    z = zone(CMq, P, thr=24, smooth=1.0, minsize=120)
    register(n, P, C1, z, info); poses[n] = paste(C1, P, z); zones[n] = z
# ---------------- mum: sip S1/S2 as patches over the plate (she is part of the plate) ----------------
mum_al = soft_key(np.asarray(Image.open(f'{A}/018_mum_green.png').convert('RGB')).astype(np.float32))
MUM = np.dstack([plate, mum_al * 255])                          # the plate's mum, cut out
MMq, _ = quinn('mum', 'masters/mum_MASTER', mum_al)
harden = lambda a: np.clip((a / 255 - 0.25) / 0.6, 0, 1) * 255   # a clean outline: no soft green fringe (the S2 elbow)
MMq[..., 3] = harden(MMq[..., 3])
# the room behind her: inpaint the plate under her silhouette (only ever seen where a pose leaves a gap the master filled)
ys, xs = np.where(mum_al > 0.02); X0, Y0, X1, Y1 = xs.min() - 40, ys.min() - 40, xs.max() + 41, ys.max() + 41
hole = ndi.binary_dilation(mum_al > 0.02, iterations=3)[Y0:Y1, X0:X1].astype(np.uint8)
BG = plate.copy()
BG[Y0:Y1, X0:X1] = cv2.inpaint(np.clip(plate[Y0:Y1, X0:X1], 0, 255).astype(np.uint8), hole, 9, cv2.INPAINT_TELEA).astype(np.float32)
# Right of her the room is horizontal bands (window bars, foliage, the seat back) up to the cushion: fill each row of the hole
# by mirroring the strip of room just right of her (up to the cushion, which is pale), so the bars run on behind her arm.
holef = ndi.binary_dilation(mum_al > 0.02, iterations=3)
pale = ndi.binary_fill_holes(ndi.binary_closing((plate[..., 2] > 100) & box_mask(S, 856, 700, 1000, 900), iterations=3)); lab, nl = ndi.label(pale)
cushion = np.zeros(S, bool)
if nl: sz = ndi.sum(pale, lab, range(1, nl + 1)); cushion = ndi.binary_dilation(lab == 1 + int(np.argmax(sz)), iterations=5)
for y in range(Y0, Y1):
    xs = np.where(holef[y])[0]
    if not len(xs): continue
    e = xs.max(); s0 = e + 1; w = 0
    while w < 30 and s0 + w < S[1] and not cushion[y, s0 + w] and not holef[y, s0 + w]: w += 1
    if w == 0: BG[y, xs.min():e + 1] = BG[y - 1, xs.min():e + 1]; continue   # she touches the cushion: carry the row above down
    for k in range(1, min(80, e - xs.min() + 1) + 1):
        j = (k - 1) % (2 * w); j = j if j < w else 2 * w - 1 - j
        BG[y, e + 1 - k] = plate[y, s0 + j]
for n, src in [('M_S1', 'mum_S1'), ('M_S2', 'mum_S2')]:
    P, info = quinn('mum', src, mum_al)
    P[..., 3] = harden(P[..., 3])
    z = zone(MMq, P, thr=24, smooth=1.0, minsize=120, keep_hair=True)
    register(n, P, MUM, z, info)
    Pf = fit(P, MUM, z)
    al = Pf[..., 3:] / 255; comp = Pf[..., :3] * al + BG * (1 - al)  # the pose over the room behind her
    m = ndi.gaussian_filter(z.astype(np.float32), 2.0); m[m < 0.004] = 0
    poses[n] = np.dstack([comp * (m[..., None] > 0), m * 255]); zones[n] = z
for n in ['M_blink_half', 'M_blink_closed']: poses[n] = REST[n]; zones[n] = REST[n][..., 3] > 0
# ---------------- write ----------------
if os.path.abspath(OUT) == os.path.abspath(SRC):
    for d in ['oldman', 'barista', 'cat', 'mum']: shutil.rmtree(f'{OUT}/{d}', ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
for rel, b in raw.items():
    os.makedirs(os.path.dirname(f'{OUT}/{rel}') or OUT, exist_ok=True); open(f'{OUT}/{rel}', 'wb').write(b)
man = {'canvas': man0['canvas'], 'plate': 'plate.png', 'layers': [], 'stills': {}, 'clips': {}}
def add_layer(actor, names):
    U = np.zeros(S, bool)
    for n in names: U |= poses[n][..., 3] > 4
    x0, y0, x1, y1 = bbox_of(U, 6); x0 = max(x0, TRIM); x1 = min(x1, S[1] - TRIM); y1 = min(y1, S[0])
    os.makedirs(f'{OUT}/{actor}', exist_ok=True)
    for n in names:
        v = poses[n][y0:y1, x0:x1]; assert not (poses[n][..., 3] > 0)[~box_mask(S, x0, y0, x1, y1)].any(), n
        Image.fromarray(np.clip(np.round(v), 0, 255).astype(np.uint8), 'RGBA').save(f'{OUT}/{actor}/{n}.png'); man['stills'][n] = f'{actor}/{n}.png'
    man['layers'].append({'actor': actor, 'x': int(x0 - TRIM), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0), 'stills': names})
NEW = {'cat': ['cat_1', 'cat_2', 'cat_F1', 'cat_F2'], 'oldman': ['O_1', 'O_blink', 'T1', 'T2', 'T2b', 'T3', 'T3b', 'T4'],
       'barista': ['B_1', 'B_P1', 'B_2_polish', 'B_P2', 'B_3_polish', 'B_P3', 'B_4_glance'],
       'mum': ['M_blink_half', 'M_blink_closed', 'M_S1', 'M_S2']}
for l in man0['layers']:                                       # same drawing order as before
    a = l['actor']
    if a in NEW: add_layer(a, NEW[a])
    else:
        man['layers'].append(l)
        for n in l['stills']: man['stills'][n] = man0['stills'][n]
# stability: within a layer every still equals the rest pose outside its moving zone (mum: the plate, i.e. transparent)
stab = {}
for actor, ns in NEW.items():
    rest = poses[ns[0]]
    for n in (ns[1:] if actor != 'mum' else ns):
        v = np.clip(np.round(poses[n]), 0, 255); r = np.clip(np.round(rest), 0, 255)
        if actor == 'mum':                                     # her rest is the plate itself: compare what is seen
            a = v[..., 3:] / 255; ch = np.abs(np.round(v[..., :3] * a + plate * (1 - a)) - plate).max(-1) > 0
        else: ch = np.abs(v - r).max(-1) > 0
        stab[n] = {'changed_px': int(ch.sum()), 'changed_outside_zone_px': int((ch & ~ndi.binary_dilation(zones[n], iterations=8)).sum()),
                   'changed_bbox': [int(t) for t in bbox_of(ch)] if ch.any() else None}
json.dump(man, open(f'{OUT}/frames.json', 'w'), indent=1)
json.dump({'stability': stab, 'registration': reg}, open(f'{OUT}/stability.json', 'w'), indent=1)
# ---------------- routines ----------------
rt = {'note': None, 'actors': {}}
rt['note'] = ("Scene 3 (café) routines, v10b. Holds in ms; [a,b] = random in range. Each actor runs independently and out of sync. "
    "RULE: fade_ms (a true cross-dissolve into a still) applies ONLY between two stills of the same loop. Every other change is an instant cut. "
    "Within a layer every still is pixel-identical to the first outside the part that moves, so cuts never flicker. "
    "The fan is part of the room: play its loop forever, do not apply the 'fully painted under actors' edge rule to it, and let the edge fade it like the plate. "
    "v10 (2026-11-26): OLD MAN reads on O_1 only (the newspaper never changes) and turns a page every 5-7 s in six drawn steps, cuts: "
    "O_1 > T1 (corner lifted) > T2 (page rising) > T2b (page carried) > T3 (page laid on the left) > T3b (arm on its way back) > T4 (hand back) > O_1, "
    "130/130/140/160/150/130 ms (0.84 s; the longer holds come before the longer moves, so the hand travels at an even speed); he blinks on O_1 only, about every 3-6 s (O_blink, 100 ms). "
    "BARISTA polishes in a circle, cuts at 140-200 ms: B_1 > B_P1 > B_2_polish > B_P2 > B_3_polish > B_P3, 3-6 rounds, then her pause and glance (B_4_glance) as before. "
    "v10b (2026-11-26): MUM (part of the plate; her layer holds patches only) sips at the START of her loop of about 22-23 s (21-25 s at the extremes): "
    "nothing for 50 ms (so her rest pose stays the plate) > M_S1 (220 ms) > M_S2 (sip, eyes closed, 1.4-1.8 s) > M_S1 > rest; then her four blinks spread through the rest of the loop "
    "(the first 2.3-2.9 s after the sip, then every 4.3-5.1 s, the last 2.7-3.3 s before the next sip), never during the sip. "
    "CAT: cat_3 is gone. Its tail flicks twice per loop: cat_1 > cat_F1 (110 ms) > cat_F2 (500 ms) > cat_F1 (110 ms) > cat_1, at the start of the loop and again after "
    "3 breaths (2 more follow), so at about 60% of the loop. It breathes (cat_1/cat_2, 1 s dissolves) the rest of the time, never during a flick; "
    "each breathing loop ends on cat_1 so the flick starts with a cut from an identical body.")
for a in ['fan', 'rachel', 'child']: rt['actors'][a] = rt0['actors'][a]
rt['actors']['barista'] = {
    'note': 'Polishing: the cloth circles the cup through three drawn in-betweens, cuts at 140-200 ms (dissolves were tried and looked muddier: the cloth moves too far between neighbours). Glance: eyes only.',
    'routine': [
        {'loop': 'polish', 'repeat': [3, 6], 'steps': [
            {'still': 'B_1', 'ms': [140, 200]}, {'still': 'B_P1', 'ms': [140, 200]}, {'still': 'B_2_polish', 'ms': [140, 200]},
            {'still': 'B_P2', 'ms': [140, 200]}, {'still': 'B_3_polish', 'ms': [140, 200]}, {'still': 'B_P3', 'ms': [140, 200]}]},
        {'still': 'B_1', 'ms': [1500, 2500]}, {'still': 'B_4_glance', 'ms': [1400, 2000]}, {'still': 'B_1', 'ms': [800, 1200]}]}
rt['actors']['oldman'] = {
    'note': 'Reads on O_1, the only reading pose, then turns the page in six drawn steps with cuts (T2b and T3b are the in-betweens that even out the sweep: 46-82 px of hand travel per step). O_1 is three holds in a row (the same still, so nothing shows between them) because the engine fits at most one blink into a hold: this way he blinks every 3-6.5 s and turns a page every 5-6.5 s (5th-95th percentile, measured over 50 min of the engine rules). He blinks only on O_1, never mid-turn.',
    'routine': [
        {'still': 'O_1', 'ms': [1250, 2100], 'blink_ok': True}, {'still': 'O_1', 'ms': [1250, 2100], 'blink_ok': True},
        {'still': 'O_1', 'ms': [1250, 2100], 'blink_ok': True},
        {'still': 'T1', 'ms': 130}, {'still': 'T2', 'ms': 130}, {'still': 'T2b', 'ms': 140}, {'still': 'T3', 'ms': 160},
        {'still': 'T3b', 'ms': 150}, {'still': 'T4', 'ms': 130}],
    'blink': {'on': 'O_1', 'frames': [{'still': 'O_blink', 'ms': 100}], 'every_ms': [2500, 4500]}}
FL = [{'still': 'cat_F1', 'ms': 110}, {'still': 'cat_F2', 'ms': 500}, {'still': 'cat_F1', 'ms': 110}]
def breathe(name, n):
    return {'loop': name, 'repeat': n, 'steps': [
        {'still': 'cat_1', 'ms': [700, 900], 'fade_ms': 1000}, {'still': 'cat_2', 'ms': [1400, 1800], 'fade_ms': 1000},
        {'still': 'cat_1', 'ms': [700, 900], 'fade_ms': 1000}]}
rt['actors']['cat'] = {
    'note': 'Flick at the start of the loop and after 3 breaths (about 60% of the loop). Each breathe loop is cat_1 > cat_2 > cat_1: the two cat_1 holds meet when it repeats (an identical still, so nothing shows) and it always ends on cat_1, ready for the flick.',
    'routine': FL + [breathe('breathe', 3)] + FL + [breathe('breathe_more', 2)]}
BL = [{'still': 'M_blink_half', 'ms': 60}, {'still': 'M_blink_closed', 'ms': 90}, {'still': 'M_blink_half', 'ms': 60}]
N = lambda ms: {'still': None, 'ms': ms}
rt['actors']['mum'] = {
    'note': ('Part of the plate: null = nothing drawn. v10b: her loop opens with the sip (after 50 ms of nothing, so that her rest pose, the routine\'s first still, '
             'stays the plate), then four blinks spread through the rest, never during the sip. Loop 21.8-23.4 s (5th-95th percentile). '
             'Each actor runs on its own random clock, so nothing in the engine can keep her sip away from Rachel\'s blinks for good. '
             'What the timing does: each time the scene starts (the café cast starts afresh on every visit, mum 0-0.9 s after Rachel) her first sip is over before '
             'Rachel can first blink (3.0 s at the earliest): clear by 0.2 s at worst, by 1 s or more 97% of the time. After that the two drift apart at random: '
             'measured with the engine\'s clipSchedule over 100 h, about 62% of sips come within 1 s of one of Rachel\'s blinks and about 33% overlap one, whatever the loop length.'),
    'routine': [N(50), {'still': 'M_S1', 'ms': 220}, {'still': 'M_S2', 'ms': [1400, 1800]}, {'still': 'M_S1', 'ms': 220}, N([2300, 2900])] + BL +
               [N([4300, 5100])] + BL + [N([4300, 5100])] + BL + [N([4300, 5100])] + BL + [N([2700, 3300])]}
order = [l['actor'] for l in man['layers']]
rt['actors'] = {a: rt['actors'][a] for a in ['fan', 'rachel', 'barista', 'child', 'oldman', 'cat', 'mum'] if a in order}
json.dump(rt, open(f'{OUT}/routine.json', 'w'), indent=1)
for k, v in stab.items(): print('stab', k, v)
for k, v in reg.items(): print('reg ', k, v)
