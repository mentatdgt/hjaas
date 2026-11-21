"""Café: Rachel's shadow arrives with her.
1) the plate gets a clean empty floor under Rachel (Quinn's repaint, job 011) with no shadow or leg traces;
2) her shadow is measured as a darkening of the floor (old plate vs clean floor) and baked into her stills as a
   darkened copy of the NEW floor, so nothing else of the old floor comes with it.
Usage: python3 -I tools/cafe_shadow2.py <package_dir> <floor_fixed.png> <floor_mask.npy> <x0,y0,x1,y1>"""
import sys, json, os, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
P_, F, M, B = sys.argv[1:5]; REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man = json.load(open(f'{P_}/frames.json')); TRIM = man['canvas']['trim_x']
old = np.asarray(Image.open(f'{P_}/plate.png').convert('RGB')).astype(np.float32); H, W = old.shape[:2]
clean = np.asarray(Image.open(f'{REPO}/frames/018-cafe-scene/approved/018_plate_quinn.png').convert('RGB')).astype(np.float32)[:, TRIM:TRIM + W]
L = [l for l in man['layers'] if l['actor'] == 'rachel'][0]
near = np.zeros((H, W), bool); near[L['y'] + int(L['h'] * 0.55):, max(L['x'] - 140, 0):min(L['x'] + L['w'] + 180, W)] = True
rough = ndi.binary_dilation((np.abs(old - clean).max(-1) > 14) & near, iterations=6)
ring = ndi.binary_dilation(rough, iterations=14) & ~ndi.binary_dilation(rough, iterations=4)
diff = (old - clean) * ring[..., None]; sig = 40
num = np.stack([ndi.gaussian_filter(diff[..., c], sig) for c in range(3)], -1); den = ndi.gaussian_filter(ring.astype(np.float32), sig)[..., None]
cm = np.clip(clean + num / np.maximum(den, 1e-3) * np.clip(den / 0.02, 0, 1), 0, 255)
# shadow = how much darker the old floor is than the clean floor (smooth, darkening only)
ratio = (ndi.gaussian_filter(old.mean(-1), 2) + 1) / (ndi.gaussian_filter(cm.mean(-1), 2) + 1)
shade = np.clip(ratio, 0.35, 1.0); shade[~near] = 1.0
dark = shade < 0.93; dark = ndi.binary_opening(dark, iterations=2); lab, n = ndi.label(dark)
if n: sz = ndi.sum(dark, lab, range(1, n + 1)); dark = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 2000])
shade = np.where(ndi.binary_dilation(dark, iterations=6), shade, 1.0); shade = ndi.gaussian_filter(shade, 2.0)
# 1) the plate: shadow and traces out, then Quinn's clean floor in
G = ndi.binary_dilation(ndi.binary_fill_holes(ndi.binary_closing((np.abs(old - cm).max(-1) > 12) & near, iterations=5)), iterations=4)
w = ndi.gaussian_filter(G.astype(np.float32), 2.5)[..., None]
plate = old * (1 - w) + cm * w
Image.fromarray(np.clip(plate, 0, 255).astype(np.uint8)).save(f'{P_}/plate.png')
subprocess.run([sys.executable, '-I', f'{REPO}/tools/cafe_floor_patch.py', P_, F, M, B], check=True)
plate = np.asarray(Image.open(f'{P_}/plate.png').convert('RGB')).astype(np.float32)
# 2) her stills carry the shadow over the new floor
sa = np.clip((1 - shade) / 0.06, 0, 1)                  # where there is any shadow
sh_rgb = plate * shade[..., None]
patch = np.dstack([sh_rgb, sa * 255])
ralpha_box = (L['x'], L['y'], L['x'] + L['w'], L['y'] + L['h'])
ys, xs = np.where(sa > 0.004); U = [min(xs.min(), ralpha_box[0]), min(ys.min(), ralpha_box[1]), max(xs.max() + 1, ralpha_box[2]), max(ys.max() + 1, ralpha_box[3])]
x0, y0, x1, y1 = map(int, U)
for nme in L['stills']:
    st = np.zeros((H, W, 4), np.float32)
    st[L['y']:L['y'] + L['h'], L['x']:L['x'] + L['w']] = np.asarray(Image.open(f"{P_}/{man['stills'][nme]}")).astype(np.float32)
    a = st[..., 3:] / 255; pa = patch[..., 3:] / 255; oa = a + pa * (1 - a)
    rgb = (st[..., :3] * a + patch[..., :3] * pa * (1 - a)) / np.maximum(oa, 1e-6)
    Image.fromarray(np.clip(np.dstack([rgb, oa[..., 0] * 255])[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA').save(f"{P_}/{man['stills'][nme]}")
L.update({'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0})
json.dump(man, open(f'{P_}/frames.json', 'w'), indent=1)
print('rachel layer', x0, y0, x1 - x0, y1 - y0, '| shadow px', int((sa > 0.5).sum()))
