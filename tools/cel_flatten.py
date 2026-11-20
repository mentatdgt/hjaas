"""Flatten a character's colours to cel shading while keeping the drawing exactly.

Gradients become flat fills with hard-edged shadow steps (like Rachel and the barista).
Lines, shapes, faces and eyes are untouched. One palette per character, fitted on the base
pose and reused for every pose, so the frames never flicker.

Usage: python3 -I tools/cel_flatten.py <k> <base.png> [other.png ...] --out DIR
(green-screen PNGs, 2580x1432)
"""
import sys, os
import numpy as np, cv2
from PIL import Image
from sklearn.cluster import KMeans
from scipy import ndimage as ndi
args = sys.argv[1:]; out = args[args.index('--out') + 1]; args = args[:args.index('--out')]
K = int(args[0]); files = args[1:]
os.makedirs(out, exist_ok=True)
def load(p):
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.uint8)
    r, g, b = [a[..., i].astype(int) for i in range(3)]
    fg = (g - np.maximum(r, b)) < 60
    return a, fg
def lines(rgb, fg):
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[..., 0].astype(float)
    blur = cv2.GaussianBlur(lab, (0, 0), 2.0)
    l = ((blur - lab) > 10) | (lab < 70)
    return l & fg
base_rgb, base_fg = load(files[0])
smooth = cv2.bilateralFilter(base_rgb, 9, 40, 9)
lab = cv2.cvtColor(smooth, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(float)
sel = (base_fg & ~lines(base_rgb, base_fg)).reshape(-1)
km = KMeans(n_clusters=K, n_init=4, random_state=0).fit(lab[sel][::3])
cent = km.cluster_centers_
for p in files:
    rgb, fg = load(p)
    sm = cv2.bilateralFilter(rgb, 9, 40, 9)
    L = cv2.cvtColor(sm, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(float)
    idx = np.zeros(L.shape[0], int)
    m = fg.reshape(-1)
    d = ((L[m][:, None, :] - cent[None]) ** 2).sum(-1)
    idx[m] = d.argmin(1)
    idx = idx.reshape(fg.shape)
    # clean speckles: majority filter on the label map
    idx = ndi.generic_filter(idx, lambda v: np.bincount(v.astype(int)).argmax(), size=5) if False else cv2.medianBlur(idx.astype(np.uint8), 5)
    flat_lab = cent[idx].astype(np.float32)
    flat = cv2.cvtColor(np.clip(flat_lab, 0, 255).astype(np.uint8).reshape(fg.shape + (3,)), cv2.COLOR_LAB2RGB)
    ln = lines(rgb, fg)
    lnw = cv2.GaussianBlur(ln.astype(np.float32), (0, 0), 0.6)[..., None]
    res = flat * (1 - lnw) + rgb * lnw                     # keep the original line art on top
    res = np.where(fg[..., None], res, rgb)                # green stays green
    Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(f'{out}/{os.path.basename(p)}')
    print('flattened', os.path.basename(p))
