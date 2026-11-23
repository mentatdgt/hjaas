import json, os, numpy as np, sys
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, '/home/claude/hjaas/tools')
import importlib.util
spec = importlib.util.spec_from_file_location('tw', '/home/claude/hjaas/tools/theatre_walk.py'); tw = importlib.util.module_from_spec(spec); spec.loader.exec_module(tw)
WD = '/home/claude/hjaas/frames/022-theatre-scene/approved/quinn/walk'
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
sprites, anchors, Wsp = tw.key_frames(WD)                    # sets tw.CYCLE/POSES
names = tw.POSES
# drawing crop used by key_frames (union bbox) -> recompute
alphas = []
for n in names:
    a = np.asarray(Image.open(f'{WD}/{n}.png').convert('RGB')).astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    alphas.append(1 - np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1))
u = np.max([al > 0.5 for al in alphas], axis=0); ys, xs = np.where(u); X0, X1 = xs.min() - 2, xs.max() + 3
fl = alphas[names.index('W03_midstance')][872:881] > 0.5; fx = np.where(fl.any(0))[0]; sc = tw.SOLE_W / (fx.max() - fx.min() + 1)
DS = 0.34                                                     # drawing -> composite scale
Q2C = DS / sc                                                 # Quinn px -> composite px
FLOOR = 1490
tr = tw.track('rtl', anchors, Wsp)
moments = [c[2] for c in tw.CYCLE]
period = tw.STRIDE / tw.SPEED
info = []
for k, (name, pin, m0) in enumerate(tw.CYCLE):
    m1 = moments[k + 1] if k + 1 < len(moments) else 1.0
    ph_near = (m0 + m1) / 2                                   # middle of this drawing's moment
    t = ((ph_near - 0.5) % 1.0) * period                      # near foot has phase0 0.5 in track()
    f = int(round(t * tw.FPS)) + int(round(period * tw.FPS)) * 2
    far, near = tr['frames'][f]
    assert near['s'] == 'L_' + name.split('_')[0], (near['s'], name)
    hip = (far['x'] + near['x']) / 2
    canvas = Image.new('RGBA', (1024, 1536), (0, 255, 0, 255)); protect = np.zeros((1536, 1024), bool)
    near_cx = None
    for b, dark in ((far, True), (near, False)):
        bn = [n for n in names if n.split('_')[0] == b['s'][2:]][0]
        im = Image.open(f'{WD}/{bn}.png').convert('RGB'); a = np.asarray(im).astype(np.float32)
        r, g, bb = a[..., 0], a[..., 1], a[..., 2]; al = 1 - np.clip((g - np.maximum(r, bb) - 40) / 120, 0, 1)
        if dark: a = a * 0.85
        boot = (al > 0.5) & (r > bb + 25)
        rgba = np.dstack([a, al * 255]).clip(0, 255).astype(np.uint8)
        sm = Image.fromarray(rgba).resize((round(1024 * DS), round(1024 * DS)), Image.LANCZOS)
        cx = 512 + (b['x'] - hip) * Q2C                          # composite x of the sprite's bottom-centre
        if not dark: near_cx = cx
        ox = cx - ((X0 + X1) / 2) * DS; oy = FLOOR - 880 * DS
        canvas.alpha_composite(sm, (int(round(ox)), int(round(oy))))
        bm = Image.fromarray((boot * 255).astype(np.uint8)).resize(sm.size, Image.NEAREST)
        pm = np.zeros((1536, 1024), bool); bma = np.asarray(bm) > 0
        x0, y0 = int(round(ox)), int(round(oy)); pm[y0:y0 + bma.shape[0], x0:x0 + bma.shape[1]] = bma[:1536 - y0, :1024 - x0]
        protect |= pm
    protect = ndi.binary_dilation(protect, iterations=3)
    tag = f'B{k + 1:02d}'
    canvas.convert('RGB').save(f'{OUT}/{tag}_boots.png')
    Image.fromarray(((~protect) * 255).astype(np.uint8)).save(f'{OUT}/{tag}_mask.png')
    info.append({'tag': tag, 'near': near['s'], 'far': far['s'], 'near_phase': round(ph_near, 3), 'hip_minus_near_quinn': round(hip - near['x'], 1), 'near_cx_offset': round(near_cx - 512, 2)})
json.dump({'DS': DS, 'Q2C': Q2C, 'FLOOR': FLOOR, 'poses': info}, open(f'{OUT}/body_layout.json', 'w'), indent=1)
for i in info: print(i)
