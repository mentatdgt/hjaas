"""Ceiling fan as a rigid 3-blade model, rendered in the drawn style (flat colour, one shadow tone, constant outline).
Geometry is fitted to Quinn's drawn fan; the hub, downrod and ceiling are Quinn's drawing. Motion is physically exact:
the blades rotate in their own horizontal plane, seen from below, with a slight pitch and correct front/back order.
Usage: python3 -I tools/cafe_fan3.py <plate> <fan_drawn> <fan_green> <ceiling_nofan> <x0,y0,x1,y1> <outdir> [deg_per_frame=6]"""
import sys, os, json, numpy as np, cv2
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from sklearn.cluster import KMeans
plate_p, drawn_p, green_p, nofan_p, box_s, OUT = sys.argv[1:7]; STEP = float(sys.argv[7]) if len(sys.argv) > 7 else 6.0
X0, Y0, X1, Y1 = map(int, box_s.split(',')); W, H = X1 - X0, Y1 - Y0; os.makedirs(OUT, exist_ok=True)
L = lambda p: np.asarray(Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32)
plate = np.asarray(Image.open(plate_p).convert('RGB')).astype(np.float32)
drawn, green, nofan = L(drawn_p), L(green_p), L(nofan_p)
fanm = (1 - np.clip((green[..., 1] - np.maximum(green[..., 0], green[..., 2]) - 40) / 120, 0, 1)) > 0.5
# ---- hub (Quinn's drawing) ----
top = fanm[:6]; rod_x = int(round(np.where(top.any(0))[0].mean())); rod_half = max(int(top.any(0).sum() / 2) + 3, 8)
hub_bottom = int(np.where(fanm[:, rod_x])[0].max())
lefts = []
for y in range(H):
    xs = np.where(fanm[y, :rod_x + 1])[0]
    if len(xs) == 0: lefts.append(0); continue
    run = rod_x - xs[::-1][np.argmax(np.diff(np.r_[rod_x + 1, xs[::-1]]) != -1)] if False else None
    # width of the contiguous run that ends at rod_x
    k = rod_x; 
    while k - 1 >= 0 and fanm[y, k - 1]: k -= 1
    lefts.append(rod_x - k)
lefts = np.array(lefts)
body = np.where((lefts > rod_half + 10) & (lefts < 0.12 * W))[0]; hub_top = int(body.min()); hw = int(np.median(lefts[body])) + 4
hm = Image.new('L', (W, H), 0); d = ImageDraw.Draw(hm)
d.ellipse([rod_x - hw, hub_top - 4, rod_x + hw, hub_bottom + 3], fill=255); d.rectangle([rod_x - rod_half, 0, rod_x + rod_half, hub_top + 6], fill=255)
hub = (np.asarray(hm) > 0) & fanm
Hc = np.array([rod_x, (hub_top + hub_bottom) / 2], float)
# ---- the drawn blades: split by angle, measure tips and colours ----
Y_, X_ = np.mgrid[0:H, 0:W]
near = ((X_ - rod_x) / (hw * 1.15)) ** 2 + ((Y_ - Hc[1]) / ((hub_bottom - hub_top) / 2 * 1.15)) ** 2 < 1
bl = fanm & ~hub & ~near; yy, xx = np.where(bl)
ang = np.arctan2(yy - Hc[1], (xx - Hc[0]) / 4.0)
km = KMeans(3, n_init=10, random_state=0).fit(np.c_[np.cos(ang), np.sin(ang)])
masks = []
for k in range(3):
    m = np.zeros_like(bl); m[yy[km.labels_ == k], xx[km.labels_ == k]] = True
    l2, n2 = ndi.label(m); z = ndi.sum(m, l2, range(1, n2 + 1)); masks.append(l2 == (np.argmax(z) + 1))
tips = []
for m in masks:
    yy2, xx2 = np.where(m); dd = (xx2 - Hc[0]) ** 2 + (yy2 - Hc[1]) ** 2; i = dd.argmax(); tips.append((xx2[i], yy2[i]))
P = np.array(tips, float) - Hc
# the tip circle seen in perspective: the ellipse through the three drawn tips, centred on the hub
Mx = np.array([[x * x, x * y, y * y] for x, y in P]); qa, qb, qc = np.linalg.solve(Mx, np.ones(3))
Q = np.array([[qa, qb / 2], [qb / 2, qc]]); ev, evec = np.linalg.eigh(Q); assert (ev > 0).all(), ev
M = evec @ np.diag(ev ** -0.5) @ evec.T; Mi = np.linalg.inv(M); a = float((ev ** -0.5).max()); b = float((ev ** -0.5).min())
tipang = np.array([np.arctan2(*(Mi @ p_)[::-1]) for p_ in P])
widths = []; roots = []
for m, t0 in zip(masks, tipang):
    yy2, xx2 = np.where(m); q = (Mi @ np.c_[xx2 - Hc[0], yy2 - Hc[1]].T).T
    dvec = np.array([np.cos(t0), np.sin(t0)]); evv = np.array([-dvec[1], dvec[0]])
    widths.append(np.percentile(np.abs(q @ evv), 95)); roots.append(np.percentile(q @ dvec, 2))
BW = float(np.clip(np.median(widths), 0.08, 0.12)); R0 = float(np.clip(np.median(roots), 0.12, 0.3))
def sample(mask, lo, hi):
    px = drawn[mask]; lum = px.mean(-1); sel = px[(lum > np.percentile(lum, lo)) & (lum < np.percentile(lum, hi))]; return sel.mean(0)
allb = masks[0] | masks[1] | masks[2]; inner = ndi.binary_erosion(allb, iterations=4)
BASE = sample(inner, 55, 95); SHADE = sample(inner, 8, 35); LINE = sample(allb & ~inner, 0, 18)
BRONZE = sample(hub, 40, 80)
print(f'hub {Hc} a={a:.0f} b={b:.0f} blade half-width={BW:.3f} root={R0:.2f} base={BASE.round()} shade={SHADE.round()} line={LINE.round()}')
# ---- blade outline in blade coords (s along, t across) ----
def blade_outline(n=48):
    s = np.linspace(R0, 0.86, n); w = BW * (0.35 + 0.65 * np.clip((s - R0) / (0.62 - R0), 0, 1) ** 0.8)
    tipc = 0.86; tip = [(tipc + BW * 0.95 * np.cos(u), BW * np.sin(u)) for u in np.linspace(-np.pi / 2, np.pi / 2, 24)]
    right = list(zip(s, -w)); left = list(zip(s[::-1], w[::-1]))
    return np.array(right + tip + left)
OUTL = blade_outline()
PITCH = np.radians(12); KV = 0.95 * a        # 3D vertical -> image px (camera ~18 degrees below the plane)
def project(sx, tz, yv):                     # plane coords (x, z) + height y -> image
    q = (M @ np.vstack([sx, tz])).T; return np.c_[Hc[0] + q[:, 0], Hc[1] + q[:, 1] - KV * yv]
SS = 3
def render(theta, side):
    img = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    blades = []
    for j in range(3):
        th = theta + tipang[0] + j * 2 * np.pi / 3
        dv = np.array([np.cos(th), np.sin(th)]); ev = np.array([-dv[1], dv[0]])
        s, t = OUTL[:, 0], OUTL[:, 1]
        pts = project(s * dv[0] + t * ev[0], s * dv[1] + t * ev[1], t * np.tan(PITCH))
        half = OUTL[:, 1] < 0
        tt = np.where(t < 0, t, -0.42 * np.abs(t)) ; sh = project(s * dv[0] + tt * ev[0], s * dv[1] + tt * ev[1], tt * np.tan(PITCH))
        iron = np.array([(0.06, -0.022), (R0 + 0.04, -0.03), (R0 + 0.04, 0.03), (0.06, 0.022)])
        ip = project(iron[:, 0] * dv[0] + iron[:, 1] * ev[0], iron[:, 0] * dv[1] + iron[:, 1] * ev[1], iron[:, 1] * np.tan(PITCH))
        depth = (M @ dv)[1]                   # lower in the image = nearer the camera
        blades.append((depth, pts, sh, ip))
    lw = int(round(3.0 * SS))
    for depth, pts, sh, ip in sorted(blades, key=lambda z: z[0]):
        if (depth >= 0) != (side == 'near'): continue
        P_ = [tuple(p * SS) for p in pts]; S_ = [tuple(p * SS) for p in sh]; I_ = [tuple(p * SS) for p in ip]
        d.polygon(I_, fill=tuple(int(c) for c in BRONZE) + (255,), outline=tuple(int(c) for c in LINE) + (255,), width=lw)
        d.polygon(P_, fill=tuple(int(c) for c in BASE) + (255,))
        d.polygon(S_, fill=tuple(int(c) for c in SHADE) + (255,))
        d.line(P_ + [P_[0]], fill=tuple(int(c) for c in LINE) + (255,), width=lw, joint='curve')
    out = np.asarray(img.resize((W, H), Image.LANCZOS)).astype(np.float32)
    # soft painted gradation like the rest of the café: warm window light from the left, a little darker toward the hub
    xs = np.arange(W)[None, :] / W; r = np.hypot((np.arange(W)[None, :] - Hc[0]) / a, (np.arange(H)[:, None] - Hc[1]) / b)
    light = 1 + 0.10 * (0.5 - xs) + 0.06 * np.clip(r - 0.45, -0.3, 0.4)
    warm = np.stack([light * 1.01, light, light * 0.97], -1)
    out[..., :3] = np.where(out[..., 3:] > 0, np.clip(ndi.gaussian_filter(out[..., :3], (1.2, 1.2, 0)) * 0 + out[..., :3] * warm, 0, 255), out[..., :3])
    return out
# the blades sit at the collar: the motor body is above that plane, the lower cap below it
split = int(Hc[1] + 6)
body = hub.copy(); body[split:] = False; cap = hub.copy(); cap[:split] = False
hubsrc = nofan.copy()                      # Quinn's clean hub (no blade roots on it), matched to the drawn hub's warmer tone
sel = hub & ~ndi.binary_dilation(masks[0] | masks[1] | masks[2], iterations=8) & (drawn.mean(-1) > 60) & (nofan.mean(-1) > 40)
gain = np.clip(np.median(drawn[sel], 0) / np.maximum(np.median(nofan[sel], 0), 1), 1.0, 1.3)   # gain only: keeps the outlines dark
clean = np.clip(nofan * gain, 0, 255)
# the drawn hub (matches the drawn blades), with the bits of blade roots that sat on it replaced by Quinn's clean hub
bladecol = (np.abs(drawn - BASE).max(-1) < 30) | (np.abs(drawn - SHADE).max(-1) < 26)
lab_, n_ = ndi.label(bladecol & hub); keepc = [i + 1 for i, z in enumerate(ndi.sum(bladecol & hub, lab_, range(1, n_ + 1))) if z > 40]
roots = ndi.binary_dilation((masks[0] | masks[1] | masks[2]) | np.isin(lab_, keepc), iterations=5) & hub
print('root px replaced on hub', int(roots.sum()))
rw = ndi.gaussian_filter(roots.astype(np.float32), 1.5)[..., None]
hubsrc = drawn * (1 - rw) + clean * rw
print('hub gain', gain.round(3))
if len(sys.argv) > 8:                       # Quinn's drawn hub with the blades removed (job 010): the proper source
    hg = L(sys.argv[8]); ha = 1 - np.clip((hg[..., 1] - np.maximum(hg[..., 0], hg[..., 2]) - 40) / 120, 0, 1)
    ha = ndi.gaussian_filter(ha, 0.7); hub = (ha > 0.5); hubsrc = hg.copy()
    edge = ndi.binary_dilation(ha < 0.99, iterations=3); cap_g = np.maximum(hg[..., 0], hg[..., 2]) * 1.0
    hubsrc[..., 1] = np.where(edge & (hg[..., 1] > cap_g), cap_g, hg[..., 1])            # no green fringe
    # also erase the old (glossy) hub from the background so none of it can peek out round the new one
    old = ndi.binary_dilation(fanm & ~(masks[0] | masks[1] | masks[2]), iterations=4) & ~ndi.binary_erosion(hub, iterations=2)
    nofan = _fill_from_ring(nofan, old) if '_fill_from_ring' in dir() else nofan
    body = hub.copy(); body[split:] = False; cap = hub.copy(); cap[:split] = False
def rgba(m):
    a_ = ha if len(sys.argv) > 8 else ndi.gaussian_filter(m.astype(np.float32), 0.6)
    return np.dstack([hubsrc, a_ * m.astype(np.float32) * 255 if len(sys.argv) > 8 else a_ * 255])
body_rgba, cap_rgba = rgba(body), rgba(cap)
def over(acc, x): return acc * (1 - x[..., 3:] / 255) + x[..., :3] * (x[..., 3:] / 255)
n = int(round(120 / STEP)); frames = []; sweep = np.zeros((H, W), bool)
for f in range(n):
    far, near = render(np.radians(f * STEP), 'far'), render(np.radians(f * STEP), 'near')
    sweep |= (far[..., 3] > 6) | (near[..., 3] > 6)
    acc = over(over(over(over(nofan, body_rgba), far), near), cap_rgba)   # motor casing (above the blade plane), blades, lower cap (below it)
    frames.append(acc)
sw = ndi.binary_dilation(sweep | fanm, iterations=8)
yy, xx = np.where(sw); bx0, by0, bx1, by1 = xx.min(), yy.min(), xx.max() + 1, yy.max() + 1
m = ndi.gaussian_filter(sw.astype(np.float32), 3)[..., None]; region = plate[Y0:Y1, X0:X1]
nf = plate.copy(); nf[Y0:Y1, X0:X1] = region * (1 - m) + nofan * m
Image.fromarray(np.clip(nf, 0, 255).astype(np.uint8)).save(f'{OUT}/plate_nofan.png')
for f, fr in enumerate(frames):
    full = region * (1 - m) + fr * m
    Image.fromarray(np.clip(full[by0:by1, bx0:bx1], 0, 255).astype(np.uint8)).convert('RGBA').save(f'{OUT}/fan_{f:02d}.png')
json.dump({'x': int(X0 + bx0), 'y': int(Y0 + by0), 'w': int(bx1 - bx0), 'h': int(by1 - by0), 'frames': n, 'deg_per_frame': STEP}, open(f'{OUT}/fan.json', 'w'))
print('frames', n, 'box', X0 + bx0, Y0 + by0, bx1 - bx0, by1 - by0)
