"""Ceiling fan for the café: cut the three blades out of the plate and re-render them rotating (procedural, loops exactly).
Usage: python3 -I tools/cafe_fan.py <plate.png 2580x1432> <outdir> [frames=16]"""
import sys, os, json, numpy as np, cv2
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
plate = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32); OUT = sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 16
os.makedirs(OUT, exist_ok=True)
OX, OY, W, H = 640, 0, 760, 240                      # working crop on the 2580 canvas
img = plate[OY:OY + H, OX:OX + W].copy()
Hc = np.array([386.0, 121.0])                        # rotation centre (blade plane)
polys = [[(36, 128), (60, 119), (200, 113), (338, 107), (348, 127), (200, 140), (60, 138)],
         [(414, 98), (520, 52), (640, 6), (676, 8), (690, 30), (668, 56), (560, 90), (440, 114)],
         [(412, 140), (446, 122), (522, 137), (584, 168), (594, 188), (572, 201), (518, 196), (448, 168)]]
tips = np.array([(38, 128), (684, 24), (590, 187)], float)
lab = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
masks = []
for p in polys:
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(p, fill=255); m = np.asarray(m) > 0
    near = ndi.binary_dilation(m, iterations=10)
    core = ndi.binary_erosion(m, iterations=5); ring = near & ~ndi.binary_dilation(m, iterations=4)
    cb, cr = lab[core].mean(0), np.median(lab[ring], 0)
    d_b = ((lab - cb) ** 2 * [0.6, 1.4, 1.4]).sum(-1); d_r = ((lab - cr) ** 2 * [0.6, 1.4, 1.4]).sum(-1)
    dark = lab[..., 0] < 75
    bm = near & ((d_b < d_r) | dark)
    bm = ndi.binary_opening(bm, iterations=1); l2, n = ndi.label(bm)
    if n: sz = ndi.sum(bm, l2, range(1, n + 1)); bm = l2 == (np.argmax(sz) + 1)
    masks.append(ndi.binary_fill_holes(ndi.binary_closing(bm, iterations=2)))
allb = np.zeros((H, W), bool)
for m in masks: allb |= m
hub = Image.new('L', (W, H), 0); ImageDraw.Draw(hub).ellipse([340, 100, 434, 146], fill=255); hub = (np.asarray(hub) > 0)
def directional_fill(im, mask, block):
    """Fill the masked pixels by interpolating ALONG the ceiling beams, so beam edges stay straight."""
    g = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=5), cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=5)
    ok = ~ndi.binary_dilation(mask, iterations=6)
    jxx, jyy, jxy = (gx * gx)[ok].sum(), (gy * gy)[ok].sum(), (gx * gy)[ok].sum()
    th = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + np.pi / 2          # edge direction
    slope = np.tan(th); slope = float(np.clip(slope, -0.4, 0.4))
    h, w = mask.shape; ys, xs = np.where(mask)
    res = []
    for sgn in (1, -1):
        col = np.zeros((len(ys), 3), np.float32); dist = np.full(len(ys), 1e6, np.float32); todo = np.ones(len(ys), bool)
        for k in range(1, 520):
            xx = xs + sgn * k; yy = np.round(ys + sgn * k * slope).astype(int)
            inb = (xx >= 0) & (xx < w) & (yy >= 0) & (yy < h)
            hit = todo & inb; hit[hit] = ~(mask | block)[yy[hit], xx[hit]]
            col[hit] = im[yy[hit], xx[hit]]; dist[hit] = k; todo &= ~hit
            if not todo.any(): break
        res.append((col, dist))
    (c1, d1), (c2, d2) = res; w1, w2 = 1 / d1, 1 / d2
    out = im.copy(); out[ys, xs] = (c1 * w1[:, None] + c2 * w2[:, None]) / (w1 + w2)[:, None]
    sm = cv2.GaussianBlur(out, (0, 0), 1.2); m3 = ndi.gaussian_filter(mask.astype(np.float32), 1.5)[..., None]
    return out * (1 - m3) + sm * m3, slope
bmask = ndi.binary_dilation(allb & ~hub, iterations=5)
block = np.zeros((H, W), bool); block[44:154, 330:444] = True; block[0:60, 370:402] = True
block_all = block.copy()
bg, slope = directional_fill(img, bmask, block & ~bmask); print('beam slope', round(slope, 3))
ys, xs = np.where(bmask & block_all); mx = 2 * 386 - xs      # the housing is symmetric: rebuild its hidden side from the other
okm = (mx >= 0) & ~bmask[ys, np.clip(mx, 0, W - 1)] & (img[ys, np.clip(mx, 0, W - 1)].mean(-1) < 120)
bg[ys[okm], xs[okm]] = img[ys[okm], mx[okm]]
hub_rgb = img.copy()
hm_bl = ndi.binary_dilation(allb, iterations=3) & hub                     # blade roots over the housing:
ys, xs = np.where(hm_bl); mx = np.clip((2 * 386 - xs), 0, W - 1)          # mirror the housing's clean side
good = ~ndi.binary_dilation(allb, iterations=3)[ys, mx]
hub_rgb[ys[good], xs[good]] = img[ys[good], mx[good]]
rest = np.zeros((H, W), bool); rest[ys[~good], xs[~good]] = True
hub_rgb = cv2.inpaint(hub_rgb.astype(np.uint8), rest.astype(np.uint8) * 255, 4, cv2.INPAINT_TELEA).astype(np.float32)
# tip path: an ellipse centred on the hub through the three tips
P = tips - Hc
Mx = np.array([[x * x, x * y, y * y] for x, y in P]); a, b, c = np.linalg.solve(Mx, np.ones(3))
Q = np.array([[a, b / 2], [b / 2, c]]); ev, evec = np.linalg.eigh(Q); assert (ev > 0).all(), ev
M = evec @ np.diag(ev ** -0.5) @ evec.T               # unit circle -> ellipse
t = np.array([np.arctan2(*(np.linalg.inv(M) @ p)[::-1]) for p in P])
order = np.argsort(t); t = np.unwrap(np.concatenate([t[order], [t[order][0] + 2 * np.pi]]))
alpha_k = np.arange(4) * (2 * np.pi / 3)
def tip_at(al):
    al = al % (2 * np.pi); tt = np.interp(al, alpha_k, t); return Hc + M @ np.array([np.cos(tt), np.sin(tt)])
def frame_of(tip, wscale):
    u = tip - Hc; v = np.array([-u[1], u[0]]); v = v / np.linalg.norm(v) * wscale; return u, v
widths = []
for i in order:
    u = tips[i] - Hc; n = np.array([-u[1], u[0]]) / np.linalg.norm(u)
    ys, xs = np.where(masks[i]); widths.append(np.ptp((np.stack([xs, ys], 1) - Hc) @ n) / 2)
widths = np.array(widths + [widths[0]])
sprites = []
for k, i in enumerate(order):
    m = ndi.gaussian_filter(masks[i].astype(np.float32), 0.8)
    sprites.append((np.dstack([img, m * 255]).astype(np.float32), frame_of(tips[i], widths[k])))
def warp(sprite, fr_src, fr_dst):
    (us, vs), (ud, vd) = fr_src, fr_dst
    S = np.stack([us, vs], 1); D = np.stack([ud, vd], 1); Aff = D @ np.linalg.inv(S); tr = Hc - Aff @ Hc
    return cv2.warpAffine(sprite, np.hstack([Aff, tr[:, None]]).astype(np.float32), (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
def blades(phase):
    acc = np.zeros((H, W, 4), np.float32)
    for j in range(3):
        al = (phase + j * 2 * np.pi / 3) % (2 * np.pi)
        k = int(al // (2 * np.pi / 3)) % 3; f = (al - k * 2 * np.pi / 3) / (2 * np.pi / 3)
        dst = frame_of(tip_at(al), np.interp(al, alpha_k, widths))
        a0 = warp(*sprites[k], dst); a1 = warp(*sprites[(k + 1) % 3], dst)
        s = a0 * (1 - f) + a1 * f
        aa = s[..., 3:] / 255; acc[..., :3] = acc[..., :3] * (1 - aa) + s[..., :3] * aa; acc[..., 3] = np.maximum(acc[..., 3], s[..., 3])
    return acc
SUB = 8; step = (2 * np.pi / 3) / N
sweep = np.zeros((H, W), bool); frames = []
for n in range(N):
    rgb = np.zeros((H, W, 3), np.float32); al = np.zeros((H, W), np.float32)
    for s in range(SUB):
        b = blades(n * step + (s / SUB) * step * 0.7); w = b[..., 3] / 255
        rgb += b[..., :3] * w[..., None]; al += w
    a = al / SUB; col = rgb / np.maximum(al, 1e-6)[..., None]
    fr = bg * (1 - a[..., None]) + col * a[..., None]
    hm = ndi.gaussian_filter(hub.astype(np.float32), 1.0)[..., None]; fr = fr * (1 - hm) + hub_rgb * hm
    frames.append(fr); sweep |= a > 0.02
ys, xs = np.where(sweep | allb); x0, y0, x1, y1 = max(xs.min() - 6, 0), max(ys.min() - 6, 0), min(xs.max() + 7, W), min(ys.max() + 7, H)
for n, fr in enumerate(frames):
    Image.fromarray(np.clip(fr[y0:y1, x0:x1], 0, 255).astype(np.uint8)).convert('RGBA').save(f'{OUT}/fan_{n:02d}.png')
nofan = plate.copy(); still = bg.copy(); hm = ndi.gaussian_filter(hub.astype(np.float32), 1.0)[..., None]
nofan[OY:OY + H, OX:OX + W] = still * (1 - hm) + hub_rgb * hm
Image.fromarray(np.clip(nofan, 0, 255).astype(np.uint8)).save(f'{OUT}/plate_nofan.png')
json.dump({'x': int(OX + x0), 'y': int(OY + y0), 'w': int(x1 - x0), 'h': int(y1 - y0), 'frames': N}, open(f'{OUT}/fan.json', 'w'))
S = Image.new('RGB', (W * 2, H * 3))
S.paste(Image.fromarray(img.astype(np.uint8)), (0, 0)); S.paste(Image.fromarray(np.clip(nofan[OY:OY + H, OX:OX + W], 0, 255).astype(np.uint8)), (W, 0))
for i, n in enumerate([0, N // 4, N // 2, 3 * N // 4]): S.paste(Image.fromarray(np.clip(frames[n], 0, 255).astype(np.uint8)), ((i % 2) * W, H + (i // 2) * H))
S.save(f'{OUT}/_check.jpg', quality=90); print('fan box', OX + x0, OY + y0, x1 - x0, y1 - y0, 'ellipse axes', (ev ** -0.5).round(1))
