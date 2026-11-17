# Task and handoff files

One Markdown file per task: `docs/qa-team/lead/tasks/<date>-<slug>.md`. The Lead writes the task; the role that does it writes the result in the same file.

```markdown
---
id: 2025-03-14-flow-sign-out
from: qa-lead
to: automation-engineer
status: open | done | blocked | rejected
created: 2025-03-14T09:30
cases: [auth-004]
tickets: [TE-150]
---
## Ask
What to do and what done looks like.

## Result            (written by the doer)
What changed, as a list of files.

## Evidence          (required for status: done)
- lint: output pasted
- run: runId found in results/runs.jsonl
- diff: files listed above

## Open questions
Anything the doer could not decide. Never guessed.
```

`status: done` without evidence is rejected by the Lead (`node scripts/lead-check.ts`). The files in this folder are produced by the demo and are not committed (see `.gitignore`); a committed copy of one full run is in `docs/example-output/`.
