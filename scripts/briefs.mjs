// Turns the recorded handoff samples into open task briefs (frontmatter + "Ask" only).
// Used by `demo.sh --agents`: the Lead's briefs exist, the real agents fill in the rest.
//   node scripts/briefs.mjs <task-id>...
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const id of process.argv.slice(2)) {
  const src = fs.readFileSync(path.join(root, 'samples/tasks', `${id}.md`), 'utf8');
  const fm = src.match(/^---\n[\s\S]*?\n---/)[0].replace(/^status: .*$/m, 'status: open');
  const ask = src.match(/^## Ask\n[\s\S]*?(?=^## )/m)[0].trimEnd();
  fs.writeFileSync(path.join(root, 'docs/qa-team/lead/tasks', `${id}.md`), `${fm}\n${ask}\n\n## Result\n\n## Evidence\n\n## Open questions\n`);
  console.log(`brief written: docs/qa-team/lead/tasks/${id}.md (status: open)`);
}
