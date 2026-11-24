"""Scene 5 (theatre): write Rachel's routine (routine.json -> actors.rachel) from her pose chains (2026-11-24).
Every move between two poses plays through Quinn's arm in-betweens (jobs 022m, 022n), 50 ms each. The reaction (salute on a
mushroom find) first takes her arm back to rest from whatever pose she is in, through the same in-betweens but quicker
(reaction.lead_in, 33 ms each), so the salute never starts with a jump. Only the stills that exist are used.
Usage: python3 -I tools/theatre_routine.py <routine.json> <dir with R_*.png>"""
import sys, os, json

R, D = sys.argv[1:3]
have = lambda n: os.path.exists(f'{D}/R_{n}.png')
def chain(*names): return [n for n in names if have(n)]

STROKE_IN = chain('T_A1_A2_1', 'T_A1_A2_2')                      # A1 -> A2
STROKE_OUT = chain('T_A2_A3_1', 'T_A2_A3_2', 'T_A2_A3_3')        # A2 -> A3
DIP = chain('T_A1_B2_0', 'T_A1_B2_1', 'T_A1_B2_2', 'T_A1_B2_2b', 'T_A1_B2_3')   # A1 -> B2
SALUTE = chain('T_A1_K1_1', 'T_A1_K1_1b', 'T_A1_K1_2', 'T_A1_K1_3')            # A1 -> K1
T = lambda names, ms=50: [{'still': f'R_{n}', 'ms': ms} for n in names]
rev = lambda l: list(reversed(l))

r = json.load(open(R)); a = r['actors']['rachel']
a['routine'] = [
    {'loop': 'paint', 'repeat': [3, 6], 'steps':
        [{'still': 'R_A1', 'ms': [500, 900], 'blink_ok': True}] + T(STROKE_IN) +
        [{'still': 'R_A2_stroke_low', 'ms': [250, 450]}] + T(STROKE_OUT) +
        [{'still': 'R_A3_stroke_out', 'ms': [250, 500]}] + T(rev(STROKE_OUT)) +
        [{'still': 'R_A2_stroke_low', 'ms': [200, 350]}] + T(rev(STROKE_IN))},
    {'still': 'R_A1', 'ms': [400, 700], 'blink_ok': True},
    {'still': 'R_B1_lean', 'ms': [2000, 3000]},
    {'still': 'R_A1', 'ms': [300, 500]}] + T(DIP) + [
    {'still': 'R_B2_dip', 'ms': [800, 1100]}] + T(rev(DIP)) + [
    {'still': 'R_A1', 'ms': [500, 800], 'blink_ok': True}]
a['reaction']['steps'] = T(SALUTE) + [{'still': 'R_K1_salute', 'ms': [1600, 2000]}] + T(rev(SALUTE)) + [{'still': 'R_A1', 'ms': 400}]

# lead-in: for each pose she can be in when a mushroom is found, the way back to rest (quick), before the salute
QUICK = 33
lead = {'R_B1_lean': [{'still': 'R_A1', 'ms': 100}]}               # the lean is a whole-body cut anyway: cut back to rest first
def back(path_to_rest, stills):
    """stills = the chain from A1 outwards; for each still on it, the rest of the way back"""
    for i, n in enumerate(stills):
        lead[f'R_{n}'] = T(rev(stills[:i]) if path_to_rest is None else path_to_rest(i), QUICK)
back(None, STROKE_IN + ['A2_stroke_low'])                           # A1 -> ... -> A2
a2_back = rev(STROKE_IN + ['A2_stroke_low'])[1:]                     # from A2: STROKE_IN reversed
for i, n in enumerate(STROKE_OUT + ['A3_stroke_out']):
    lead[f'R_{n}'] = T(rev(STROKE_OUT[:i]) + ['A2_stroke_low'] + rev(STROKE_IN), QUICK)
back(None, DIP + ['B2_dip'])
for k in list(lead):
    if not lead[k] and k != 'R_A1': del lead[k]
a['reaction']['lead_in'] = lead
a['reaction']['min_show_ms'] = 120   # a reaction waits until the drawing on screen has shown this long (or its own time, if shorter)
a['reaction']['min_show_by_still'] = {'R_B1_lean': 500}   # the lean is a whole-body cut: never just a twitch
a['reaction']['note'] = ('On a mushroom find: from whatever pose she is in, her arm first goes back to rest through her in-betweens '
                         '(lead_in, 33 ms each; none from rest), then she raises the brush through the salute in-betweens, turns her '
                         'head to you and smiles, and lowers it again. A second find during the salute extends the hold (again: hold).')
a['note'] = ('Paints in short strokes (A1 > A2 > A3 > A2), every move drawn through in-betweens (R_T_*, 50 ms each, jobs 022m/022n); now and then '
             'leans back to judge it (B1, a cut), then dips the brush in the pot on the ladder (B2) through in-betweens.')
json.dump(r, open(R, 'w'), indent=1)
print('stroke', STROKE_IN, STROKE_OUT, '\ndip', DIP, '\nsalute', SALUTE, '\nlead-in from', sorted(lead))
