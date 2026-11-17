# Higgsfield jobs (2026-11-17)

Upscaler: bytedance_image_upscale at 2k, 2 credits each. Input is a green-backed copy of each approved frame, from `inputs/`.

| Frame | Job id |
|---|---|
| loop_01 | 8a7b19bb-6e71-4dd5-8257-2d93ade8aa1c (test: PASS, crisper lines, same style) |
| loop_02 | 35f87efe-4de4-4091-9719-d2e1c940e5a8 |
| loop_03 | 6ad1bde3-54c3-4e25-90c7-b815d892b054 |
| loop_04 | ae6df476-0b27-4d36-9903-a8ccda3a94ed |
| blink_half | 6c726918-9a49-4f9e-b955-769c3d4e27fb |
| blink_closed | bd40d63f-576d-450a-af14-01aba84ddf40 |
| K1 | f78ac891-2323-4491-b158-482bedefeed3 |
| K2 | f8adea28-7e34-476e-b34b-0655261ffc50 |

## Reaction clips (task 005)
Kling 3.0, std 720p, 3 s, 4.5 credits each.

| Clip | Job id | Result |
|---|---|---|
| A, attempt 1 | 5128b269-f6f7-4ed5-a380-6ec18be3e4c0 | FAIL: her glasses vanish for 5 frames and the face morphs instead of the head lifting. |
| B, attempt 1 | ccfb4093-2169-4a01-9634-7592a5227659 | Usable: a connected arm swing. Drop 2–3 smeared hand frames (~34–37). |
| A, attempt 2 | acec5436-d5d1-4b71-8b20-0c2cc3c9fc21 | Usable: eyes up first, then the head lifts. Frames 50–51 dropped. |

Spent so far: 29.5 credits (balance 210 → 180.5).

## Output (2026-11-17)
`approved/` contains the 2× set (1146×916, transparent): frame_01–04, blink_half, blink_closed, K1, K2.
- Each upscale was downsized to exactly 2×, keyed, and then steadied: frame_01's pixels are kept everywhere except the areas that differ in the approved 1× originals. That way the independent upscales can't shimmer between frames.
- Built with `tools/build_2x_frames.py`. QC: crisp lines, same style, clean edges on dark backgrounds.
- **For the site:** drop-in replacements for `frames/001`, `002` and `004` at double resolution. The placement transform is computed from the image size, so nothing else changes.
