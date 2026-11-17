# HJaaS — Hui Jie As a Service

Asset pipeline for the HJaaS website animations.

## Who does what

| Role | Who | Does |
|---|---|---|
| Art director / QC | **Wren** (Claude) | Writes frame tasks in `tasks/`, inspects delivered frames, passes or sends back with notes, cuts approved frames into web-ready assets |
| Illustrator | **Quinn** (ChatGPT) | Reads a task file, generates the frames as one sprite-sheet image |
| Courier | **You** | Carries the image from ChatGPT into the repo (ChatGPT's GitHub connection is read-only, so it can't commit images itself) |

## The loop

```
1. Wren writes   tasks/NNN-name.md                (status: open)
2. You tell Quinn: "Read tasks/NNN-name.md in mentatdgt/hjaas and generate it."
3. Quinn makes   one sprite-sheet PNG
4. You upload it to frames/NNN-name/incoming/     (GitHub: Add file → Upload files)
5. You tell Wren: "QC NNN"
6. Wren runs     tools/qc_frames.py, looks at every frame, then either
     PASS  → frames/NNN-name/approved/  + preview.gif   (status: approved)
     FAIL  → writes "Revision notes" in the task file   (status: changes-requested)
               → back to step 2 ("Read the revision notes in tasks/NNN-name.md and regenerate")
```

## Layout

```
reference/          character sheets and style references (the source of truth for how Hui Jie looks)
tasks/              one markdown file per animation; _TEMPLATE.md is the blank
frames/NNN-name/
    incoming/       raw deliveries from Quinn (never edited)
    approved/       sliced, aligned frames that passed QC + preview.gif
tools/qc_frames.py  slicing + consistency checks + preview builder
```
