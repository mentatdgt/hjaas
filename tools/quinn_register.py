"""Bring a Quinn crop result back onto the 2580x1432 canvas, aligned to the original.
place(result_png, box, ref_rgba_full) -> RGBA float array (1432,2580,4)
Alignment: scale back to the box, then search a small shift (+-12 px) that best matches the original's alpha."""
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
def soft_key(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = 1 - np.clip((g - np.maximum(r, b) - 40) / 120, 0, 1)
    return ndi.gaussian_filter(al, 0.7)
def despill(rgb, al):
    edge = ndi.binary_dilation(al < 0.99, iterations=3); r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    cap = np.maximum(r, b) * 1.05 + 10; rgb = rgb.copy(); rgb[..., 1] = np.where(edge & (g > cap), cap, g); return rgb
def place(path, box, ref_alpha_full):
    x0, y0, x1, y1 = box
    im = Image.open(path).convert('RGB').resize((x1 - x0, y1 - y0), Image.LANCZOS)
    rgb = np.asarray(im).astype(np.float32); al = soft_key(rgb); rgb = despill(rgb, al)
    ref = ref_alpha_full[y0:y1, x0:x1]
    best = (1e9, 0, 0)
    for dy in range(-12, 13):
        for dx in range(-12, 13):
            s = np.roll(np.roll(al, dy, 0), dx, 1)
            e = np.abs(s - ref)[16:-16, 16:-16].mean()
            if e < best[0]: best = (e, dx, dy)
    _, dx, dy = best
    rgb = np.roll(np.roll(rgb, dy, 0), dx, 1); al = np.roll(np.roll(al, dy, 0), dx, 1)
    # np.roll wraps: clear the strips that wrapped round from the opposite edge
    if dy > 0: al[:dy] = 0
    if dy < 0: al[dy:] = 0
    if dx > 0: al[:, :dx] = 0
    if dx < 0: al[:, dx:] = 0
    full = np.zeros((1432, 2580, 4), np.float32); full[y0:y1, x0:x1, :3] = rgb; full[y0:y1, x0:x1, 3] = al * 255
    return full, (dx, dy, round(float(best[0]), 4))
