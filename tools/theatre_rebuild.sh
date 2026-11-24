#!/bin/bash
# Scene 5 (theatre): rebuild the whole package from the approved Quinn pieces, in order.
# Usage: bash tools/theatre_rebuild.sh <work_dir> [--preview]
# Inputs (all in the repo):
#   frames/022-theatre-scene/incoming/022_scene_LOCKED_1536x1024.png   the locked scene
#   frames/022-theatre-scene/approved/quinn/   plate.png, plate_finished.png, pose crops, walk/ (drawn boot walk), body/ (drawn full-body walk)
#   frames/022-theatre-scene/approved/green/   green-screen cut-outs of the seven poses (job 022f)
#   frames/022-theatre-scene/site/routine.json the routines (hand-written; kept across rebuilds)
set -e
W=${1:?work dir}; A=frames/022-theatre-scene/approved
mkdir -p "$W"
python3 -I tools/theatre_lamp.py  $A/quinn/plate.png "$W" $A/quinn/plate_finished.png
python3 -I tools/theatre_build.py "$W" $A/quinn $A/green A2_stroke_low A3_stroke_out A1_blink B1_lean B2_dip K1_salute --inbetweens $A/quinn/arm
python3 -I tools/theatre_walk.py  "$W/plate_nolamp.png" $A/quinn/walk "$W/walk" $A/quinn/body
python3 -I tools/theatre_qa.py    "$W" $A/green "$W/qa_sheet.jpg"
cp frames/022-theatre-scene/site/routine.json /tmp/theatre_routine.json
rm -rf "$W/site"
python3 -I tools/theatre_package.py "$W" "$W/plate_finished_nolamp.png" "$W/site"
cp /tmp/theatre_routine.json "$W/site/routine.json"
python3 -I tools/theatre_routine.py "$W/site/routine.json" "$W"     # Rachel's routine from her in-between chains (+ reaction lead-in)
if [ "$2" = "--preview" ]; then PREVIEW_FPS=${PREVIEW_FPS:-30} python3 -I tools/theatre_preview.py "$W/site" "$W/theatre-preview.mp4" 32; fi
echo "built $W/site  (copy it to frames/022-theatre-scene/site when happy)"
