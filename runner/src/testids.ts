// `testids`: compares the UI elements named in the cases ([ui: some-id]) with the testIDs that exist in the app.
// Missing ones are written to docs/qa-team/testid-requests.md for the app developers.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, walk } from './lib.ts';
import { appTestIds, idMatches } from './lint.ts';

export function testIdReport(): { text: string; missing: Record<string, string[]>; checked: number } {
  const ids = appTestIds();
  const wanted = new Map<string, Set<string>>(); // ui id -> cases
  for (const f of walk(path.join(ROOT, 'docs/cases')).filter((p) => p.endsWith('.md'))) {
    let current = '';
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const h = line.match(/^## ([a-z]+-\d{3}):/);
      if (h) current = h[1];
      for (const m of line.matchAll(/\[ui:\s*([^\]]+)\]/g))
        for (const id of m[1].split(',').map((s) => s.trim()).filter(Boolean)) wanted.set(id, (wanted.get(id) ?? new Set()).add(current));
    }
  }
  const missing: Record<string, string[]> = {};
  for (const [id, cases] of wanted) if (!idMatches(id, ids)) missing[id] = [...cases];
  const L = ['# testID requests', '', 'Written by `runner testids`. The cases name these UI elements, but the app has no such testID yet. The Automation engineer cannot automate the blocked cases until they exist.', '',
    '| Missing testID | Blocks case(s) |', '|---|---|'];
  for (const [id, cs] of Object.entries(missing)) L.push(`| \`${id}\` | ${cs.join(', ')} |`);
  if (!Object.keys(missing).length) L.push('| none | |');
  L.push('', `${wanted.size} UI elements named in cases, ${wanted.size - Object.keys(missing).length} exist in the app, ${Object.keys(missing).length} missing.`, '');
  return { text: L.join('\n'), missing, checked: wanted.size };
}
