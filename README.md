# QA Agents Demo: an agentic QA team on a mock mobile app

Five Claude agents (QA Lead, Watcher, Analyst, Automation engineer, Runner) run an end-to-end test process on **TokenEstate**, a mock mobile app for fractional, tokenized real-world assets. The point is the *process*: narrow tools, evidence-based handoffs, a human who approves every outward action, and defences against prompt injection that do not rely on the model behaving.

Everything is fake: the app, the backend, the tickets, the chat. It needs no company access and no device to demo.

## Live demo (no install)

[![Animated walkthrough: an agentic QA team starts on a new project](docs/img/walkthrough.png)](https://huseyinozturk.github.io/agentic-qa-team-demo/)

**Animated walkthrough:** [huseyinozturk.github.io/agentic-qa-team-demo](https://huseyinozturk.github.io/agentic-qa-team-demo/). It plays the six phases of a team starting on a new project, from the real output of the demo.

To browse the raw results without running anything: [docs/example-output/](docs/example-output/).

## 5-minute quickstart

Prerequisites: **Node 22.18 or newer** (the TypeScript scripts run directly, no build) and `bash`. Nothing to install for the demo itself.

```bash
git clone https://github.com/huseyinozturk/agentic-qa-team-demo && cd agentic-qa-team-demo
./scripts/demo.sh
```

That plays one story in *recorded* mode (about 15 seconds, offline): **the team meets a project for the first time.**

1. **QA Lead** collects the documents and tickets, groups them and decides which test type (unit, API, end-to-end) fits what, and writes the test plan.
2. **Analyst** writes cases per type. Every step and expectation names a source. Documents have a ranking; where two disagree, a clarification question is drafted for the people who own them. It also proposes the smoke, critical and regression suites (the owner approves the first two).
3. **Automation engineer** turns the ready end-to-end cases into Maestro scripts, checks that the app has the testIDs the cases need, and notes what is missing.
4. **Runner** executes the plan (smoke on every build, regression nightly) and reports per test *and* per host resource (CPU, memory, swap, disk, duration).
5. **QA Lead** reads the report and drafts tickets for the findings. Filing needs the owner's approval; the script refuses without it.
6. **Watcher** follows the tracker and chat in the background. A ticket labelled `e2e` moves to the test status, so the Lead has a case and a script made and the suite grows. Two planted prompt injections and a fake token show the safety model.

At the end the Lead reviews every handoff by re-deriving the evidence (one is rejected), the cost log is printed and the privacy check runs.

**Prefer pictures to terminal text?** The last step builds a clickable visual walkthrough from the real outputs: `open docs/visual/index.html` (or `OPEN=1 ./scripts/demo.sh`). It opens with an animated diagram of the six phases (who talks to whom), then one scene per phase: plan, cases and document conflicts, scripts and testID gaps, runs and host metrics (click a failing test for its evidence), tickets with the owner-approval gate, the Watcher with the planted attacks, and finally review and cost. Arrow keys navigate.

Useful options: `./scripts/demo.sh --pause` (wait for Enter between steps, for presenting) and `./scripts/demo.sh --agents` (see below). The presenter script is in [docs/demo-script.md](docs/demo-script.md). One finished run is committed in [docs/example-output/](docs/example-output/).

## Architecture

```mermaid
flowchart LR
  SRC[(Documents<br/>+ tickets)] -->|1 collect, group| L
  L[QA Lead<br/>Opus] -->|2 strategy| A[Analyst<br/>Opus]
  A -->|cases + questions| L
  A -.->|clarifications| O((Owner approves<br/>every outward action))
  L -->|3 ready cases| E[Automation engineer<br/>Sonnet]
  E -->|scripts + testID gaps| L
  L -->|4 test plan| R[Runner<br/>Sonnet]
  R -->|report: tests + host resources| L
  E --> DEV
  R --> DEV
  subgraph dev[One device: run lock]
    DEV[runner CLI] --> M[Maestro scripts] --> APP[TokenEstate app] --> BE[mock backend<br/>failure modes]
  end
  L -.->|5 draft tickets| O
  O -->|files| TR[(Tracker + chat)]
  TR -->|6 daily news| F[fetch.ts<br/>redacts secrets]
  F --> W[Watcher<br/>Sonnet, read-only]
  W -->|what changed| L
  H{{hook, deny rules,<br/>budget caps}} -.guards.- A
  H -.guards.- E
  H -.guards.- R
  H -.guards.- W
  H -.guards.- L
```

## What is in the repo

| Path | What |
|---|---|
| `app/` | Expo (React Native) app, every interactive element has a kebab-case `testID` |
| `mock-backend/` | Node mock backend with switchable failure modes, unit-tested |
| `e2e/` | Maestro flow headers (case id, tickets, tags), shared subflows, suites (`smoke`, `critical`, `regression`), owner-approved suite allowlist. Flows start empty: the Automation engineer step creates them from `samples/` |
| `runner/` | TypeScript runner: `lint`, `list`, `run`, `report`, `lock`; writes `results/runs.jsonl` with failure class `app/selector/env/test/driver`; recorded-run mode |
| `.claude/agents/` | The five agents (model, tool allowlist, trigger, budget) |
| `.claude/settings.json`, `.claude/hooks/` | Deny rules and the `PreToolUse` guard |
| `docs/qa-team/` | Roster, per-role permission files, handoffs, reports, run lock, cost log |
| `fixtures/`, `scripts/fetch.ts` | Fake project documents (product requirements, API spec, design notes), mock tracker and chat data, and the redacting fetch step |
| `docs/visual/` | The animated, clickable walkthrough built by `scripts/build-visual.ts` |
| `samples/` | Recorded agent outputs used by the offline demo |
| `docs/design.md`, `docs/safety.md`, `docs/seeded-bugs.md`, `docs/demo-script.md` | Design, safety model, the two seeded bugs, interview walkthrough |

## Recorded vs live

| | Recorded (default) | Live |
|---|---|---|
| Test runs | Replays `runner/recordings/*.json` through the real runner, classifier, lock, lint and report code | `node runner/src/cli.ts run --suite regression --mode live` runs `maestro test` against the app on a booted simulator, with the mock backend running |
| Agent steps | Pre-written sample outputs in `samples/`, checked by the real Lead script | `./scripts/demo.sh --agents` runs each role headless via `scripts/run-agent.sh` (needs the `claude` CLI and `ANTHROPIC_API_KEY` in the environment; the key is never read from a file) |
| Cost log | Illustrative placeholder rows, labelled `recorded` | Measured rows labelled `live` |

Live device run, step by step: `cd app && npm install && npx expo run:ios`, then `node mock-backend/server.mjs`, then the runner command above. Needs [Maestro](https://docs.maestro.dev) and Xcode with a simulator.

## Safety model (short)

Agents draft, the owner decides and sends. Layers: narrow tool allowlists (the Watcher has no Bash and no network); per-role permission files; project deny rules; a `PreToolUse` hook that blocks dangerous commands, owner-only files, device use while locked, and outward actions unless the owner approved that one action; a fetch step that is the only code touching the tracker and chat and redacts secrets; a run lock; budget caps; and a Lead that re-derives evidence instead of trusting summaries. Details and the planted attacks: [docs/safety.md](docs/safety.md).

## Honest limits

- **Recorded mode is a replay.** The runner, classifier, lock, lint, report, fetch, redaction and Lead checks are real code. The agent outputs in `samples/` are written by hand in the style of the agents; they are not fresh model output. Only `--agents` produces fresh output.
- **Not verified here:** the `--agents` mode and a live Maestro run on a simulator were not exercised. The Expo app type-checks (`cd app && npm install && npm run typecheck` passed when this was written) but has never been run on a device or simulator.
- The failure classifier is a handful of regular expressions: it suggests, a person confirms. It will misclassify. The recorded `invest-001` case is a deliberate example.
- The injection defences are layered, not proof. The strongest ones are structural (no tools to act with). Prompt wording and the heuristic flagging in `fetch.ts` are weaker. A determined attacker with write access to a tool an agent legitimately has could still do damage inside that tool's scope.
- The hook uses pattern matching on commands, so it is conservative: it can block harmless commands that merely contain a blocked word, and it is not a sandbox. Use OS-level isolation for anything real.
- Costs in the log are placeholders unless the mode is `live`; token prices in `docs/qa-team/prices.json` are placeholders too.
- One mock app, one platform in the recordings, a few dozen cases and eleven flows: it is a teaching demo, not a benchmark.

## Privacy

`scripts/privacy-check.sh` scans the repo for company or personal identifiers, tracker keys of real projects, secrets, non-placeholder URLs and e-mail addresses, and image files. Add your own terms to `.privacy-terms.local` (git-ignored). Run it before every push.
