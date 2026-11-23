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
X_RIGHT, X_LEFT = 1610, 190   # he starts (and ends) fully behind the curtain on the right
BACKDROP_LEFT = 338  # the backdrop's left edge (Quinn x); the leaning flat stands just in front of it
SPEED = 285.0        # px/s: a purposeful walk
STRIDE = 300.0       # px per full stride (two steps)
FPS = 60             # track rate (the site animates at 60 fps; position changes every frame)
SHADE = 0.58         # backstage is dim
BODY_SHADE = (0.58, 0.40)   # his body in the dark slot by the curtain: as lit as the boots at the floor, darker towards his head

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

def feet(direction, anchors, W, t):
    """Both feet at time t (s): [(far), (near)], each (drawing index, sprite bottom-centre x). Continuous in t."""
    sgn = -1 if direction == 'rtl' else 1
    side = 'L' if direction == 'rtl' else 'R'
    x0 = X_RIGHT if direction == 'rtl' else X_LEFT
    period = STRIDE / SPEED
    names = [c[0] for c in CYCLE]; pins = [c[1] for c in CYCLE]; moments = [c[2] for c in CYCLE] + [1.0]
    def anc(i, k):
        v = anchors[i][k]
        return W - v if side == 'R' else v
    i03, i01, i05 = names.index('W03_midstance'), names.index('W01_contact'), names.index('W05_toe_off')
    L = abs(anc(i03, 'heel') - anc(i03, 'toe'))
    out = []
    for phase0 in (0.0, 0.5):                                  # far foot, near foot half a stride apart
        ph = ((t / period) + phase0) % 1.0
        cyc = np.floor((t / period) + phase0)
        heel = x0 + sgn * STRIDE * (cyc - phase0) + sgn * STRIDE * 0.25
        toe = heel + sgn * L
        i = max(j for j in range(len(names)) if moments[j] <= ph)
        if pins[i] == 'heel':  x = heel - anc(i, 'heel') + W / 2
        elif pins[i] == 'toe': x = toe - anc(i, 'toe') + W / 2
        else:
            c_off = toe - anc(i05, 'toe') + anc(i05, 'centre')
            c_on = heel + sgn * STRIDE - anc(i01, 'heel') + anc(i01, 'centre')
            u = (ph - SWING_START) / (1 - SWING_START)
            x = c_off + (c_on - c_off) * _ease(u) - anc(i, 'centre') + W / 2
        out.append((i, float(x), ph))
    return out

def track(direction, anchors, W, body=None):
    """Per frame: the two boots (continuous). With `body` (the drawn full-body walk), the frames in which any part of
    him is in the open slot by the curtain show the whole man instead: one drawing per moment of the stride, placed
    where his boots are at that moment. The switch happens at a moment's middle, where the boots and the drawing agree."""
    sgn = -1 if direction == 'rtl' else 1
    side = 'L' if direction == 'rtl' else 'R'
    x0, x1 = (X_RIGHT, X_LEFT) if direction == 'rtl' else (X_LEFT, X_RIGHT)
    T = abs(x1 - x0) / SPEED; n = int(T * FPS) + 1
    period = STRIDE / SPEED; names = [c[0] for c in CYCLE]; moments = [c[2] for c in CYCLE] + [1.0]
    frames = []
    for f in range(n):
        t = f / FPS
        (fi, fx, _), (ni, nx, nph) = feet(direction, anchors, W, t)
        boots = [{'s': f"{side}_{names[fi].split('_')[0]}", 'x': round(fx, 1), 'y': float(GROUND - 2), 'rot': 0, 'far': True},
                 {'s': f"{side}_{names[ni].split('_')[0]}", 'x': round(nx, 1), 'y': float(GROUND), 'rot': 0, 'far': False}]
        if body is not None:
            # this moment's middle, for the near foot
            m0 = moments[ni]; m1 = moments[ni + 1]; t_mid = t + ((m0 + m1) / 2 - nph) * period
            (_, fxm, _), (_, nxm, _) = feet(direction, anchors, W, t_mid)
            def zone(tm):
                (_, a_, _), (_, b_, _) = feet(direction, anchors, W, tm); return body['zone'][0] <= (a_ + b_) / 2 <= body['zone'][1]
            nm = len(moments) - 1
            tp = t_mid - ((m0 + m1) / 2 - (moments[ni - 1] + moments[ni]) / 2 if ni > 0 else (m0 + m1) / 2 - (moments[nm - 1] + 1.0) / 2 + 1.0) * period
            tn = t_mid + ((moments[ni + 1] + (moments[ni + 2] if ni + 2 <= nm else 1.0 + moments[1])) / 2 - (m0 + m1) / 2) * period
            cur, prv, nxt = zone(t_mid), zone(tp), zone(tn)
            # enter or leave the full-body view only at a moment's middle, where the boots and the drawing agree
            if cur and (t >= t_mid - 1e-9 or prv) and (t <= t_mid + 1e-9 or nxt):
                bdx = body['near_dx'][ni] * (1 if side == 'L' else -1)        # sprite bottom-centre minus near boot x
                frames.append([{'s': f"L_B{ni + 1:02d}", 'x': round(nxm + bdx, 1), 'y': float(GROUND + body['dy']),
                                'rot': 0, 'far': False, 'body': True, **({'flip': True} if side == 'R' else {})}])
                continue
        frames.append(boots)
    # the switch must fall where boots and drawing agree: only allow a change of mode at a moment's middle
    return {'fps': FPS, 'frames': frames}

def key_body(body_dir, layout):
    """Quinn's full-body walk (jobs 022j/022k): B01..B16 on green, 1024x1536, boots placed by body_inputs at scale DS.
    Returns sprites (L_Bnn, R_Bnn mirrored) at the boots' scale, and each drawing's offset from its near boot."""
    L = json.load(open(layout)); Q2C = L['Q2C']; FLOOR = L['FLOOR']
    sprites, near_dx = {}, []
    for k, p in enumerate(L['poses']):
        a = np.asarray(Image.open(f"{body_dir}/{p['tag']}.png").convert('RGB')).astype(np.float32)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        al = 1 - np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1); al = ndi.gaussian_filter(al, 0.7)
        edge = ndi.binary_dilation(al < 0.99, iterations=3); cap = np.maximum(r, b) * 1.05 + 10
        a[..., 1] = np.where(edge & (g > cap), cap, g)
        H, Wd = al.shape; w = round(Wd / Q2C); h = round(FLOOR / Q2C)        # keep the full width; bottom edge = the floor
        sh = np.interp(np.arange(FLOOR), [FLOOR - 0.75 * FLOOR, FLOOR - 230], [BODY_SHADE[1], BODY_SHADE[0]])[:, None, None]   # floor-level light
        im = Image.fromarray(np.dstack([a[:FLOOR] * sh, al[:FLOOR] * 255]).clip(0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
        sprites[f"L_{p['tag']}"] = im                                        # walking right: the same drawing, mirrored when drawn (flip)
        near_dx.append(-p['near_cx_offset'] / Q2C)                          # canvas centre (512) minus near boot, in Quinn px
    return sprites, near_dx

def slot_mask(plate):
    """The open slot between the backdrop's right edge and the curtain (where he is seen whole), above the hem."""
    a = np.asarray(Image.open(plate).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; lum = 0.3 * r + 0.59 * g + 0.11 * b
    curt = ndi.binary_dilation(ndi.binary_opening((r > 95) & (r > 2.0 * np.maximum(g, b)), iterations=1), iterations=1)
    gold = ndi.binary_dilation((r > 150) & (g > 100) & (b < 110), iterations=2)
    ys, xe = [], []
    for y in range(200, HEM):
        for x in range(1350, 1440):
            if lum[y, x] > 95 and (lum[y, x + 1:x + 6] < 60).all(): ys.append(y); xe.append(x); break
    fe = np.polyfit(ys, xe, 1)
    m = np.zeros(lum.shape, bool)
    for y in range(150, HEM):
        e = int(round(np.polyval(fe, y))) + 2
        for x in range(e, a.shape[1]):
            if curt[y, x]: break
            m[y, x] = True
    m &= ~gold & (lum < 70)
    m = ndi.binary_opening(m, iterations=1)
    lab, n = ndi.label(m); sizes = ndi.sum(m, lab, range(1, n + 1)); m = np.isin(lab, 1 + np.where(sizes > 500)[0])
    return ndi.gaussian_filter(m.astype(np.float32), 0.6)

if __name__ == '__main__':
    plate, walk_dir, out = sys.argv[1:4]; body_dir = sys.argv[4] if len(sys.argv) > 4 else None
    os.makedirs(out, exist_ok=True)
    sprites, anchors, W = key_frames(walk_dir)
    gm = gap_mask(plate)
    body = None
    if body_dir:
        bs, near_dx = key_body(body_dir, f'{body_dir}/body_layout.json'); sprites.update(bs)
        sm = slot_mask(plate)
        Image.fromarray((np.maximum(sm, gm) * 255).astype(np.uint8)).save(f'{out}/body_mask.png')   # where he's seen whole: slot + gap
        # he is "in the slot zone" while his drawing could overlap the slot (half his width either side of it)
        xs = np.where(sm.max(0) > 0.5)[0]; half = max(im.width for k, im in bs.items()) / 2
        body = {'near_dx': near_dx, 'dy': 0.0, 'zone': (xs.min() - half, X_RIGHT + 200)}
    for k, im in sprites.items(): im.save(f'{out}/{k}.png')
    Image.fromarray((gm * 255).astype(np.uint8)).save(f'{out}/gap_mask.png')
    w = {'note': 'Stagehand behind the backdrop. Quinn space 1536x1024. Each frame: a list of sprites to draw in order. Boots: two '
                 '(far first, drawn 15% darker), clipped to gap_mask. When he is by the curtain, one entry with body=true: his whole '
                 'drawn body, clipped to body_mask. x,y = bottom-centre of the sprite (its bottom edge is the floor), rot = 0.',
         'sprites': sorted(sprites), 'rtl': track('rtl', anchors, W, body), 'ltr': track('ltr', anchors, W, body)}
    json.dump(w, open(f'{out}/walk.json', 'w'))
    nb = sum(1 for d in ('rtl', 'ltr') for fr in w[d]['frames'] if fr[0].get('body'))
    print('drawings', len(POSES), 'frames rtl', len(w['rtl']['frames']), 'ltr', len(w['ltr']['frames']), 'body frames', nb)
