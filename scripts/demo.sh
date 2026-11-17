#!/usr/bin/env bash
# The story: an agentic QA team starts on a project for the first time.
#   Phase 1  QA Lead     collects documents and tickets, groups them, decides the test types
#   Phase 2  Analyst     writes cases per type, resolves document conflicts, proposes suites
#   Phase 3  Automation  turns cases into scripts, checks testIDs
#   Phase 4  Runner      runs the plan, reports tests and host resources
#   Phase 5  QA Lead     analyses the report, drafts tickets (owner approves)
#   Phase 6  Watcher     sees a ticket move to test, the Lead starts a new case and flow
#
#   ./scripts/demo.sh            recorded mode: deterministic, offline, no device, no API key
#   ./scripts/demo.sh --pause    wait for Enter between steps (for presenting)
#   ./scripts/demo.sh --agents   real headless agents for the agent steps (claude CLI + ANTHROPIC_API_KEY)
#   OPEN=1 ./scripts/demo.sh     open the visual walkthrough at the end
set -euo pipefail
cd "$(dirname "$0")/.."

AGENTS=0; PAUSE=0
for a in "$@"; do case "$a" in --agents) AGENTS=1 ;; --pause) PAUSE=1 ;; *) echo "unknown option $a"; exit 2 ;; esac; done

C() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { echo; C "== $1"; shift; [ $# -gt 0 ] && echo "   $*"; if [ "$PAUSE" = 1 ]; then read -r -p "   [Enter to run] " _; fi; return 0; }
cli() { node runner/src/cli.ts "$@"; }
T=docs/qa-team/lead/tasks
# delegate <role> <task-id> <prompt>: real agent (--agents) or the recorded sample; returns 0 if the real agent ran
delegate() {
  if [ "$AGENTS" = 1 ]; then
    node scripts/briefs.mjs "$2" >/dev/null
    scripts/run-agent.sh "$1" "$2" "Do task $T/$2.md. $3"
    return 0
  fi
  cp "samples/tasks/$2.md" "$T/"
  return 1
}

node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)' \
  || { echo "Node 22.18 or newer is required (found $(node -v))."; exit 2; }
if [ "$AGENTS" = 1 ]; then
  command -v claude >/dev/null && [ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "--agents needs the claude CLI and ANTHROPIC_API_KEY in the environment."; exit 2; }
fi

step "0. Clean start: a project the team has never seen" "generated output from earlier runs is removed; the app, backend and documents stay"
rm -rf results
rm -f docs/qa-team/run.lock docs/qa-team/cost.tsv docs/qa-team/testid-requests.md docs/qa-team/watch/* docs/qa-team/runs/*-nightly.md \
      docs/qa-team/lead/reviews/* docs/qa-team/lead/intake.json docs/qa-team/lead/strategy.* docs/qa-team/lead/tickets-to-file.json \
      e2e/test-plan.json docs/cases/*.md
rm -rf docs/cases/drafts
find docs/qa-team/lead/tasks -name '20*.md' -delete
find e2e/flows -name '*.yaml' -delete
mkdir -p docs/qa-team/watch docs/qa-team/lead/reviews docs/cases e2e/flows
node scripts/check-agents.ts
node .claude/hooks/pretool-guard.mjs --self-test | tail -1
npm test --silent 2>&1 | grep -E '^ℹ (tests|pass|fail)' || true

step "Mock product: reproducible failure modes" "so every later failure has a known cause"
node scripts/failure-modes.mjs

# ---------------------------------------------------------------- Phase 1
step "PHASE 1 - QA Lead: collect, group, decide test types" "inputs: 3 project documents and 14 tickets"
node scripts/intake.ts
if [ "$AGENTS" = 1 ]; then
  node scripts/briefs.mjs 2025-03-10-cases-core >/dev/null
  scripts/run-agent.sh qa-lead 2025-03-10-intake-strategy "Run node scripts/intake.ts, then write docs/qa-team/lead/strategy.md and strategy.json (test type per ticket) and e2e/test-plan.json."
else
  cp samples/lead/strategy.md samples/lead/strategy.json docs/qa-team/lead/
  cp samples/lead/test-plan.json e2e/test-plan.json
fi
node scripts/intake.ts --verify docs/qa-team/lead/strategy.json
sed -n '/^## Which test type/,/^Rule used/p' docs/qa-team/lead/strategy.md | head -12
echo "-- the plan the Runner will follow:"
cli plan

# ---------------------------------------------------------------- Phase 2
step "PHASE 2 - Analyst: cases, source hierarchy, clarifications, suites" "every step and expectation must name a source; conflicting documents go to the people who own them"
cat docs/qa-team/source-hierarchy.md | sed -n '/^| Rank/,/^| - /p'
if delegate analyst 2025-03-10-cases-core "Follow docs/qa-team/source-hierarchy.md. Strategy: docs/qa-team/lead/strategy.md."; then :; else
  cp samples/analyst/cases/*.md samples/analyst/suites.json samples/analyst/clarifications.md docs/cases/
fi
node scripts/cases-lib.ts
echo "-- conflicts between documents (drafted for the owner to send):"
grep -E '^## C[0-9]|^conflict:|^status:' docs/cases/clarifications.md | sed 's/^/   /'
echo "-- proposed suites:"; cat docs/cases/suites.json | sed 's/^/   /'
echo "-- the owner approves smoke and critical (e2e/smoke-allowlist.json):"; sed 's/^/   /' e2e/smoke-allowlist.json | tail -4

# ---------------------------------------------------------------- Phase 3
step "PHASE 3 - Automation engineer: cases to scripts, testID analysis" "framework selected so far: Maestro, for the e2e-fe cases"
echo "-- testID analysis first:"
cli testids | tail -6
if delegate automation-engineer 2025-03-11-flows-core "Cases are in docs/cases/. In this demo a run needs: --recording runner/recordings/first-run.json --label first-run --env local."; then :; else
  cp -r samples/automation-engineer/flows/* e2e/flows/
  rm e2e/flows/auth/auth-004-sign-out.yaml   # arrives in phase 6
fi
cli list
cli lint
cli run --suite regression --label first-run --env local --role automation-engineer --recording runner/recordings/first-run.json | tail -4
echo "   not automated: wallet-004/005 wait for a testID, wallet-006 waits for an open clarification."
[ -f "$T/2025-03-11-flows-core.md" ] || cp samples/tasks/2025-03-11-flows-core.md "$T/"

# ---------------------------------------------------------------- Phase 4
step "PHASE 4 - Runner: the plan, two nights, host metrics" "smoke on every build, regression nightly, on the planned environment"
cli plan run nightly-regression --role runner --recording runner/recordings/night-1.json | tail -2
cli plan run nightly-regression --role runner --recording runner/recordings/night-2.json | tail -8
echo "-- one device, one driver (the automation engineer holds the lock, the runner is refused):"
cli lock acquire automation-engineer
cli plan run smoke-on-build --role runner --recording runner/recordings/build-214-smoke.json || echo "   (refused as expected, exit $?)"
cli lock release automation-engineer
echo "-- a new build arrives: smoke runs on it"
cli plan run smoke-on-build --role runner --recording runner/recordings/build-214-smoke.json | tail -6
echo "-- the morning report for the QA Lead:"
if delegate runner 2025-03-14-nightly-report "Results are already in results/runs.jsonl; do not run the suite again."; then :; else
  cli report --nightly | sed -n '/^## Result/,/^## Changes/p;/^## System/,/^## Notes/p'
fi
[ -f docs/qa-team/runs/2025-03-14-nightly.md ] || cli report --nightly >/dev/null

# ---------------------------------------------------------------- Phase 5
step "PHASE 5 - QA Lead: analyse the report, draft tickets" "drafts only: filing a ticket is an outward action and needs the owner"
if [ "$AGENTS" = 1 ]; then
  scripts/run-agent.sh qa-lead 2025-03-14-review-and-tickets "Read docs/qa-team/runs/2025-03-14-nightly.md and write docs/qa-team/lead/tickets-to-file.json (drafts only). Do not file anything."
else
  cp samples/lead/tickets-to-file.json docs/qa-team/lead/
fi
node scripts/file-tickets.ts || echo "   (blocked as expected, exit $?)"
echo "-- the owner reviews and approves:"
node scripts/file-tickets.ts --approve-all | tail -8

# ---------------------------------------------------------------- Phase 6
step "PHASE 6 - Watcher: the day's developments" "fetch is the only code that touches the tracker and chat; it redacts secrets first"
node scripts/fetch.ts
echo "-- redaction proof (the planted fake token, before and after):"
grep -o 'Authorization: Bearer [^ ]*' fixtures/tracker.json | head -1 | cut -c1-60 | sed 's/$/ ... (raw, in the fixture)/'
grep -o 'Authorization: Bearer [^ ]*' docs/qa-team/watch/2025-03-14-data.json | head -1 | sed 's/$/ (what the agents see)/'
if delegate watcher 2025-03-14-watch-morning "For date 2025-03-14."; then :; else
  cp samples/watcher/2025-03-14.md docs/qa-team/watch/2025-03-14.md
fi
echo "-- what the Watcher tells the QA Lead:"
sed -n '/^## 1\. Needs a test decision/,/^## 2\./p' docs/qa-team/watch/2025-03-14.md | head -8
echo "-- and the two planted prompt injections, quoted as data:"
sed -n '/^## Quoted instructions/,/^Why not acted on/p' docs/qa-team/watch/2025-03-14.md | grep -E '^Source:|^Two texts'

step "PHASE 6b - the Lead reacts: new case, new flow, bigger suite" "TE-150 (label e2e) moved to Ready for Test, so it becomes part of the automated tests"
if [ "$AGENTS" = 1 ]; then
  node scripts/briefs.mjs 2025-03-14-flow-sign-out >/dev/null
  scripts/run-agent.sh analyst 2025-03-14-cases-profile "Write the case for TE-150 into docs/cases/profile.md."
  scripts/run-agent.sh automation-engineer 2025-03-14-flow-sign-out "Do task $T/2025-03-14-flow-sign-out.md. A run needs --recording runner/recordings/adhoc-auth-004.json."
else
  cp samples/analyst/cases-late/profile.md docs/cases/profile.md
  cp samples/automation-engineer/flows/auth/auth-004-sign-out.yaml e2e/flows/auth/
  cp samples/tasks/2025-03-14-flow-sign-out.md "$T/"
fi
node scripts/cases-lib.ts | head -1
echo "regression suite before: 10 flows; after:"
cli lint
cli run --flow auth-004 --recording runner/recordings/adhoc-auth-004.json --role automation-engineer --env staging | tail -3
cli list | grep -c . | sed 's/$/ flows in total/'

# ---------------------------------------------------------------- Review
step "The Lead reviews every handoff" "evidence is re-derived by code; a handoff with no evidence is rejected"
if [ "$AGENTS" = 1 ]; then
  node scripts/briefs.mjs 2025-03-14-cases-portfolio-sell >/dev/null
  scripts/run-agent.sh analyst 2025-03-14-cases-portfolio-sell "Do task $T/2025-03-14-cases-portfolio-sell.md."
  scripts/run-agent.sh qa-lead 2025-03-14-review "Review every handoff in $T with node scripts/lead-check.ts and write docs/qa-team/lead/reviews/2025-03-14-review.md."
else
  mkdir -p docs/cases/drafts
  cp samples/analyst/weak/portfolio-sell.md docs/cases/drafts/
  cp samples/tasks/2025-03-14-cases-portfolio-sell.md "$T/"
  cp samples/lead/2025-03-14-review.md docs/qa-team/lead/reviews/
fi
node scripts/lead-check.ts --review docs/qa-team/lead/reviews/2025-03-14-review.md --apply || echo "(the Lead's note and the mechanical check disagree: see above)"

step "Cost log"
[ "$AGENTS" = 1 ] || cp samples/cost.tsv docs/qa-team/cost.tsv
node scripts/cost-summary.ts

step "Privacy check" "nothing private may be in this repo"
./scripts/privacy-check.sh

step "Visual walkthrough" "a clickable, animated page built from the real outputs above"
node scripts/build-visual.ts
if [ "${OPEN:-0}" = 1 ] && command -v open >/dev/null; then open docs/visual/index.html; fi

echo; C "Demo complete."
echo "Visual version: open docs/visual/index.html   (or: OPEN=1 ./scripts/demo.sh)"
echo "Look at: docs/qa-team/lead/strategy.md  docs/cases/  docs/qa-team/runs/2025-03-14-nightly.md  docs/qa-team/lead/tickets-to-file.json  docs/qa-team/watch/2025-03-14.md  docs/qa-team/lead/tasks/"
