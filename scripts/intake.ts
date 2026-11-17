// QA Lead, step 1: collect the project's documents and tickets and group them by area.
// The grouping is code; deciding which test TYPE fits each item is the Lead's judgement (strategy.json).
//   node scripts/intake.ts                 writes docs/qa-team/lead/intake.json
//   node scripts/intake.ts --verify file   checks a strategy file covers every ticket with a valid test type
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, arg } from '../runner/src/lib.ts';

const TYPES = ['unit', 'api', 'e2e-fe', 'none'];
const args = process.argv.slice(2);
const tracker = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/tracker.json'), 'utf8')).tickets as { key: string; area: string; summary: string; status: string }[];

const docs = [
  { file: 'fixtures/docs/prd.md', rank: 1, name: 'Product requirements' },
  { file: 'fixtures/docs/api-spec.md', rank: 2, name: 'API specification' },
  { file: 'fixtures/docs/design-notes.md', rank: 3, name: 'Design notes' },
].map((d) => ({ ...d, statements: (fs.readFileSync(path.join(ROOT, d.file), 'utf8').match(/^§\d+\.\d+/gm) ?? []).length }));

const areas: Record<string, { key: string; summary: string; status: string }[]> = {};
for (const t of tracker) (areas[t.area] ??= []).push({ key: t.key, summary: t.summary, status: t.status });

if (args.includes('--verify')) {
  const strat = JSON.parse(fs.readFileSync(path.resolve(arg(args, 'verify')!), 'utf8')) as { items: { ticket: string; types: string[] }[] };
  const problems: string[] = [];
  for (const t of tracker) {
    const it = strat.items.find((i) => i.ticket === t.key);
    if (!it) problems.push(`${t.key} is not covered by the strategy`);
    else if (!it.types.length || it.types.some((x) => !TYPES.includes(x))) problems.push(`${t.key} has an invalid test type: [${it.types}]`);
  }
  const counts: Record<string, number> = {};
  strat.items.forEach((i) => i.types.forEach((x) => (counts[x] = (counts[x] ?? 0) + 1)));
  problems.forEach((p) => console.error(`error: ${p}`));
  console.log(`strategy covers ${strat.items.length} of ${tracker.length} tickets; test types: ${Object.entries(counts).map(([k, v]) => `${k} x${v}`).join(', ')}`);
  process.exit(problems.length ? 1 : 0);
}

const out = path.join(ROOT, 'docs/qa-team/lead/intake.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ documents: docs, areas }, null, 2) + '\n');
console.log(`documents: ${docs.map((d) => `${d.name} (rank ${d.rank}, ${d.statements} statements)`).join('; ')}`);
console.log(`tickets: ${tracker.length} in ${Object.keys(areas).length} areas: ${Object.entries(areas).map(([a, t]) => `${a} (${t.length})`).join(', ')}`);
console.log(`written: ${path.relative(ROOT, out)}`);
