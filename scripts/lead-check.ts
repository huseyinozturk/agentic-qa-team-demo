// The Lead's evidence checks, as code. A handoff is accepted only if what it claims can be re-derived.
//   node scripts/lead-check.ts [--review file] [--apply]
//   --review  compare the Lead's review note (accepted/rejected lists) with the mechanical result
//   --apply   write status: rejected (and the reason) into rejected task files
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRuns, arg } from '../runner/src/lib.ts';
import { lint } from '../runner/src/lint.ts';
import { redact } from './redact.ts';
import { batches } from '../runner/src/report.ts';

const TASK_DIR = path.join(ROOT, 'docs/qa-team/lead/tasks');
const args = process.argv.slice(2);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
const tracker = JSON.parse(read('fixtures/tracker.json')).tickets as { key: string; acceptanceCriteria: string[]; comments: { id: string }[] }[];

function frontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return Object.fromEntries((m?.[1] ?? '').split('\n').map((l) => [l.split(':')[0].trim(), l.slice(l.indexOf(':') + 1).trim()]));
}
const section = (text: string, name: string) => text.match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1].trim() ?? '';
const paths = (s: string) => [...s.matchAll(/`((?:docs|e2e|results)\/[^`\s]+)`/g)].map((m) => m[1]);

type Verdict = { id: string; to: string; ok: boolean; reasons: string[]; file: string };

function checkCaseDraft(file: string, reasons: string[]) {
  const text = read(file);
  const steps = text.split('\n').filter((l) => /^\d+\.\s/.test(l));
  steps.forEach((s) => { if (!/Source:\s*\S/.test(s)) reasons.push(`step without a Source: "${s.slice(0, 70)}"`); });
  for (const m of text.matchAll(/Source:\s*(TE-\d+)\s+AC(\d+)/g)) {
    const t = tracker.find((x) => x.key === m[1]);
    if (!t) reasons.push(`source ticket ${m[1]} does not exist`);
    else if (!t.acceptanceCriteria.some((a) => a.startsWith(`AC${m[2]}:`))) reasons.push(`source "${m[1]} AC${m[2]}" does not exist (${m[1]} has ${t.acceptanceCriteria.length} acceptance criteri${t.acceptanceCriteria.length === 1 ? "on" : "a"})`);
  }
  const ids = [...text.matchAll(/^## ([a-z]+-\d{3}):/gm)].map((m) => m[1]);
  const index = read('docs/cases/index.md');
  ids.forEach((id) => { if (index.includes(`| ${id} |`)) reasons.push(`case id ${id} already exists in the index`); });
}

function check(file: string): Verdict {
  const text = fs.readFileSync(file, 'utf8');
  const fm = frontmatter(text);
  const reasons: string[] = [];
  const ev = section(text, 'Evidence');
  const result = section(text, 'Result');
  const rel = path.relative(ROOT, file);

  if (fm.status === 'done') {
    if (!ev || !/^- /m.test(ev)) reasons.push('status is done but the Evidence section is empty');
    for (const p of [...paths(ev), ...paths(result)]) if (!exists(p)) reasons.push(`cited file does not exist: ${p}`);

    if (fm.to === 'analyst') for (const p of paths(result).filter((p) => p.startsWith('docs/cases/drafts/') && exists(p))) checkCaseDraft(p, reasons);

    if (fm.to === 'automation-engineer') {
      const l = lint();
      if (l.errors.length) reasons.push(`lint fails: ${l.errors[0]}`);
      const runId = ev.match(/runId\s+`([^`]+)`/)?.[1];
      if (!runId) reasons.push('no runId in Evidence');
      else {
        const r = loadRuns().find((x) => x.runId === runId);
        if (!r) reasons.push(`runId ${runId} not found in results/runs.jsonl`);
        else if (!r.ok) reasons.push(`runId ${runId} did not pass`);
      }
      for (const p of paths(result).filter((p) => p.endsWith('.yaml') && exists(p))) {
        const body = read(p);
        if (/^\s+-\s+smoke\s*$/m.test(body)) reasons.push(`${p} adds the smoke tag (owner decision)`);
        if (!/^# case: /m.test(body) || !/^# tickets: /m.test(body) || !/^tags:/m.test(body)) reasons.push(`${p}: header incomplete`);
      }
    }

    if (fm.to === 'runner') {
      const rep = paths(ev).find((p) => p.includes('nightly'));
      const bs = batches();
      const cur = bs[bs.length - 1];
      if (!rep || !cur) reasons.push('no nightly report or no run batch to recount');
      else {
        const pass = cur.runs.filter((r) => r.ok).length;
        const fail = cur.runs.length - pass;
        if (!read(rep).includes(`Pass: ${pass} / Fail: ${fail}`)) reasons.push(`report counts differ from results/runs.jsonl (recount: Pass: ${pass} / Fail: ${fail})`);
      }
    }

    if (fm.to === 'watcher') {
      const rep = paths(ev).find((p) => /watch\/\d{4}-\d\d-\d\d\.md$/.test(p));
      if (!rep || !exists(rep)) reasons.push('watch report missing');
      else {
        const body = read(rep);
        const data = JSON.parse(read(rep.replace(/\.md$/, '-data.json')));
        if (Object.keys(redact(body).hits).length) reasons.push('report contains a secret-like value');
        if (!/Not acted on/i.test(body)) reasons.push('instruction-like texts are not marked "Not acted on"');
        for (const s of data.injectionSuspects as { text: string }[]) if (!body.includes(s.text)) reasons.push(`instruction-like text not quoted verbatim: "${s.text.slice(0, 50)}..."`);
        for (const t of data.tickets as { key: string }[]) if (!body.includes(t.key)) reasons.push(`changed ticket ${t.key} is missing from the report`);
      }
    }
  }
  return { id: fm.id, to: fm.to, ok: reasons.length === 0, reasons, file: rel };
}

const files = fs.readdirSync(TASK_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md').sort().map((f) => path.join(TASK_DIR, f));
const verdicts = files.map(check);
for (const v of verdicts) {
  console.log(`${v.ok ? 'ACCEPT' : 'REJECT'}  ${v.id}  (${v.to})`);
  v.reasons.forEach((r) => console.log(`          - ${r}`));
}

let exit = 0;
const reviewFile = arg(args, 'review');
if (reviewFile) {
  const rv = frontmatter(fs.readFileSync(path.resolve(reviewFile), 'utf8'));
  const list = (s: string) => s.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean);
  const accepted = list(rv.accepted ?? ''), rejected = list(rv.rejected ?? '');
  const mismatches = verdicts.filter((v) => (v.ok && !accepted.includes(v.id)) || (!v.ok && !rejected.includes(v.id)));
  if (mismatches.length) { console.log(`\nreview note disagrees with the mechanical check on: ${mismatches.map((m) => m.id).join(', ')}`); exit = 1; }
  else console.log(`\nreview note agrees with the mechanical check: ${accepted.length} accepted, ${rejected.length} rejected`);
}
if (args.includes('--apply')) {
  for (const v of verdicts.filter((x) => !x.ok)) {
    const p = path.join(ROOT, v.file);
    const t = fs.readFileSync(p, 'utf8').replace(/^status: done$/m, 'status: rejected');
    fs.writeFileSync(p, `${t.trimEnd()}\n\n## Review\nRejected by the Lead:\n${v.reasons.map((r) => `- ${r}`).join('\n')}\n`);
    console.log(`applied: ${v.id} -> status: rejected`);
  }
}
process.exit(exit);
