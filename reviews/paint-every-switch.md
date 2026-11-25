# Paint on every scene change (user request, 2026-11-25)

## The problem the user reported
On the phone preview the first scene paints in. After that, any scene they jump to appears already filled in. They want the paint effect on every change of scene.

## What the code does now (`site/review-fixes` @ 60f19b8, `src/engine/site.ts`)
- **A scene never seen:** the full painting from blank paper (about 5 s).
- **A scene already seen:** a quick brush over the old picture (1.2 s of brush and a 0.25 s wash).
- **Reduced motion, or a "rush":** no brushwork at all, just a 200 ms fade or an instant finish. A rush is any tap on the menu while a painting or switch is under way (`go()` calls `finishTransition()`).
- **"Seen" never resets:** it is saved in localStorage and stays for good. On any later visit the opening is a 300 ms reveal and every scene gets only the quick brush.

Likely causes of what the user saw:
1. Tapping a tab while the opening is still painting, which snaps the next scene in finished.
2. Scenes marked seen from earlier preview visits, so they get only the 1.2 s brush, which is too quick to read as painting.

Reproduce both before fixing, and say in the report which one it was.

## The fix (Wren's call)
1. **"Painted" lasts for one visit only.** Keep it in memory for the page's lifetime, not in localStorage.
   - Every new visit opens with the full painting. Skip stays.
   - The scene's first appearance in a visit gets the full painting.
   - Keep mushroom finds and the pan position saved as now.
   - The old saved `seen` key is only read where something else needs it: the newcomer drift and the hunt state. Do not let it skip a painting.
2. **Returning to a scene already painted in this visit is a real brush-over:** 2.4 s of brush and a 0.35 s wash, instead of 1.2 s and 0.25 s. Keep the memory rule that the two scenes are never decoded together.
3. **A tab tap mid-painting changes scene, painted.** It no longer snaps to finished. The current picture is finished under the sheet, and then the newly asked-for scene is painted:
   - with the full painting if it is new in this visit;
   - with a brush-over if it was already painted.
   Only Skip, or tapping the tab of the scene being painted, jumps to the finished picture.
4. **Reduced motion stays as it is** (the 200 ms fade). This is an accessibility setting.
