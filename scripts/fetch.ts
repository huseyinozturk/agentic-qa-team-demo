// Fetch step: the ONLY code that reads the tracker and chat. Agents never touch those systems.
// Reads fixtures (mock Jira/Slack), keeps what changed in the window, redacts secrets,
// maps tickets to flows and case documents, flags instruction-like text, writes one JSON file.
//   node scripts/fetch.ts [--since ISO] [--until ISO] [--out file]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadFlows, arg } from '../runner/src/lib.ts';
import { redact, looksLikeInstruction } from './redact.ts';

const args = process.argv.slice(2);
const until = arg(args, 'until') ?? '2025-03-14T08:00:00Z';
const since = arg(args, 'since') ?? '2025-03-13T08:00:00Z';
const out = arg(args, 'out') ?? path.join(ROOT, `docs/qa-team/watch/${until.slice(0, 10)}-data.json`);
const inWindow = (iso: string) => iso >= since && iso < until;

const tracker = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/tracker.json'), 'utf8'));
const chat = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/chat.json'), 'utf8'));

const totalHits: Record<string, number> = {};
const clean = <T>(v: T): T => {
  const r = redact(JSON.stringify(v));
  for (const [k, n] of Object.entries(r.hits)) totalHits[k] = (totalHits[k] ?? 0) + n;
  return JSON.parse(r.text) as T;
};

const tickets = tracker.tickets.filter((t: any) => inWindow(t.updatedAt));
const messages = chat.channels.map((c: any) => ({ channel: c.name, messages: c.messages.filter((m: any) => inWindow(m.ts)) }));

// ticket -> flows (by header) and case documents (by grep)
const casesByTicket: Record<string, { flows: string[]; docs: string[] }> = {};
const caseLines = fs.readFileSync(path.join(ROOT, 'docs/cases/index.md'), 'utf8').split('\n');
const flows = loadFlows();
for (const t of tracker.tickets) {
  const f = flows.filter((x) => x.tickets.includes(t.key)).map((x) => `${x.caseId} (${x.file})`);
  const d = caseLines.map((l, i) => (l.includes(t.key) ? `docs/cases/index.md:${i + 1}` : '')).filter(Boolean);
  if (f.length || d.length) casesByTicket[t.key] = { flows: f, docs: d };
}

const injectionSuspects: { source: string; text: string }[] = [];
for (const t of tickets) for (const c of t.comments) if (looksLikeInstruction(c.body)) injectionSuspects.push({ source: `${t.key} comment ${c.id} by ${c.author}`, text: c.body });
for (const c of messages) for (const m of c.messages) if (looksLikeInstruction(m.text)) injectionSuspects.push({ source: `${c.channel} message at ${m.ts} by ${m.author}`, text: m.text });

const data = clean({ window: { since, until }, tickets, chat: messages, casesByTicket, injectionSuspects });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ ...data, redaction: { hits: totalHits } }, null, 2) + '\n');

const raw = fs.readFileSync(out, 'utf8');
console.log(`fetched ${tickets.length} of ${tracker.tickets.length} tickets, ${messages.reduce((n: number, c: any) => n + c.messages.length, 0)} chat messages (window ${since} .. ${until})`);
console.log(`redacted: ${Object.entries(totalHits).map(([k, n]) => `${k} x${n}`).join(', ') || 'nothing'}`);
console.log(`instruction-like texts flagged: ${injectionSuspects.length} (to be quoted as data, never acted on)`);
console.log(`secret still present in output: ${/eyJhbGci|FAKE-0123/.test(raw) ? 'YES (bug!)' : 'no'}`);
console.log(`written: ${path.relative(ROOT, out)}`);
