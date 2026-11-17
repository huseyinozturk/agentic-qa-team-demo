// Files the Lead's draft tickets into the MOCK tracker, but only the ones the owner approved.
// Writing to a tracker is an outward action: without approval nothing happens.
//   node scripts/file-tickets.ts                     shows the drafts and refuses
//   node scripts/file-tickets.ts --approve D1,D3     files only those
//   node scripts/file-tickets.ts --approve-all       (the owner approves every draft)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, arg } from '../runner/src/lib.ts';

type Draft = { id: string; action: 'comment' | 'create'; ticket?: string; type?: string; title: string; body: string; evidence: string };
const src = path.join(ROOT, 'docs/qa-team/lead/tickets-to-file.json');
const drafts = (JSON.parse(fs.readFileSync(src, 'utf8')) as { drafts: Draft[] }).drafts;
const args = process.argv.slice(2);

console.log('Drafts by the QA Lead:');
for (const d of drafts) console.log(`  ${d.id}  ${d.action === 'create' ? `new ${d.type}` : `comment on ${d.ticket}`}: ${d.title}`);

const approved = args.includes('--approve-all') ? drafts.map((d) => d.id) : (arg(args, 'approve') ?? '').split(',').filter(Boolean);
if (!approved.length) {
  console.log('\nBLOCKED: filing tickets is an outward action. The owner has not approved any draft.');
  process.exit(3);
}

const out = path.join(ROOT, 'results/mock-tracker-out.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
let next = 201;
const filed = drafts.filter((d) => approved.includes(d.id)).map((d) => ({ ...d, filedAs: d.action === 'create' ? `TE-${next++}` : `comment on ${d.ticket}`, approvedBy: 'owner' }));
fs.writeFileSync(out, JSON.stringify({ filed }, null, 2) + '\n');
console.log(`\nOwner approved ${approved.join(', ')}. Filed in the mock tracker (${path.relative(ROOT, out)}):`);
filed.forEach((f) => console.log(`  ${f.id} -> ${f.filedAs}`));
