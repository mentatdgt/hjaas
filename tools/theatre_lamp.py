"""Scene 5 (theatre): the caged work lamp swings as one rigid piece on its rope (a pendulum), no blur, no warping.
Cuts rope+lamp out of a plate, fills the plate behind them, and renders N rotated frames (RGBA, Quinn space 1536x1024).
Usage: python3 -I tools/theatre_lamp.py <plate.png> <out_dir> [more plates to clean...]
Writes <out_dir>/plate_nolamp.png (and <name>_nolamp.png for extra plates), <out_dir>/lamp/L_00..png, lamp_mask.png."""
import sys, os, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

PIVOT = (1258.0, -60.0)       # the rope continues above the picture; it hangs from a point above the top edge
AMP_DEG = 2.2                 # half-swing
N = 36                        # frames per swing cycle (played at ~100 ms -> 3.6 s, like a 3 m pendulum)

def lamp_mask(rgb):
    h, w = rgb.shape[:2]; m = np.zeros((h, w), bool)
    yy, xx = np.mgrid[0:h, 0:w]
    # rope: a narrow band along its line from (1256, 0) to (1260, 128)
    xc = 1256 + (yy / 128.0) * 4
    m |= (np.abs(xx - xc) <= 5) & (yy <= 128)
    # lamp body: everything not pale canvas inside its outline box
    box = (xx >= 1230) & (xx <= 1300) & (yy >= 118) & (yy <= 210)
    v = rgb.max(-1)
    body = box & (v < 175)                      # the metal cap and cage outlines (the glow on the canvas is lighter)
    body = ndi.binary_closing(body, iterations=4); body = ndi.binary_fill_holes(body)
    lab, n = ndi.label(body)
    if n: sz = ndi.sum(body, lab, range(1, n + 1)); body = lab == (int(np.argmax(sz)) + 1)
    m |= body
    return ndi.binary_dilation(m, iterations=1)

def clean(rgb, m):
    return cv2.inpaint(rgb.astype(np.uint8), ndi.binary_dilation(m, iterations=2).astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)

if __name__ == '__main__':
    plate_p, out = sys.argv[1:3]; extra = sys.argv[3:]
    os.makedirs(f'{out}/lamp', exist_ok=True)
    rgb = np.asarray(Image.open(plate_p).convert('RGB'))
    m = lamp_mask(rgb.astype(np.float32))
    Image.fromarray((m * 255).astype(np.uint8)).save(f'{out}/lamp_mask.png')
    Image.fromarray(clean(rgb, m)).save(f'{out}/plate_nolamp.png')
    for p in extra:
        e = np.asarray(Image.open(p).convert('RGB'))
        Image.fromarray(clean(e, m)).save(f'{out}/{os.path.splitext(os.path.basename(p))[0]}_nolamp.png')
    al = ndi.gaussian_filter(m.astype(np.float32), 0.5) * 255
    sprite = np.dstack([rgb, al]).astype(np.uint8)
    for i in range(N):
        ang = AMP_DEG * np.sin(2 * np.pi * i / N)
        M = cv2.getRotationMatrix2D(PIVOT, ang, 1.0)
        fr = cv2.warpAffine(sprite, M, (rgb.shape[1], rgb.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        Image.fromarray(fr).save(f'{out}/lamp/L_{i:02d}.png')
    print('lamp px', int(m.sum()), 'frames', N)
