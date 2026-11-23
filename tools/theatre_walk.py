"""Scene 5 (theatre): the stagehand's boots crossing behind the backdrop, seen only in the gap under its hem.
The boots walk on Quinn's hand-drawn walk cycle (job 022g, 2026-11-23): 8 drawings of one boot facing left
(W01 contact, W02 flat, W03 mid-stance, W04 heel rise, W05 toe-off, W06-W08 swing), floor at y=880 in each.
Planted poses are pinned by their floor contact (the heel for W01-W03, the toe tip for W04-W05), so the foot never
slides; in the air the boot carries from where it pushed off to where it lands next. Facing right = the same drawings mirrored.
Usage: python3 -I tools/theatre_walk.py <plate.png> <walk_dir with W01..W08 png> <out_dir>
Writes (Quinn space, 1536x1024): L_W01..L_W08.png and R_W01..R_W08.png (sprites; their bottom edge is the floor),
gap_mask.png (where boots may show), walk.json (two tracks at 30 fps, 'rtl' and 'ltr'; per frame, per boot:
s = sprite name, x, y of the sprite's bottom-centre, rot = 0, far)."""
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi

SOLE_W = 66          # boot length on screen (px, Quinn space): a man's work boot, about a paint tin wide (2026-11-22; was 46)
GROUND = 666         # sole line on the backstage floor behind the backdrop
HEM = 631            # first visible row under the backdrop's hem
X_RIGHT, X_LEFT = 1490, 190
BACKDROP_LEFT = 338  # the backdrop's left edge (Quinn x); the leaning flat stands just in front of it
SPEED = 285.0        # px/s: a purposeful walk
STRIDE = 300.0       # px per full stride (two steps)
FPS = 60             # track rate (the site animates at 60 fps; position changes every frame)
SHADE = 0.58         # backstage is dim

# The walk cycle: Quinn's 8 keys (job 022g) and 8 in-betweens (job 022h). (name, pinned by, moment in one foot's stride)
CYCLE = [('W01_contact', 'heel', 0.000), ('W01b', 'heel', 0.035), ('W02_flat', 'heel', 0.070), ('W02b', 'heel', 0.135),
         ('W03_midstance', 'heel', 0.200), ('W03b', 'heel', 0.300), ('W04_heel_rise', 'toe', 0.400), ('W04b', 'toe', 0.465),
         ('W05_toe_off', 'toe', 0.530), ('W05b', 'air', 0.600), ('W06_early_swing', 'air', 0.640), ('W06b', 'air', 0.700),
         ('W07_mid_swing', 'air', 0.760), ('W07b', 'air', 0.820), ('W08_late_swing', 'air', 0.880), ('W08b', 'air', 0.940)]
SWING_START = 0.600  # the toe leaves the floor
POSES = [c[0] for c in CYCLE]
FLOOR_Y = 880        # the floor line in Quinn's drawings

def key_frames(walk_dir):
    """Key all 8 drawings on one common crop and one common scale, so they stay registered to each other.
    Returns sprites {name: RGBA image} and per-pose anchors in sprite px (facing left): heel/toe at the floor, boot centre."""
    global CYCLE, POSES
    CYCLE = [c for c in CYCLE if os.path.exists(f'{walk_dir}/{c[0]}.png')]; POSES = [c[0] for c in CYCLE]
    raw = [np.asarray(Image.open(f'{walk_dir}/{n}.png').convert('RGB')).astype(np.float32) for n in POSES]
    alphas, rgbs = [], []
    for a in raw:
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        al = 1 - np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1); al = ndi.gaussian_filter(al, 0.7)
        edge = ndi.binary_dilation(al < 0.99, iterations=3); cap = np.maximum(r, b) * 1.05 + 10
        a = a.copy(); a[..., 1] = np.where(edge & (g > cap), cap, g); alphas.append(al); rgbs.append(a)
    union = np.max([al > 0.5 for al in alphas], axis=0); ys, xs = np.where(union)
    x0, x1, y0 = xs.min() - 2, xs.max() + 3, ys.min() - 2
    y1 = FLOOR_Y + 1                                            # bottom edge of every sprite = the floor
    # scale: W03's sole (heel to toe on the floor) becomes SOLE_W
    fl = alphas[POSES.index('W03_midstance')][FLOOR_Y - 8:FLOOR_Y + 1] > 0.5; fx = np.where(fl.any(0))[0]
    sc = SOLE_W / (fx.max() - fx.min() + 1)
    W = round((x1 - x0) * sc); H = round((y1 - y0) * sc)
    sprites, anchors = {}, []
    for n, a, al in zip(POSES, rgbs, alphas):
        crop = np.dstack([a[y0:y1, x0:x1] * SHADE, al[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(crop).resize((W, H), Image.LANCZOS)
        sprites['L_' + n.split('_')[0]] = im; sprites['R_' + n.split('_')[0]] = im.transpose(Image.FLIP_LEFT_RIGHT)
        f = al[FLOOR_Y - 8:FLOOR_Y + 1] > 0.5; fxs = np.where(f.any(0))[0]
        r_, b_ = a[..., 0], a[..., 2]; boot = (al > 0.5) & (r_ > b_ + 25); bxs = np.where(boot)[1]
        anchors.append({'heel': (fxs.max() - x0) * sc if len(fxs) else None, 'toe': (fxs.min() - x0) * sc if len(fxs) else None,
                        'centre': (bxs.mean() - x0) * sc})
    return sprites, anchors, W

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
    # Left of the backdrop's left edge nothing hangs above the floor: anyone there would be seen whole (in the dark slots
    # between the flats). So the boots only ever show under the hem: walking left he goes out of sight behind the leaning
    # flat, whose edge meets the floor beside the backdrop's edge (2026-11-23, user: "when they reach the end there is no person").
    m[:, :BACKDROP_LEFT] = False
    m = ndi.binary_opening(m, iterations=1); m = ndi.binary_erosion(m, iterations=1)
    return ndi.gaussian_filter(m.astype(np.float32), 0.8)

def _ease(u): u = min(max(u, 0.0), 1.0); return u * u * (3 - 2 * u)

def track(direction, anchors, W):
    sgn = -1 if direction == 'rtl' else 1                      # the toe points this way
    side = 'L' if direction == 'rtl' else 'R'
    x0, x1 = (X_RIGHT, X_LEFT) if direction == 'rtl' else (X_LEFT, X_RIGHT)
    T = abs(x1 - x0) / SPEED; n = int(T * FPS) + 1
    period = STRIDE / SPEED
    names = [c[0] for c in CYCLE]; pins = [c[1] for c in CYCLE]; moments = [c[2] for c in CYCLE] + [1.0]
    def anc(i, k):
        v = anchors[i][k]
        return W - v if side == 'R' else v
    i03, i01, i05 = names.index('W03_midstance'), names.index('W01_contact'), names.index('W05_toe_off')
    L = abs(anc(i03, 'heel') - anc(i03, 'toe'))                # sole length on the floor (= SOLE_W)
    frames = []
    for f in range(n):
        t = f / FPS; boots = []
        for kf, phase0 in ((0, 0.0), (1, 0.5)):                # far foot, near foot half a stride apart
            ph = ((t / period) + phase0) % 1.0
            cyc = np.floor((t / period) + phase0)
            heel = x0 + sgn * STRIDE * (cyc - phase0) + sgn * STRIDE * 0.25   # this stride's heel print
            toe = heel + sgn * L
            i = max(j for j in range(len(names)) if moments[j] <= ph)
            if pins[i] == 'heel':  x = heel - anc(i, 'heel') + W / 2           # pinned at the heel
            elif pins[i] == 'toe': x = toe - anc(i, 'toe') + W / 2             # pinned at the toe tip
            else:                                                              # in the air: carried from toe-off to the next heel strike
                c_off = toe - anc(i05, 'toe') + anc(i05, 'centre')
                c_on = heel + sgn * STRIDE - anc(i01, 'heel') + anc(i01, 'centre')
                u = (ph - SWING_START) / (1 - SWING_START)
                c = c_off + (c_on - c_off) * _ease(u)
                x = c - anc(i, 'centre') + W / 2
            boots.append({'s': f"{side}_{names[i].split('_')[0]}", 'x': round(float(x), 1), 'y': float(GROUND - (2 if kf == 0 else 0)),
                          'rot': 0, 'far': kf == 0})
        frames.append(boots)
    return {'fps': FPS, 'frames': frames}

if __name__ == '__main__':
    plate, walk_dir, out = sys.argv[1:4]; os.makedirs(out, exist_ok=True)
    sprites, anchors, W = key_frames(walk_dir)
    for k, im in sprites.items(): im.save(f'{out}/{k}.png')
    Image.fromarray((gap_mask(plate) * 255).astype(np.uint8)).save(f'{out}/gap_mask.png')
    w = {'note': 'Stagehand boots behind the backdrop, on Quinn\'s drawn walk cycle. Quinn space 1536x1024. Each frame: two boots '
                 '(far first, drawn 15% darker); s = sprite, x,y = bottom-centre of the sprite (its bottom edge is the floor), rot = 0. '
                 'Draw the boots clipped to gap_mask (they only show in the dark gap under the hem: the ladder, pots and cart stay in front).',
         'sprites': sorted(sprites), 'rtl': track('rtl', anchors, W), 'ltr': track('ltr', anchors, W)}
    json.dump(w, open(f'{out}/walk.json', 'w'))
    print('drawings', len(POSES), 'frames rtl', len(w['rtl']['frames']), 'ltr', len(w['ltr']['frames']), 'sprite size', sprites['L_W03'].size)
