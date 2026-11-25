#!/usr/bin/env python3
"""The lab's humidifier mist as a room loop (task 024), packaged like the Merlion's water (task 020).

Quinn's four mist frames (round 10, mister_M1..M4) are edits of mister_MASTER.png: the lab room's crop at
box (1140, 260, 1440, 710), scaled 3.413x to 1024x1536. Only the mist changed. This script:

  1. scales each frame (and the master) back to the box, 300x450, in float;
  2. finds the mist (every pixel any frame changed), and the smallest rectangle that holds it in all four
     frames, plus MARGIN px;
  3. makes each frame a patch of the room for that rectangle: the room's own pixels plus what the frame
     changed (frame - master, both at box size), so outside the mist the patch IS the room; its alpha is
     solid, feathered to clear over the outer FEATHER px (which lie on room pixels: no seam can show);
  4. checks the seam (patch over room vs room, outside the mist), the loop's flicker (how much mist each
     frame has) and how the new mist compares with the painted one it replaces;
  5. writes frames/024-lab-mister/site/ (frames.json, routine.json, mister/M1..M4.png), a contact sheet
     at 2x and an 8 s preview video of the loop over the room.

Usage (from the repo root):
  python3 tools/lab_mister.py --quinn /mnt/user-data/outputs/round10/quinn \
      --master /mnt/user-data/outputs/round10/masters/mister_MASTER.png \
      [--room room.webp] [--video out.mp4] [--sheet out.png] [--report out.json]
--room defaults to the live site's lab room, read from origin/site/review-fixes.
"""
import argparse
import io
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

BOX = (1140, 260, 1440, 710)  # on the 1672x941 room
BW, BH = BOX[2] - BOX[0], BOX[3] - BOX[1]
MARGIN = 12
FEATHER = 10
MS = 140
ROOM_REF = 'origin/site/review-fixes:site/public/assets/scene2/room.webp'
OUT = Path('frames/024-lab-mister/site')
NAMES = ['M1', 'M2', 'M3', 'M4']


def rgb(path_or_img):
    img = path_or_img if isinstance(path_or_img, Image.Image) else Image.open(path_or_img)
    return np.asarray(img.convert('RGB')).astype(np.float32)


def shrink(a, size):
    """Lanczos resize of a float RGB array, per channel in float (no rounding)."""
    return np.stack([np.asarray(Image.fromarray(a[..., c], 'F').resize(size, Image.LANCZOS)) for c in range(3)], -1)


def luma(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quinn', required=True, help='folder with mister_M1.png .. mister_M4.png')
    ap.add_argument('--master', required=True)
    ap.add_argument('--room', help='the room (1672x941); default: the live site room.webp from git')
    ap.add_argument('--video')
    ap.add_argument('--sheet')
    ap.add_argument('--report')
    args = ap.parse_args()

    if args.room:
        room_img = Image.open(args.room)
    else:
        room_img = Image.open(io.BytesIO(subprocess.check_output(['git', 'show', ROOM_REF])))
    room = rgb(room_img)
    assert room.shape[:2] == (941, 1672), room.shape
    master_full = rgb(args.master)
    frames_full = [rgb(Path(args.quinn) / f'mister_{n}.png') for n in NAMES]
    report = {}

    # The master must be this room's crop, scaled up.
    crop = room[BOX[1]:BOX[3], BOX[0]:BOX[2]]
    up = rgb(Image.fromarray(crop.astype(np.uint8)).resize(master_full.shape[1::-1], Image.LANCZOS))
    report['master_vs_room_crop_upscaled_mean_abs'] = round(float(np.abs(up - master_full).mean()), 3)

    # 1. Back to the box.
    master = shrink(master_full, (BW, BH))
    frames = [shrink(f, (BW, BH)) for f in frames_full]
    changed_full = np.zeros(master_full.shape[:2], bool)
    for f in frames_full:
        changed_full |= np.abs(f - master_full).max(2) > 0
    ys, xs = np.nonzero(changed_full)
    report['changed_full_res_bbox_x0y0x1y1'] = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    # The mist at box size: a box px holding any changed px, and the reach of the resize kernel (3 px).
    sx, sy = BW / master_full.shape[1], BH / master_full.shape[0]
    mist = np.asarray(Image.fromarray(changed_full.astype(np.uint8) * 255).resize((BW, BH), Image.BOX)) > 0
    deltas = [f - master for f in frames]
    moved = np.zeros((BH, BW), bool)
    for d in deltas:
        moved |= np.abs(d).max(2) > 0.5
    mist |= moved
    mist_area = cv2.dilate(mist.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0  # + 3 px

    ys, xs = np.nonzero(mist)
    x0, y0, x1, y1 = xs.min() - MARGIN, ys.min() - MARGIN, xs.max() + 1 + MARGIN, ys.max() + 1 + MARGIN
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(BW, x1), min(BH, y1)
    rx, ry, rw, rh = BOX[0] + x0, BOX[1] + y0, x1 - x0, y1 - y0
    report['mist_bbox_in_room'] = [int(BOX[0] + xs.min()), int(BOX[1] + ys.min()), int(BOX[0] + xs.max() + 1), int(BOX[1] + ys.max() + 1)]
    report['patch_rect_in_room'] = {'x': int(rx), 'y': int(ry), 'w': int(rw), 'h': int(rh)}

    # 2. The patches: the room, plus what each frame changed; alpha solid, feathered at the rim.
    room_rect = room[ry:ry + rh, rx:rx + rw]
    yy, xx = np.mgrid[0:rh, 0:rw]
    edge_d = np.minimum.reduce([xx, yy, rw - 1 - xx, rh - 1 - yy]).astype(np.float32)
    t = np.clip((edge_d + 0.5) / FEATHER, 0, 1)
    alpha = (t * t * (3 - 2 * t))  # smoothstep
    alpha8 = np.round(alpha * 255).astype(np.uint8)
    patches = []
    for d in deltas:
        p = np.clip(np.round(room_rect + d[y0:y1, x0:x1]), 0, 255).astype(np.uint8)
        patches.append(p)
    (OUT / 'mister').mkdir(parents=True, exist_ok=True)
    for n, p in zip(NAMES, patches):
        Image.fromarray(np.dstack([p, alpha8]), 'RGBA').save(OUT / 'mister' / f'{n}.png', optimize=True)

    # 3a. Seam: each patch drawn over the room, against the room, outside the mist.
    a = alpha8.astype(np.float32)[..., None] / 255
    out_mask = ~mist_area[y0:y1, x0:x1]
    seam = {}
    comps = []
    for n, p in zip(NAMES, patches):
        comp = p.astype(np.float32) * a + room_rect * (1 - a)
        comps.append(comp)
        diff = np.abs(comp - room_rect).max(2)
        rim = edge_d < FEATHER
        seam[n] = {'max_outside_mist': round(float(diff[out_mask].max()), 3), 'mean_outside_mist': round(float(diff[out_mask].mean()), 4),
                   'max_on_feather_rim': round(float(diff[rim].max()), 3)}
    report['seam'] = seam

    # 3b. Flicker and lightness. The clean wall is not known, so a wall is made by inpainting the room over
    # the mist; each frame's mist is its brightening over that wall, summed (the same wall for all, so its
    # errors cancel between frames). Opacity: how far each px goes from the wall towards white.
    mm = mist_area[y0:y1, x0:x1]
    wall = cv2.inpaint(np.clip(room_rect, 0, 255).astype(np.uint8), (mm * 255).astype(np.uint8), 9, cv2.INPAINT_TELEA).astype(np.float32)
    lw = luma(wall)

    def measure(img):
        li = luma(img)
        lift = (li - lw)[mm]
        op = np.clip((li - lw) / np.maximum(1, 255 - lw), 0, 1)[mm]
        return {'mean_luma': round(float(li[mm].mean()), 2), 'mist_lift_sum': round(float(lift.sum()), 0),
                'mean_lift_levels': round(float(lift.mean()), 2), 'opacity_sum_px': round(float(op.sum()), 1),
                'p99_luma': round(float(np.percentile(li[mm], 99)), 1)}

    painted = measure(room_rect)
    per = {n: measure(c) for n, c in zip(NAMES, comps)}
    lifts = np.array([per[n]['mist_lift_sum'] for n in NAMES])
    report['painted_mist'] = painted
    report['frames'] = per
    report['flicker'] = {
        'lift_max_over_min_minus_1_pct': round(float(lifts.max() / lifts.min() - 1) * 100, 1),
        'lift_frame_to_frame_pct': [round(float(abs(lifts[(i + 1) % 4] - lifts[i]) / lifts.mean() * 100), 1) for i in range(4)],
        'mean_luma_frame_to_frame_levels': [round(per[NAMES[(i + 1) % 4]]['mean_luma'] - per[NAMES[i]]['mean_luma'], 2) for i in range(4)],
    }
    report['vs_painted'] = {
        'lift_ratio_mean_frames_over_painted': round(float(lifts.mean() / painted['mist_lift_sum']), 3),
        'opacity_ratio': round(float(np.mean([per[n]['opacity_sum_px'] for n in NAMES]) / painted['opacity_sum_px']), 3),
        'mean_luma_diff_levels': round(float(np.mean([per[n]['mean_luma'] for n in NAMES]) - painted['mean_luma']), 2),
        'p99_luma_diff_levels': round(float(np.mean([per[n]['p99_luma'] for n in NAMES]) - painted['p99_luma']), 1),
    }
    # The painted mist outside the patch: how much brighter than the wall's own texture the ring just outside
    # the rectangle is (in levels of luma over the inpainted wall, compared with the rest of the box's wall).
    ring = np.zeros((BH, BW), bool)
    ring[max(0, y0 - 10):y1 + 10, max(0, x0 - 10):x1 + 10] = True
    ring[y0:y1, x0:x1] = False
    report['ring_outside_rect_mean_luma'] = round(float(luma(room[BOX[1]:BOX[3], BOX[0]:BOX[2]])[ring].mean()), 2)

    # 4. The package.
    frames_json = {
        'canvas': {'w': 1672, 'h': 941, 'note': 'Scene 2 (Grow, the mushroom lab) canvas 1672x941 = plate space (the 1x set; there is no larger master, so do not upscale for phones). The plate is the lab room as the site already ships it (site/public/assets/scene2/room.webp, from scene/mushroom-lab.png); this package has no plate of its own. Draw the layer over the plate, under Rachel. Each patch is the room itself for its rectangle except where the mist is, with a solid alpha feathered to clear over its outer 10 px, so it meets the room with no seam.'},
        'layers': [{'actor': 'mister', 'x': int(rx), 'y': int(ry), 'w': int(rw), 'h': int(rh), 'stills': NAMES, 'scenery': True}],
        'stills': {n: f'mister/{n}.png' for n in NAMES},
        'clips': {},
    }
    routine_json = {
        'note': 'Scene 2 (Grow) room loops. Holds in ms. Every change is an instant cut (no fade_ms). Within the layer every still is the room itself outside the mist, so cuts never flicker.',
        'actors': {'mister': {
            'routine': [{'loop': 'mist', 'repeat': [1000, 1000], 'steps': [{'still': n, 'ms': MS} for n in NAMES]}],
            'note': "The humidifier's mist rising: a hand-drawn loop (Quinn, round 10), forever. Part of the scenery: let the edge treat it like the plate.",
        }},
    }
    (OUT / 'frames.json').write_text(json.dumps(frames_json, indent=1) + '\n')
    (OUT / 'routine.json').write_text(json.dumps(routine_json, indent=1) + '\n')

    # 5. Contact sheet at 2x: each frame in place (the patch over the room, with 40 px of room around it).
    pad = 40
    cx0, cy0, cx1, cy1 = max(0, rx - pad), max(0, ry - pad), min(1672, rx + rw + pad), min(941, ry + rh + pad)
    rooms_with = []
    for p in patches:
        r = room.copy()
        r[ry:ry + rh, rx:rx + rw] = p.astype(np.float32) * a + r[ry:ry + rh, rx:rx + rw] * (1 - a)
        rooms_with.append(np.clip(np.round(r), 0, 255).astype(np.uint8))
    if args.sheet:
        tiles = [Image.fromarray(np.clip(room[cy0:cy1, cx0:cx1], 0, 255).astype(np.uint8))] + [Image.fromarray(r[cy0:cy1, cx0:cx1]) for r in rooms_with]
        tiles = [t.resize((t.width * 2, t.height * 2), Image.LANCZOS) for t in tiles]
        gap = 8
        sheet = Image.new('RGB', (sum(t.width for t in tiles) + gap * (len(tiles) - 1), tiles[0].height + 30), (40, 40, 40))
        from PIL import ImageDraw
        dr = ImageDraw.Draw(sheet)
        x = 0
        for label, t in zip(['room (painted mist)'] + NAMES, tiles):
            sheet.paste(t, (x, 30))
            dr.text((x + 6, 8), label, fill=(255, 255, 255))
            # the patch rectangle, dotted
            px0, py0 = x + (rx - cx0) * 2, 30 + (ry - cy0) * 2
            for k in range(0, rw * 2, 6):
                dr.point([(px0 + k, py0), (px0 + k, py0 + rh * 2 - 1)], fill=(255, 60, 60))
            for k in range(0, rh * 2, 6):
                dr.point([(px0, py0 + k), (px0 + rw * 2 - 1, py0 + k)], fill=(255, 60, 60))
            x += t.width + gap
        sheet.save(args.sheet)

    # Preview: 8 s of the lab at 1280 px wide, the loop at 140 ms a frame, 50 fps video.
    if args.video:
        W, H = 1280, int(round(941 * 1280 / 1672 / 2) * 2)
        small = [cv2.resize(cv2.cvtColor(r, cv2.COLOR_RGB2BGR), (W, H), interpolation=cv2.INTER_AREA) for r in rooms_with]
        fps = 50
        proc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                                 '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', args.video], stdin=subprocess.PIPE)
        for i in range(8 * fps):
            ms = i * 1000 / fps
            proc.stdin.write(small[int(ms // MS) % 4].tobytes())
        proc.stdin.close()
        proc.wait()

    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=1) + '\n')
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    sys.exit(main())
