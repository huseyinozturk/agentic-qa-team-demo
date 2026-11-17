// Builds docs/visual/index.html: a self-contained, animated walkthrough made from the REAL outputs of the last demo run.
//   node scripts/build-visual.ts      (run ./scripts/demo.sh first)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadFlows, loadRuns, readJson, type RunRecord } from '../runner/src/lib.ts';
import { batches, loadKnown } from '../runner/src/report.ts';
import { testIdReport } from '../runner/src/testids.ts';
import { parseCases } from './cases-lib.ts';

const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
for (const p of ['results/runs.jsonl', 'docs/qa-team/lead/intake.json', 'docs/qa-team/lead/strategy.json', 'docs/qa-team/watch/2025-03-14-data.json', 'docs/qa-team/cost.tsv', 'docs/cases/clarifications.md', 'results/mock-tracker-out.json'])
  if (!exists(p)) { console.error(`missing ${p}: run ./scripts/demo.sh first`); process.exit(1); }

const roster = readJson<{ roles: Record<string, unknown> }>(path.join(ROOT, 'docs/qa-team/roster.json')).roles;

// phase 1: documents and tickets by area with the Lead's test types
const intake = JSON.parse(read('docs/qa-team/lead/intake.json'));
const strat = JSON.parse(read('docs/qa-team/lead/strategy.json')) as { items: { ticket: string; types: string[]; why: string }[] };
const areas = Object.entries(intake.areas as Record<string, { key: string; summary: string; status: string }[]>).map(([name, ts]) => ({
  name, tickets: ts.map((t) => ({ ...t, types: strat.items.find((i) => i.ticket === t.key)?.types ?? [] })),
}));

// phase 2: cases, clarifications, suites
const cases = parseCases();
const clar = read('docs/cases/clarifications.md').split(/^## /m).slice(1).map((b) => {
  const f = (k: string) => b.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1] ?? '';
  return { id: b.match(/^(C\d+):/)?.[1], title: b.match(/^C\d+: (.*)$/m)?.[1], status: f('status'), to: f('to'), conflict: f('conflict'), blocks: f('blocks'), answer: f('answer'), resolution: f('resolution') };
});
const approved = readJson<{ smoke: string[]; critical: string[] }>(path.join(ROOT, 'e2e/smoke-allowlist.json'));

// phase 3: automation
const flows = loadFlows().map((f) => ({ id: f.caseId, name: f.name, tags: f.tags }));
const testids = testIdReport();
const runs = loadRuns();
const batchRecs = (suite: string) => runs.filter((r) => r.suite === suite);
const firstRun = batchRecs('first-run');
const pack = (rs: RunRecord[]) => rs.map((r) => ({ caseId: r.caseId, ok: r.ok, failureClass: r.failureClass, error: r.error, logPath: r.logPath, durationMs: r.durationMs }));

// phase 4: runner
const plan = readJson<{ plans: unknown[] }>(path.join(ROOT, 'e2e/test-plan.json')).plans;
const nights = batches('regression').map((b, i) => ({ label: `Night ${i + 1}`, env: b.runs[0].env, host: b.runs[0].host, runs: pack(b.runs) }));
const smoke = batches('smoke').map((b) => ({ label: 'Smoke on the new build', env: b.runs[0].env, host: b.runs[0].host, runs: pack(b.runs) }));

// phase 5: tickets
const drafts = JSON.parse(read('docs/qa-team/lead/tickets-to-file.json')).drafts;
const filed = JSON.parse(read('results/mock-tracker-out.json')).filed as { id: string; filedAs: string }[];

// phase 6: watcher
const data = JSON.parse(read('docs/qa-team/watch/2025-03-14-data.json'));
const te150 = data.tickets.find((t: any) => t.key === 'TE-150');
const chat = data.chat.flatMap((c: any) => c.messages.map((m: any) => ({ channel: c.channel, ...m }))).filter((m: any) => /Build|OTP|Staging/.test(m.text));
const newRun = runs.find((r) => r.caseId === 'auth-004');
const rawToken = (read('fixtures/tracker.json').match(/Bearer (eyJ[A-Za-z0-9._-]{10,})/)?.[1] ?? '').slice(0, 24);
const cleanToken = JSON.stringify(data).match(/Bearer (\[REDACTED:[a-z-]+\])/)?.[1] ?? '[REDACTED]';

// review + cost
const tdir = path.join(ROOT, 'docs/qa-team/lead/tasks');
const verdicts = fs.readdirSync(tdir).filter((f) => f.startsWith('20')).sort().map((f) => {
  const t = fs.readFileSync(path.join(tdir, f), 'utf8');
  const fm = (k: string) => t.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1] ?? '';
  const rejected = fm('status') === 'rejected';
  return { id: fm('id'), to: fm('to'), ok: !rejected, reasons: rejected ? [...(t.split('## Review')[1] ?? '').matchAll(/^- (.*)$/gm)].map((m) => m[1]) : [] };
}).sort((a, b) => Number(a.ok) - Number(b.ok));
const [h, ...rows] = read('docs/qa-team/cost.tsv').trim().split('\n').map((l) => l.split('\t'));
const per = new Map<string, number>();
for (const r of rows) per.set(r[h.indexOf('role')], (per.get(r[h.indexOf('role')]) ?? 0) + Number(r[h.indexOf('usd')]));
const cost = [...per].map(([role, usd]) => ({ role, usd, cap: (roster as any)[role].budgetUsd }));

const payload = {
  roster, intake: { documents: intake.documents }, areas, cases, clar, approved,
  flows, missingIds: testids.missing, firstRun: pack(firstRun),
  plan, nights, smoke, known: loadKnown(), drafts, filed,
  watch: { te150: { changes: te150.changes, summary: te150.summary }, chat, suspects: data.injectionSuspects, hits: data.redaction.hits, rawToken, cleanToken, tickets: data.tickets.length, messages: data.chat.reduce((n: number, c: any) => n + c.messages.length, 0) },
  newRun: newRun ? { runId: newRun.runId, durationMs: newRun.durationMs } : null, verdicts, cost,
};

const html = read('scripts/visual/template.html').replace('/*DATA*/null', JSON.stringify(payload).replace(/</g, '\\u003c'));
const out = path.join(ROOT, 'docs/visual/index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`visual walkthrough written: ${path.relative(ROOT, out)} (open it in a browser)`);
