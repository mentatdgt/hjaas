# Logo swap: the final logo (do after review 03, or in the next build round)

The final logo is approved (task 014, round 3). Two new files:
- `assets/logo/hjaas-logo.png`: 1651×630, transparent. The full logo.
- `assets/logo/hjaas-reel.png`: 643×643, transparent, square. The reel only.

In `site/scripts/build-assets.mjs`:
1. Point the logo sprite at `assets/logo/hjaas-logo.png` instead of `tape-measure-temp.png`. Keep `LOGO_W` sizing; the glint mask comes from the new alpha.
2. Make the favicon and apple-touch-icon from `assets/logo/hjaas-reel.png` (just resize). Remove the fixed `reel = {left: 0, top: 6, ...}` crop, which only fitted the temporary image.
3. Make the og:image from the new logo.
4. Run `npm run assets`. Check the logo, its glint, the favicon at 32 px and the link-preview image. Keep `tape-measure-temp.png` in the repo, but nothing should use it any more.

Do this on whichever branch is chosen (`site/scene-1-elegant` or `site/scene-1`), in its own commit.
