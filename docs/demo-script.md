# Demo script: 10 minutes

Audience: a hiring manager or a QA/engineering lead. Goal: show that you design an *agentic QA process* with controls, not a chatbot that writes tests.

Setup: `./scripts/demo.sh` already run once, `docs/visual/index.html` open full screen (the visual is the main stage; the terminal is the proof). Arrow keys move between scenes.

## 0. The pitch [0:45] (Overview scene)
"Imagine this team meets a project for the first time. I built five agents and one rule: agents draft, the human approves anything that leaves the building."

Press Play on the animated diagram and walk the six phases (it highlights who talks to whom). Point out: the owner sits at every outward arrow; the Watcher is the only one looking outward, and it cannot act.

## 1. Phase 1: the Lead plans [1:00] (scene "1 · Plan")
- Three documents (ranked) and fourteen tickets, grouped by area.
- The Lead decides the test type per ticket: unit, API, end-to-end. "If a user can see it, it gets an end-to-end case; if the rule lives in the backend, an API case too."
- The plan: smoke on every build, regression nightly, critical before a release.

## 2. Phase 2: the Analyst [1:45] (scene "2 · Cases")
- The source ladder: product requirements beat the API spec beat design notes.
- Two real conflicts (code validity 10 vs 15 minutes, daily limit 5000 vs 10000). "The Analyst does not pick silently. It drafts a question to the team that owns the lower document. The owner sends it. The answer is written down, then the case is complete."
- One question stays open, so one case stays blocked. "No guessing."
- The meter "every step has a source" (all of them).

## 3. Phase 3: scripts [1:00] (scene "3 · Scripts")
- Funnel: cases → automated, waiting for a missing testID, blocked by a question.
- The first run finds two app bugs. "They stay red. The engineer is not allowed to skip or hide a failure."

## 4. Phase 4: the Runner [1:30] (scene "4 · Runs")
- Click tiles for evidence and the suggested cause. Click the doubtful one: "selector" might be an app bug. "The agent suggests, a person confirms."
- Host gauges: swap and memory under pressure may explain the driver failure. "A good report separates test failures from machine trouble."
- Terminal: the run lock refusing a second driver.

## 5. Phase 5: tickets [0:45] (scene "5 · Tickets")
- Drafts with evidence. Click "Owner approves": only then are they filed. Terminal: the filing script refuses without approval.

## 6. Phase 6: the Watcher [2:00] (scene "6 · Watcher")
- The example you want to tell: a ticket labelled e2e moves to the test status. The Watcher catches it, the Lead asks for a case and a script, the suite grows from 10 to 11.
- The planted attacks: two texts that give the agents orders, plus a secret. "Quoted as data, redacted, not acted on. And even if the model were fooled, the Watcher has no shell and no network."

## 7. Review and cost [0:45] (last scene)
- Five handoffs accepted, one rejected by code: empty evidence, a step without a source, a source that does not exist.
- Cost per role against caps (illustrative in recorded mode). Close with the README's "Honest limits".

## Likely questions
- *Why two models?* Case writing is judgement (stronger model); script writing has fast feedback from lint and a run (cheaper model). A hypothesis I would revise with measured cost and quality.
- *Why not let the agents file tickets?* Outward actions are the owner's. Drafts, not sends. The script and the hook both refuse without approval.
- *What if the model ignores its prompt?* The controls are structural: tool allowlists, hook, deny rules, redaction, budget caps.
- *How would this run in CI?* Headless roles with `--max-budget-usd` and their own permission files; secrets as CI secrets.
- *What did you not verify?* A live Maestro run and `--agents` mode with fresh model output. Say it first.
