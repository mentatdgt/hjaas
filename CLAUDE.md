# HJaaS — notes for Claude (Wren)

Pipeline and roles: see README.md. Quinn = ChatGPT (read-only GitHub access; the user uploads its images).

## QC procedure ("QC NNN")
1. Take the newest file in `frames/NNN-*/incoming/`.
2. Run `python3 tools/qc_frames.py <sheet> --grid <grid> --frames <n> --fps <fps> --reference <ref> --out frames/NNN-*/approved` with values from the task's front matter. Raise `--max-baseline-drift` only if the task's motion intends vertical movement (jumps, crouches).
3. Always look at `contact.png` and several individual frames yourself: the script can't judge identity, face, hands, outfit details or style match against `reference/`.
4. PASS → keep `approved/`, set task `status: approved`. FAIL → delete `approved/` output, add a numbered "Round N" under Revision notes with specific, frame-numbered fixes, set `status: changes-requested`.
