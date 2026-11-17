// Run lock for the one-device rule: whoever drives the simulator holds docs/qa-team/run.lock.
import fs from 'node:fs';
import path from 'node:path';
import { LOCK_FILE } from './lib.ts';

export type Lock = { owner: string; startedAt: string; pid: number };
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

export function readLock(): Lock | null {
  return fs.existsSync(LOCK_FILE) ? (JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as Lock) : null;
}

export function lockStatus(): string {
  const l = readLock();
  if (!l) return 'free';
  const age = Date.now() - Date.parse(l.startedAt);
  const stale = age > STALE_AFTER_MS && !alive(l.pid);
  return `held by ${l.owner} since ${l.startedAt} (pid ${l.pid})${stale ? ' - STALE: report it, the owner removes it' : ''}`;
}

export function acquire(owner: string, pid = process.pid): { ok: true } | { ok: false; reason: string } {
  const existing = readLock();
  if (existing) return { ok: false, reason: `run lock ${lockStatus()}` };
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ owner, startedAt: new Date().toISOString(), pid } satisfies Lock), { flag: 'wx' });
  return { ok: true };
}

export function release(owner: string): boolean {
  const l = readLock();
  if (!l || l.owner !== owner) return false;
  fs.rmSync(LOCK_FILE);
  return true;
}
