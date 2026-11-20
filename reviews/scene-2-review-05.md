# Scene 2: Wren's review 05 (2026-11-20): whole-page memory

For: Fable, on `site/scene-2`. Commit and push. Never merge into other branches.

Review 04 and the hunt difficulty are approved. The corners now match the mock-up, the lab memory went from 243 to 67 MB, and the hunt has a good curve. One follow-up from your own flag:

## 1. Only the visible scene keeps decoded frames
- **Problem:** a phone that opened Build first holds about 165 MB with Grow open, because scene 1 still holds its 84 MB.
- **On a scene switch,** once the incoming scene is fully shown, release the outgoing scene's decoded character frames with `ImageBitmap.close()` or by dropping the references. Keep the encoded blobs, so switching back re-decodes during the brush transition with no visible wait.
- **Give scene 1 the same treatment as the lab:**
  - Phones (under 900 CSS px) get a 1.5× set of Rachel's Build frames from `npm run assets`.
  - The reaction frames stay decoded only while Build is visible.
- **Report** the peak decoded image memory on the phone profile in three cases: Build only; Build, then Grow; Grow, then Build. Target under 80 MB in each.
- Re-check that switching both ways has no frame over about 50 ms in WebKit, on a quiet Mac.

## 2. Re-measure the opening painting
Re-measure it on a quiet Mac (iCloud and other syncing paused): 10 cold loads in the iPhone profile. Report the numbers.

## Done means
Add a "Review 05" section to `site/qa/REPORT.md`, push, and paste a short summary.
