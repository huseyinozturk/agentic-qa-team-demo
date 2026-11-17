// `run`: executes a suite or one flow. Two modes:
//   recorded (default)  replays results from a recording file, deterministic, no device needed
//   live                resets the mock backend, runs `maestro test` per flow, classifies failures
// Either way it takes the run lock first and appends one JSON line per run to results/runs.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, RESULTS_DIR, E2E_DIR, loadConfig, loadFlows, suiteFlows, appendRun, readJson, arg, type Flow, type RunRecord } from './lib.ts';
import { classify, type Hints } from './classify.ts';
import { acquire, release } from './lock.ts';

type Recording = {
  startedAt: string;
  platform: string;
  flows: Record<string, { ok: boolean; durationMs: number; error?: string; hints?: Hints }>;
};

const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

export async function run(args: string[]): Promise<number> {
  const suite = arg(args, 'suite');
  const flowName = arg(args, 'flow');
  const mode = (arg(args, 'mode') ?? 'recorded') as 'recorded' | 'live';
  const role = arg(args, 'role') ?? 'runner';
  const platform = arg(args, 'platform') ?? 'ios';
  if (!suite && !flowName) { console.error('usage: run --suite <name> | --flow <case-id> [--mode recorded|live] [--recording file] [--role name]'); return 2; }

  const flows: Flow[] = flowName ? loadFlows().filter((f) => f.caseId === flowName) : suiteFlows(suite!);
  if (!flows.length) { console.error(`no flows found for ${flowName ?? suite}`); return 2; }

  const lock = acquire(role, process.pid);
  if (!lock.ok) { console.error(`REFUSED: ${lock.reason}\nOne device, one driver: wait or ask the lock owner.`); return 3; }

  try {
    let rec: Recording | null = null;
    if (mode === 'recorded') {
      const recFile = arg(args, 'recording');
      if (!recFile) { console.error('recorded mode needs --recording <file>'); return 2; }
      rec = readJson<Recording>(path.resolve(recFile));
    }
    const startedAt = rec?.startedAt ?? new Date().toISOString();
    const batchId = `${stamp(startedAt)}_${suite ?? 'adhoc'}_${platform}`;
    let failed = 0;

    for (const f of flows) {
      const runId = `${stamp(startedAt)}_${f.caseId}_${platform}`;
      let ok: boolean, durationMs: number, error: string | null = null, hints: Hints = {};
      if (rec) {
        const r = rec.flows[f.caseId];
        if (!r) { console.error(`recording has no entry for ${f.caseId}`); return 2; }
        ({ ok, durationMs } = r); error = r.error ?? null; hints = r.hints ?? {};
      } else {
        const t0 = Date.now();
        const res = await runLive(f);
        ok = res.ok; error = res.error; durationMs = Date.now() - t0;
      }
      const failureClass = ok ? null : classify(error ?? '', hints);
      const dir = path.join(RESULTS_DIR, 'artifacts', runId);
      fs.mkdirSync(dir, { recursive: true });
      const logPath = path.relative(ROOT, path.join(dir, 'maestro.log'));
      fs.writeFileSync(path.join(ROOT, logPath), `flow: ${f.file}\nbackend-mode: ${f.backendMode}\nresult: ${ok ? 'PASSED' : 'FAILED'}\n${error ? `error: ${error}\n` : ''}`);
      const record: RunRecord = {
        runId, batchId, startedAt, suite: suite ?? 'adhoc', caseId: f.caseId, flow: path.basename(f.file), platform,
        ok, durationMs, failureClass, error, logPath, backendMode: f.backendMode, mode,
      };
      appendRun(record);
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${f.caseId.padEnd(14)} ${(durationMs / 1000).toFixed(1).padStart(5)}s${ok ? '' : `  [${failureClass}] ${error}`}`);
    }
    console.log(`\nbatch ${batchId}: ${flows.length - failed} passed, ${failed} failed (${mode})`);
    return 0; // a failing flow is a result, not a runner error
  } finally {
    release(role);
  }
}

async function runLive(f: Flow): Promise<{ ok: boolean; error: string | null }> {
  const cfg = loadConfig();
  try {
    await fetch(`${cfg.backendUrl}/admin/reset`, { method: 'POST' });
    await fetch(`${cfg.backendUrl}/admin/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: f.backendMode }) });
  } catch {
    return { ok: false, error: `backend unreachable at ${cfg.backendUrl} (ECONNREFUSED)` };
  }
  const res = spawnSync('maestro', ['test', path.join(ROOT, f.file)], { encoding: 'utf8', cwd: E2E_DIR });
  if (res.error) return { ok: false, error: `maestro driver did not start: ${res.error.message}` };
  if (res.status === 0) return { ok: true, error: null };
  const out = `${res.stdout}\n${res.stderr}`.split('\n').filter((l) => /fail|error|not found|assert/i.test(l));
  return { ok: false, error: (out[0] ?? 'maestro exited non-zero').trim() };
}
