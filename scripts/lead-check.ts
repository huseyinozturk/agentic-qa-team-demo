// The Lead's evidence checks, as code. A handoff is accepted only if what it claims can be re-derived.
//   node scripts/lead-check.ts [--review file] [--apply]
//   --review  compare the Lead's review note (accepted/rejected lists) with the mechanical result
//   --apply   write status: rejected (and the reason) into rejected task files
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRuns, arg, walk } from '../runner/src/lib.ts';
import { lint } from '../runner/src/lint.ts';
import { redact } from './redact.ts';
import { batches } from '../runner/src/report.ts';

const TASK_DIR = path.join(ROOT, 'docs/qa-team/lead/tasks');
const args = process.argv.slice(2);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
const tracker = JSON.parse(read('fixtures/tracker.json')).tickets as { key: string; acceptanceCriteria: string[] }[];
const DOCS: Record<string, string> = { PRD: 'fixtures/docs/prd.md', API: 'fixtures/docs/api-spec.md', Design: 'fixtures/docs/design-notes.md' };

function frontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return Object.fromEntries((m?.[1] ?? '').split('\n').map((l) => [l.split(':')[0].trim(), l.slice(l.indexOf(':') + 1).trim()]));
}
const section = (text: string, name: string) => text.match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1].trim() ?? '';
const paths = (s: string) => [...s.matchAll(/`((?:docs|e2e|results)\/[^`\s]+)`/g)].map((m) => m[1]);

type Verdict = { id: string; to: string; ok: boolean; reasons: string[]; file: string };

function clarificationStatus(id: string): string | null {
  const f = 'docs/cases/clarifications.md';
  if (!exists(f)) return null;
  const m = read(f).match(new RegExp(`^## ${id}:[^\\n]*\\nstatus: (\\w+)`, 'm'));
  return m ? m[1] : null;
}

// Every case, step and expectation must name a source that really exists.
function checkCaseFile(file: string, reasons: string[], seen: Map<string, string>) {
  const blocks = read(file).split(/^## /m).slice(1);
  for (const b of blocks) {
    const id = b.match(/^([a-z]+-\d{3}):/)?.[1];
    if (!id) continue; // not a case (for example the clarifications file)
    if (seen.has(id) && seen.get(id) !== file) reasons.push(`case id ${id} is defined twice (${seen.get(id)} and ${file})`);
    seen.set(id, file);
    const blocked = /status: blocked/.test(b);
    for (const line of b.split('\n').filter((l) => /^\d+\.\s/.test(l))) {
      const src = line.match(/Source:\s*(.*)$/)?.[1];
      if (!src) { reasons.push(`${id}: step without a Source: "${line.slice(0, 60)}"`); continue; }
      for (const tok of src.split(',').map((s) => s.trim())) {
        let m: RegExpMatchArray | null;
        if ((m = tok.match(/^(PRD|API|Design) §(\d+\.\d+)$/))) {
          if (!read(DOCS[m[1]]).includes(`§${m[2]} `)) reasons.push(`${id}: source "${tok}" does not exist`);
        } else if ((m = tok.match(/^(TE-\d+) AC(\d+)$/))) {
          const t = tracker.find((x) => x.key === m![1]);
          if (!t) reasons.push(`${id}: source ticket ${m[1]} does not exist`);
          else if (!t.acceptanceCriteria.some((a) => a.startsWith(`AC${m![2]}:`))) reasons.push(`${id}: source "${tok}" does not exist (${m[1]} has ${t.acceptanceCriteria.length} acceptance criteri${t.acceptanceCriteria.length === 1 ? 'on' : 'a'})`);
        } else if ((m = tok.match(/^Clarification (C\d+)$/))) {
          const st = clarificationStatus(m[1]);
          if (!st) reasons.push(`${id}: source "${tok}" does not exist`);
          else if (st !== 'answered' && !blocked) reasons.push(`${id}: is marked ready but "${tok}" is still ${st}`);
        } else reasons.push(`${id}: unknown source format "${tok}"`);
      }
    }
  }
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

    if (fm.to === 'analyst') {
      const seen = new Map<string, string>();
      // cases in other files count for duplicate detection
      for (const f of walk(path.join(ROOT, 'docs/cases')).filter((x) => x.endsWith('.md') && !/clarifications|README/.test(x)).map((x) => path.relative(ROOT, x)))
        if (!paths(result).includes(f)) for (const m of read(f).matchAll(/^## ([a-z]+-\d{3}):/gm)) seen.set(m[1], f);
      for (const p of paths(result).filter((p) => p.startsWith('docs/cases/') && p.endsWith('.md') && exists(p))) checkCaseFile(p, reasons, seen);
    }

    if (fm.to === 'automation-engineer') {
      const l = lint();
      if (l.errors.length) reasons.push(`lint fails: ${l.errors[0]}`);
      const runs = [...ev.matchAll(/runId\s+`([^`]+)`\s+(ok|failed)/g)];
      if (!runs.length) reasons.push('no runId with a stated result in Evidence');
      for (const [, runId, claimed] of runs) {
        const r = loadRuns().find((x) => x.runId === runId);
        if (!r) reasons.push(`runId ${runId} not found in results/runs.jsonl`);
        else if (r.ok !== (claimed === 'ok')) reasons.push(`runId ${runId}: Evidence says ${claimed}, the run log says ${r.ok ? 'ok' : 'failed'}`);
      }
      for (const p of paths(result).filter((p) => p.endsWith('.yaml') && exists(p))) {
        const body = read(p);
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
        const body = read(rep);
        if (!body.includes(`Pass: ${pass} / Fail: ${fail}`)) reasons.push(`report counts differ from results/runs.jsonl (recount: Pass: ${pass} / Fail: ${fail})`);
        const h = cur.runs[0].host;
        if (h && !body.includes(`Swap used: ${h.swapGb} GB`)) reasons.push('report host metrics differ from the run records');
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
