"""Scene 5 (theatre): package for the site, in the café format (frames.json + routine.json), plus extras.
Quinn space (1536x1024) -> site canvas 1672x941: crop y 120..984, scale 1672/1536.
Usage: python3 -I tools/theatre_package.py <work_dir> <plate_finished_nolamp.png> <out_site_dir>
work_dir holds plate_nolamp.png, R_*.png, lamp/L_*.png, walk/{L_W0*,R_W0*,gap_mask}.png, walk/walk.json."""
import sys, os, json, glob, numpy as np
from PIL import Image
from scipy import ndimage as ndi

Y0, S = 120, 1672 / 1536
CW, CH = 1672, 941

def to_canvas(im):
    """full Quinn-space image -> full site-canvas image"""
    return im.crop((0, Y0, 1536, Y0 + 864)).resize((CW, CH), Image.LANCZOS)

def bbox_union(ims, pad=2):
    xs0, ys0, xs1, ys1 = [], [], [], []
    for im in ims:
        a = np.asarray(im)[..., 3]; ys, xs = np.where(a > 0)
        if len(xs): xs0.append(xs.min()); ys0.append(ys.min()); xs1.append(xs.max()); ys1.append(ys.max())
    return int(max(min(xs0) - pad, 0)), int(max(min(ys0) - pad, 0)), int(min(max(xs1) + pad + 1, CW)), int(min(max(ys1) + pad + 1, CH))

def add_layer(m, out, actor, named, extra=None):
    ims = {k: to_canvas(v) for k, v in named.items()}
    x0, y0, x1, y1 = bbox_union(ims.values())
    os.makedirs(f'{out}/{actor}', exist_ok=True)
    for k, im in ims.items():
        im.crop((x0, y0, x1, y1)).save(f'{out}/{actor}/{k}.png'); m['stills'][k] = f'{actor}/{k}.png'
    layer = {'actor': actor, 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'stills': list(ims)}
    if extra: layer.update(extra)
    m['layers'].append(layer)

def patches(plate, fin, W, n=10, seed=5):
    """Split the still-unpainted part of the backdrop into n ragged swaths, nearest the painted edge first."""
    a = np.asarray(plate).astype(np.float32); b = np.asarray(fin).astype(np.float32)
    d = np.abs(a - b).max(-1) > 26
    d[Y0 + 864:] = False; d[:, :700] = False; d[630:] = False         # the backdrop only, above its hem
    d = ndi.binary_closing(ndi.binary_opening(d, iterations=2), iterations=6); d = ndi.binary_fill_holes(d)
    lab, k = ndi.label(d); sz = ndi.sum(d, lab, range(1, k + 1)); d = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 4000])
    # how far each unpainted pixel is from the painted edge on its own row: the painting spreads rightward, away from it
    xx = np.arange(d.shape[1])[None, :].repeat(d.shape[0], 0).astype(np.float32)
    rowmin = np.where(d.any(1), np.where(d, xx, 1e9).min(1), 0)[:, None]
    dist = ndi.gaussian_filter(np.where(d, xx - rowmin, 0), 6)
    rng = np.random.default_rng(seed)
    noise = ndi.gaussian_filter(rng.standard_normal(d.shape), 28); noise /= noise.std()
    f = dist + 34 * noise
    # never paint a pixel before everything to its left on the same row: the paint front only moves rightward,
    # so no unpainted island can ever be left behind inside the painted part
    fm = np.where(d, f, -1e9); fm = np.maximum.accumulate(fm, axis=1); f = np.where(d, fm, f)
    # equal shares of what a visitor can SEE: pixels behind Rachel (any pose) all go into the first patch
    rach = np.zeros(d.shape, bool)
    for pth in glob.glob(f'{W}/R_*.png'): rach |= np.asarray(Image.open(pth))[..., 3] > 0
    vis = d & ~rach
    qs = np.quantile(f[vis], np.linspace(0, 1, n + 1)); qs[-1] = f[d].max() + 1
    painted0 = (xx < rowmin) & (xx >= 700) & d.any(1)[:, None]          # the painted part: left of the ragged edge, row by row
    prev = np.zeros_like(d); out = []
    for i in range(n):
        C = (d & ((f <= qs[i + 1]) | (rach & (i == 0)))) | prev
        # keep only paint that touches the painted part (no floating islands), and leave no unpainted holes inside it
        U = C | painted0; lab, k = ndi.label(U); keep = np.unique(lab[painted0 & (lab > 0)])
        C = np.isin(lab, keep) & d
        holes = ndi.binary_fill_holes(C | painted0) & ~(C | painted0) & d      # only small unpainted gaps get filled
        hl, hk = ndi.label(holes)
        if hk: hs = ndi.sum(holes, hl, range(1, hk + 1)); C |= np.isin(hl, [j + 1 for j, s_ in enumerate(hs) if s_ < 3000])
        rest = d & ~C; rl, rn = ndi.label(rest)                         # no tiny unpainted specks left behind
        if rn: rs = ndi.sum(rest, rl, range(1, rn + 1)); C |= np.isin(rl, [j + 1 for j, s_ in enumerate(rs) if s_ < 600])
        if i == n - 1: C = d.copy()
        m = C & ~prev; prev = C
        m = ndi.binary_dilation(m, iterations=2) & ndi.binary_dilation(d, iterations=2)
        al = ndi.gaussian_filter(m.astype(np.float32), 1.6)
        out.append(Image.fromarray(np.dstack([b, al * 255]).clip(0, 255).astype(np.uint8)))
    return out, d

if __name__ == '__main__':
    W, fin_p, out = sys.argv[1:4]; os.makedirs(out, exist_ok=True)
    plate = Image.open(f'{W}/plate_nolamp.png').convert('RGB'); fin = Image.open(fin_p).convert('RGB')
    to_canvas(plate).save(f'{out}/plate.png')
    m = {'canvas': {'w': CW, 'h': CH, 'note': 'Scene 5 (theatre) canvas 1672x941 (= Quinn space 1536x1024 cropped to y 120..984 and scaled by 1672/1536). Draw layers in order over plate.png; each still at its layer x,y. Within a layer every still is pixel-identical to the first outside the part that moves.'},
         'plate': 'plate.png', 'layers': [], 'stills': {}, 'clips': {}}
    # 1. the backdrop: one patch per mushroom found in this scene (hunt progress, not a routine)
    ps, dmask = patches(plate, fin, W)
    for i, p in enumerate(ps):
        add_layer(m, out, f'backdrop_{i + 1:02d}', {f'P_{i + 1:02d}': p},
                  {'scenery': True, 'hunt_progress': i + 1})
    # 2. the stagehand's boots: sprites drawn from a track, clipped to the gap under the hem
    os.makedirs(f'{out}/stagehand', exist_ok=True)
    w = json.load(open(f'{W}/walk/walk.json'))
    for k in w['sprites']:                     # Quinn's drawn walk cycle: L_W01..L_W08 (facing left), R_W01..R_W08 (mirrored)
        im = Image.open(f'{W}/walk/{k}.png'); im.resize((round(im.width * S), round(im.height * S)), Image.LANCZOS).save(f'{out}/stagehand/{k}.png')
    gm = to_canvas(Image.open(f'{W}/walk/gap_mask.png').convert('L')); _, gy0, _, gy1 = Image.fromarray((np.asarray(gm) > 0).astype(np.uint8) * 255).getbbox()
    gx0, gx1 = 0, gm.width                     # always the full canvas width (the site's boots canvas is 1672 wide)
    gm.crop((gx0, gy0, gx1, gy1)).save(f'{out}/stagehand/gap_mask.png')
    for dr in ('rtl', 'ltr'):
        for fr in w[dr]['frames']:
            for b in fr: b['x'] = round(b['x'] * S, 1); b['y'] = round((b['y'] - Y0) * S, 1)
    w['note'] = ('Site canvas coords. Each frame: two boots (far first; draw the far one 15% darker); s = which sprite (a drawing of the '
                 'walk cycle), x,y = bottom-centre of that sprite, rot = 0. Draw the boots clipped to stagehand/gap_mask.png placed at gap_mask_xy, '
                 'so they only show in the dark gap under the backdrop (ladder, pots and cart stay in front).')
    w['gap_mask_xy'] = [gx0, gy0]
    json.dump(w, open(f'{out}/stagehand/walk.json', 'w'))
    m['layers'].append({'actor': 'stagehand', 'x': 0, 'y': 0, 'w': CW, 'h': CH, 'stills': [], 'sprite_track': 'stagehand/walk.json',
                        'sprites': {k: f'stagehand/{k}.png' for k in w['sprites']}, 'mask': 'stagehand/gap_mask.png'})
    # 3. the lamp: a rigid pendulum swing
    lamp = {f'L_{i:02d}': Image.open(p) for i, p in enumerate(sorted(glob.glob(f'{W}/lamp/L_*.png')))}
    add_layer(m, out, 'lamp', lamp, {'scenery': True})
    # 4. Rachel
    names = ['A1', 'A2_stroke_low', 'A3_stroke_out', 'A1_blink', 'B1_lean', 'B2_dip', 'K1_salute']
    add_layer(m, out, 'rachel', {f'R_{n}': Image.open(f'{W}/R_{n}.png') for n in names})
    json.dump(m, open(f'{out}/frames.json', 'w'), indent=1)
    print('layers', [l['actor'] for l in m['layers']])
