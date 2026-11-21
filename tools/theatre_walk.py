"""Scene 5 (theatre): the stagehand's boots crossing behind the backdrop, seen only in the gap under its hem.
Each boot is a rigid sprite: it rolls off its toe, swings forward on an arc, lands on its heel and rolls flat, so it never slides.
Usage: python3 -I tools/theatre_walk.py <plate.png> <boot_facing_left.png> <boot_facing_right.png> <out_dir>
Writes (Quinn space, 1536x1024): boot_L.png / boot_R.png (sprites, sole at the bottom), gap_mask.png (where boots may show),
walk.json (two tracks at 30 fps: 'rtl' right-to-left and 'ltr' left-to-right; per frame, per boot: x, y of the sprite's
bottom-centre, rotation in degrees, and draw order far-then-near)."""
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi

SOLE_W = 46          # boot length on screen (px, Quinn space)
GROUND = 666         # sole line on the backstage floor behind the backdrop
HEM = 631            # first visible row under the backdrop's hem
X_RIGHT, X_LEFT = 1490, 190
SPEED = 285.0        # px/s: a purposeful walk
STRIDE = 300.0       # px per full stride (two steps)
FPS = 30
SHADE = 0.58         # backstage is dim

def key(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    al = 1 - np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1); al = ndi.gaussian_filter(al, 0.7)
    edge = ndi.binary_dilation(al < 0.99, iterations=3); cap = np.maximum(r, b) * 1.05 + 10
    a[..., 1] = np.where(edge & (g > cap), cap, g)
    ys, xs = np.where(al > 0.5); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; al = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    # sole length = width of the bottom 12% of the sprite
    h = al.shape[0]; bottom = al[int(h * 0.88):].max(0) > 0.5; bx = np.where(bottom)[0]
    s = SOLE_W / (bx.max() - bx.min() + 1)
    im = Image.fromarray(np.dstack([a * SHADE, al * 255]).clip(0, 255).astype(np.uint8))
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

def gap_mask(plate):
    a = np.asarray(Image.open(plate).convert('RGB')).astype(np.float32)
    lum = a @ np.array([0.3, 0.59, 0.11]); m = np.zeros(lum.shape, bool)
    m[HEM:704] = lum[HEM:704] < 72
    # The right-hand curtain hangs in front of the gap: its shadowed folds are dark enough to pass the test
    # above, so close the mask from the curtain's left edge rightward, row by row (2026-11-22, Fable's review 01).
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    curt = ndi.binary_opening((r > 95) & (r > 2.0 * np.maximum(g, b)), iterations=1)
    X0 = 1360                                  # the curtain zone starts right of the cart
    for y in range(HEM, 704):
        run = ndi.uniform_filter1d(curt[y, X0:].astype(np.float32), 7)
        xs = np.where(run > 0.6)[0]
        if len(xs): m[y, X0 + xs[0] - 3:] = False
    m = ndi.binary_opening(m, iterations=1); m = ndi.binary_erosion(m, iterations=1)
    return ndi.gaussian_filter(m.astype(np.float32), 0.8)

def track(direction):
    sgn = -1 if direction == 'rtl' else 1
    x0, x1 = (X_RIGHT, X_LEFT) if direction == 'rtl' else (X_LEFT, X_RIGHT)
    T = abs(x1 - x0) / SPEED; n = int(T * FPS) + 1
    period = STRIDE / SPEED                    # one stride per foot
    stance = 0.62                              # fraction of the stride each foot is on the ground
    frames = []
    for i in range(n):
        t = i / FPS; hip = x0 + sgn * SPEED * t
        boots = []
        for k, phase0 in ((0, 0.0), (1, 0.5)):  # k=0 far foot, k=1 near foot, half a stride apart
            ph = ((t / period) + phase0) % 1.0
            cyc = np.floor((t / period) + phase0)
            # the foot's ground position advances by one STRIDE per cycle; it is fixed while the foot is down
            base = x0 + sgn * STRIDE * (cyc - phase0) + sgn * STRIDE * 0.25
            if ph < stance:
                x = base; lift = 0.0
                if ph < 0.12: rot = -12 * (1 - ph / 0.12)            # heel strike -> flat (toe up -> 0)
                elif ph > stance - 0.12: rot = 12 * (ph - (stance - 0.12)) / 0.12   # heel off (toe down)
                else: rot = 0.0
            else:
                u = (ph - stance) / (1 - stance)                       # 0..1 through the swing
                e = u * u * (3 - 2 * u)
                x = base + sgn * STRIDE * e
                lift = 9 * np.sin(np.pi * u)
                rot = 12 * np.cos(np.pi * u)                           # toe down at lift-off, toe up at landing
            boots.append({'x': round(float(x), 1), 'y': round(GROUND - lift - (2 if k == 0 else 0), 1),
                          'rot': round(float(rot * -sgn), 2), 'far': k == 0})
        frames.append(boots)
    return {'fps': FPS, 'frames': frames, 'sprite': 'boot_L' if direction == 'rtl' else 'boot_R'}

if __name__ == '__main__':
    plate, bl, br, out = sys.argv[1:5]; os.makedirs(out, exist_ok=True)
    key(bl).save(f'{out}/boot_L.png'); key(br).save(f'{out}/boot_R.png')
    Image.fromarray((gap_mask(plate) * 255).astype(np.uint8)).save(f'{out}/gap_mask.png')
    w = {'note': 'Stagehand boots behind the backdrop. Quinn space 1536x1024. Each frame: two boots (far first, drawn 15% darker), x,y = bottom-centre of the sprite on screen, rot = degrees (positive = clockwise) about that point. Draw the boots clipped to gap_mask (they only show in the dark gap under the hem: the ladder, pots and cart stay in front).',
         'rtl': track('rtl'), 'ltr': track('ltr')}
    json.dump(w, open(f'{out}/walk.json', 'w'))
    print('frames rtl', len(w['rtl']['frames']), 'ltr', len(w['ltr']['frames']))
