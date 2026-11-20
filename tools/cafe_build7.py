"""Café package v7: Rachel and the barista from their round-9 masters (the café's painted style), every pose = master + ONLY
the part that moves; the child with his head tilted down; the rigid drawn fan.
Usage: python3 -I tools/cafe_build7.py <outdir> <fan_dir> [child_lookup_png]"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = f'{REPO}/frames/018-cafe-scene/approved'; R9 = f'{A}/round9'
OUT, FAN = sys.argv[1], sys.argv[2]; C3NEW = sys.argv[3] if len(sys.argv) > 3 else None
TRIM = 18; CW, CH = 2580 - 2 * TRIM, 1432
def soft_key(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return ndi.gaussian_filter(1 - np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1), 0.7)
def despill(a):
    al = a[..., 3] / 255; edge = ndi.binary_dilation(al < 0.99, iterations=3); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    cap = np.maximum(r, b) * 1.05 + 10; a = a.copy(); a[..., 1] = np.where(edge & (g > cap), cap, g); return a
def K(n):
    a = np.asarray(Image.open(f'{A}/018_{n}.png').convert('RGB')).astype(np.float32); return despill(np.dstack([a, soft_key(a) * 255]))
def Q(n):
    return despill(np.asarray(Image.open(f'{R9}/{n}.png')).astype(np.float32))
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
def eyes_box(img, region, pad=14):
    rgb = img[..., :3]; w = (rgb.min(-1) > 200) & (img[..., 3] > 250) & region
    lab, n = ndi.label(w); sz = ndi.sum(w, lab, range(1, n + 1)); w = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 60])
    x0, y0, x1, y1 = bbox_of(w, pad); return box_mask(img.shape, x0, y0, x1, y1)
poses, zones = {}, {}; S = (1432, 2580)
# ---------------- Rachel ----------------
RM = Q('R_MASTER'); poses['R_A1_sketch'] = RM
ys, xs = np.where(RM[..., 3] > 128); rx0, ry0, rx1, ry1 = xs.min(), ys.min(), xs.max(), ys.max()
NECK = 800                                    # her head and hair are above; arms, cup and stylus between NECK and the table edge
ARMS = box_mask(S, 0, NECK - 40, 2580, 1012); head = box_mask(S, rx0 - 20, ry0 - 20, rx1 + 20, NECK)
EYES = eyes_box(RM, box_mask(S, rx0, ry0, rx1, NECK))
ZK = dict(thr=30, smooth=1.5, keep_hair=True, minsize=150)
def rach(name, region, extra=None, **kw):
    src = Q(name); z = zone(RM, src, region=region, **{**ZK, **kw})
    if extra is not None: z = z | extra
    zones[name] = z; return paste(RM, src, z)
poses['R_A2_stroke'] = rach('R_A2_stroke', ARMS)
poses['R_A1_blink'] = paste(RM, Q('R_A1_blink'), EYES, 3.0); zones['R_A1_blink'] = EYES
poses['R_S1_reach'] = rach('R_S1_reach', ARMS)
poses['R_S2_lift'] = rach('R_S2_lift', ARMS, EYES)
poses['R_B1_sip'] = rach('R_B1_sip', ARMS | box_mask(S, 0, 700, 2580, 1012), EYES)
# reaction: the head from K1 on the master's body; K2 and K1_blink change only the face inside K1's head
k1 = Q('R_K1_look'); hz = zone(RM, k1, region=head, thr=16, minsize=1500, grow=10); hz = ndi.binary_fill_holes(ndi.binary_closing(hz, iterations=8))
K1 = paste(RM, k1, hz, 3.0); poses['R_K1_look'] = K1; zones['R_K1_look'] = hz
FACE = eyes_box(K1, hz, pad=40) | box_mask(S, *[int(v) for v in np.array(bbox_of(eyes_box(K1, hz, 0)))[[0, 1, 2, 3]] + np.array([-10, 0, 10, 90])])
for n in ['R_K2_smile', 'R_K1_blink']:
    src = Q(n); z = zone(K1, src, region=FACE & hz, thr=16, minsize=30, grow=6); poses[n] = paste(K1, src, z); zones[n] = z | hz
# ---------------- barista ----------------
BM = Q('B_MASTER'); poses['B_1'] = BM
ys, xs = np.where(BM[..., 3] > 128); bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max(), ys.max()
bface = box_mask(S, bx0, by0, bx1, by0 + int((by1 - by0) * 0.42)); bhands = box_mask(S, bx0, by0 + int((by1 - by0) * 0.55), bx1, by1)
for n in ['B_2_polish', 'B_3_polish']:
    src = Q(n); z = zone(BM, src, region=bhands, thr=30, smooth=1.5, keep_hair=True, minsize=120); poses[n] = paste(BM, src, z); zones[n] = z
src = Q('B_4_glance'); z = zone(BM, src, region=bface, thr=16, minsize=20, grow=4); poses['B_4_glance'] = paste(BM, src, z); zones['B_4_glance'] = z
# ---------------- child ----------------
C1o = K('C_1'); hd = Q('C_HEAD_DOWN')
cy = 812                                       # the neck: his head and hair are above, shirt and arms below
chead = zone(C1o, hd, region=box_mask(S, 0, 0, 2580, cy), thr=14, minsize=200, grow=8) | (box_mask(S, 0, 0, 2580, cy) & (hd[..., 3] > 128) & ~box_mask(S, 0, cy - 10, 2580, 1432))
chead = ndi.binary_fill_holes(ndi.binary_closing(chead, iterations=6)) & box_mask(S, 0, 0, 2580, cy + 8)
C1 = paste(C1o, hd, chead, 2.0); poses['C_1'] = C1; zones['C_1'] = chead
z = zone(C1o, K('C_2'), minsize=40) & ~ndi.binary_dilation(chead, iterations=6); poses['C_2'] = paste(C1, K('C_2'), z); zones['C_2'] = z
if C3NEW:
    c3 = despill(np.asarray(Image.open(C3NEW)).astype(np.float32)); z = zone(C1, c3, minsize=100, grow=8) & box_mask(S, 0, 0, 2580, 980)
    poses['C_3'] = paste(C1, c3, ndi.binary_fill_holes(ndi.binary_closing(z, iterations=6))); zones['C_3'] = z
# ---------------- old man, cat (unchanged art) ----------------
O1 = K('O_1'); poses['O_1'] = O1
for n in ['O_2', 'O_3']:
    z = zone(O1, K(n), minsize=200); poses[n] = paste(O1, K(n), z, match=False); zones[n] = z
c1 = K('cat_1'); poses['cat_1'] = c1
for n, ms in [('cat_2', 200), ('cat_3', 120)]:
    z = zone(c1, K(n), thr=14, minsize=ms); poses[n] = paste(c1, K(n), z, match=False); zones[n] = z
# ---------------- write ----------------
os.makedirs(OUT, exist_ok=True)
plate = np.asarray(Image.open(f'{FAN}/plate_nofan.png').convert('RGB')).astype(np.float32)
Image.fromarray(plate[:, TRIM:TRIM + CW].astype(np.uint8)).save(f'{OUT}/plate.png')
man = {'canvas': {'w': CW, 'h': CH, 'trim_x': TRIM, 'to_plate_scale': 1672 / CW,
        'note': 'Café canvas 2544x1432. Draw layers in order over plate.png; each still at its layer x,y. Within a layer every still is pixel-identical to the first outside the part that moves.'},
       'plate': 'plate.png', 'layers': [], 'stills': {}, 'clips': {}}
def add_layer(actor, names, arrs):
    U = np.zeros(S, bool)
    for v in arrs: U |= v[..., 3] > 4
    x0, y0, x1, y1 = bbox_of(U, 6); x0 = max(x0, TRIM); x1 = min(x1, 2580 - TRIM); y1 = min(y1, 1432)
    os.makedirs(f'{OUT}/{actor}', exist_ok=True)
    for n, v in zip(names, arrs):
        Image.fromarray(np.clip(v[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA').save(f'{OUT}/{actor}/{n}.png'); man['stills'][n] = f'{actor}/{n}.png'
    man['layers'].append({'actor': actor, 'x': int(x0 - TRIM), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0), 'stills': names})
fj = json.load(open(f'{FAN}/fan.json')); names = []
os.makedirs(f'{OUT}/fan', exist_ok=True)
for f in range(fj['frames']):
    n = f'fan_{f:02d}'; Image.open(f'{FAN}/{n}.png').save(f'{OUT}/fan/{n}.png'); man['stills'][n] = f'fan/{n}.png'; names.append(n)
man['layers'].append({'actor': 'fan', 'x': fj['x'] - TRIM, 'y': fj['y'], 'w': fj['w'], 'h': fj['h'], 'stills': names})
actors = {'cat': ['cat_1', 'cat_2', 'cat_3'], 'child': ['C_1', 'C_2'] + (['C_3'] if 'C_3' in poses else []), 'oldman': ['O_1', 'O_2', 'O_3'],
          'barista': ['B_1', 'B_2_polish', 'B_3_polish', 'B_4_glance'],
          'rachel': ['R_A1_sketch', 'R_A2_stroke', 'R_A1_blink', 'R_S1_reach', 'R_S2_lift', 'R_B1_sip', 'R_K1_look', 'R_K1_blink', 'R_K2_smile']}
rep = {}
for actor, ns in actors.items():
    add_layer(actor, ns, [poses[n] for n in ns]); b = poses[ns[0]]
    for n in ns[1:]:
        ch = np.abs(poses[n] - b).max(-1) > 0
        rep[n] = {'changed_pct_of_actor': round(float(100 * ch.sum() / max((b[..., 3] > 128).sum(), 1)), 1), 'changed_outside_zone_px': int((ch & ~ndi.binary_dilation(zones[n], iterations=12)).sum())}
# mum: eye-only blink patches over the plate (art unchanged)
mg = K('mum_green'); mx0, my0, mx1, my1 = bbox_of(mg[..., 3] > 128); U = np.zeros(S, bool); zs = []
for n in ['M_blink_half', 'M_blink_closed']:
    z = zone(mg, K(n), thr=14, minsize=20, grow=4, region=box_mask(S, mx0, my0, mx1, my0 + int((my1 - my0) * 0.3))); zs.append(z); U |= z
arrs = []
for n in ['M_blink_half', 'M_blink_closed']:
    v = K(n); m = ndi.gaussian_filter(U.astype(np.float32), 2.0); comp = plate * (1 - v[..., 3:] / 255) + v[..., :3] * (v[..., 3:] / 255); arrs.append(np.dstack([comp, m * 255]))
add_layer('mum', ['M_blink_half', 'M_blink_closed'], arrs)
json.dump(man, open(f'{OUT}/frames.json', 'w'), indent=1); json.dump(rep, open(f'{OUT}/stability.json', 'w'), indent=1)
for k, v in rep.items(): print(k, v)
