#!/usr/bin/env bash
# Runs one role headless with its own permission file and budget cap, and logs the cost.
#   ANTHROPIC_API_KEY=... scripts/run-agent.sh <role> <task-id> "<prompt>"
# The key is read from the environment only. It is passed to this one call and never written anywhere.
set -euo pipefail
cd "$(dirname "$0")/.."

role=${1:?role (qa-lead|watcher|analyst|automation-engineer|runner)}
task=${2:?task id}
prompt=${3:?prompt}

command -v claude >/dev/null || { echo "run-agent: the claude CLI is not installed (see README, prerequisites)"; exit 2; }
[ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "run-agent: ANTHROPIC_API_KEY is not set in the environment"; exit 2; }

budget=$(node -e "console.log(JSON.parse(require('fs').readFileSync('docs/qa-team/roster.json','utf8')).roles['$role'].budgetUsd)")
model=$(node -e "console.log(JSON.parse(require('fs').readFileSync('docs/qa-team/roster.json','utf8')).roles['$role'].model)")
echo "run-agent: $role (model $model, budget cap \$$budget) task $task"

# Clean environment on purpose: the agent inherits nothing but PATH, HOME, the key and its role name.
# The hook in .claude/settings.json (loaded from the project) still applies.
out=$(env -i PATH="$PATH" HOME="$HOME" ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" QA_ROLE="$role" \
  claude -p --agent "$role" \
    --settings "docs/qa-team/settings/$role.json" \
    --max-budget-usd "$budget" \
    --output-format json \
    "$prompt") || { echo "run-agent: claude exited non-zero"; exit 1; }

printf '%s' "$out" | ROLE="$role" MODEL="$model" TASK="$task" node -e '
  const fs = require("fs");
  const r = JSON.parse(fs.readFileSync(0, "utf8"));
  const u = r.usage || {};
  const file = "docs/qa-team/cost.tsv";
  if (!fs.existsSync(file)) fs.writeFileSync(file, "date\trole\tmodel\tmode\tinput_tokens\toutput_tokens\tusd\ttask\n");
  const row = [new Date().toISOString().slice(0, 10), process.env.ROLE, process.env.MODEL, "live",
    u.input_tokens ?? 0, u.output_tokens ?? 0, (r.total_cost_usd ?? 0).toFixed(4), process.env.TASK].join("\t");
  fs.appendFileSync(file, row + "\n");
  console.log(String(r.result ?? "").slice(0, 600));
  console.log("cost logged:", row);
'
