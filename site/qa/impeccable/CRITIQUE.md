# Impeccable critique: logo slot, counter, unlock, contact form

Method: dual-agent. Assessment A (design review) and Assessment B (detector and measurements) ran as
two separate agents that did not see each other's work, on the state of the branch before the fixes
listed below. Run on 2026-11-18.

Questions skipped: the run was unattended. Impeccable's product interview (`init`) was also skipped for
the same reason; `HANDOVER.md` was used as the brief.

## Design health (Nielsen heuristics, from Assessment A)

| # | Heuristic | Score | Key issue at review time |
|---|---|---|---|
| 1 | Visibility of system status | 3 | A production build only said the form was off after a full message had been typed. |
| 2 | Match with the real world | 3 | "Grow" and "Travel" are opaque until the services copy exists. |
| 3 | User control and freedom | 3 | On a phone held sideways the title and close button scrolled away with the form. |
| 4 | Consistency and standards | 3 | Three focus styles of different strength; a picked chip looked like the primary button. |
| 5 | Error prevention | 3 | Nothing said the chips were optional or that several could be picked. |
| 6 | Recognition rather than recall | 3 | The reason for the hunt is shown once (pinned by the brief). |
| 7 | Flexibility and efficiency | n/a | One-task experience page. |
| 8 | Aesthetic and minimalist design | 3 | Hollow success sheet; prompt pill crowding the logo at 360 px; small HUD on big monitors. |
| 9 | Error recognition and recovery | 3 | Keyboard focus was dropped while sending and not restored on failure. |
| 10 | Help and documentation | n/a | Limited by the brief to the prompt, the prize line and the wiggle. |
| | **Total** | **24 / 32** | Good, with specific gaps. |

**Design specificity:** grounded in this product. The counter is a believable enamel pin, its icon is
drawn like the pin, the unlocked button takes the logo tape's mustard, the glint is shared with the logo,
and the form is the same pin at sheet size. Two generic pockets were named: the success state (a stock
tick) and the prompt line (a dark tooltip pill).

**Strengths named by the review:** the pin is laid out at button width and clipped, so the morph is
physically honest and text never reflows; the form's behaviour is careful (tab order, kept drafts,
16 px inputs, all text at 5.9:1 or better); the microcopy is plain and never fakes a send.

## Detector and measurements (Assessment B)

- File scan and live-page scans (desktop 1440 × 900, phone 390 × 844; counter, unlocked, form open,
  form with errors): one finding in total, `text-occlusion` on the unlocked button. It was a false
  positive (the real button carried transparent text for its accessible name), and it is gone now that
  the button is named with `aria-label` instead.
- Text contrast: no failures. Lowest value 5.9:1 (error text).
- Touch targets: no failures (44 px or more on the phone).
- Accessible names: none missing. Horizontal overflow: none. Text under 12 px: none.
- One real measurement outside the detector's rules: field and chip borders were 1.6–1.75:1 against
  their surroundings (the guideline for control edges is 3:1).

After the fixes the detector reports nothing in any of the scanned states.

## Priority issues and what was done

| # | Issue | Outcome |
|---|---|---|
| 1 | In a production build with no form endpoint, the visitor learned the form was off only after writing a message. | **Fixed.** The sheet now says so at the top as soon as it opens, and Send is switched off (`submit.ts` `canSend`, `form.ts`). Checked on the production build: `m6/prod-form-not-connected.jpg`. |
| 2 | Field and chip edges at 1.6–1.75:1; weak focus on fields and chips; a picked chip shown by fill alone. | **Fixed.** Edges are `#9c7a3a` (3.9:1 on the field, 3.6:1 on the sheet); fields, chips, Send and close share one 2 px ink focus ring; a picked chip gains a tick. |
| 3 | During the unlock the icon slid across the first letter of the label, and the pill was briefly empty. | **Fixed.** The label now travels with the icon inside the pin's clip, always one gap behind it, and cross-fades with the number in place. Frozen frames: `m6/morph-frames-desktop.jpg`, `m6/morph-frames-iphone.jpg`. |
| 4 | Keyboard focus was dropped when Send disabled itself, and was not restored after a failure. | **Fixed.** Send uses `aria-disabled` and keeps focus; after sending, focus moves to the "Message sent" heading; field errors are announced politely. |
| 5 | On phones narrower than 380 px the prompt ran into the logo. | **Fixed.** The prompt wraps under 380 px; under 340 px the logo and button tighten up. Checked at 360 px: `screens/narrow-360-01-fresh.jpg`. |

## Smaller findings

| Finding | Outcome |
|---|---|
| The success state was a stock tick in a mostly empty sheet. | **Fixed.** The sheet shrinks to its content, shows the hunt's own enamel mushroom with a tick, and names the address the reply will go to. |
| The prompt line was a generic dark tooltip. | **Fixed.** It is now a small cream tag with a gold hairline, the pin's own material. The swipe hint matches it. |
| No words at the 10/10 moment. | **Fixed.** The tag says "You found all 10" for four seconds as the button appears. |
| On a phone held sideways the title and close button scrolled away. | **Fixed.** The title row stays; only the form scrolls. |
| Opening the form on a phone would raise the keyboard over it at once. | **Fixed.** On touch devices focus rests on the title; with a mouse or keyboard it goes to the name field. |
| The sheet did not follow its button when the window was resized. | **Fixed.** It re-anchors on resize. |
| The pin and logo stayed small on very large monitors. | **Fixed.** Above 1800 px the logo is 12% of the width and the pin is 1.2× (1.45× above 2400 px). |
| The unlocked button had no lasting hover state. | **Fixed.** It brightens slightly on hover, as well as glinting. |
| Chips gave no cue that they are optional and multi-select. | **Fixed.** "Pick any" beside the question. |
| Chips were 40 px tall in landscape. | **Fixed.** 44 px everywhere. |
| Reduced motion showed one frame of a wide pill holding a fading "10 / 10". | **Fixed.** The number goes at once. |
| The textarea's native resize grip was unstyled. | **Fixed.** No grip; the field grows with the message where the browser supports it. |
| A screen-reader user never heard what the hunt is for. | **Fixed.** The first find's announcement adds "Find all 10 to reach Hui Jie". |
| A returning visitor mid-hunt only saw the generic prompt. | **Fixed.** They are reminded what the hunt is for instead. |
| The temporary logo PNG has pale smears under the reel and tape tip, obvious on the phone's dark band. | **Not changed** (the brief forbids editing it). Passed to Wren in the report. |
| The only way to the form is the hunt. | **Not changed** (it is the concept). Noted in the report as the page's biggest drop-off risk. |
| The Contact button sits out of thumb reach at the top of a phone. | **Not changed.** It is the counter, and the brief puts the counter in a corner above the scene. Noted. |
| A draft is lost if the page is reloaded. | **Not changed.** Low value for this build. |
| The failure message offers no other way to reach Hui Jie. | **Not changed.** There is no contact address in the brief yet. |

The agents' raw measurements are beside this file (`assessment-a/shots/*.json`,
`assessment-b/mechanical.json`, `assessment-b/overlay.json`). Their screenshots are kept on this Mac
only (about 220 MB, and of the pre-fix state).
