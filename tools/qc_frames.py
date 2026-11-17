#!/usr/bin/env python3
"""QC and slice an animation sprite sheet (or a folder of frames) for HJaaS.

Usage:
  python3 tools/qc_frames.py SHEET.png --grid 4x2 --frames 8 --fps 8 --out frames/001-x/qc
  python3 tools/qc_frames.py FOLDER_OF_PNGS --fps 8 --out ...

Writes to --out:
  frame_01.png ...   background removed, aligned (see --align), trimmed to a shared canvas
  contact.png        all raw cells side by side with bbox + frame-1 baseline drawn (for eyeballing)
  preview.gif        animation on a light background at --fps
  qc-report.md/json  measurements and PASS/FAIL per check
Exit code 0 = all hard checks pass, 1 = at least one failed.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def parse_grid(s):
    c, r = s.lower().split("x")
    return int(c), int(r)


def load_cells(src: Path, grid, n_frames):
    if src.is_dir():
        files = sorted(p for p in src.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
        cells = [Image.open(p).convert("RGBA") for p in files]
        notes = [f"Loaded {len(cells)} separate frame files."]
    else:
        sheet = Image.open(src).convert("RGBA")
        cols, rows = grid
        W, H = sheet.size
        cw, ch = W // cols, H // rows
        notes = [f"Sheet {W}x{H}, grid {cols}x{rows}, cell {cw}x{ch}."]
        if W % cols or H % rows:
            notes.append(f"WARN sheet size not divisible by grid ({W % cols}px / {H % rows}px left over).")
        cells = []
        for r in range(rows):
            for c in range(cols):
                cells.append(sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
    if n_frames:
        cells = cells[:n_frames]
    return cells, notes


def border_color(arr):
    b = np.concatenate([arr[0, :, :3], arr[-1, :, :3], arr[:, 0, :3], arr[:, -1, :3]])
    return np.median(b, axis=0)


def fg_mask(cell, tol):
    a = np.asarray(cell).astype(np.int16)
    alpha = a[..., 3]
    if (alpha < 250).mean() > 0.05:  # real transparency present
        return alpha > 32, "alpha", None
    bg = border_color(a)
    dist = np.sqrt(((a[..., :3] - bg) ** 2).sum(-1))
    return dist > tol, "keyed", bg


def cutout(cell, mask, mode):
    a = np.asarray(cell).copy()
    if mode == "keyed":
        a[..., 3] = np.where(mask, 255, 0)
        # despill green fringe on kept pixels
        r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
        spill = mask & (g > np.maximum(r, b))
        a[..., 1] = np.where(spill, np.maximum(r, b), g).astype(np.uint8)
    return Image.fromarray(a, "RGBA")


def hist(cell, mask):
    px = np.asarray(cell)[..., :3][mask] // 32  # 8 bins per channel
    if len(px) == 0:
        return np.zeros(512)
    idx = px[:, 0] * 64 + px[:, 1] * 8 + px[:, 2]
    h = np.bincount(idx, minlength=512).astype(float)
    return h / h.sum()


def measure(cell, mask):
    h, w = mask.shape
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return None
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    a = np.asarray(cell).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fringe = (mask & (g > r + 40) & (g > b + 40)).sum() / max(mask.sum(), 1)
    return {
        "bbox": [int(x0), int(y0), int(x1), int(y1)],
        "height": int(y1 - y0 + 1),
        "width": int(x1 - x0 + 1),
        "baseline": int(y1),
        "cx": float(xs.mean()),
        "area": int(mask.sum()),
        "margin_frac": round(float(min(x0, y0, w - 1 - x1, h - 1 - y1) / min(w, h)), 4),
        "touches_edge": bool(mask[0].any() or mask[-1].any() or mask[:, 0].any() or mask[:, -1].any()),
        "green_fringe_frac": round(float(fringe), 5),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("--grid", default="4x2")
    ap.add_argument("--frames", type=int, default=0, help="use only the first N cells")
    ap.add_argument("--fps", type=float, default=8)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--reference", type=Path, help="reference sheet for palette comparison (info only)")
    ap.add_argument("--tol", type=float, default=60, help="colour distance for keyed backgrounds")
    ap.add_argument("--max-height-var", type=float, default=0.04)
    ap.add_argument("--max-baseline-drift", type=float, default=0.02, help="fraction of cell height; raise for jumps")
    ap.add_argument("--min-palette-sim", type=float, default=0.80)
    ap.add_argument("--min-margin", type=float, default=0.08)
    ap.add_argument("--align", choices=["none", "baseline", "baseline+center"], default="none")
    args = ap.parse_args()

    cells, notes = load_cells(args.src, parse_grid(args.grid), args.frames)
    args.out.mkdir(parents=True, exist_ok=True)

    masks, modes, ms, hists = [], [], [], []
    for c in cells:
        m, mode, _ = fg_mask(c, args.tol)
        masks.append(m); modes.append(mode); ms.append(measure(c, m)); hists.append(hist(c, m))

    checks = []

    def check(name, ok, detail, hard=True):
        checks.append({"check": name, "result": "PASS" if ok else ("FAIL" if hard else "WARN"), "detail": detail})

    sizes = {c.size for c in cells}
    check("frames same size", len(sizes) == 1, f"sizes: {sorted(sizes)}")
    empty = [i + 1 for i, m in enumerate(ms) if m is None]
    check("no empty frames", not empty, f"empty: {empty}" if empty else "all frames have content")
    if empty:
        return finish(args, cells, ms, checks, notes, modes)

    cell_h = cells[0].size[1]
    heights = [m["height"] for m in ms]
    hv = (max(heights) - min(heights)) / float(np.median(heights))
    check("character height consistent", hv <= args.max_height_var,
          f"variation {hv:.1%} (limit {args.max_height_var:.0%}); heights {heights}")

    bases = [m["baseline"] for m in ms]
    bd = (max(bases) - min(bases)) / cell_h
    check("baseline steady", bd <= args.max_baseline_drift,
          f"drift {bd:.1%} of cell (limit {args.max_baseline_drift:.0%}); baselines {bases}")

    cxs = [round(m["cx"]) for m in ms]
    check("horizontal centre", True, f"centre x per frame {cxs} (info: intentional motion is fine)", hard=False)

    touching = [i + 1 for i, m in enumerate(ms) if m["touches_edge"]]
    check("nothing touches cell edge", not touching, f"touching: {touching}" if touching else "clear")
    tight = [i + 1 for i, m in enumerate(ms) if m["margin_frac"] < args.min_margin]
    check("margin ≥ spec", not tight, f"frames under {args.min_margin:.0%} margin: {tight}" if tight else "ok", hard=False)

    sims = [float(np.minimum(hists[0], h).sum()) for h in hists]
    low = [i + 1 for i, s in enumerate(sims) if s < args.min_palette_sim]
    check("palette matches frame 1", not low,
          f"similarity {[round(s, 2) for s in sims]} (limit {args.min_palette_sim}); low: {low}")

    if args.reference and args.reference.exists():
        ref = Image.open(args.reference).convert("RGBA")
        rm, _, _ = fg_mask(ref, args.tol)
        rh = hist(ref, rm)
        rs = [round(float(np.minimum(rh, h).sum()), 2) for h in hists]
        check("palette vs reference", True, f"similarity {rs} (info: reference has other poses/text)", hard=False)

    fr = [m["green_fringe_frac"] for m in ms]
    bad = [i + 1 for i, f in enumerate(fr) if f > 0.002]
    check("no green fringe", not bad, f"fringe {fr}; bad: {bad}")

    check("background", True, f"modes per frame: {sorted(set(modes))}", hard=False)

    # ---- outputs ----
    cut = [cutout(c, m, mode) for c, m, mode in zip(cells, masks, modes)]
    ref_base, ref_cx = ms[0]["baseline"], ms[0]["cx"]
    shifted = []
    for im, m in zip(cut, ms):
        dy = ref_base - m["baseline"] if args.align != "none" else 0
        dx = round(ref_cx - m["cx"]) if args.align == "baseline+center" else 0
        canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
        canvas.paste(im, (dx, dy), im)
        shifted.append(canvas)
    union = None
    for im in shifted:
        bb = im.getbbox()
        if bb:
            union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
    pad = int(0.04 * max(union[2] - union[0], union[3] - union[1]))
    W, H = shifted[0].size
    crop = (max(0, union[0] - pad), max(0, union[1] - pad), min(W, union[2] + pad), min(H, union[3] + pad))
    finals = [im.crop(crop) for im in shifted]
    for i, im in enumerate(finals):
        im.save(args.out / f"frame_{i + 1:02d}.png")

    bgc = (245, 243, 238, 255)
    gif = []
    for im in finals:
        bg = Image.new("RGBA", im.size, bgc)
        bg.alpha_composite(im)
        gif.append(bg.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=255))
    gif[0].save(args.out / "preview.gif", save_all=True, append_images=gif[1:],
                duration=int(1000 / args.fps), loop=0, disposal=2)

    cw, ch = cells[0].size
    sheet = Image.new("RGB", (cw * len(cells), ch + 24), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for i, (c, m) in enumerate(zip(cut, ms)):
        bg = Image.new("RGBA", c.size, (230, 230, 230, 255))
        bg.alpha_composite(c)
        sheet.paste(bg.convert("RGB"), (i * cw, 24))
        x0, y0, x1, y1 = m["bbox"]
        d.rectangle((i * cw + x0, 24 + y0, i * cw + x1, 24 + y1), outline=(0, 120, 255))
        d.text((i * cw + 6, 6), f"{i + 1}  h={m['height']}", fill=(0, 0, 0))
        d.line((i * cw, 24, i * cw, ch + 24), fill=(160, 160, 160))
    d.line((0, 24 + ref_base, sheet.width, 24 + ref_base), fill=(255, 0, 0))
    d.line((0, 24 + ms[0]["bbox"][1], sheet.width, 24 + ms[0]["bbox"][1]), fill=(255, 150, 0))
    sheet.save(args.out / "contact.png")

    return finish(args, cells, ms, checks, notes, modes)


def finish(args, cells, ms, checks, notes, modes):
    passed = all(c["result"] != "FAIL" for c in checks)
    report = {"source": str(args.src), "passed": passed, "notes": notes, "checks": checks, "frames": ms}
    (args.out / "qc-report.json").write_text(json.dumps(report, indent=2))
    lines = [f"# QC report — {args.src.name}", "", f"**Automated checks: {'PASS' if passed else 'FAIL'}**", ""]
    lines += [f"- {n}" for n in notes] + ["", "| Check | Result | Detail |", "|---|---|---|"]
    lines += [f"| {c['check']} | {c['result']} | {c['detail']} |" for c in checks]
    lines += ["", "_Automated checks only. Wren's visual review (identity, style, motion) is recorded in the task file._"]
    (args.out / "qc-report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
