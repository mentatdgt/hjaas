# Copy round 1 + Instrument Sans: build brief (user approved 2026-11-25)

Sources: the copy chat's handover `HANDOVER-copy-round-1.md` (claude.ai Project) and Wren's additions, which the user approved on 2026-11-25. Everything Engine needs is in this file.

## Decisions (user, 2026-11-25)
- The site uses the name **Hui Jie**. Scene 5 is **Set Design**. Unlock at **all 50** (no change).
- **No scene lines** under the paintings for now.
- **About, FAQ, Plans, 404 and footer are on hold.** Don't build them in this round.
- **Voice rule:** buttons and counters use her name ("Contact Hui Jie"). Anything she says herself is in the first person.
- No Singlish, apart from "kopi".
- **Font:** Instrument Sans for the whole site. The preview password page (`site/middleware.js`) stays in its grey monospace.

## 0. Font: Instrument Sans everywhere
- **Install:** self-host it with Fontsource (`@fontsource-variable/instrument-sans`; check the exact package name on npm). Do not load it from Google Fonts. Latin subset only, as today.
- **Replace both current fonts:**
  - Bricolage Grotesque, `--hj-font`;
  - Spectral, `--hj-serif`, used for "Hui Jie", the headings and the form title.
  - Remove the two `@fontsource` packages and their imports. One family remains; set its weights to match today's hierarchy.
- **Fallback stack:** `'Instrument Sans Variable', 'Instrument Sans', 'Avenir Next', 'Segoe UI', system-ui, sans-serif`.
- **Keep:** `font-display: swap` and the bounded font wait added in job 011, if present.
- **Check:** fonts before and after (bytes), and that the masthead, counter, form and buttons all render in Instrument Sans in Chrome and WebKit (computed style plus screenshots).

## 1. Tagline: `site/src/engine/site.ts`, `COPY.tagline`
`I design rooms and sets, build them, film them, and grow mushrooms in between.`

## 2. Search and link-preview text: `site/index.html`
Use this for both `meta name="description"` and `meta property="og:description"`, and remove the `TODO(copy)` comments:

`Hui Jie designs and builds interiors, does production for shoots, designs sets (and grows mushrooms). Find the fifty hidden mushrooms to get in touch.`

## 3. Counter: `site/src/engine/site.ts`, `COUNTER`
- **New zero case:** when a scene has **0** found, the cream label reads `hiding in {scene}` (e.g. "0/10 hiding in Build").
  - Today `hereFound` covers 0 too; the choice is made in `state.ts` around line 224.
  - Add a copy key such as `hereNone`.
  - **Add the new label to the width measurement in `caption.ts` (~line 236)** so the labels still line up, measured with Instrument Sans.
- `siteDone`: `You found all 50` → `All 50. Good eye.`
- **Everything else stays:** `found in X`, `N more in X`, `X complete`, `Next:`, `find all 50 to contact Hui Jie`, `N more to contact Hui Jie`, `Contact Hui Jie`, and the spoken screen-reader lines.

## 4. Contact form: `site/src/engine/form.ts`

| Slot | Now | New |
|---|---|---|
| Dialog title (h2) | Contact Hui Jie | Hi! What have you got in mind? |
| Name label | Your name | (keep) |
| Email label | Email | Where should I reply? |
| Choices legend | What do you need? | What can I help with? (keep the "Pick any" hint) |
| Choices (`NEEDS`), in tab order | Build, Design, Film, Grow, Set Design, Something else | Building or renovating · Mushrooms · Designing a space · Production for a shoot · Designing a set · Something else |
| Message label | Message | Tell me about it |
| Message placeholder | (none) | The space, the timeline, the feeling you're after. Rough is fine. |
| Send button | Send to Hui Jie | Send it |
| Sent title (h3) | Message sent | Got it, thank you. |
| Sent line (~line 302) | Hui Jie will reply to ${email}. | I'll reply to ${email}. |
| Back button | Back to the room | Back to the scenes |
| Missing name | Add your name. | What should I call you? |
| Missing email | Add your email so Hui Jie can reply. | I need an email to reply to. |
| Email typo | That email looks incomplete. Check it for typos. | That email looks a bit off. Typo? |
| Missing message | Write a few words about what you need. | A few words, so I know where to start. |
| Send failed | Your message could not be sent. Check your connection and try again. | That didn't go through. Check your connection and try again? |

- **Leave alone:** the counter's "Contact Hui Jie" button, the close button's label, the "form not switched on yet" notices and the test-mode note.
- **Important: the choices must match on the server.** `site/api/contact.js` (job 012) accepts only `needs` values from the form's list.
  - Update it to exactly the new six labels.
  - Better: keep the list in one shared module that both the form and the function import, so they can't drift apart.
  - Update `form.test.ts`, `submit.test.ts` and the function's tests to the new strings.
  - Add a test that every `NEEDS` label is accepted by the function.

## Checks for the report
- **Screenshots:**
  - the masthead at 375 px and on desktop;
  - the counter at 0 in a scene ("hiding in"), at 3 found, at 10, and at all 50;
  - the form open, the form with each error showing, and the sent state.
- **Width:** the cream label doesn't jump when "hiding in" changes to "found in".
- **End to end:** submit the form against the function locally, with Resend's fetch mocked, using one of the new choices; it must be accepted, and the printed Resend JSON must show the new label in the text.
- **No markers left:** no `TODO(copy)` in `index.html`, `COPY.tagline` or `form.ts`.
- **Tests,** type check and build; no console errors; the hunt 50 of 50 on desktop and phone (the font change can move layout).

## Must not change
The paintings, the animation timing, the hunt logic, memory behaviour, `middleware.js`.
