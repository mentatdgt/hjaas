"""Build the café (scene 3) animation package from approved 018 assets and the two Higgsfield clips.

Usage: python3 -I tools/cafe_build.py <video_sip_dir> <video_look_dir> <outdir>
(video dirs hold f_001.png ... extracted at native size, 960x960)

Output: <outdir>/plate.png, <outdir>/<actor>/*.png, <outdir>/frames.json
Canvas: 2544x1432 = the approved 2580x1432 scene with 18 px trimmed from each side.
Map to the 1672x941 plate space with scale 1672/2544.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = f'{REPO}/frames/018-cafe-scene/approved'
TRIM = 18
CW, CH = 2580 - 2 * TRIM, 1432
VID_SIP, VID_LOOK, OUT = sys.argv[1:4]
crop = json.load(open(f'{REPO}/frames/018-cafe-scene/hf-inputs/crops.json'))

def key(name):
    a = np.asarray(Image.open(f'{A}/{name}.png').convert('RGBA')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gs = np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1)
    al = (1 - gs) * (a[..., 3] / 255)
    edge = ndi.binary_dilation(al < 0.99, iterations=3)
    cap = np.maximum(r, b) * 1.05 + 10
    a[..., 1] = np.where(edge & (g > cap), cap, g)
    a[..., 3] = al * 255
    return a

def over(base_rgb, fg):
    al = fg[..., 3:4] / 255
    return base_rgb * (1 - al) + fg[..., :3] * al

plate = np.asarray(Image.open(f'{A}/018_plate.png').convert('RGB')).astype(np.float32)
os.makedirs(OUT, exist_ok=True)
Image.fromarray(plate[:, TRIM:TRIM + CW].astype(np.uint8)).save(f'{OUT}/plate.png')

actors = {
    'cat':     ['018_cat_1', '018_cat_2', '018_cat_3'],
    'child':   ['018_C_1', '018_C_2', '018_C_3'],
    'oldman':  ['018_O_1', '018_O_2', '018_O_3'],
    'barista': ['018_B_1', '018_B_2', '018_B_3', '018_B_4'],
    'rachel':  ['018_R_A1_sketch', '018_R_A2_stroke', '018_R_A1_blink', '018_R_B1_sip', '018_R_K1_look'],
    'mum':     ['018_M_blink_half', '018_M_blink_closed'],
}
man = {'canvas': {'w': CW, 'h': CH, 'trim_x': TRIM, 'to_plate_scale': 1672 / CW,
        'note': 'Café canvas 2544x1432 (approved scene minus 18 px each side). Plate space = canvas px x 1672/2544. Draw layers in the order of "layers" over plate.png. Each still is drawn at its layer x,y. Clip frames are patches drawn over the layer\'s base still at the clip x,y (layer-local).'},
       'plate': 'plate.png', 'layers': [], 'stills': {}, 'clips': {}}
S = {}
for actor, names in actors.items():
    K = {n: key(n) for n in names}
    U = np.zeros((1432, 2580), bool)
    for v in K.values(): U |= v[..., 3] > 8
    if actor == 'mum':      # the mum lives in the plate; her blink stills are patches over it
        base = np.dstack([plate, np.full((1432, 2580), 255, np.float32)])
        Kb = {}
        for n, v in K.items():
            diff = np.abs(over(plate, v) - plate).max(-1) > 6
            Kb[n] = (v, diff)
        U = np.zeros((1432, 2580), bool)
        for v, d in Kb.values(): U |= d
        U = ndi.binary_dilation(U, iterations=6)
    ys, xs = np.where(U)
    x0, y0 = max(xs.min() - 6, TRIM), max(ys.min() - 6, 0)
    x1, y1 = min(xs.max() + 7, 2580 - TRIM), min(ys.max() + 7, 1432)
    os.makedirs(f'{OUT}/{actor}', exist_ok=True)
    for n, v in K.items():
        if actor == 'mum':
            comp = over(plate, v)
            rgba = np.dstack([comp, np.full(comp.shape[:2], 255, np.float32)])
            m = ndi.gaussian_filter(U.astype(np.float32), 2)
            rgba[..., 3] = m * 255
            out = rgba
        else:
            out = v
        short = n.replace('018_', '')
        Image.fromarray(np.clip(out[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA').save(f'{OUT}/{actor}/{short}.png')
        man['stills'][short] = f'{actor}/{short}.png'
        S[short] = out
    man['layers'].append({'actor': actor, 'x': int(x0 - TRIM), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0),
                          'stills': [n.replace('018_', '') for n in names]})
    print(actor, 'layer', x0 - TRIM, y0, x1 - x0, y1 - y0)

# ---- Rachel's clips -------------------------------------------------------
rl = [l for l in man['layers'] if l['actor'] == 'rachel'][0]
RX, RY = rl['x'] + TRIM, rl['y']
cast = [key(n) for n in ['018_cat_1', '018_child_green', '018_oldman_green', '018_barista_green']]
def scene_with(rach):
    c = plate.copy()
    for v in cast + [rach]: c = over(c, v)
    return c
X0, Y0, SIDE = crop['x0'], crop['y0'], crop['side']
def vframe(d, i):
    im = Image.open(f'{d}/f_{i:03d}.png').convert('RGB').resize((SIDE, SIDE), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)
def build_clip(d, frames, base_name, name):
    base = S[base_name]                                   # Rachel RGBA on the 2580 canvas
    ref = scene_with(base)[Y0:Y0 + SIDE, X0:X0 + SIDE]
    f0 = vframe(d, frames[0])
    close = np.abs(f0 - ref).mean(-1) < 25
    coef = []
    for c in range(3):
        x, y = f0[..., c][close], ref[..., c][close]
        coef.append(np.linalg.lstsq(np.vstack([x, np.ones_like(x)]).T, y, rcond=None)[0])
    print(name, 'colour fit', [(round(k, 3), round(b, 1)) for k, b in coef], 'px', int(close.sum()))
    vids = []
    for i in frames:
        v = vframe(d, i)
        for c, (k, b) in enumerate(coef): v[..., c] = np.clip(v[..., c] * k + b, 0, 255)
        vids.append(v)
    # one motion zone for the whole clip, so the patch never flickers at its border
    Z = np.zeros((SIDE, SIDE), bool)
    for v in vids: Z |= np.abs(v - ref).max(-1) > 30
    Z = ndi.binary_opening(Z, iterations=2)
    lab, n = ndi.label(Z)
    if n:
        sz = ndi.sum(Z, lab, range(1, n + 1)); Z = np.isin(lab, [j + 1 for j, s in enumerate(sz) if s > 400])
    Z = ndi.binary_closing(Z, iterations=12); Z = ndi.binary_fill_holes(Z); Z = ndi.binary_dilation(Z, iterations=10)
    edge = np.zeros_like(Z); edge[4:-4, 4:-4] = True          # keep clear of the crop border
    Z &= edge
    m = ndi.gaussian_filter(Z.astype(np.float32), 4)
    ys, xs = np.where(m > 0.01)
    px0, py0, px1, py1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    # patch in Rachel-layer coordinates
    lx, ly = X0 + px0 - RX, Y0 + py0 - RY
    os.makedirs(f'{OUT}/rachel/{name}', exist_ok=True)
    fl = []
    base_crop = base[Y0:Y0 + SIDE, X0:X0 + SIDE]
    for i, v in zip(frames, vids):
        mm = m[..., None]
        a_base = base_crop[..., 3:4] / 255
        alpha = mm + (1 - mm) * a_base
        rgb = (v * mm + base_crop[..., :3] * a_base * (1 - mm)) / np.maximum(alpha, 1e-6)
        out = np.dstack([rgb, alpha[..., 0] * 255])[py0:py1, px0:px1]
        fn = f'rachel/{name}/{name}_{i:03d}.png'
        Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(f'{OUT}/{fn}')
        fl.append(fn)
    man['clips'][name] = {'layer': 'rachel', 'base': base_name, 'x': int(lx), 'y': int(ly), 'frames': fl}
    print(name, 'patch', px1 - px0, 'x', py1 - py0, len(frames), 'frames at', lx, ly)

build_clip(VID_SIP, list(range(1, 74, 2)) + [73], 'R_A1_sketch', 'sip')
build_clip(VID_LOOK, list(range(1, 50, 2)), 'R_A1_sketch', 'look_up')
json.dump(man, open(f'{OUT}/frames.json', 'w'), indent=1)
