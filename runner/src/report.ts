// `report`: table of the latest batch, or the nightly report (failure classes + evidence).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRuns, loadFlows, FAILURE_CLASSES, type RunRecord } from './lib.ts';

const KNOWN_FILE = path.join(ROOT, 'docs/qa-team/runs/known-findings.md');

export function loadKnown(): Record<string, { ticket: string; note: string }> {
  const out: Record<string, { ticket: string; note: string }> = {};
  if (!fs.existsSync(KNOWN_FILE)) return out;
  for (const line of fs.readFileSync(KNOWN_FILE, 'utf8').split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length > 4 && /^[a-z]+-\d{3}$/.test(c[1])) out[c[1]] = { ticket: c[3], note: c[4] };
  }
  return out;
}

export function batches(suite = 'regression'): { id: string; runs: RunRecord[] }[] {
  const by = new Map<string, RunRecord[]>();
  for (const r of loadRuns().filter((r) => r.suite === suite)) by.set(r.batchId, [...(by.get(r.batchId) ?? []), r]);
  return [...by.entries()].map(([id, runs]) => ({ id, runs })).sort((a, b) => a.id.localeCompare(b.id));
}

const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function nightlyReport(): { text: string; date: string } {
  const bs = batches();
  if (!bs.length) throw new Error('no regression batches in results/runs.jsonl - run a suite first');
  const cur = bs[bs.length - 1];
  const prev = bs.length > 1 ? bs[bs.length - 2] : null;
  const known = loadKnown();
  const tickets = Object.fromEntries(loadFlows().map((f) => [f.caseId, f.tickets.join(', ')]));
  const platforms = [...new Set(cur.runs.map((r) => r.platform))];
  const date = new Date(Date.parse(cur.runs[0].startedAt) + 12 * 3600e3).toISOString().slice(0, 10);
  const failed = cur.runs.filter((r) => !r.ok);
  const prevFailed = new Set((prev?.runs ?? []).filter((r) => !r.ok).map((r) => r.caseId));
  const prevDur = new Map((prev?.runs ?? []).map((r) => [r.caseId, r.durationMs]));

  const L: string[] = [];
  L.push(`# Nightly report ${date}`, '');
  L.push(`Batch: \`${cur.id}\` (${cur.runs[0].mode} run, environment \`${cur.runs[0].env}\`). Source: \`results/runs.jsonl\`. Counts are computed by \`runner report --nightly\`, not estimated.`, '');
  L.push('## Result', '');
  for (const p of platforms) {
    const rs = cur.runs.filter((r) => r.platform === p);
    L.push(`- **${p}**: Pass: ${rs.filter((r) => r.ok).length} / Fail: ${rs.filter((r) => !r.ok).length} (of ${rs.length})`);
  }
  L.push('', '## Failure classes (suggested)', '', '| Class | Count |', '|---|---|');
  for (const c of FAILURE_CLASSES) L.push(`| ${c} | ${failed.filter((r) => r.failureClass === c).length} |`);
  L.push('', '## Failures', '', '| Case | Tickets | Suggested class | Evidence | Status |', '|---|---|---|---|---|');
  for (const r of failed) {
    const k = known[r.caseId];
    const status = k ? `known finding ${k.ticket}` : prevFailed.has(r.caseId) ? 'failed last night too' : '**new since last night**';
    L.push(`| ${r.caseId} | ${tickets[r.caseId] ?? '?'} | ${r.failureClass} | \`${r.error}\` (log: \`${r.logPath}\`) | ${status} |`);
  }
  if (!failed.length) L.push('| none | | | | |');
  const recovered = [...prevFailed].filter((c) => cur.runs.find((r) => r.caseId === c)?.ok);
  L.push('', '## Changes since last night', '');
  L.push(prev ? `- Previous batch: \`${prev.id}\`.` : '- No previous batch.');
  L.push(`- New failures: ${failed.filter((r) => !prevFailed.has(r.caseId)).map((r) => r.caseId).join(', ') || 'none'}`);
  L.push(`- Recovered: ${recovered.join(', ') || 'none'}`);
  L.push('', '## Durations', '');
  const total = cur.runs.reduce((s, r) => s + r.durationMs, 0);
  L.push(`- Total: ${sec(total)}${prev ? ` (last night ${sec(prev.runs.reduce((s, r) => s + r.durationMs, 0))})` : ''}`);
  const slow = cur.runs.filter((r) => prevDur.has(r.caseId) && r.durationMs > prevDur.get(r.caseId)! * 1.3);
  L.push(`- Runs more than 30% slower than last night: ${slow.map((r) => `${r.caseId} (${sec(prevDur.get(r.caseId)!)} -> ${sec(r.durationMs)})`).join(', ') || 'none'}`);
  const h = cur.runs[0].host, ph = prev?.runs[0].host;
  L.push('', '## System (host the devices run on)', '');
  if (h) {
    const d = (old?: number, unit = '') => (old === undefined ? '' : ` (last night ${old}${unit})`);
    L.push(`- Peak CPU: ${h.peakCpuPct}%${d(ph?.peakCpuPct, '%')}`);
    L.push(`- Minimum free memory: ${h.minFreeMemMb} MB${d(ph?.minFreeMemMb, ' MB')}`);
    L.push(`- Swap used: ${h.swapGb} GB${d(ph?.swapGb, ' GB')}`);
    L.push(`- Disk free: ${h.diskFreeGb} GB${d(ph?.diskFreeGb, ' GB')}`);
    const warn: string[] = [];
    if (h.swapGb > 4) warn.push(`swap above 4 GB${failed.some((r) => r.failureClass === 'driver') ? ': this can make the device driver fail, so the driver failure above may be load, not the app' : ''}`);
    if (h.minFreeMemMb < 1000) warn.push('free memory under 1000 MB');
    if (h.diskFreeGb < 20) warn.push('free disk under 20 GB');
    L.push(warn.length ? `- **Attention:** ${warn.join('; ')}` : '- All host metrics within limits.');
  } else L.push('- No host metrics recorded.');
  L.push('', '## Notes', '', '- Failure classes are suggestions. A person confirms them (a "selector" class can hide an app bug).',
    '- Known findings are listed in `docs/qa-team/runs/known-findings.md` (owner-edited).', '');
  return { text: L.join('\n'), date };
}

export function latestTable(suite?: string): string {
  const bs = batches(suite ?? 'regression');
  if (!bs.length) return 'no runs yet';
  const cur = bs[bs.length - 1];
  return [`batch ${cur.id}`, ...cur.runs.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.caseId.padEnd(14)} ${sec(r.durationMs).padStart(7)}  ${r.failureClass ?? ''}`)].join('\n');
}
