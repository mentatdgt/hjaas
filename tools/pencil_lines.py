"""Make a scene's pencil line map for the edge (reviews/scene-edge-pencil.md).

Usage: python3 tools/pencil_lines.py <plate.png> <out.png>
Output: 8-bit greyscale, same size as the plate. 0 = no line, 255 = full pencil line.
Pencil grain is baked in. The edge's break-up is applied at runtime.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def value_noise(h, w, cell, seed):
    rng = np.random.default_rng(seed)
    gw, gh = int(w / cell) + 2, int(h / cell) + 2
    L = rng.random((gh + 1, gw + 1))
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    fx, fy = xs / cell, ys / cell
    ix, iy = fx.astype(int), fy.astype(int)
    tx, ty = fx - ix, fy - iy
    sx, sy = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b, c, d = L[iy, ix], L[iy, ix + 1], L[iy + 1, ix], L[iy + 1, ix + 1]
    top, bot = a + (b - a) * sx, c + (d - c) * sx
    return top + (bot - top) * sy

def lines(plate):
    g = np.asarray(plate.convert('L'), float)
    blur = ndi.gaussian_filter(g, 2.2)
    dog = np.clip((blur - g - 6) / 16, 0, 1)        # thin strokes darker than their surroundings
    dark = np.clip((95 - g) / 55, 0, 1)             # thick dark outlines
    l = np.maximum(dog, 0.8 * dark)
    m = l > 0.35                                    # drop texture specks: keep connected strokes only
    lab, n = ndi.label(m)
    sizes = ndi.sum(m, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= 60
    l = l * ndi.binary_dilation(keep[lab], iterations=1)
    l = ndi.gaussian_filter(l, 0.7)
    h, w = g.shape
    grain = 0.7 + 0.3 * value_noise(h, w, 1.6, 7)   # graphite tooth
    return np.clip(l * grain * 1.15, 0, 1)

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    Image.fromarray((lines(Image.open(src)) * 255).astype(np.uint8), 'L').save(out, optimize=True)
