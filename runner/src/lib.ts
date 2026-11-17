// Shared helpers for the e2e runner: flow parsing, run records, paths.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const E2E_DIR = path.join(ROOT, 'e2e');
export const RESULTS_DIR = path.join(ROOT, 'results');
export const RUNS_FILE = path.join(RESULTS_DIR, 'runs.jsonl');
export const LOCK_FILE = path.join(ROOT, 'docs/qa-team/run.lock');

export const FAILURE_CLASSES = ['app', 'selector', 'env', 'test', 'driver'] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];

export type Flow = {
  file: string; // path relative to ROOT
  caseId: string;
  tickets: string[];
  name: string;
  tags: string[];
  backendMode: string;
  body: string;
  headerLines: string[];
};

export type RunRecord = {
  runId: string;
  batchId: string;
  startedAt: string;
  suite: string;
  caseId: string;
  flow: string;
  platform: string;
  ok: boolean;
  durationMs: number;
  failureClass: FailureClass | null;
  error: string | null;
  logPath: string | null;
  backendMode: string;
  mode: 'recorded' | 'live';
  env: string;
  host?: HostMetrics;
};

export type HostMetrics = { peakCpuPct: number; minFreeMemMb: number; swapGb: number; diskFreeGb: number };

export type Config = {
  appId: string;
  backendUrl: string;
  allowedTags: string[];
  suites: Record<string, { tags: string[] }>;
};

export const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
export const loadConfig = (): Config => readJson<Config>(path.join(E2E_DIR, 'e2e.config.json'));

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
export { walk };

export function parseFlow(absPath: string): Flow {
  const text = fs.readFileSync(absPath, 'utf8');
  const [head, ...rest] = text.split(/^---\s*$/m);
  const headerLines = head.split('\n');
  const comment = (key: string) => headerLines.map((l) => l.match(new RegExp(`^#\\s*${key}:\\s*(.*)$`))?.[1]).find(Boolean)?.trim() ?? '';
  const tickets = comment('tickets').replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
  const tags: string[] = [];
  let inTags = false;
  for (const l of headerLines) {
    if (/^tags:\s*$/.test(l)) { inTags = true; continue; }
    const m = l.match(/^\s+-\s+(\S+)/);
    if (inTags && m) tags.push(m[1]); else if (!/^\s*$/.test(l)) inTags = false;
  }
  return {
    file: path.relative(ROOT, absPath),
    caseId: comment('case'),
    tickets,
    name: headerLines.find((l) => l.startsWith('name:'))?.slice(5).trim() ?? '',
    tags,
    backendMode: comment('backend-mode') || 'none',
    body: rest.join('---'),
    headerLines,
  };
}

export function loadFlows(): Flow[] {
  return walk(path.join(E2E_DIR, 'flows')).filter((f) => f.endsWith('.yaml')).sort().map(parseFlow);
}

export function loadRuns(): RunRecord[] {
  if (!fs.existsSync(RUNS_FILE)) return [];
  return fs.readFileSync(RUNS_FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as RunRecord);
}

export function appendRun(r: RunRecord) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.appendFileSync(RUNS_FILE, JSON.stringify(r) + '\n');
}

export function suiteFlows(suite: string): Flow[] {
  const cfg = loadConfig();
  const def = cfg.suites[suite];
  if (!def) throw new Error(`unknown suite "${suite}" (have: ${Object.keys(cfg.suites).join(', ')})`);
  return loadFlows().filter((f) => f.tags.some((t) => def.tags.includes(t)));
}

export const arg = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
