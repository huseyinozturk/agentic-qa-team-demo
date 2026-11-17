// Parses the case documents in docs/cases/ (shared by the summary command and the visual builder).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, walk } from '../runner/src/lib.ts';

export type Case = { id: string; title: string; type: string; suite: string; tickets: string[]; status: string; steps: number; sourced: number; ui: string[]; file: string };

export function parseCases(): Case[] {
  const out: Case[] = [];
  for (const f of walk(path.join(ROOT, 'docs/cases')).filter((p) => p.endsWith('.md') && !/clarifications|README/.test(p) && !p.includes('/drafts/')).sort()) {
    for (const b of fs.readFileSync(f, 'utf8').split(/^## /m).slice(1)) {
      const h = b.match(/^([a-z]+-\d{3}): (.*)$/m);
      if (!h) continue;
      const meta = b.match(/^type: (.*?) \| suite: (.*?) \| tickets: (.*?) \| status: (.*)$/m);
      const steps = b.split('\n').filter((l) => /^\d+\.\s/.test(l));
      out.push({
        id: h[1], title: h[2], type: meta?.[1] ?? '?', suite: meta?.[2] ?? '?', tickets: (meta?.[3] ?? '').split(',').map((s) => s.trim()), status: meta?.[4] ?? '?',
        steps: steps.length, sourced: steps.filter((l) => /Source:\s*\S/.test(l)).length,
        ui: [...b.matchAll(/\[ui:\s*([^\]]+)\]/g)].flatMap((m) => m[1].split(',').map((s) => s.trim())), file: path.relative(ROOT, f),
      });
    }
  }
  return out;
}

if (process.argv[1].endsWith('cases-lib.ts')) {
  const cases = parseCases();
  const by = (k: (c: Case) => string) => cases.reduce<Record<string, number>>((m, c) => ((m[k(c)] = (m[k(c)] ?? 0) + 1), m), {});
  console.log(`${cases.length} cases, ${cases.reduce((n, c) => n + c.steps, 0)} steps, ${cases.reduce((n, c) => n + c.sourced, 0)} with a named source`);
  console.log('by type:  ', Object.entries(by((c) => c.type)).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('by suite: ', Object.entries(by((c) => c.suite)).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('by status:', Object.entries(by((c) => c.status.replace(/ by .*/, ''))).map(([k, v]) => `${k} ${v}`).join(', '));
}
