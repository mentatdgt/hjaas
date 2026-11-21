"""Move Rachel's floor shadow (and the faint table-leg traces under her) out of the café plate and into her own stills,
so it appears together with her during the paint-in instead of before her.
Usage: python3 -I tools/cafe_shadow.py <package_dir>   (edits plate.png, rachel/*.png and frames.json in place)"""
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
P_ = sys.argv[1]; REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man = json.load(open(f'{P_}/frames.json')); TRIM = man['canvas']['trim_x']
plate = np.asarray(Image.open(f'{P_}/plate.png').convert('RGB')).astype(np.float32); H, W = plate.shape[:2]
clean = np.asarray(Image.open(f'{REPO}/frames/018-cafe-scene/approved/018_plate_quinn.png').convert('RGB')).astype(np.float32)[:, TRIM:TRIM + W]
L = [l for l in man['layers'] if l['actor'] == 'rachel'][0]
ralpha = np.zeros((H, W), np.float32)
for n in L['stills']:
    a = np.asarray(Image.open(f"{P_}/{man['stills'][n]}"))[..., 3].astype(np.float32) / 255
    ralpha[L['y']:L['y'] + L['h'], L['x']:L['x'] + L['w']] = np.maximum(ralpha[L['y']:L['y'] + L['h'], L['x']:L['x'] + L['w']], a)
near = np.zeros((H, W), bool); near[L['y'] + int(L['h'] * 0.55):, max(L['x'] - 140, 0):min(L['x'] + L['w'] + 180, W)] = True
# 1) colour-match Quinn's clean floor to the plate around the area
rough = ndi.binary_dilation((np.abs(plate - clean).max(-1) > 14) & near, iterations=6)
ring = ndi.binary_dilation(rough, iterations=14) & ~ndi.binary_dilation(rough, iterations=4)
diff = (plate - clean) * ring[..., None]; sig = 40
num = np.stack([ndi.gaussian_filter(diff[..., c], sig) for c in range(3)], -1); den = ndi.gaussian_filter(ring.astype(np.float32), sig)[..., None]
cm = np.clip(clean + num / np.maximum(den, 1e-3) * np.clip(den / 0.02, 0, 1), 0, 255)
# 2) the region that differs from clean floor: the shadow, the leg traces (and anything under her)
D = (np.abs(plate - cm).max(-1) > 12) & near
D = ndi.binary_opening(D, iterations=2); lab, n = ndi.label(D)
if n:
    sz = ndi.sum(D, lab, range(1, n + 1)); D = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 300])
G = ndi.binary_fill_holes(ndi.binary_closing(D, iterations=5))
G = ndi.binary_dilation(G, iterations=4)
w = ndi.gaussian_filter(G.astype(np.float32), 2.5)[..., None]
new_plate = plate * (1 - w) + cm * w
# 3) Rachel's stills carry the original floor (with her shadow) in that region, under her
patch = np.dstack([plate, w[..., 0] * 255])
U = (w[..., 0] > 0.004) | (ralpha > 0)
ys, xs = np.where(U); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
for nme in L['stills']:
    st = np.zeros((H, W, 4), np.float32)
    st[L['y']:L['y'] + L['h'], L['x']:L['x'] + L['w']] = np.asarray(Image.open(f"{P_}/{man['stills'][nme]}")).astype(np.float32)
    a = st[..., 3:] / 255; pa = patch[..., 3:] / 255
    out_a = a + pa * (1 - a)
    rgb = (st[..., :3] * a + patch[..., :3] * pa * (1 - a)) / np.maximum(out_a, 1e-6)
    out = np.dstack([rgb, out_a[..., 0] * 255])[y0:y1, x0:x1]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(f"{P_}/{man['stills'][nme]}")
for c in man['clips'].values():
    if c.get('layer') == 'rachel': c['x'] += L['x'] - int(x0); c['y'] += L['y'] - int(y0)
L.update({'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)})
Image.fromarray(np.clip(new_plate, 0, 255).astype(np.uint8)).save(f'{P_}/plate.png')
json.dump(man, open(f'{P_}/frames.json', 'w'), indent=1)
print('rachel layer now', L['x'], L['y'], L['w'], L['h'], '| region px', int(G.sum()))
