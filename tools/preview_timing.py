#!/usr/bin/env python3
"""Render an MP4 preview of a character loop composited into a scene, using a
human-feeling, varied timing schedule (the same rules the website will use).

Usage:
  python3 tools/preview_timing.py --frames frames/001-hammer-loop/approved \
      --scene scene/room-empty.png --place 600,868,455 --seconds 14 --out preview.mp4
"""
import argparse
import random
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Hammer rhythm (milliseconds). Frame ids: 1 contact, 2 lift, 3 wind-up, 4 down-swing.
SWING = [(1, (260, 460)), (2, (110, 150)), (3, (240, 420)), (4, (60, 80))]
TAP = [(1, (160, 220)), (2, (80, 100))]          # small tap: contact -> lift -> contact
PAUSE = (1100, 2000)                              # stop and look at the work


def schedule(seconds, seed=7):
    rnd = random.Random(seed)
    seq, t = [], 0
    swings_until_pause = rnd.randint(3, 6)
    while t < seconds * 1000:
        if swings_until_pause == 0:
            ms = rnd.randint(*PAUSE)
            seq.append((1, ms)); t += ms
            swings_until_pause = rnd.randint(3, 6)
            continue
        if rnd.random() < 0.2:                    # occasionally a couple of quick taps
            for _ in range(rnd.randint(1, 2)):
                for f, (lo, hi) in TAP:
                    ms = rnd.randint(lo, hi); seq.append((f, ms)); t += ms
        tempo = rnd.uniform(0.9, 1.15)            # each swing a little faster or slower
        for f, (lo, hi) in SWING:
            ms = int(rnd.randint(lo, hi) * tempo); seq.append((f, ms)); t += ms
        swings_until_pause -= 1
    return seq


def composite(frames_dir, scene, place):
    px, py, ph = (float(v) for v in place.split(","))
    room = Image.open(scene).convert("RGBA")
    frames = [Image.open(p) for p in sorted(Path(frames_dir).glob("frame_*.png"))]
    a1 = np.asarray(frames[0])[..., 3] > 10
    rows = np.where(a1.any(1))[0]
    top, bot = rows.min(), rows.max()
    s = ph / (bot - top)
    out = []
    for f in frames:
        g = f.resize((int(f.width * s), int(f.height * s)), Image.LANCZOS)
        c = room.copy()
        ell = Image.new("L", (int(g.width * 0.95), max(int(28 * s), 8)), 0)
        ImageDraw.Draw(ell).ellipse([0, 0, ell.width - 1, ell.height - 1], fill=110)
        ell = ell.filter(ImageFilter.GaussianBlur(10))
        sh = Image.new("RGBA", ell.size, (60, 30, 10, 0)); sh.putalpha(ell)
        c.alpha_composite(sh, (int(px + g.width * 0.02), int(py - ell.height * 0.6)))
        c.alpha_composite(g, (int(px), int(py - bot * s)))
        out.append(c.convert("RGB"))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", required=True)
    ap.add_argument("--scene", required=True)
    ap.add_argument("--place", required=True)
    ap.add_argument("--seconds", type=float, default=14)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    imgs = composite(args.frames, args.scene, args.place)
    seq = schedule(args.seconds, args.seed)
    with tempfile.TemporaryDirectory() as td:
        for i, im in enumerate(imgs, start=1):
            im.save(f"{td}/f{i}.png")
        lines = []
        for f, ms in seq:
            lines += [f"file '{td}/f{f}.png'", f"duration {ms/1000:.3f}"]
        lines.append(f"file '{td}/f{seq[-1][0]}.png'")
        Path(f"{td}/list.txt").write_text("\n".join(lines) + "\n")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{td}/list.txt",
                        "-vf", f"fps={args.fps},scale=1280:-2:flags=lanczos,format=yuv420p",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", args.out], check=True)
    swings = sum(1 for f, _ in seq if f == 4)
    print(f"{len(seq)} steps, {swings} full swings in {args.seconds}s (~{swings/args.seconds*60:.0f} per minute)")


if __name__ == "__main__":
    main()
