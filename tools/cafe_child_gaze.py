"""Child looks down at his drawing, mouth closed: a tiny deterministic face edit on 018_C_1 (no redraw).
Usage: python3 -I tools/cafe_child_gaze.py <in C_1.png> <out.png>"""
import sys, numpy as np, cv2
from PIL import Image, ImageDraw
src = Image.open(sys.argv[1]).convert('RGB'); a = np.asarray(src).copy()
X0, Y0, X1, Y1 = 396, 720, 476, 800; S = 8
crop = a[Y0:Y1, X0:X1].copy()
fg = (crop[..., 1].astype(int) - np.maximum(crop[..., 0], crop[..., 2])) < 60
# 1) mouth: remove the open smile by inpainting skin over it
r, g, b = [crop[..., i].astype(int) for i in range(3)]
box = np.zeros(crop.shape[:2], bool); box[772 - Y0:800 - Y0, 421 - X0:455 - X0] = True
mouth = box & (((r > 150) & (g < 125)) | ((r < 95) & (g < 75)) | ((r > 215) & (g > 205) & (b > 190)))
mouth = cv2.dilate(mouth.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
mouth &= fg
crop = cv2.inpaint(crop, mouth.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
# 2) eyes and new mouth, drawn supersampled
big = Image.fromarray(crop).resize(((X1 - X0) * S, (Y1 - Y0) * S), Image.BICUBIC)
d = ImageDraw.Draw(big)
P = lambda x, y: ((x - X0) * S, (y - Y0) * S)
WHITE = (238, 233, 218); SKIN = tuple(int(v) for v in a[728:734, 420:428].reshape(-1, 3).mean(0)); LINE = (52, 30, 22)
def eye(cx, cy, rx, ry, pupil_dx):
    m = Image.new('L', big.size, 0); md = ImageDraw.Draw(m)
    md.ellipse([*P(cx - rx, cy - ry), *P(cx + rx, cy + ry)], fill=255)
    layer = Image.new('RGB', big.size, SKIN); ld = ImageDraw.Draw(layer)
    # the open part of the eye: a lower ellipse, so the lid's edge is a soft curve
    ox0, oy0, ox1, oy1 = cx - rx * 1.35, cy - ry * 0.34, cx + rx * 1.35, cy + ry * 1.9
    ld.ellipse([*P(ox0, oy0), *P(ox1, oy1)], fill=WHITE, outline=LINE, width=int(1.5 * S))
    pr = rx * 0.5
    ld.ellipse([*P(cx + pupil_dx - pr, cy + ry * 0.2), *P(cx + pupil_dx + pr, cy + ry * 0.2 + pr * 2.4)], fill=(30, 22, 20))
    big.paste(layer, (0, 0), m)
eye(424.3, 755.0, 11.6, 16.2, -1.2)
eye(450.4, 747.6, 6.6, 13.4, -0.8)
# small closed, content mouth
d.arc([*P(427, 771), *P(446, 786)], start=20, end=150, fill=(96, 44, 30), width=int(1.7 * S))
small = np.asarray(big.resize((X1 - X0, Y1 - Y0), Image.LANCZOS))
out = a.copy(); region = out[Y0:Y1, X0:X1]; region[fg] = small[fg]
Image.fromarray(out).save(sys.argv[2])
