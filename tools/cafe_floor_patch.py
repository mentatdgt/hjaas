"""Paste Quinn's repainted floor (job 011) into the café plate, inside the floor mask only, colour-matched at the seam.
Usage: python3 -I tools/cafe_floor_patch.py <package_dir> <floor_fixed.png> <mask.npy> <x0,y0,x1,y1>"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
P, F, M, B = sys.argv[1:5]; x0, y0, x1, y1 = map(int, B.split(','))
plate = np.asarray(Image.open(f'{P}/plate.png').convert('RGB')).astype(np.float32)
mask = np.load(M)
fx = np.asarray(Image.open(F).convert('RGB').resize((x1 - x0, y1 - y0), Image.LANCZOS)).astype(np.float32)
full = plate.copy(); full[y0:y1, x0:x1] = fx
ring = ndi.binary_dilation(mask, iterations=12) & ~ndi.binary_dilation(mask, iterations=3)
ring[:y0] = False; ring[y1:] = False; ring[:, :x0] = False; ring[:, x1:] = False
diff = (plate - full) * ring[..., None]; sig = 30
num = np.stack([ndi.gaussian_filter(diff[..., c], sig) for c in range(3)], -1); den = ndi.gaussian_filter(ring.astype(np.float32), sig)[..., None]
full = np.clip(full + num / np.maximum(den, 1e-3) * np.clip(den / 0.02, 0, 1), 0, 255)
w = ndi.gaussian_filter(mask.astype(np.float32), 6)[..., None]
out = plate * (1 - w) + full * w
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'{P}/plate.png')
print('patched', int(mask.sum()), 'px')
