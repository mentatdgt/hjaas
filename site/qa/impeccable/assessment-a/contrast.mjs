// Assessment A: WCAG contrast ratios for the colour pairs used by the counter and the form.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)).toFixed(2); };
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const pairs = [
  ['pin count  ink #2b1a10 on cream #fbf3df', '#2b1a10', '#fbf3df'],
  ['pin count  ink on cream-deep #efdfb9 (face edge)', '#2b1a10', '#efdfb9'],
  ['pin "/ 10" ink-soft #6a4a2c on cream #fbf3df', '#6a4a2c', '#fbf3df'],
  ['pin "/ 10" ink-soft on cream-deep #efdfb9', '#6a4a2c', '#efdfb9'],
  ['button label ink on mustard #edb525', '#2b1a10', '#edb525'],
  ['button label ink on mustard-deep #d89a12', '#2b1a10', '#d89a12'],
  ['form label ink-soft on sheet #fbf3df', '#6a4a2c', '#fbf3df'],
  ['form label ink-soft on sheet low #f3e6c4', '#6a4a2c', '#f3e6c4'],
  ['error text #9d3018 on sheet #fbf3df', '#9d3018', '#fbf3df'],
  ['error text #9d3018 on sheet low #f3e6c4', '#9d3018', '#f3e6c4'],
  ['alert text #7c2410 on #f6dccf', '#7c2410', '#f6dccf'],
  ['input text ink on #fffdf6', '#2b1a10', '#fffdf6'],
  ['NON-TEXT field border #d6c08d vs field #fffdf6', '#d6c08d', '#fffdf6'],
  ['NON-TEXT field border #d6c08d vs sheet #fbf3df', '#d6c08d', '#fbf3df'],
  ['NON-TEXT field fill #fffdf6 vs sheet #fbf3df', '#fffdf6', '#fbf3df'],
  ['NON-TEXT field fill #fffdf6 vs sheet low #f3e6c4', '#fffdf6', '#f3e6c4'],
  ['NON-TEXT invalid border #b23a1e vs field #fffdf6', '#b23a1e', '#fffdf6'],
  ['NON-TEXT invalid border #b23a1e vs normal border #d6c08d', '#b23a1e', '#d6c08d'],
  ['NON-TEXT focus border gold-deep #9c6a1c vs field #fffdf6', '#9c6a1c', '#fffdf6'],
  ['NON-TEXT focus border #9c6a1c vs unfocused border #d6c08d', '#9c6a1c', '#d6c08d'],
  ['NON-TEXT selected chip #edb525 vs unselected #fffdf6', '#edb525', '#fffdf6'],
  ['NON-TEXT selected chip #edb525 vs sheet #fbf3df', '#edb525', '#fbf3df'],
  ['chip text ink on selected mustard', '#2b1a10', '#edb525'],
  ['close icon ink-soft on sheet', '#6a4a2c', '#fbf3df'],
  ['sent tick ink on mustard', '#2b1a10', '#edb525'],
  ['icon cap red #c9472c on cream', '#c9472c', '#fbf3df'],
  ['icon cap red #c9472c on mustard #edb525', '#c9472c', '#edb525'],
  ['icon stroke #7a4a12 on mustard', '#7a4a12', '#edb525'],
  ['gold rim #d9a441 vs mustard face #edb525 (button edge)', '#d9a441', '#edb525'],
];
for (const [n, a, b] of pairs) console.log(cr(hex(a), hex(b)).padStart(6), ' ', n);
// The note: cream text on rgba(34,20,11,.8) over scene colours
for (const [n, bg] of [['dark band #4a2204', '#4a2204'], ['wall mid #a8683a', '#a8683a'], ['bright light patch #f6a94a', '#f6a94a'], ['window white #f4ead8', '#f4ead8']]) {
  const b = over([34, 20, 11], 0.8, hex(bg));
  console.log(cr(hex('#fbf3df'), b).padStart(6), '  note cream text on pill over', n, '| pill vs backdrop (edge):', cr(b, hex(bg)));
}
// focus halo rgba(237,181,37,.45) over sheet
const halo = over([237, 181, 37], 0.45, hex('#fbf3df'));
console.log(cr(halo, hex('#fbf3df')).padStart(6), '  NON-TEXT focus halo (mustard 45%) vs sheet #fbf3df');
// dev note
const dn = over([43, 26, 16], 0.08, hex('#fbf3df'));
console.log(cr(hex('#6a4a2c'), dn).padStart(6), '  dev note ink-soft text on tinted box');
