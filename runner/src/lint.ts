// Static checks for flows and for the app's testIDs.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, E2E_DIR, loadConfig, loadFlows, walk, readJson } from './lib.ts';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MODES = ['none', 'otp-delay', 'payment-declined', 'duplicate-webhook'];

export function appTestIds(): string[] {
  const ids: string[] = [];
  for (const f of walk(path.join(ROOT, 'app')).filter((p) => /\.tsx?$/.test(p) && !p.includes('node_modules'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/testID=(?:"([^"]+)"|\{(.*?)\}(?=[\s>/]))/g)) {
      if (m[1]) ids.push(m[1]);
      else for (const s of (m[2] ?? '').matchAll(/['`]([^'`]+)['`]/g)) ids.push(s[1]);
    }
    for (const m of src.matchAll(/\bid="([^"]+)"/g)) ids.push(m[1]);
  }
  return [...new Set(ids)];
}

export const idMatches = (selector: string, ids: string[]) =>
  ids.some((id) => id === selector || (id.includes('${') && new RegExp('^' + id.replace(/\$\{[^}]*\}/g, '.+') + '$').test(selector)));

export function lint(): { errors: string[]; checked: number; ids: number } {
  const errors: string[] = [];
  const cfg = loadConfig();
  const allow = readJson<Record<'smoke' | 'critical', string[]>>(path.join(E2E_DIR, 'smoke-allowlist.json'));
  const ids = appTestIds();

  for (const id of ids) {
    if (!KEBAB.test(id.replace(/\$\{[^}]*\}/g, 'x'))) errors.push(`app: testID "${id}" is not kebab-case`);
  }

  const seen = new Map<string, string>();
  const flows = loadFlows();
  for (const f of flows) {
    const at = (msg: string) => errors.push(`${f.file}: ${msg}`);
    if (!/^[a-z]+-\d{3}$/.test(f.caseId)) at(`header "case" missing or not like auth-001`);
    if (!f.tickets.length || f.tickets.some((t) => !/^[A-Z]+-\d+$/.test(t))) at('header "tickets" missing or malformed');
    if (!f.name) at('"name" missing');
    if (!f.tags.length) at('"tags" missing');
    for (const t of f.tags) if (!cfg.allowedTags.includes(t)) at(`tag "${t}" is not allowed`);
    for (const t of ['smoke', 'critical'] as const) if (f.tags.includes(t) && !allow[t].includes(f.caseId)) at(`tag "${t}" needs the owner to list ${f.caseId} in e2e/smoke-allowlist.json`);
    if (!MODES.includes(f.backendMode)) at(`unknown backend-mode "${f.backendMode}"`);
    if (!path.basename(f.file).startsWith(f.caseId)) at(`file name should start with the case id "${f.caseId}"`);
    if (seen.has(f.caseId)) at(`duplicate case id (also in ${seen.get(f.caseId)})`);
    seen.set(f.caseId, f.file);
    if (/optional:\s*true|retryTapIfNoChange|^\s*-\s*skip\b/m.test(f.body)) at('hides failures (optional/retryTapIfNoChange/skip) - not allowed');
    for (const m of f.body.matchAll(/\bid:\s*"?([A-Za-z0-9_-]+)"?/g)) {
      if (!idMatches(m[1], ids)) at(`selector id "${m[1]}" is not a testID in the app`);
    }
  }
  // subflows: selectors only
  for (const p of walk(path.join(E2E_DIR, 'subflows'))) {
    const body = fs.readFileSync(p, 'utf8');
    for (const m of body.matchAll(/\bid:\s*"?([A-Za-z0-9_-]+)"?/g))
      if (!idMatches(m[1], ids)) errors.push(`${path.relative(ROOT, p)}: selector id "${m[1]}" is not a testID in the app`);
  }
  return { errors, checked: flows.length, ids: ids.length };
}
