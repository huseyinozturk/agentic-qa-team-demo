// e2e runner CLI. Usage: node runner/src/cli.ts <lint|list|run|report|lock> [options]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadFlows, arg } from './lib.ts';
import { lint } from './lint.ts';
import { run } from './run.ts';
import { nightlyReport, latestTable } from './report.ts';
import { acquire, release, lockStatus } from './lock.ts';
import { testIdReport } from './testids.ts';
import { readJson } from './lib.ts';

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'lint': {
    const r = lint();
    r.errors.forEach((e) => console.error(`error: ${e}`));
    console.log(`lint: ${r.checked} flows, ${r.ids} app testIDs checked, ${r.errors.length} errors`);
    process.exit(r.errors.length ? 1 : 0);
  }
  // falls through only if process.exit is mocked; never reached
  case 'list': {
    for (const f of loadFlows()) console.log(`${f.caseId.padEnd(14)} ${f.tags.join(',').padEnd(11)} ${f.tickets.join(',').padEnd(8)} ${f.name}`);
    break;
  }
  case 'run':
    process.exit(await run(args));
  case 'report': {
    if (args.includes('--nightly')) {
      const { text, date } = nightlyReport();
      const out = arg(args, 'out') ?? path.join(ROOT, `docs/qa-team/runs/${date}-nightly.md`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, text);
      console.log(text);
      console.log(`written: ${path.relative(ROOT, out)}`);
    } else console.log(latestTable(arg(args, 'suite')));
    break;
  }
  case 'testids': {
    const r = testIdReport();
    fs.writeFileSync(path.join(ROOT, 'docs/qa-team/testid-requests.md'), r.text);
    console.log(r.text);
    break;
  }
  case 'plan': {
    type Plan = { name: string; suite: string; env: string; trigger: string };
    const plans = readJson<{ plans: Plan[] }>(path.join(ROOT, 'e2e/test-plan.json')).plans;
    const [sub, name] = args;
    if (sub === 'run') {
      const p = plans.find((x) => x.name === name);
      if (!p) { console.error('unknown plan ' + name); process.exit(2); }
      console.log('plan ' + p.name + ': suite ' + p.suite + ' on ' + p.env + ' (trigger: ' + p.trigger + ')');
      process.exit(await run(['--suite', p.suite, '--env', p.env, ...args.slice(2)]));
    }
    console.log('plan                  suite       env       trigger');
    for (const p of plans) console.log(p.name.padEnd(21) + ' ' + p.suite.padEnd(11) + ' ' + p.env.padEnd(9) + ' ' + p.trigger);
    break;
  }
  case 'lock': {
    const [sub, owner = 'unknown'] = args;
    if (sub === 'status') console.log(lockStatus());
    else if (sub === 'acquire') {
      const r = acquire(owner, process.ppid);
      if (!r.ok) { console.error(`REFUSED: ${r.reason}`); process.exit(3); }
      console.log(`lock acquired by ${owner}`);
    } else if (sub === 'release') console.log(release(owner) ? 'lock released' : 'nothing to release (not the owner)');
    else { console.error('usage: lock status | acquire <owner> | release <owner>'); process.exit(2); }
    break;
  }
  default:
    console.error('usage: cli.ts <lint|list|run|report|lock>');
    process.exit(2);
}
