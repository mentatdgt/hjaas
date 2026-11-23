"""Scene 5 (theatre): the backdrop runs on behind the curtain (2026-11-23).
In the locked scene there was a dark slot between the backdrop's right edge and the red curtain. Anyone walking behind
the backdrop would be seen whole in that slot, so the stagehand's boots can't come out of it on their own (user, 2026-11-23:
"when they reach the end there is no person"). Quinn painted the backdrop into the slot (job 022i), for the bare and the
finished backdrop. This takes ONLY the slot (approved/quinn/ext/slot_mask.png) from Quinn's two images, colour-matched to
the ring of pixels around it, and puts it into the approved plates. Everything outside the slot stays pixel-identical.
Usage: python3 -I tools/theatre_extend_backdrop.py <quinn_dir> <out_dir>
  reads  <quinn_dir>/plate.png, plate_finished.png, ext/plate_ext.png, ext/plate_finished_ext.png, ext/slot_mask.png
  writes <out_dir>/  a copy of <quinn_dir> (links) with plate.png and plate_finished.png replaced"""
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi

def put_slot(orig, quinn, mask):
    a = np.asarray(orig.convert('RGB')).astype(np.float32); q = np.asarray(quinn.convert('RGB').resize(orig.size, Image.LANCZOS)).astype(np.float32)
    ring = ndi.binary_dilation(mask, iterations=6) & ~ndi.binary_dilation(mask, iterations=1)
    # colour-match Quinn's paint to the untouched pixels around the slot (gain + offset per channel)
    for c in range(3):
        qa, oa = q[..., c][ring], a[..., c][ring]
        g = np.clip(oa.std() / max(qa.std(), 1e-3), 0.85, 1.15); o = oa.mean() - g * qa.mean()
        q[..., c] = q[..., c] * g + o
    w = ndi.gaussian_filter(mask.astype(np.float32), 0.8); w = np.where(mask, np.maximum(w, 0.5), w)   # 1-2 px soft join
    w = np.where(ndi.binary_erosion(mask, iterations=2), 1.0, w)
    out = a * (1 - w[..., None]) + q * w[..., None]
    # heal the old edge: a faint vertical line survives where the backdrop used to end. Blur ACROSS it, row by row
    # (horizontal-only), in a 13 px band: that removes a vertical line but keeps the pencil lines and hills (horizontal) intact.
    for y in np.where(mask.any(1))[0]:
        x0 = int(np.where(mask[y])[0][0]); lo, hi = max(x0 - 9, 0), x0 + 10
        seg = ndi.gaussian_filter1d(out[y, lo - 8:hi + 8], 2.5, axis=0)[8:-8]
        t = np.clip(1 - np.abs(np.arange(lo, hi) - (x0 + 0.5)) / 7.0, 0, 1)[:, None]     # strongest on the line, fading out
        out[y, lo:hi] = out[y, lo:hi] * (1 - t) + seg * t
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

if __name__ == '__main__':
    q, o = sys.argv[1:3]; os.makedirs(o, exist_ok=True)
    for f in os.listdir(q):                                     # everything else: unchanged (linked)
        src, dst = os.path.abspath(f'{q}/{f}'), f'{o}/{f}'
        if f not in ('plate.png', 'plate_finished.png', 'ext') and not os.path.exists(dst): os.symlink(src, dst)
    mask = np.asarray(Image.open(f'{q}/ext/slot_mask.png').convert('L')) > 127
    put_slot(Image.open(f'{q}/plate.png'), Image.open(f'{q}/ext/plate_ext.png'), mask).save(f'{o}/plate.png')
    put_slot(Image.open(f'{q}/plate_finished.png'), Image.open(f'{q}/ext/plate_finished_ext.png'), mask).save(f'{o}/plate_finished.png')
    print('backdrop extended behind the curtain:', int(mask.sum()), 'px from Quinn job 022i; the rest unchanged')
