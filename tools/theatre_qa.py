"""Scene 5 (theatre): automatic checks on Rachel's stills before anything is shown to the user.
Usage: python3 -I tools/theatre_qa.py <work_dir> <green_dir> <sheet.jpg>
Checks, per still:
  1. coverage: every pixel the green-screen cut says is Rachel is fully opaque in the still (no see-through trousers,
     boots or brush); reports the count of under-opaque pixels;
  2. no stray opacity: nothing opaque where the cut says background;
  3. legs and boots: identical to the base in every still (pixel diff below her waist cut);
  4. the face: identical to the base in the stroke poses.
Writes a check sheet: each still on magenta (shows any hole) and on the plate, plus zooms of the boots and torso."""
import sys, numpy as np
from PIL import Image

W, G, SHEET = sys.argv[1:4]
CX = 330
import glob, os
names = ['A1', 'A2_stroke_low', 'A3_stroke_out', 'A1_blink', 'B1_lean', 'B2_dip', 'K1_salute'] + \
        sorted(os.path.basename(p)[2:-4] for p in glob.glob(f'{W}/R_T_*.png'))   # the arm in-betweens (job 022m)
def pmul(a): return np.dstack([a[..., :3] * a[..., 3:] / 255.0, a[..., 3]])
base = pmul(np.asarray(Image.open(f'{W}/R_A1.png')).astype(float))
H, Wd = base.shape[:2]; yy, xx = np.mgrid[0:H, 0:Wd]
ok = True
for n in names:
    raw = np.asarray(Image.open(f'{W}/R_{n}.png')).astype(int); s = pmul(raw.astype(float))
    g = np.asarray(Image.open(f'{W}/green_{n}.png' if n.startswith('T_') else f'{G}/green_{n}.png').convert('RGB')).astype(int)
    fg = ~((g[..., 1] > 150) & (g[..., 1] - np.maximum(g[..., 0], g[..., 2]) > 70))
    from scipy import ndimage as ndi
    inner = np.zeros((H, Wd), bool); inner[:, CX:CX + 1024] = ndi.binary_erosion(fg, iterations=2)
    outer = np.zeros((H, Wd), bool); outer[:, CX:CX + 1024] = ~ndi.binary_dilation(fg, iterations=2)
    under = int((inner & (raw[..., 3] < 250)).sum()); stray = int((outer & (raw[..., 3] > 5)).sum())
    legs = int(((np.abs(s - base).max(-1) > 2) & (yy >= 460) & (xx < 800)).sum())
    face = int(((np.abs(s - base).max(-1) > 2) & (xx >= 690) & (xx <= 806) & (yy >= 195) & (yy <= 305)).sum()) if ('stroke' in n or n.startswith('T_')) else -1
    bad = under > 30 or stray > 30 or legs > 0 or face > 0
    ok &= not bad
    print(f'{n:15s} under-opaque {under:5d}  stray {stray:5d}  legs-changed {legs:4d}  face-changed {face:5d}  {"FAIL" if bad else "ok"}')
plate = Image.open(f'{W}/plate_nolamp.png').convert('RGBA')
cols = []
for n in names:
    r = Image.open(f'{W}/R_{n}.png')
    mg = Image.new('RGBA', plate.size, (255, 0, 255, 255)); mg.alpha_composite(r)
    pl = plate.copy(); pl.alpha_composite(r)
    cols.append([mg.crop((650, 170, 1010, 700)).resize((270, 398)), pl.crop((650, 170, 1010, 700)).resize((270, 398)),
                 mg.crop((680, 560, 840, 700)).resize((270, 236)), pl.crop((700, 300, 860, 470)).resize((270, 287))])
sheet = Image.new('RGB', (270 * len(names), 398 * 2 + 236 + 287), 'white')
for i, c in enumerate(cols):
    y = 0
    for im in c: sheet.paste(im.convert('RGB'), (270 * i, y)); y += im.height
sheet.save(SHEET, quality=90)
print('ALL OK' if ok else 'SOME FAIL')
