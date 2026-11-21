"""Scene 5 (theatre): Rachel's layer stills.
Colour comes from the drawings themselves (the locked scene for the base, Quinn's pose crops for the poses).
The outline (alpha) comes ONLY from Quinn's green-screen cut-outs (job 022f), never from comparing with the plate:
that comparison loses every part of her that matches the background (navy trousers on the blue landscape,
boots on the ladder, paint-tipped bristles on the sky).
Every pose = the base + only the part that moved (no colour re-fit: Quinn's pose crops are pixel-identical outside
the edit, so they need none).
Usage: python3 -I tools/theatre_build.py <out_dir> <pose_dir> <green_dir> [pose names...]
Writes <out_dir>/R_<name>.png (RGBA, full Quinn space 1536x1024)."""
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi

SCENE = 'frames/022-theatre-scene/incoming/022_scene_LOCKED_1536x1024.png'
CX = 330                                   # every crop is scene[:, 330:1354]
HEAD = (680, 190, 812, 318)                # her head (full coords): the strokes never touch it

def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)

def key(green_png):
    """alpha from a green-screen cut-out: hard inside, 1 px soft edge, no holes, nothing stray"""
    g = load(green_png); r, gg, b = g[..., 0], g[..., 1], g[..., 2]
    fg = ~((gg > 150) & (gg - np.maximum(r, b) > 70))          # anything that is not the green screen
    fg = ndi.binary_opening(fg, iterations=1)
    lab, n = ndi.label(fg)
    if n:                                                         # keep her (and anything attached), drop specks
        sz = ndi.sum(fg, lab, range(1, n + 1)); fg = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 400])
    holes = ndi.binary_fill_holes(fg) & ~fg                       # fill only pin-holes, keep real gaps (arm/body)
    hl, hn = ndi.label(holes)
    if hn: hs = ndi.sum(holes, hl, range(1, hn + 1)); fg |= np.isin(hl, [i + 1 for i, s in enumerate(hs) if s < 40])
    return ndi.gaussian_filter(fg.astype(np.float32), 0.55)

def full(crop_arr, fill):
    out = np.array(fill, np.float32, copy=True); out[:, CX:CX + 1024] = crop_arr; return out

if __name__ == '__main__':
    out, pose_dir, green_dir = sys.argv[1:4]; names = sys.argv[4:]
    os.makedirs(out, exist_ok=True)
    S = load(SCENE); H, W = S.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    zero = np.zeros((H, W), np.float32)
    a0 = full(key(f'{green_dir}/green_A1.png'), zero)
    base = np.dstack([S, a0 * 255])
    Image.fromarray(base.clip(0, 255).astype(np.uint8)).save(f'{out}/R_A1.png')
    head = (xx >= HEAD[0]) & (xx <= HEAD[2]) & (yy >= HEAD[1]) & (yy <= HEAD[3])
    MODE = {'A2_stroke_low': 'stroke', 'A3_stroke_out': 'stroke', 'A1_blink': 'blink',
            'B1_lean': 'pose', 'B2_dip': 'pose', 'K1_salute': 'pose'}
    for n in names:
        rgb = full(load(f'{pose_dir}/{n}.png'), S)
        al = full(key(f'{green_dir}/green_{n}.png'), zero)
        changed = (np.abs(rgb - S).max(-1) > 6) | (np.abs(al - a0) > 0.3)
        changed = ndi.binary_dilation(ndi.binary_opening(changed, iterations=1), iterations=4)
        mode = MODE[n]
        if mode == 'stroke': z = changed & ~head                       # arm, shoulder and brush; never the face
        elif mode == 'blink': z = changed & head                       # the eyes only
        else: z = changed | (ndi.binary_dilation(changed, iterations=12) & (yy < 452))   # the whole moved upper body
        z &= ~((yy >= 460) & (xx < 800))                               # legs and boots always stay the base drawing
        m = ndi.gaussian_filter(z.astype(np.float32), 1.2)[..., None]; m[m < 0.01] = 0
        a = a0[..., None] * (1 - m) + al[..., None] * m
        pre = S * a0[..., None] * (1 - m) + rgb * al[..., None] * m
        col = np.where(a > 1e-4, pre / np.maximum(a, 1e-4), 0)
        still = np.dstack([col, a[..., 0] * 255])
        Image.fromarray(still.clip(0, 255).astype(np.uint8)).save(f'{out}/R_{n}.png')
        print(n, mode, 'zone px', int(z.sum()))
