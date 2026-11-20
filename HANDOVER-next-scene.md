# Handover: the next scene (scene 4)

For: **Wren** (Claude) in a new chat. From: Wren, 2026-11-20.
Read `STATUS.md`, `BIBLE.md` and `SCENE-RECIPE.md` first. They hold the rules, the state and the method. This file covers what's specific to starting scene 4 while the café is still being finished elsewhere.

## 1. The situation
- Scenes 1 (Build) and 2 (Grow) are built. Scene 2 is waiting for Fable's review 05 and the organic edge before merging.
- **Scene 3 (Design, the café) is being finished in another Wren chat.** That chat owns task 018, the café Higgsfield clips, Fable's scene-2 report and the scene-2 merge. **Don't touch any of these.**
- **This chat owns scene 4:** choosing it, staging it with Quinn, its tasks (019 onwards), its clips and its Fable brief.

## 2. First job: pick the scene with the user
Two candidates, both with an approved backdrop already:

| | Film (video production) | Travel |
|---|---|---|
| Backdrop | `scene/merlion.png`: Merlion and Marina Bay Sands, golden hour, promenade (task 006) | `scene/travel-lookout.png`: mountain lookout over a green valley (task 009) |
| Who's in it | Rachel filming a friend (**Sean**) posing in front of the Merlion | Rachel alone, taking in the view |
| Blockers | **Sean's consent** to appear. Two real people to draw and keep consistent. | Location is a placeholder; the user may name a real trip instead. |
| Reaction to a find | Peace sign | Look into the camera plus a small wave |
| Outfit | Not decided | Outfit 3 is the hiking gear (`reference/hjaas1.png`), with bandana and bun or loose hair, user to choose |

**Recommendation: Travel next**, unless the user says Sean has agreed. It has no consent dependency, only one character, and fewer pieces, so it's the faster scene. Film can follow as scene 5.

Then settle with the user (one short question, offering choices), and record the answers in `BIBLE.md` §3:
- outfit and hair (no glasses, ever)
- the two-stage loop (e.g. Travel: looking out with a hand shading her eyes ↔ a sip from her water bottle or a photo on her phone; Film: framing a shot ↔ checking the playback)
- the location (Travel)
- any supporting cast or animals

## 3. Then follow `SCENE-RECIPE.md`
1. **Task 019:** 3 staging mock-ups from Quinn on the backdrop. The user picks one, then fix rounds until it's right.
2. **Task 020 (or 019 continued):** final scene, plate, green anchors, poses. Every image is an edit of the approved scene, at 1672×941. Quinn stops for approval after the scene.
3. **QC**, then Higgsfield clips (**quote first**), then package, then Fable brief. Fable builds on `site/scene-4` only after the café is merged, so don't hand Fable anything earlier.

**Use the café task as the model:** `tasks/018-cafe-scene.md` (step order, file naming, self-check, round notes).

## 4. Sharing with the café chat
- **Git:** run `git pull --rebase origin main` before every commit. Touch only scene-4 files plus your own row in `STATUS.md`.
- **Higgsfield credits are shared.** The balance was 148.5 on 2026-11-20, and the café needs about 15–20. Check the balance before each quote and tell the user what remains for both scenes.
- **Quinn:** ask the user to use a **separate ChatGPT chat** for scene 4, so Quinn doesn't mix it up with the café task.
- **Task numbers:** 019 onwards belong to this chat. The café stays 018.

## 5. Files without re-uploading
- Your Mac folder `~/hjaas` is connected through the device bridge. Ask the user to also add their **Downloads** folder to this chat (the "Add folder" button in the Claude desktop app). Then they just click download in ChatGPT or Higgsfield, and you pick up the newest file from Downloads.
- You can't fetch ChatGPT or Higgsfield files yourself: the network allowlist blocks the Higgsfield cloudfront domain in both the cloud and the Mac VM.
- For a single image, the user can paste it into the chat.
- Higgsfield inputs go in via `raw.githubusercontent.com` URLs (the repo is public).

## 6. How the user likes to work
- Low cognitive load: one short paste-ready prompt per step; the details go in the task file.
- One clear recommendation. Verify against docs before giving step-by-step instructions.
- Restate any ambiguous visual direction before writing the prompt.
- A cost quote and a yes before every paid job.
- Names: Quinn = ChatGPT (draws). Fable = Claude Fable 5.2 in Claude Code (builds). Foreman = Grok orchestrator. You = Wren.
- Real people's photos are never passed to Quinn or committed. Supporting characters are described in words.
