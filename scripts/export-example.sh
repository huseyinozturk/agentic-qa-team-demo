#!/usr/bin/env bash
# Copies the output of the last ./scripts/demo.sh run into docs/example-output/ (committed, so reviewers can browse it).
set -euo pipefail
cd "$(dirname "$0")/.."
out=docs/example-output
rm -rf "$out"
mkdir -p "$out"/{lead,cases,flows,runs,watch,handoffs,reviews}
cp docs/qa-team/lead/strategy.md docs/qa-team/lead/strategy.json docs/qa-team/lead/tickets-to-file.json "$out/lead/"
cp docs/cases/*.md docs/cases/suites.json "$out/cases/"
cp docs/qa-team/testid-requests.md "$out/cases/"
cp -r e2e/flows/* "$out/flows/"
cp e2e/test-plan.json "$out/"
cp docs/qa-team/runs/*-nightly.md "$out/runs/"
cp results/runs.jsonl "$out/runs.jsonl"
cp results/mock-tracker-out.json "$out/filed-tickets.json"
cp docs/qa-team/watch/2*.md docs/qa-team/watch/2*-data.json "$out/watch/"
cp docs/qa-team/lead/tasks/2*.md "$out/handoffs/"
cp docs/qa-team/lead/reviews/*.md "$out/reviews/"
cp docs/qa-team/cost.tsv "$out/"
echo "exported to $out"
