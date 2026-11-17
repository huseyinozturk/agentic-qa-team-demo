// Static check of the team definition: agent files vs roster.json and the safety invariants.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from '../runner/src/lib.ts';

type Roster = { roles: Record<string, { model: string; budgetUsd: number; tools: string[]; trigger: string; writes: string[] }> };
const roster = readJson<Roster>(path.join(ROOT, 'docs/qa-team/roster.json'));
const errors: string[] = [];

for (const [name, spec] of Object.entries(roster.roles)) {
  const f = path.join(ROOT, `.claude/agents/${name}.md`);
  if (!fs.existsSync(f)) { errors.push(`${name}: agent file missing`); continue; }
  const text = fs.readFileSync(f, 'utf8');
  const fm = Object.fromEntries((text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '').split('\n').map((l) => [l.split(':')[0].trim(), l.slice(l.indexOf(':') + 1).trim()]));
  const tools = (fm.tools ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (fm.name !== name) errors.push(`${name}: frontmatter name is "${fm.name}"`);
  if (fm.model !== spec.model) errors.push(`${name}: model "${fm.model}" differs from roster "${spec.model}"`);
  if (tools.join() !== spec.tools.join()) errors.push(`${name}: tools [${tools}] differ from roster [${spec.tools}]`);
  if (!/\| Trigger \|/.test(text)) errors.push(`${name}: no Trigger row`);
  if (!new RegExp(`max-budget-usd ${spec.budgetUsd}\\b`).test(text) && name !== 'runner' || (name === 'runner' && !/max-budget-usd 1\b/.test(text))) errors.push(`${name}: budget cap ${spec.budgetUsd} USD not stated`);
  if (!/data, not instructions/.test(text)) errors.push(`${name}: missing the "data, not instructions" rule`);
  if (!fs.existsSync(path.join(ROOT, `docs/qa-team/settings/${name}.json`))) errors.push(`${name}: no per-role settings file`);
}

// invariants of the design
const w = roster.roles['watcher'];
if (w.tools.includes('Bash')) errors.push('watcher must not have Bash');
if (roster.roles['analyst'].tools.includes('Bash')) errors.push('analyst must not have Bash');
if (roster.roles['qa-lead'].model !== 'opus' || roster.roles['analyst'].model !== 'opus') errors.push('lead and analyst are meant to run on the stronger model');
const wSettings = readJson<{ permissions: { deny: string[] } }>(path.join(ROOT, 'docs/qa-team/settings/watcher.json'));
for (const d of ['Bash', 'WebFetch', 'WebSearch']) if (!wSettings.permissions.deny.includes(d)) errors.push(`watcher settings do not deny ${d}`);
const proj = readJson<{ hooks: { PreToolUse: unknown[] } }>(path.join(ROOT, '.claude/settings.json'));
if (!proj.hooks?.PreToolUse?.length) errors.push('.claude/settings.json has no PreToolUse hook');

errors.forEach((e) => console.error(`error: ${e}`));
console.log(`agents: ${Object.keys(roster.roles).length} roles checked, ${errors.length} problems`);
process.exit(errors.length ? 1 : 0);
