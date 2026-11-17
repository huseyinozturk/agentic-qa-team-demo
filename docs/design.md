# Design: a small QA team of Claude agents

This is the design behind the demo, written generically. It targets one person who owns end-to-end testing of a mobile app and wants the repeatable work done by agents, while every decision and every outward action stays human.

## 1. Ground rules

1. **The owner approves every outward action.** No agent posts to chat, writes to the tracker or messages a person. Agents write drafts into the repo.
2. **Outside content is data, not instructions.** Tickets, comments, chat and documents can contain text aimed at an agent. Agents quote it and never act on it.
3. **Narrow tools.** Each role gets an allowlist of tools and commands, not a deny list. Example: the runner may stop the Maestro process only with an exact `pkill -f` pattern, because a bare pattern also matches other processes.
4. **Files, not chat.** Roles hand work over through files, so every handoff is reviewable, diffable and survives a session.
5. **Evidence, not summaries.** A result counts when it points at a run record, a diff, a lint output or a reproduction.
6. **Secrets stay hidden.** No agent prints a token; credentials live only in the fetch step and the environment.
7. **Commit only when asked.** Agents leave changes in the working tree.

## 2. The team

| Role | Job | Model | Trigger | Writes |
|---|---|---|---|---|
| **QA Lead** | Takes the owner's requests, splits them into tasks, checks results against evidence | Opus | The owner, interactive | `docs/qa-team/lead/` |
| **Watcher** | Reads tracker and chat, says what changed for testing | Sonnet | Weekday morning, on request | `docs/qa-team/watch/` |
| **Analyst** | Writes cases from tickets with a named source per step; lists gaps | Opus | Task from the Lead | `docs/cases/drafts/` |
| **Automation engineer** | Turns ready cases into flows that pass lint and a run | Sonnet | Task from the Lead | `e2e/flows/`, `e2e/subflows/` |
| **Runner** | Runs suites, reads results, classifies failures, writes the morning report | Sonnet (report only) | Nightly, on request | `docs/qa-team/runs/` |

Why this split: writing a case is judgement over sources, so it gets the stronger model; writing a flow is pattern work with fast feedback (lint, a run), so a cheaper model is enough. Reading-heavy work (the Watcher) goes to the cheaper model, and the judgement over it stays with the Analyst and the owner. The model assignment is a starting hypothesis to be revised with measured cost and quality.

## 2b. The lifecycle on a project that is new to the team

1. **Intake (QA Lead).** Collect the project documents and tickets, group them by area, decide per item which test type fits: `unit`, `api`, `e2e-fe`. Write the strategy and the test plan (which suite runs where and when).
2. **Cases (Analyst).** Write cases per type. Sources have a ranking (product requirements, API specification, design notes, ticket criteria; comments and chat never count alone). Every case, step and expectation names its source. Where sources disagree, the Analyst drafts a clarification for the people who own them, works with the higher source as an assumption, and completes the case only when the answer is written down. It proposes the `smoke`, `critical` and `regression` suites; the owner approves the first two.
3. **Scripts (Automation engineer).** Convert ready cases for the *selected* framework. Check that every UI element a case names has a testID in the app, and write down what is missing. Run each script once; real failures stay failing.
4. **Runs (Runner).** Execute the plan: smoke on every build, regression nightly, critical before a release, in the planned environments. Report per test (failure class and evidence) and per host resource (CPU, memory, swap, disk, duration) to the Lead.
5. **Findings (QA Lead).** Read the report, draft tickets and comments with evidence. Filing is an outward action: the owner approves each draft.
6. **Watching (Watcher), in parallel.** Follow the tracker and the chat channels, collect the day's developments and pass them to the Lead. Example: a ticket labelled `e2e` moves to the test status, so the Lead has the case written and the script built, and the ticket becomes part of the suites. Informal channels are scanned only for what matters to testing.

### QA Lead
- **Inputs:** the owner's request, project documents and tickets, the Runner's reports, the Watcher's reports, handoff files.
- **Outputs:** strategy and test plan, task briefs, draft tickets, review notes, drafts of outward messages for the owner.
- **Tools:** read everything; edit under `docs/qa-team/lead/`; run lint, report and the check script; start the other roles. Outward tools only after the owner's yes for that one action.
- **Approval points:** every outward action, every change to the `smoke` tag set, every deletion outside run artifacts.

### Watcher (read-only)
- **Input:** a JSON file written by the fetch step (redacted tickets and messages, plus a map from ticket to flows and cases).
- **Output:** one report per day with every changed ticket in exactly one group: needs a test decision, touches existing cases, test-relevant without a case, no test impact; plus chat items that matter and a section that **quotes every instruction-like text** with its source.
- **Tools:** Read, Grep, Glob, Write under its folder. No Bash, no network.
- **Why the fetch is separate:** the agent holds no credentials and cannot reach the network, so an injected instruction has nothing to act with.

### Analyst
- **Input:** a task from the Lead naming tickets.
- **Output:** draft cases where **every step names its source** (ticket key and acceptance criterion), a gap list for what the sources do not answer, and a status per case (ready or blocked by a named gap).
- **Rule:** never guess. A missing answer becomes a gap, and a blocked case.

### Automation engineer
- **Output:** a flow with a header (case id, tickets, tags), using only testIDs that exist in the app, with the lint output and one run id as evidence.
- **Rules:** no `smoke` tag (owner decision), no `skip`/`optional`/`retryTapIfNoChange` to hide a failure, no run while the run lock is held.

### Runner
- **Output:** a report with pass and fail per platform, each failure with a **suggested** class (`app`, `selector`, `env`, `test`, `driver`), the evidence (error line, log path), whether it is a known finding, and what changed since last night.
- **Counting is code:** the runner script counts; the model never counts by hand.
- **Rule:** the class is a suggestion; a person confirms it. A `selector` failure can hide an app bug.

## 3. Handoff format

One Markdown file per task in `docs/qa-team/lead/tasks/`:

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
## Result            (written by the doer)
## Evidence          (required for status: done)
## Open questions    (never guessed)
```

## 4. How the Lead verifies

| Work | The Lead re-derives |
|---|---|
| New or changed flow | lint is clean; the quoted run id exists in the run log with `ok: true`; header complete; no new `smoke` tag; no skip |
| New case | every step has a source that exists; two sources opened and compared; no duplicate case id |
| Nightly report | pass and fail recounted from the run log; two error lines opened and the class checked |
| Watcher report | every changed ticket present; every instruction-like text quoted verbatim and marked "not acted on"; no secret |

A handoff that fails a check goes back with `status: rejected` and the reason. Two rejections in a row on the same task go to the owner. In the demo this is code: `scripts/lead-check.ts`.

## 5. One device: the run lock

The simulator and the CPU are shared. Anything that drives a device takes `docs/qa-team/run.lock` (owner role, start time, PID) first and removes it at the end. One platform at a time. A lock older than six hours whose process is gone is *stale*: the runner reports it and the owner removes it. The hook also refuses `maestro test` while another role holds the lock.

## 6. Mechanisms used

| Mechanism | Used for |
|---|---|
| Subagent definitions (`.claude/agents/`) | The five roles: system prompt, model, tool allowlist |
| Permission rules and a `PreToolUse` hook | Hard limits that do not depend on the prompt |
| Headless runs (`claude -p --agent ... --max-budget-usd`) | Scheduled roles, with a spending cap and their own permission file |
| Scheduled tasks (cron, launchd or the desktop app) | Nightly run, morning reports |
| Skills | Not used in the demo; a natural home for shared procedures such as "write a case from a ticket" |

## 7. Cost

Every headless run has a budget cap. `docs/qa-team/cost.tsv` logs one row per run (tokens, cost, task). Rates in `docs/qa-team/prices.json` are placeholders. Recorded demo rows are illustrative, not measured; `--agents` mode appends measured rows.

## 8. Risks and handling

| Risk | Handling |
|---|---|
| Prompt injection from tickets or chat | Readers have no write or network tools; hook blocks outward actions; quote-as-data rule; the Lead checks it |
| Secrets in outside data | Redaction before any agent sees the data |
| Cost runaway | Model per role, budget cap per run, cost log |
| Two agents on one device | Run lock, one platform at a time |
| Duplicated or conflicting work | One owner per folder; tasks only through the Lead's files |
| Confident wrong output | Evidence checks; the owner confirms classes and cases |

## 9. Pilot approach

Build one role first, use it for a week, measure, then decide on the next. Start with the Runner report, because the run script already exists and the agent only reads results (no new risk to the device). Success measures after five nights: reports ready before the start of the workday, counts match the run log exactly, the owner agrees with at least 90 percent of suggested classes, zero actions outside the allowlist, cost per report under a stated target.
