// Which threads were busy in a window of a trace. node qa/tools/busy.mjs trace.json.gz --mark name --from 1800 --to 2400 [--min 8]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const file = process.argv[2];
const flag = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const ev = JSON.parse(gunzipSync(readFileSync(file)).toString()).traceEvents;
const t0 = ev.reduce((m, e) => (e.ts > 0 && e.ts < m ? e.ts : m), Infinity);
const tn = new Map(), pn = new Map();
for (const e of ev) { if (e.ph === 'M' && e.name === 'thread_name') tn.set(`${e.pid}:${e.tid}`, e.args.name); if (e.ph === 'M' && e.name === 'process_name') pn.set(e.pid, e.args.name); }
const mark = ev.find((e) => e.name === flag('--mark'));
const m = mark ? (mark.ts - t0) / 1000 : 0;
const from = m + Number(flag('--from', 0)), to = m + Number(flag('--to', 1000)), min = Number(flag('--min', 8)) * 1000;
for (const e of ev.filter((e) => e.ph === 'X' && e.dur > min && (e.ts - t0) / 1000 >= from && (e.ts - t0) / 1000 <= to).sort((a, b) => a.ts - b.ts)) {
  console.log(`+${((e.ts - t0) / 1000 - m).toFixed(0).padStart(5)}  ${(e.dur / 1000).toFixed(0).padStart(4)}ms  ${pn.get(e.pid) ?? e.pid}/${tn.get(`${e.pid}:${e.tid}`) ?? e.tid}  ${e.name}  ${JSON.stringify(e.args?.data ?? {}).slice(0, 110)}`);
}
