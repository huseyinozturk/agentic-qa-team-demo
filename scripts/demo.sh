#!/usr/bin/env bash
# The full story in one command. Default mode is "recorded": deterministic, no device, no API key.
#   ./scripts/demo.sh            recorded run + recorded agent outputs (offline)
#   ./scripts/demo.sh --pause    wait for Enter between steps (for presenting)
#   ./scripts/demo.sh --agents   real headless agents for the agent steps (needs claude CLI + ANTHROPIC_API_KEY)
# Real device runs: `node runner/src/cli.ts run --suite regression --mode live` (needs Maestro, a booted
# simulator with the app installed, and the mock backend running). See README.
set -euo pipefail
cd "$(dirname "$0")/.."

AGENTS=0; PAUSE=0
for a in "$@"; do case "$a" in --agents) AGENTS=1 ;; --pause) PAUSE=1 ;; *) echo "unknown option $a"; exit 2 ;; esac; done

C() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { echo; C "== $1"; shift; [ $# -gt 0 ] && echo "   $*"; if [ "$PAUSE" = 1 ]; then read -r -p "   [Enter to run] " _; fi; }
cli() { node runner/src/cli.ts "$@"; }

node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)' \
  || { echo "Node 22.18 or newer is required (found $(node -v))."; exit 2; }
if [ "$AGENTS" = 1 ]; then
  command -v claude >/dev/null && [ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "--agents needs the claude CLI and ANTHROPIC_API_KEY in the environment."; exit 2; }
fi

step "0. Reset generated output" "results, reports, handoffs, drafts and the demo flow are regenerated each run"
rm -rf results docs/cases/drafts
rm -f docs/qa-team/run.lock docs/qa-team/cost.tsv docs/qa-team/watch/* docs/qa-team/runs/*-nightly.md \
      docs/qa-team/lead/reviews/* e2e/flows/auth/auth-004-*.yaml
find docs/qa-team/lead/tasks -name '20*.md' -delete
mkdir -p docs/qa-team/watch docs/qa-team/lead/reviews docs/cases/drafts

step "1. The team and its guard rails" "static checks, hook self-test, unit tests"
node scripts/check-agents.ts
node .claude/hooks/pretool-guard.mjs --self-test
npm test --silent 2>&1 | grep -E '^# (tests|pass|fail)|^ℹ (tests|pass|fail)' || true

step "2. Mock backend: reproducible failure modes" "otp-delay, payment-declined, duplicate-webhook (the last one shows seeded bug 1)"
node scripts/failure-modes.mjs

step "3. Flow lint" "headers, tags, smoke allowlist, selectors must exist as testIDs in the app"
cli list
cli lint
cat > e2e/flows/auth/zz-bad.yaml <<'EOF'
# case: auth-099
appId: com.example.tokenestate
name: A deliberately bad flow
tags:
  - smoke
---
- tapOn:
    id: "does-not-exist-button"
    optional: true
EOF
echo "-- and a deliberately bad flow is rejected:"
cli lint || echo "(lint failed as expected)"
rm e2e/flows/auth/zz-bad.yaml

step "4. Two nightly runs (recorded)" "same flows and runner as live mode; results come from runner/recordings/"
cli run --suite regression --recording runner/recordings/night-1.json | tail -2
cli run --suite regression --recording runner/recordings/night-2.json
cli report --suite regression >/dev/null

step "5. One device, one driver: the run lock" "the automation engineer holds the lock, the runner is refused"
cli lock acquire automation-engineer
cli run --suite smoke --recording runner/recordings/night-2.json --role runner || echo "(refused as expected, exit $?)"
cli lock status
cli lock release automation-engineer

step "6. Runner: nightly report" "counts come from runs.jsonl, not from a model"
if [ "$AGENTS" = 1 ]; then
  node scripts/briefs.mjs 2025-03-14-nightly-report
  scripts/run-agent.sh runner 2025-03-14-nightly-report "Do task docs/qa-team/lead/tasks/2025-03-14-nightly-report.md. Results are already in results/runs.jsonl; do not run the suite again."
else
  cli report --nightly | sed -n '1,28p'
  cp samples/tasks/2025-03-14-nightly-report.md docs/qa-team/lead/tasks/
fi
[ "$AGENTS" = 1 ] || echo "   ... (full report: docs/qa-team/runs/2025-03-14-nightly.md)"
[ -f docs/qa-team/runs/2025-03-14-nightly.md ] || cli report --nightly >/dev/null

step "7. Fetch: mock Jira and Slack, with redaction" "the only code that reads them; agents get the cleaned JSON"
node scripts/fetch.ts
echo "-- redaction proof (the planted fake token, before and after):"
grep -o 'Authorization: Bearer [^ ]*' fixtures/tracker.json | head -1 | cut -c1-60 | sed 's/$/ ... (raw, in the fixture)/'
grep -o 'Authorization: Bearer [^ ]*' docs/qa-team/watch/2025-03-14-data.json | head -1 | sed 's/$/ (what the agents see)/'

step "8. Watcher: what changed" "no Bash, no network. It quotes the two planted injections as data and does not act on them"
if [ "$AGENTS" = 1 ]; then
  node scripts/briefs.mjs 2025-03-14-watch-morning
  scripts/run-agent.sh watcher 2025-03-14-watch-morning "Do task docs/qa-team/lead/tasks/2025-03-14-watch-morning.md for date 2025-03-14."
else
  cp samples/watcher/2025-03-14.md docs/qa-team/watch/2025-03-14.md
  cp samples/tasks/2025-03-14-watch-morning.md docs/qa-team/lead/tasks/
fi
sed -n '/^## Quoted instructions/,/^## Questions/p' docs/qa-team/watch/2025-03-14.md | head -24

step "9. Analyst: case draft with named sources" "plus a second, weak handoff that the Lead will reject"
if [ "$AGENTS" = 1 ]; then
  node scripts/briefs.mjs 2025-03-14-case-topup-limit 2025-03-14-case-portfolio-refresh
  scripts/run-agent.sh analyst 2025-03-14-case-topup-limit "Do task docs/qa-team/lead/tasks/2025-03-14-case-topup-limit.md."
  scripts/run-agent.sh analyst 2025-03-14-case-portfolio-refresh "Do task docs/qa-team/lead/tasks/2025-03-14-case-portfolio-refresh.md."
else
  cp samples/analyst/te-160-topup-limit.md samples/analyst/te-140-portfolio-refresh.md docs/cases/drafts/
  cp samples/tasks/2025-03-14-case-topup-limit.md samples/tasks/2025-03-14-case-portfolio-refresh.md docs/qa-team/lead/tasks/
fi
sed -n '1,20p' docs/cases/drafts/te-160-topup-limit.md

step "10. Automation engineer: a new flow that passes lint and a run" "the run takes the lock first"
if [ "$AGENTS" = 1 ]; then
  node scripts/briefs.mjs 2025-03-14-flow-sign-out
  scripts/run-agent.sh automation-engineer 2025-03-14-flow-sign-out "Do task docs/qa-team/lead/tasks/2025-03-14-flow-sign-out.md. In this demo a run needs --recording runner/recordings/adhoc-auth-004.json."
else
  cp samples/automation-engineer/auth-004-sign-out.yaml e2e/flows/auth/
  cp samples/tasks/2025-03-14-flow-sign-out.md docs/qa-team/lead/tasks/
fi
cli lint
[ -n "$(grep -s auth-004 results/runs.jsonl)" ] || cli run --flow auth-004 --recording runner/recordings/adhoc-auth-004.json --role automation-engineer

step "11. Lead review: evidence is re-derived, not trusted" "one handoff has no evidence and is rejected"
if [ "$AGENTS" = 1 ]; then
  scripts/run-agent.sh qa-lead 2025-03-14-review "Review every handoff in docs/qa-team/lead/tasks with node scripts/lead-check.ts and write docs/qa-team/lead/reviews/2025-03-14-review.md."
else
  cp samples/lead/2025-03-14-review.md docs/qa-team/lead/reviews/
fi
node scripts/lead-check.ts --review docs/qa-team/lead/reviews/2025-03-14-review.md --apply || echo "(the Lead's note and the mechanical check disagree: see above)"
echo "-- rejected handoff after the review:"
sed -n '2,5p;/^## Review/,$p' docs/qa-team/lead/tasks/2025-03-14-case-portfolio-refresh.md

step "12. Cost log"
[ "$AGENTS" = 1 ] || cp samples/cost.tsv docs/qa-team/cost.tsv
node scripts/cost-summary.ts

step "13. Privacy check" "nothing private may be in this repo"
./scripts/privacy-check.sh

echo; C "Demo complete."
echo "Look at: docs/qa-team/runs/2025-03-14-nightly.md  docs/qa-team/watch/2025-03-14.md  docs/cases/drafts/  docs/qa-team/lead/tasks/  docs/qa-team/lead/reviews/  docs/qa-team/cost.tsv"
