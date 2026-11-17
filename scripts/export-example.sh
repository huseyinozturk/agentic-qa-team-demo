#!/usr/bin/env bash
# Copies the output of the last ./scripts/demo.sh run into docs/example-output/ (committed, so reviewers can browse it).
set -euo pipefail
cd "$(dirname "$0")/.."
out=docs/example-output
rm -rf "$out"
mkdir -p "$out"/{runs,watch,cases,handoffs,reviews}
cp docs/qa-team/runs/*-nightly.md "$out/runs/"
cp docs/qa-team/watch/2*.md docs/qa-team/watch/2*-data.json "$out/watch/"
cp docs/cases/drafts/*.md "$out/cases/"
cp docs/qa-team/lead/tasks/2*.md "$out/handoffs/"
cp docs/qa-team/lead/reviews/*.md "$out/reviews/"
cp docs/qa-team/cost.tsv "$out/"
cp results/runs.jsonl "$out/runs.jsonl"
echo "exported to $out"
