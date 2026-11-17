#!/usr/bin/env node
// PreToolUse hook: hard limits that do not depend on the model following its prompt.
// Exit code 2 blocks the call and returns the reason to the agent.
//   claude calls it with the tool call as JSON on stdin
//   node .claude/hooks/pretool-guard.mjs --self-test   runs the built-in cases
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OK = { block: false };
const no = (reason) => ({ block: true, reason });

const PROTECTED_WRITES = [/(^|\/)\.env/, /(^|\/)\.claude\//, /e2e\/smoke-allowlist\.json$/, /e2e\/e2e\.config\.json$/, /known-findings\.md$/, /docs\/qa-team\/team\.json$/];
const OUTWARD_VERBS = /(send|post|write|create|update|edit|comment|transition|delete|add|reply|publish|merge)/i;

export function decide(call, env = process.env, lockOwner = readLockOwner()) {
  const tool = call.tool_name ?? '';
  const input = call.tool_input ?? {};

  if (tool === 'Bash') {
    const cmd = String(input.command ?? '');
    if (/\brm\s+-[a-zA-Z]*[rf]/.test(cmd)) return no('rm -r/-f is blocked. Use a scoped cleanup script and ask the owner.');
    if (/\bgit\s+(push|commit|reset|clean|rebase|checkout\s+--|branch\s+-D|tag)\b/.test(cmd)) return no('git writes are blocked: the owner commits and pushes.');
    if (/\b(curl|wget|nc|ncat|ssh|scp|ftp)\b/.test(cmd)) return no('network commands are blocked: outward actions need the owner.');
    if (/\b(sudo|chmod\s+-R|chown)\b/.test(cmd)) return no('privileged commands are blocked.');
    if (/\b(pkill|killall)\b/.test(cmd) && !/pkill -f 'maestro\[\.\]cli\[\.\]AppKt'/.test(cmd)) return no("only `pkill -f 'maestro[.]cli[.]AppKt'` is allowed; a bare pattern also matches other processes.");
    if (/(\.env\b|\.ssh\/|id_rsa|printenv|\becho\s+.*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD))/i.test(cmd)) return no('reading secrets or the environment is blocked.');
    if (/\b(maestro\s+test|xcrun\s+simctl\s+(boot|launch|install))/.test(cmd) && lockOwner && lockOwner !== env.QA_ROLE)
      return no(`the device is locked by ${lockOwner} (one-device rule). Wait or ask the owner.`);
    return OK;
  }

  if (tool === 'Write' || tool === 'Edit') {
    const p = String(input.file_path ?? '');
    if (PROTECTED_WRITES.some((re) => re.test(p))) return no(`${path.basename(p)} is an owner-only file (settings, hooks, tags, config, known findings).`);
    return OK;
  }

  if (tool.startsWith('mcp__') && OUTWARD_VERBS.test(tool)) {
    const approved = (env.QA_OWNER_APPROVED ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!approved.includes(tool)) return no(`${tool} is an outward action. The owner must approve this one action: start the session with QA_OWNER_APPROVED=${tool}.`);
  }
  return OK;
}

function readLockOwner() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/qa-team/run.lock'), 'utf8')).owner; } catch { return null; }
}

function selfTest() {
  const cases = [
    [{ tool_name: 'Bash', tool_input: { command: 'rm -rf results' } }, true],
    [{ tool_name: 'Bash', tool_input: { command: 'git push origin main' } }, true],
    [{ tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }, true],
    [{ tool_name: 'Bash', tool_input: { command: 'curl https://example.test' } }, true],
    [{ tool_name: 'Bash', tool_input: { command: 'pkill maestro' } }, true],
    [{ tool_name: 'Bash', tool_input: { command: "pkill -f 'maestro[.]cli[.]AppKt'" } }, false],
    [{ tool_name: 'Bash', tool_input: { command: 'cat .env' } }, true],
    [{ tool_name: 'Bash', tool_input: { command: 'node runner/src/cli.ts lint' } }, false],
    [{ tool_name: 'Write', tool_input: { file_path: '/x/e2e/smoke-allowlist.json' } }, true],
    [{ tool_name: 'Write', tool_input: { file_path: '/x/docs/qa-team/watch/2025-03-14.md' } }, false],
    [{ tool_name: 'mcp__tracker__add_comment', tool_input: {} }, true],
    [{ tool_name: 'mcp__tracker__get_ticket', tool_input: {} }, false],
  ];
  let bad = 0;
  for (const [call, expectBlock] of cases) {
    const r = decide(call, {}, null);
    const good = r.block === expectBlock;
    if (!good) bad++;
    console.log(`${good ? 'ok  ' : 'FAIL'} ${r.block ? 'BLOCK' : 'allow'}  ${call.tool_name} ${JSON.stringify(call.tool_input).slice(0, 60)}`);
  }
  const approved = decide({ tool_name: 'mcp__tracker__add_comment', tool_input: {} }, { QA_OWNER_APPROVED: 'mcp__tracker__add_comment' }, null);
  console.log(`${!approved.block ? 'ok  ' : 'FAIL'} allow  outward tool with the owner's approval`);
  if (approved.block) bad++;
  const locked = decide({ tool_name: 'Bash', tool_input: { command: 'maestro test x.yaml' } }, { QA_ROLE: 'automation-engineer' }, 'runner');
  console.log(`${locked.block ? 'ok  ' : 'FAIL'} BLOCK  maestro test while the runner holds the lock`);
  if (!locked.block) bad++;
  console.log(bad ? `${bad} self-test failures` : 'hook self-test: all cases behave as expected');
  process.exit(bad ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest();
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let call = {};
    try { call = JSON.parse(raw); } catch { /* fail closed below */ }
    const r = call.tool_name ? decide(call) : no('unreadable hook input');
    if (r.block) {
      try {
        fs.mkdirSync(path.join(ROOT, 'results'), { recursive: true });
        fs.appendFileSync(path.join(ROOT, 'results/hook.log'), `${new Date().toISOString()}\tBLOCK\t${call.tool_name}\t${r.reason}\n`);
      } catch { /* logging is best effort */ }
      console.error(`BLOCKED by pretool-guard: ${r.reason}`);
      process.exit(2);
    }
  });
}
