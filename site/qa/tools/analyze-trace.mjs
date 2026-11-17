// Summarises a Chrome performance trace: frames, dropped frames and long main-thread tasks in a time window.
//   node qa/tools/analyze-trace.mjs trace.json.gz [fromMs] [toMs] [--tasks]
//   node qa/tools/analyze-trace.mjs trace.json.gz --mark hj-find --span 1500 [--tasks]
// Times are milliseconds after navigationStart (or after the first event when the trace has no navigation).
// --mark starts the window at a performance.mark() the page made; --span is its length in ms.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [file, fromArg, toArg] = process.argv.slice(2);
const showTasks = process.argv.includes('--tasks');
const flag = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const raw = readFileSync(file);
const json = JSON.parse((file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'));
const events = Array.isArray(json) ? json : json.traceEvents;

// The page's renderer main thread: the CrRendererMain thread with the most events.
const mains = new Map();
for (const e of events) if (e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain') mains.set(`${e.pid}:${e.tid}`, 0);
for (const e of events) { const k = `${e.pid}:${e.tid}`; if (mains.has(k)) mains.set(k, mains.get(k) + 1); }
const [mainKey] = [...mains.entries()].sort((a, b) => b[1] - a[1])[0];
const [pid, tid] = mainKey.split(':').map(Number);

const nav = events.filter((e) => e.name === 'navigationStart' && e.pid === pid).sort((a, b) => a.ts - b.ts).pop();
const t0 = nav ? nav.ts : events.reduce((min, e) => (e.ts > 0 && e.ts < min ? e.ts : min), Infinity);
const ms = (ts) => (ts - t0) / 1000;
let from = fromArg !== undefined && !fromArg.startsWith('--') ? Number(fromArg) : -Infinity;
let to = toArg !== undefined && !toArg.startsWith('--') ? Number(toArg) : Infinity;
if (flag('--mark')) {
  // The last one, in case the page was reloaded while the trace was running.
  const mark = events.findLast((e) => e.name === flag('--mark') && String(e.cat).includes('blink.user_timing'));
  if (!mark) throw new Error(`mark "${flag('--mark')}" not found in trace`);
  from = ms(mark.ts);
  to = from + Number(flag('--span') ?? 1000);
}
const inWindow = (e) => ms(e.ts) >= from && ms(e.ts) <= to;

const main = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === 'X');
const tasks = main.filter((e) => e.name === 'RunTask' && inWindow(e));
const long = tasks.filter((e) => e.dur > 50000).sort((a, b) => a.ts - b.ts);
const over = flag('--over') ? tasks.filter((e) => e.dur > Number(flag('--over')) * 1000).sort((a, b) => a.ts - b.ts) : [];

// Frames as the compositor presented them.
const count = (name) => events.filter((e) => e.name === name && inWindow(e)).length;
const names = ['BeginFrame', 'DrawFrame', 'DroppedFrame', 'BeginMainThreadFrame', 'Commit'];
const frames = Object.fromEntries(names.map((n) => [n, count(n)]));

// How each frame ended, from the compositor's pipeline reporter (this page's renderer only).
const states = {};
let smoothnessDrops = 0;
for (const e of events) {
  if (e.name !== 'PipelineReporter' || e.ph !== 'b' || e.pid !== pid || !inWindow(e)) continue;
  const r = e.args?.frame_reporter ?? e.args?.chrome_frame_reporter;
  if (!r?.state) continue;
  states[r.state] = (states[r.state] || 0) + 1;
  if (r.state === 'STATE_DROPPED' && r.affects_smoothness) smoothnessDrops++;
}
const dropped = events.filter((e) => e.name === 'DroppedFrame' && e.pid === pid && inWindow(e)).map((e) => ({ atMs: Math.round(ms(e.ts)), partial: !!e.args?.hasPartialUpdate }));

const busiest = (task) => main
  .filter((e) => e !== task && e.ts >= task.ts && e.ts + (e.dur || 0) <= task.ts + task.dur && e.dur > 4000 && e.name !== 'RunTask')
  .sort((a, b) => b.dur - a.dur).slice(0, 6)
  .map((e) => `${e.name}${e.args?.data?.functionName ? `(${e.args.data.functionName})` : ''}${e.args?.data?.url ? ` ${String(e.args.data.url).split('/').pop()}` : ''} ${(e.dur / 1000).toFixed(0)}ms`);

const out = {
  window: [from === -Infinity ? 'start' : Math.round(from), to === Infinity ? 'end' : Math.round(to)],
  frames,
  frameStates: states,
  droppedAffectingSmoothness: smoothnessDrops,
  droppedFrameEvents: dropped,
  mainThreadTasks: tasks.length,
  longTasksOver50ms: long.length,
  longestTaskMs: tasks.length ? Math.round(Math.max(...tasks.map((e) => e.dur)) / 1000) : 0,
  longTasks: long.map((e) => ({ atMs: Math.round(ms(e.ts)), durMs: Math.round(e.dur / 1000), ...(showTasks ? { top: busiest(e) } : {}) })),
};
console.log(JSON.stringify(out, null, 1));
for (const e of over) console.log(`+${Math.round(ms(e.ts) - (from === -Infinity ? 0 : from))}ms  ${(e.dur / 1000).toFixed(0)}ms  ${busiest(e).join(' | ')}`);
