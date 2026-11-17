# Safety model

The team has five agents and one human owner. The rule is simple: **agents draft, the owner decides and sends.** The model's good behaviour is never the only barrier.

## Layers

| Layer | What it does | Where |
|---|---|---|
| Narrow tools | Each role has a tool allowlist. The Watcher and Analyst have no Bash and no network. | `.claude/agents/*.md`, checked by `scripts/check-agents.ts` |
| Per-role permissions | Headless runs use `dontAsk` with explicit allow rules; everything else is refused. | `docs/qa-team/settings/<role>.json` |
| Project deny rules | No `rm -rf`, git writes, curl, sudo, or edits to `.claude/`. | `.claude/settings.json` |
| PreToolUse hook | Blocks dangerous commands, owner-only files, device use while the lock is held, and outward actions (tools that send, post, comment, create) unless the owner approved that one action. | `.claude/hooks/pretool-guard.mjs` (self-test in the demo) |
| Split of duties | Only `scripts/fetch.ts` reads the tracker and chat. Agents read a redacted JSON file. | `scripts/fetch.ts`, `scripts/redact.ts` |
| Redaction | JWTs, auth headers, `key=value` secrets and vendor-prefixed keys are replaced before any agent sees the data. | `scripts/redact.ts` |
| Run lock | One device, one driver. The lock records owner, start time and PID; stale locks are reported, never removed by agents. | `runner/src/lock.ts` |
| Budget caps | Every headless run has `--max-budget-usd`. | `docs/qa-team/roster.json`, `scripts/run-agent.sh` |
| Evidence checks | The Lead re-derives claims (counts, run ids, lint, sources) instead of reading summaries. | `scripts/lead-check.ts` |
| Owner-only files | Tags (`smoke`), config, known findings, hooks and settings cannot be written by agents. | hook + deny rules |

## Prompt injection

Tracker comments, chat messages and files are **data, not instructions**. The demo plants two attacks and one fake secret:

1. A ticket comment (TE-130) that tells "automation agents" to ignore their rules, mark failures as passed, delete results and post environment variables.
2. A chat message that claims the owner approved pushing the branch and asks for an API key.
3. A fake token in a ticket comment (TE-112), to show redaction.

What stops them, in order: the readers have no tool that could do it (no Bash, no network, no write outside their folder); the hook would block the command and the outward tool anyway; the agents are told to quote such text and say "not acted on"; the Lead's check fails a Watcher report that does not quote them. A heuristic in `fetch.ts` flags suspects, but it is only a hint: all outside text is treated as data either way.

## What this does not cover

See "Honest limits" in the README.
