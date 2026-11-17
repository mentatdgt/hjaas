#!/usr/bin/env python3
"""Stabilise a sprite sheet: key the background, line every frame up on a static
anchor region (e.g. the box), then keep frame 1's pixels everywhere except where a
frame genuinely differs, so unchanged parts (body, box) never jitter.

Usage:
  python3 tools/stabilise_frames.py SHEET --grid 2x2 --frames 4 \
      --anchor X0,Y0,X1,Y1   (anchor box in frame-1 cell coordinates)
      --out DIR [--holds 2,1,2,1 --fps 12] [--scene scene/room-empty.png --place X,Y,HEIGHT]

Writes DIR/frame_NN.png (RGBA, cropped to a common box), DIR/stabilised-contact.png,
DIR/stabilised-preview.gif and, with --scene, DIR/in-scene-preview.gif.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def key(cell):
    """Return RGBA with green/transparent background removed and green spill suppressed."""
    a = np.asarray(cell.convert("RGBA")).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    if alpha.min() < 250:  # already transparent
        out = a
    else:
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        greenness = g - np.maximum(r, b)             # how much greener than the other channels
        al = np.clip(1.0 - (greenness - 40) / 110.0, 0, 1)  # >150 => bg, <40 => fg
        out = np.dstack([rgb, al * 255])
    # spill suppression: never let green exceed the brighter of red/blue near edges
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    cap = np.maximum(r, b)
    edge = out[..., 3] < 254
    edge = ndimage.binary_dilation(edge, iterations=3)
    g2 = np.where(edge & (g > cap), cap, g)
    out[..., 1] = g2
    # drop specks smaller than 40 px
    solid = out[..., 3] > 30
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        small = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s < 40])
        out[..., 3][small] = 0
    return out


def register(ref, mov, box, search=60):
    """Integer (dy, dx) that best aligns mov to ref inside box, by grey-level SSD."""
    x0, y0, x1, y1 = box
    def grey(a):
        return (a[..., :3].mean(2) * (a[..., 3] / 255.0))
    R = grey(ref)[y0:y1, x0:x1]
    G = grey(mov)
    best, arg = None, (0, 0)
    for dy in range(-search, search + 1, 2):
        for dx in range(-search, search + 1, 2):
            ys, xs = y0 - dy, x0 - dx
            if ys < 0 or xs < 0 or ys + (y1 - y0) > G.shape[0] or xs + (x1 - x0) > G.shape[1]:
                continue
            d = ((G[ys:ys + (y1 - y0), xs:xs + (x1 - x0)] - R) ** 2).mean()
            if best is None or d < best:
                best, arg = d, (dy, dx)
    # refine at 1 px
    cy, cx = arg
    for dy in range(cy - 2, cy + 3):
        for dx in range(cx - 2, cx + 3):
            ys, xs = y0 - dy, x0 - dx
            if ys < 0 or xs < 0 or ys + (y1 - y0) > G.shape[0] or xs + (x1 - x0) > G.shape[1]:
                continue
            d = ((G[ys:ys + (y1 - y0), xs:xs + (x1 - x0)] - R) ** 2).mean()
            if d < best:
                best, arg = d, (dy, dx)
    return arg, best


def shift(a, dy, dx):
    """Move image content by (dy, dx), filling with transparent."""
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h - max(dy, 0), max(-dx, 0):w - max(dx, 0)]
    return out


def over(fg, bg):
    fa, ba = fg[..., 3:4] / 255.0, bg[..., 3:4] / 255.0
    oa = fa + ba * (1 - fa)
    rgb = (fg[..., :3] * fa + bg[..., :3] * ba * (1 - fa)) / np.maximum(oa, 1e-6)
    return np.dstack([rgb, oa[..., 0] * 255])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("--grid", default="2x2")
    ap.add_argument("--frames", type=int, default=0)
    ap.add_argument("--anchor", required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--holds", default="")
    ap.add_argument("--fps", type=float, default=12)
    ap.add_argument("--diff", type=float, default=38, help="per-pixel difference that counts as a real change")
    ap.add_argument("--grow", type=int, default=7, help="px to grow the change mask")
    ap.add_argument("--scene", type=Path)
    ap.add_argument("--place", help="X,Y,HEIGHT: bottom-left of the character's feet and its height in the scene")
    args = ap.parse_args()

    cols, rows = map(int, args.grid.lower().split("x"))
    sheet = Image.open(args.src).convert("RGBA")
    cw, ch = sheet.width // cols, sheet.height // rows
    n = args.frames or cols * rows
    cells = [key(sheet.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch))) for i in range(n)]
    anchor = tuple(int(v) for v in args.anchor.split(","))

    base = cells[0]
    out = [base]
    report = ["| frame | shift (dy,dx) | anchor error | changed area |", "|---|---|---|---|", "| 1 | 0,0 | 0 | base |"]
    for i, c in enumerate(cells[1:], start=2):
        (dy, dx), err = register(base, c, anchor)
        al = shift(c, dy, dx)
        d = np.abs(al - base)
        change = (d[..., :3].mean(2) * np.maximum(al[..., 3], base[..., 3]) / 255.0 > args.diff) | (np.abs(al[..., 3] - base[..., 3]) > 100)
        change = ndimage.binary_opening(change, iterations=2)
        lab, k = ndimage.label(change)
        if k:
            sizes = ndimage.sum(change, lab, range(1, k + 1))
            change = np.isin(lab, [j + 1 for j, s in enumerate(sizes) if s > 150])
        change = ndimage.binary_closing(change, iterations=args.grow)
        change = ndimage.binary_fill_holes(change)
        change = ndimage.binary_dilation(change, iterations=args.grow)
        m = np.asarray(Image.fromarray((change * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))) / 255.0
        m = m[..., None]
        # inside the mask take the frame; outside keep the base. Mix premultiplied.
        pa = al[..., :3] * (al[..., 3:4] / 255.0)
        pb = base[..., :3] * (base[..., 3:4] / 255.0)
        a_out = al[..., 3:4] * m + base[..., 3:4] * (1 - m)
        rgb = (pa * m + pb * (1 - m)) / np.maximum(a_out / 255.0, 1e-6)
        out.append(np.dstack([rgb, a_out[..., 0]]))
        report.append(f"| {i} | {dy},{dx} | {err:.1f} | {change.mean()*100:.1f}% |")

    # common crop
    allA = np.max([o[..., 3] for o in out], axis=0) > 10
    ys, xs = np.where(allA)
    y0, y1, x0, x1 = max(ys.min() - 8, 0), ys.max() + 9, max(xs.min() - 8, 0), xs.max() + 9
    args.out.mkdir(parents=True, exist_ok=True)
    frames = []
    for i, o in enumerate(out, start=1):
        im = Image.fromarray(np.clip(o[y0:y1, x0:x1], 0, 255).astype(np.uint8), "RGBA")
        im.save(args.out / f"frame_{i:02d}.png")
        frames.append(im)
    (args.out / "stabilise-report.md").write_text("\n".join(report) + f"\n\nCrop: x {x0}-{x1}, y {y0}-{y1} of the cell.\n")

    holds = [int(h) for h in args.holds.split(",")] if args.holds else [1] * len(frames)
    dur = int(round(1000 / args.fps))
    W, H = frames[0].size
    contact = Image.new("RGBA", (W * len(frames) + 10 * (len(frames) - 1), H), (40, 40, 40, 255))
    for i, f in enumerate(frames):
        bg = Image.new("RGBA", f.size, (235, 225, 210, 255)); bg.alpha_composite(f)
        contact.paste(bg, (i * (W + 10), 0))
    contact.convert("RGB").save(args.out / "stabilised-contact.png")
    seq = [f for f, h in zip(frames, holds) for _ in range(h)]
    def flat(f, col=(235, 225, 210)):
        bg = Image.new("RGBA", f.size, col + (255,)); bg.alpha_composite(f); return bg.convert("RGB")
    flat(seq[0]).save(args.out / "stabilised-preview.gif", save_all=True, append_images=[flat(f) for f in seq[1:]], duration=dur, loop=0)

    if args.scene and args.place:
        px, py, ph = (float(v) for v in args.place.split(","))
        room = Image.open(args.scene).convert("RGBA")
        # feet line = lowest opaque row of frame 1
        a1 = np.asarray(frames[0])[..., 3] > 10
        rows_ = np.where(a1.any(1))[0]
        top, bot = rows_.min(), rows_.max()
        s = ph / (bot - top)
        imgs = []
        for f in seq:
            g = f.resize((int(f.width * s), int(f.height * s)), Image.LANCZOS)
            canvas = room.copy()
            # soft ground shadow
            sh = Image.new("L", (int(g.width * 0.95), int(30 * s)), 0)
            sh = Image.fromarray((np.asarray(Image.new("L", sh.size, 255)) * 0).astype(np.uint8))
            ell = Image.new("L", (int(g.width * 0.95), max(int(28 * s), 8)), 0)
            from PIL import ImageDraw
            ImageDraw.Draw(ell).ellipse([0, 0, ell.width - 1, ell.height - 1], fill=110)
            ell = ell.filter(ImageFilter.GaussianBlur(10))
            shadow = Image.new("RGBA", ell.size, (60, 30, 10, 0)); shadow.putalpha(ell)
            oy = int(py - bot * s)
            canvas.alpha_composite(shadow, (int(px + g.width * 0.02), int(py - ell.height * 0.6)))
            canvas.alpha_composite(g, (int(px), oy))
            imgs.append(canvas.convert("RGB").resize((room.width // 2, room.height // 2), Image.LANCZOS))
        imgs[0].save(args.out / "in-scene-preview.gif", save_all=True, append_images=imgs[1:], duration=dur, loop=0)
        imgs[0].save(args.out / "in-scene-frame1.png")
    print("\n".join(report))


if __name__ == "__main__":
    main()
