"""Scene 5 (theatre): build Rachel's layer stills from the locked scene, the plate and Quinn's pose crops.
Every pose = the base Rachel (cut from the locked scene against the plate) + ONLY the part that moved, colour-matched.
Works in Quinn space (1536x1024). Usage: python3 -I tools/theatre_build.py <out_dir> <plate.png> <pose_dir> [pose names...]
Writes <out_dir>/R_<name>.png (RGBA, full 1536x1024) and a check sheet."""
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
# helpers copied from tools/cafe_build7.py (that file runs its build on import)
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

SCENE = 'frames/022-theatre-scene/incoming/022_scene_LOCKED_1536x1024.png'
CX = 330                      # pose crops are scene[:, 330:1354]
REGION = (600, 120, 1060, 720)  # where Rachel can be (x0, y0, x1, y1), full coords

def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)

def silhouette(img, plate, thr=40):
    x0, y0, x1, y1 = REGION
    d = np.abs(img - plate).max(-1) > thr
    r = np.zeros_like(d); r[y0:y1, x0:x1] = True; d &= r
    d = ndi.binary_opening(d, iterations=1)
    lab, n = ndi.label(d)
    if n:
        sz = ndi.sum(d, lab, range(1, n + 1)); d = lab == (int(np.argmax(sz)) + 1)
    d = ndi.binary_closing(d, iterations=3); d = ndi.binary_fill_holes(d)
    return ndi.gaussian_filter(d.astype(np.float32), 0.6)

def rgba(rgb, al): return np.dstack([rgb, np.clip(al, 0, 1) * 255]).astype(np.float32)

if __name__ == '__main__':
    out, plate_p, pose_dir = sys.argv[1:4]; names = sys.argv[4:]
    os.makedirs(out, exist_ok=True)
    S = load(SCENE); P = load(plate_p)
    base = rgba(S, silhouette(S, P))
    Image.fromarray(base.astype(np.uint8)).save(f'{out}/R_A1.png')
    x0, y0, x1, y1 = REGION
    region = np.zeros(S.shape[:2], bool); region[y0:y1, x0:x1] = True
    for n in names:
        q = S.copy(); q[:, CX:CX + 1024] = load(f'{pose_dir}/{n}.png')
        src = rgba(q, silhouette(q, P))
        z = zone(base, src, thr=22, minsize=60, grow=5, region=region)
        still = paste(base, src, z, feather=1.6, match=True)
        Image.fromarray(np.clip(still, 0, 255).astype(np.uint8)).save(f'{out}/R_{n}.png')
        print(n, 'zone px', int(z.sum()))
