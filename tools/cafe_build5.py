"""Café package, stabilised: every pose = the actor's base pose + ONLY the part that moves.
Outside the moving zone a pose is pixel-identical to the base, so nothing can flicker.

Usage: python3 -I tools/cafe_build5.py <outdir> [fan_frames_dir]
"""
import sys, os, json, glob, subprocess
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = f'{REPO}/frames/018-cafe-scene/approved'
OUT = sys.argv[1]; FAN = sys.argv[2] if len(sys.argv) > 2 else None
TRIM = 18; CW, CH = 2580 - 2 * TRIM, 1432

def key(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    al = 1 - np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1)
    al = ndi.gaussian_filter(al, 0.7)
    edge = ndi.binary_dilation(al < 0.99, iterations=3); cap = np.maximum(r, b) * 1.05 + 10
    a[..., 1] = np.where(edge & (g > cap), cap, g)
    return np.dstack([a, al * 255])
def K(n, sub=''): return key(f'{A}/{sub}018_{n}.png')
def pm(x): return x[..., :3] * (x[..., 3:] / 255)
def zone(base, src, thr=16, minsize=80, grow=6, box=None):
    d = (np.abs(pm(base) - pm(src)).max(-1) > thr) | (np.abs(base[..., 3] - src[..., 3]) > 60)
    if box is not None:
        m = np.zeros_like(d); x0, y0, x1, y1 = box; m[y0:y1, x0:x1] = True; d &= m
    d = ndi.binary_opening(d, iterations=1)
    lab, n = ndi.label(d)
    if n:
        sz = ndi.sum(d, lab, range(1, n + 1)); d = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= minsize])
    d = ndi.binary_closing(d, iterations=4); d = ndi.binary_fill_holes(d)
    return ndi.binary_dilation(d, iterations=grow)
def fit(src, base, z):
    """Match src's colours to base using the ring just outside the zone."""
    ring = ndi.binary_dilation(z, iterations=28) & ~ndi.binary_dilation(z, iterations=3) & (base[..., 3] > 250) & (src[..., 3] > 250)
    out = src.copy()
    for c in range(3):
        x, y = src[..., c][ring], base[..., c][ring]
        k, b = 1.0, 0.0
        for _ in range(3):
            res = np.abs(x * k + b - y); ok = res < 22 if _ else np.ones_like(res, bool)
            if ok.sum() < 50: break
            k, b = np.linalg.lstsq(np.vstack([x[ok], np.ones(ok.sum())]).T, y[ok], rcond=None)[0]
        out[..., c] = np.clip(src[..., c] * k + b, 0, 255)
    return out
def paste(base, src, z, feather=2.0):
    m = ndi.gaussian_filter(z.astype(np.float32), feather); m[m < 0.004] = 0; m = m[..., None]
    a = base[..., 3:] * (1 - m) + src[..., 3:] * m
    rgb = (pm(base) * (1 - m) + pm(src) * m) / np.maximum(a / 255, 1e-6)
    out = np.dstack([np.clip(rgb, 0, 255), a[..., 0]])
    keep = m[..., 0] == 0; out[keep] = base[keep]          # exact outside the zone
    return out
def bbox_of(mask, pad=0):
    ys, xs = np.where(mask); return max(xs.min() - pad, 0), max(ys.min() - pad, 0), xs.max() + 1 + pad, ys.max() + 1 + pad

poses, zones = {}, {}
# ---- Rachel ---------------------------------------------------------------
A1 = K('R_A1_sketch'); poses['R_A1_sketch'] = A1
z = zone(A1, K('R_A2_stroke'), minsize=40); poses['R_A2_stroke'] = paste(A1, K('R_A2_stroke'), z); zones['R_A2_stroke'] = z
rgb = A1[..., :3]; white = (rgb.min(-1) > 222) & (A1[..., 3] > 250)
hb = np.zeros_like(white); hb[600:800, 1200:1500] = True; white &= hb
lab, n = ndi.label(white); sz = ndi.sum(white, lab, range(1, n + 1)); white = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 150])
ex0, ey0, ex1, ey1 = bbox_of(white, 14)
z = np.zeros_like(white); z[ey0:ey1, ex0:ex1] = True
bl = K('R_A1_blink'); poses['R_A1_blink'] = paste(A1, fit(bl, A1, z), z, 3.0); zones['R_A1_blink'] = z
# sip: three drawn poses. Arms, cup and stylus move; the head only moves at the sip itself.
below = np.zeros(A1.shape[:2], bool); below[770:, :] = True
s1 = K('R_S1_reach'); z = zone(A1, s1, minsize=60) & below; S1 = paste(A1, s1, z); poses['R_S1_reach'] = S1; zones['R_S1_reach'] = z
s2 = K('R_S2_lift'); z2 = zone(A1, s2, minsize=60) & below; S2 = paste(A1, s2, z2)
ez = zones['R_A1_blink']; S2 = paste(S2, fit(s2, A1, ez), ez, 3.0); poses['R_S2_lift'] = S2; zones['R_S2_lift'] = z2 | ez
b1 = K('R_B1_sip'); zb = zone(S2, b1, thr=14, minsize=400, grow=8); poses['R_B1_sip'] = paste(S2, b1, zb); zones['R_B1_sip'] = zb | zones['R_S2_lift']
K2 = K('R_K2_smile'); hz = zone(A1, K2, thr=14, minsize=1500, grow=8)
baseK = paste(A1, K2, hz); poses['R_K2_smile'] = baseK; zones['R_K2_smile'] = hz
k1b = K('R_K1_blink'); fz = zone(K2, k1b, thr=14, minsize=40) & hz
poses['R_K1_blink'] = paste(baseK, k1b, fz); zones['R_K1_blink'] = hz
k1 = K('R_K1_look', 'pre-round5/')                           # same family as K2: no seams
c = k1[..., :3]; cream = (c[..., 0] > 225) & (c[..., 1] > 205) & (c[..., 2] > 150) & (c.min(-1) <= 222) & hz
cream = ndi.binary_opening(cream, iterations=1); k1[cream, :3] = [247, 245, 238]      # its right eye was tinted
fz = zone(K2, k1, thr=14, minsize=40) & hz
poses['R_K1_look'] = paste(baseK, k1, fz); zones['R_K1_look'] = hz
# ---- barista: still, with an eyes-only glance ------------------------------
B1 = K('B_1'); poses['B_1'] = B1
bx0, by0, bx1, by1 = bbox_of(B1[..., 3] > 128)
z = zone(B1, K('B_4'), thr=14, minsize=25, grow=4, box=(bx0, by0, bx1, by0 + int((by1 - by0) * 0.45)))
poses['B_4'] = paste(B1, K('B_4'), z); zones['B_4'] = z
# ---- child: looks down at his drawing (tools/cafe_child_gaze.py) ------------
tmp = f'{OUT}/_c1.png'; os.makedirs(OUT, exist_ok=True)
subprocess.run([sys.executable, '-I', f'{REPO}/tools/cafe_child_gaze.py', f'{A}/018_C_1.png', tmp], check=True)
C1o = K('C_1'); C1 = key(tmp); os.remove(tmp); poses['C_1'] = C1
face = np.zeros(C1.shape[:2], bool); face[720:800, 396:476] = True
z = zone(C1o, K('C_2'), minsize=40) & ~face; poses['C_2'] = paste(C1, K('C_2'), z); zones['C_2'] = z
z = zone(C1o, K('C_3'), minsize=100) | (face & (C1o[..., 3] > 128)); z = ndi.binary_fill_holes(ndi.binary_closing(z, iterations=6))
poses['C_3'] = paste(C1, K('C_3'), z); zones['C_3'] = z
# ---- old man, cat ----------------------------------------------------------
O1 = K('O_1'); poses['O_1'] = O1
for n in ['O_2', 'O_3']:
    z = zone(O1, K(n), minsize=200); poses[n] = paste(O1, K(n), z); zones[n] = z
c1 = K('cat_1'); poses['cat_1'] = c1
for n, ms in [('cat_2', 200), ('cat_3', 120)]:
    z = zone(c1, K(n), thr=14, minsize=ms); poses[n] = paste(c1, K(n), z); zones[n] = z

plate = np.asarray(Image.open(f'{A}/018_plate.png').convert('RGB')).astype(np.float32)
os.makedirs(OUT, exist_ok=True)
Image.fromarray(plate[:, TRIM:TRIM + CW].astype(np.uint8)).save(f'{OUT}/plate.png')
actors = {'cat': ['cat_1', 'cat_2', 'cat_3'], 'child': ['C_1', 'C_2', 'C_3'], 'oldman': ['O_1', 'O_2', 'O_3'],
          'barista': ['B_1', 'B_4'], 'rachel': ['R_A1_sketch', 'R_A2_stroke', 'R_A1_blink', 'R_S1_reach', 'R_S2_lift', 'R_B1_sip', 'R_K1_blink', 'R_K1_look', 'R_K2_smile']}
man = {'canvas': {'w': CW, 'h': CH, 'trim_x': TRIM, 'to_plate_scale': 1672 / CW,
        'note': 'Café canvas 2544x1432. Plate space = canvas px x 1672/2544. Draw the layers in order over plate.png; each still is drawn at its layer x,y. Within a layer, every still is pixel-identical to the first one outside the part that moves.'},
       'plate': 'plate.png', 'layers': [], 'stills': {}, 'clips': {}}
report = {}
def add_layer(actor, names, arrs, base_name=None):
    U = np.zeros((1432, 2580), bool)
    for v in arrs: U |= v[..., 3] > 4
    x0, y0, x1, y1 = bbox_of(U, 6); x0 = max(x0, TRIM); x1 = min(x1, 2580 - TRIM); y1 = min(y1, 1432)
    os.makedirs(f'{OUT}/{actor}', exist_ok=True)
    for n, v in zip(names, arrs):
        Image.fromarray(np.clip(v[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA').save(f'{OUT}/{actor}/{n}.png')
        man['stills'][n] = f'{actor}/{n}.png'
    man['layers'].append({'actor': actor, 'x': int(x0 - TRIM), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0), 'stills': names})
if FAN:
    fr = sorted(glob.glob(f'{FAN}/fan_*.png')); meta = json.load(open(f'{FAN}/fan.json'))
    os.makedirs(f'{OUT}/fan', exist_ok=True); names = []
    for f in fr:
        n = os.path.basename(f)[:-4]; Image.open(f).save(f'{OUT}/fan/{n}.png'); man['stills'][n] = f'fan/{n}.png'; names.append(n)
    man['layers'].append({'actor': 'fan', 'x': meta['x'] - TRIM, 'y': meta['y'], 'w': meta['w'], 'h': meta['h'], 'stills': names})
    Image.open(f'{FAN}/plate_nofan.png').convert('RGB').crop((TRIM, 0, TRIM + CW, CH)).save(f'{OUT}/plate.png')
for actor, names in actors.items():
    add_layer(actor, names, [poses[n] for n in names])
    b = poses[names[0]]
    for n in names[1:]:
        ch = np.abs(poses[n] - b).max(-1) > 0
        report[n] = {'changed_px_pct_of_actor': round(100 * ch.sum() / max((b[..., 3] > 128).sum(), 1), 1),
                     'changed_outside_zone_px': int((ch & ~ndi.binary_dilation(zones[n], iterations=12)).sum())}
# mum: lives in the plate; her blink is an eye-only patch over it
mg = K('mum_green'); mx0, my0, mx1, my1 = bbox_of(mg[..., 3] > 128)
arrs = []; U = np.zeros((1432, 2580), bool); zs = []
for n in ['M_blink_half', 'M_blink_closed']:
    z = zone(mg, K(n), thr=14, minsize=20, grow=4, box=(mx0, my0, mx1, my0 + int((my1 - my0) * 0.3))); zs.append(z); U |= z
for n, z in zip(['M_blink_half', 'M_blink_closed'], zs):
    v = K(n); m = ndi.gaussian_filter(U.astype(np.float32), 2.0)
    comp = plate * (1 - v[..., 3:] / 255) + v[..., :3] * (v[..., 3:] / 255)
    arrs.append(np.dstack([comp, m * 255]))
add_layer('mum', ['M_blink_half', 'M_blink_closed'], arrs)
json.dump(man, open(f'{OUT}/frames.json', 'w'), indent=1)
json.dump(report, open(f'{OUT}/stability.json', 'w'), indent=1)
for k, v in report.items(): print(k, v)
for l in man['layers']: print(l['actor'], l['x'], l['y'], l['w'], l['h'])
