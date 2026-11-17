// Summarises docs/qa-team/cost.tsv per role and checks each row against the role budget.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from '../runner/src/lib.ts';

const file = path.join(ROOT, 'docs/qa-team/cost.tsv');
if (!fs.existsSync(file)) { console.error('no cost log yet'); process.exit(1); }
const prices = readJson<Record<string, { input: number; output: number }>>(path.join(ROOT, 'docs/qa-team/prices.json'));
const roster = readJson<{ roles: Record<string, { budgetUsd: number }> }>(path.join(ROOT, 'docs/qa-team/roster.json'));
const [head, ...rows] = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => l.split('\t'));
const col = (r: string[], n: string) => r[head.indexOf(n)];

const per = new Map<string, { runs: number; usd: number; modes: Set<string> }>();
let problems = 0;
for (const r of rows) {
  const role = col(r, 'role'), usd = Number(col(r, 'usd'));
  const p = prices[col(r, 'model')];
  const expect = p ? (Number(col(r, 'input_tokens')) * p.input + Number(col(r, 'output_tokens')) * p.output) / 1e6 : NaN;
  if (col(r, 'mode') === 'recorded' && Math.abs(expect - usd) > 0.005) { console.error(`row ${col(r, 'task')}: usd ${usd} differs from recomputed ${expect.toFixed(4)}`); problems++; }
  if (usd > (roster.roles[role]?.budgetUsd ?? Infinity)) { console.error(`row ${col(r, 'task')}: ${usd} exceeds the ${role} budget cap`); problems++; }
  const cur = per.get(role) ?? { runs: 0, usd: 0, modes: new Set<string>() };
  per.set(role, { runs: cur.runs + 1, usd: cur.usd + usd, modes: cur.modes.add(col(r, 'mode')) });
}
console.log('role                  runs    usd   mode');
let total = 0;
for (const [role, v] of per) { total += v.usd; console.log(`${role.padEnd(21)} ${String(v.runs).padStart(4)} ${v.usd.toFixed(2).padStart(6)}   ${[...v.modes].join(',')}`); }
console.log(`${'total'.padEnd(21)} ${String(rows.length).padStart(4)} ${total.toFixed(2).padStart(6)}`);
console.log(rows.some((r) => col(r, 'mode') === 'recorded') ? 'note: "recorded" rows are illustrative placeholders, not measured spend.' : '');
process.exit(problems ? 1 : 0);
