// One line per run of qa/form-reply/report.json (written by form-reply.mjs): the checks that matter, at a glance.
//   node qa/tools/form-reply-summary.mjs
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(new URL('../form-reply/report.json', import.meta.url), 'utf8'));
for (const [name, run] of Object.entries(report)) {
  if (!run || typeof run !== 'object') continue;
  if (run.skipped) {
    console.log(`${name}: skipped (${run.skipped})`);
    continue;
  }
  console.log(name, JSON.stringify({
    tabOrderOk: run.tabOrderOk,
    groupError: run.groupError,
    badNumber: run.badNumber?.['hj-phone-err'],
    pasted: run.pasted,
    phoneOnly: run.phoneOnlySend?.says,
    posted: run.phoneOnlySend?.posted,
    both: run.bothSend && [run.bothSend.replyTo, run.bothSend.says],
    afterReset: run.afterReset,
    fields16: run.layout?.allAtLeast16,
    consoleErrors: run.consoleErrors,
  }, null, 1));
}
