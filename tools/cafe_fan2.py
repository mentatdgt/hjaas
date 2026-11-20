"""Spin Quinn's hand-drawn fan (no motion blur).
Usage: python3 -I tools/cafe_fan2.py <plate 2580x1432> <fan_drawn.png> <fan_green.png> <ceiling_nofan.png> <box x0,y0,x1,y1> <outdir> [frames_per_third=36]
Writes fan_NN.png (opaque crops), fan.json, plate_nofan.png (the plate with the blades removed inside the sweep)."""
import sys, os, json, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
plate_p, drawn_p, green_p, nofan_p, box_s, OUT = sys.argv[1:7]; N = int(sys.argv[7]) if len(sys.argv) > 7 else 36
X0, Y0, X1, Y1 = map(int, box_s.split(',')); W, H = X1 - X0, Y1 - Y0
os.makedirs(OUT, exist_ok=True)
L = lambda p: np.asarray(Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32)
plate = np.asarray(Image.open(plate_p).convert('RGB')).astype(np.float32)
drawn, green, nofan = L(drawn_p), L(green_p), L(nofan_p)
g = green; al = 1 - np.clip((g[..., 1] - np.maximum(g[..., 0], g[..., 2]) - 40) / 120, 0, 1)
fanm = al > 0.5
# hub + downrod = the part of the fan that stays; find it as the dark-bronze body around the top of the downrod
ys, xs = np.where(fanm)
top = fanm[:6]; rod_x = int(round(np.where(top.any(0))[0].mean()))            # the downrod is the only thing at the very top
rod_half = max(int(top.any(0).sum() / 2) + 3, 8)
colrows = np.where(fanm[:, rod_x])[0]; hub_bottom = int(colrows.max())
lefts = [np.where(fanm[y, :rod_x])[0] for y in range(H)]
left_edge = np.array([rod_x - l[np.where(np.diff(np.r_[l, rod_x]) > 1)[0][-1] + 1] if len(l) and (np.diff(np.r_[l, rod_x]) > 1).any() else (rod_x - l.min() if len(l) else 0) for l in lefts])
body = np.where((left_edge > rod_half + 10) & (left_edge < 0.12 * W))[0]                  # rows where the hub is wider than the rod
hub_top = int(body.min()); hw = int(np.median(left_edge[body])) + 4
from PIL import ImageDraw
hubmask = Image.new('L', (W, H), 0); d = ImageDraw.Draw(hubmask)
d.ellipse([rod_x - hw, hub_top - 4, rod_x + hw, hub_bottom + 3], fill=255)
d.rectangle([rod_x - rod_half, 0, rod_x + rod_half, hub_top + 6], fill=255)
hub = (np.asarray(hubmask) > 0) & fanm
hh = (hub_bottom - hub_top) / 2
blades = fanm & ~hub
Hc0 = np.array([rod_x, (hub_top + hub_bottom) / 2], float)
Y_, X_ = np.mgrid[0:H, 0:W]
near_hub = ((X_ - rod_x) / (hw * 1.25)) ** 2 + ((Y_ - Hc0[1]) / ((hub_bottom - hub_top) / 2 * 1.25)) ** 2 < 1
blades = blades & ~near_hub
yy, xx = np.where(blades); ang = np.arctan2(yy - Hc0[1], (xx - Hc0[0]) / 4.0)   # flatten the perspective before splitting
from sklearn.cluster import KMeans
km = KMeans(3, n_init=10, random_state=0).fit(np.c_[np.cos(ang), np.sin(ang)])
bm = []
for k in range(3):
    m = np.zeros_like(blades); m[yy[km.labels_ == k], xx[km.labels_ == k]] = True
    m = ndi.binary_opening(m, iterations=1); l2, n2 = ndi.label(m)
    if n2: z = ndi.sum(m, l2, range(1, n2 + 1)); m = l2 == (np.argmax(z) + 1)
    bm.append(m)
sz = [int(m.sum()) for m in bm]
Hc = np.array([rod_x, (hub_top + hub_bottom) / 2 + 0.25 * hh], float)
print('rod_x', rod_x, 'hub', hub_top, hub_bottom, 'hw', hw, 'blade sizes', sorted(sz)[::-1][:4])
tips = []
for m in bm:
    yy, xx = np.where(m); d = (xx - Hc[0]) ** 2 + (yy - Hc[1]) ** 2; i = d.argmax(); tips.append((xx[i], yy[i]))
tips = np.array(tips, float); P = tips - Hc
Mx = np.array([[x * x, x * y, y * y] for x, y in P]); a, b, c = np.linalg.solve(Mx, np.ones(3))
Q = np.array([[a, b / 2], [b / 2, c]]); ev, evec = np.linalg.eigh(Q); assert (ev > 0).all(), ev
M = evec @ np.diag(ev ** -0.5) @ evec.T; Mi = np.linalg.inv(M)
t = np.array([np.arctan2(*(Mi @ p)[::-1]) for p in P]); order = np.argsort(t)
tt = np.unwrap(np.concatenate([t[order], [t[order][0] + 2 * np.pi]])); ak = np.arange(4) * 2 * np.pi / 3
def tip_at(alp): return Hc + M @ np.array([np.cos(np.interp(alp % (2 * np.pi), ak, tt)), np.sin(np.interp(alp % (2 * np.pi), ak, tt))])
wid = []
for i in order:
    u = tips[i] - Hc; nrm = np.array([-u[1], u[0]]) / np.linalg.norm(u); yy, xx = np.where(bm[i]); wid.append(np.ptp((np.stack([xx, yy], 1) - Hc) @ nrm) / 2)
wid = np.array(wid + [wid[0]])
def frame(tip, w):
    u = tip - Hc; v = np.array([-u[1], u[0]]); return u, v / np.linalg.norm(v) * w
spr = []
for k, i in enumerate(order):
    m = ndi.gaussian_filter(bm[i].astype(np.float32), 0.7)
    spr.append((np.dstack([drawn, m * 255]), frame(tips[i], wid[k])))
def warp(s, fs, fd):
    S_ = np.stack(fs, 1); D = np.stack(fd, 1); A = D @ np.linalg.inv(S_); tr = Hc - A @ Hc
    return cv2.warpAffine(s, np.hstack([A, tr[:, None]]).astype(np.float32), (W, H), flags=cv2.INTER_CUBIC, borderValue=0)
bg = nofan.copy()
BRONZE = np.median(drawn[hub & (drawn.mean(-1) > 90) & (drawn.mean(-1) < 170)], 0)
hub_rgba = np.dstack([drawn, ndi.gaussian_filter(hub.astype(np.float32), 0.7) * 255])
step = (2 * np.pi / 3) / N; frames = []; sweep = np.zeros((H, W), bool)
for f in range(N):
    acc = bg.copy()
    for j in range(3):
        alp = f * step + j * 2 * np.pi / 3; k = int((alp % (2 * np.pi)) // (2 * np.pi / 3)) % 3; fr = ((alp % (2 * np.pi)) - k * 2 * np.pi / 3) / (2 * np.pi / 3)
        dst = frame(tip_at(alp), np.interp(alp % (2 * np.pi), ak, wid))
        w0 = warp(*spr[k], dst); w1 = warp(*spr[(k + 1) % 3], dst)
        # take whichever source blade is nearer in angle: no dissolve between two drawings
        s = w0 if fr < 0.5 else w1
        a_ = s[..., 3:] / 255; acc = acc * (1 - a_) + s[..., :3] * a_; sweep |= s[..., 3] > 8
    # blade irons: short bronze arms from the hub to each blade root, drawn like the hub (outline + fill)
    big = 4; arm = np.zeros((H * big, W * big, 4), np.float32)
    for j in range(3):
        alp = f * step + j * 2 * np.pi / 3; tip = tip_at(alp); u = tip - Hc
        def ell(tq):
            p = Hc + tq * u; return ((p[0] - rod_x) / (hw * 1.25)) ** 2 + ((p[1] - Hc0[1]) / ((hub_bottom - hub_top) / 2 * 1.25)) ** 2
        tc = next(tq for tq in np.linspace(0, 1, 400) if ell(tq) >= 1)
        p0 = (Hc + 0.35 * tc * u) * big; p1 = (Hc + min(tc * 1.35, tc + 0.06) * u) * big
        thick = max(int(big * 0.18 * hw), big * 3)
        cv2.line(arm, tuple(int(v) for v in p0), tuple(int(v) for v in p1), (52, 34, 24, 255), thick + big * 3, cv2.LINE_AA)
        cv2.line(arm, tuple(int(v) for v in p0), tuple(int(v) for v in p1), tuple(float(v) for v in BRONZE) + (255,), thick, cv2.LINE_AA)
    arm = cv2.resize(arm, (W, H), interpolation=cv2.INTER_AREA)
    a_ = arm[..., 3:] / 255; acc = acc * (1 - a_) + arm[..., :3] * a_; sweep |= arm[..., 3] > 8
    a_ = hub_rgba[..., 3:] / 255; acc = acc * (1 - a_) + hub_rgba[..., :3] * a_
    frames.append(acc)
sweep |= fanm
sw = ndi.binary_dilation(sweep, iterations=8)
yy, xx = np.where(sw); bx0, by0, bx1, by1 = xx.min(), yy.min(), xx.max() + 1, yy.max() + 1
# plate: Quinn's empty ceiling only inside the sweep, feathered into the original
m = ndi.gaussian_filter(sw.astype(np.float32), 3)[..., None]
region = plate[Y0:Y1, X0:X1]
nofan_plate = plate.copy(); nofan_plate[Y0:Y1, X0:X1] = region * (1 - m) + bg * m
Image.fromarray(np.clip(nofan_plate, 0, 255).astype(np.uint8)).save(f'{OUT}/plate_nofan.png')
for f, fr in enumerate(frames):
    full = region * (1 - m) + fr * m
    Image.fromarray(np.clip(full[by0:by1, bx0:bx1], 0, 255).astype(np.uint8)).convert('RGBA').save(f'{OUT}/fan_{f:02d}.png')
json.dump({'x': int(X0 + bx0), 'y': int(Y0 + by0), 'w': int(bx1 - bx0), 'h': int(by1 - by0), 'frames': N}, open(f'{OUT}/fan.json', 'w'))
print('fan', X0 + bx0, Y0 + by0, bx1 - bx0, by1 - by0, 'hub centre', Hc, 'axes', (ev ** -0.5).round(1))
