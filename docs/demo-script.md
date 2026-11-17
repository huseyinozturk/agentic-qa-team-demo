# Demo script: 10 minutes

Audience: a hiring manager or a QA/engineering lead. Goal: show that you design an *agentic QA process* with controls, not a chatbot that writes tests.

Setup: a terminal with the repo, `./scripts/demo.sh --pause` ready, `docs/design.md` and the Mermaid diagram in the README open in another tab. Total runtime about 10 minutes; the numbers in brackets are minutes.

## 0. The pitch [0:30]
"I own end-to-end testing alone. Most of my week is repeatable: reading what changed, turning tickets into cases, writing flows, triaging the nightly. I built a team of five agents that does the repeatable part. Every decision and every outward action stays with me."

Show the architecture diagram. Point at three things: the fetch step is the only thing that touches outside systems; the Watcher cannot reach the network; the owner sits at the end of every outward arrow.

## 1. The team and its guard rails [1:00] (steps 0 and 1)
- Five agent files, each with a tool allowlist, trigger and budget cap. The two readers have no shell.
- The hook self-test: "git push is blocked, a comment on the tracker is blocked unless I approve that one tool."
- Line to say: "The prompt explains the rule; the hook enforces it."

## 2. A reproducible product [1:00] (step 2)
Failure modes of the mock backend: delayed OTP, declined payment, duplicate webhook. "A flaky test is often a flaky environment; I want to switch the environment on purpose." The duplicate webhook shows a seeded app bug (balance 200 instead of 100).

## 3. The E2E layer [1:30] (steps 3 and 4)
- `lint`: flow headers (case id, tickets, tags), selectors must exist in the app, `smoke` tag needs my allowlist, nothing may hide a failure. Show the bad flow being rejected.
- Two nightly runs, then the nightly report: failure classes with evidence, "known finding" versus "new since last night", durations.
- Talking point: "The runner counts, the model never counts. The model reads logs and writes judgement."
- Point at `invest-001`: suggested class `selector`, flagged as doubtful. "The agent suggests, I confirm. A selector failure can be an app bug."

## 4. One device, one driver [0:30] (step 5)
The run lock refusing the second driver. "This is the same idea as a mutex, applied to a simulator that two agents would otherwise fight over."

## 5. Prompt injection, live [2:00] (steps 6 and 7)
- Show `fixtures/tracker.json`: a ticket comment that tells automation agents to mark failures as passed and delete results; a chat message that claims owner approval and asks for an API key; a fake token.
- Run the fetch: the token is redacted before any agent sees it.
- Show the Watcher report's "Quoted instructions": both quoted in fenced blocks, "Not acted on".
- Say why it holds: "Even if the model were fooled, the Watcher has no Bash and no network. And the hook would block the command. And the Lead's check fails any report that does not quote the injection."

## 6. Analyst and Automation engineer [1:30] (steps 8 and 9)
- Case draft: every step has `Source: TE-160 AC2`. One case is *blocked* by a named gap (does a declined payment count towards the daily limit?). "The Analyst never guesses; it asks."
- The new flow `auth-004`: lint output, a run id, the lock taken for the run.

## 7. The Lead rejects a handoff [1:30] (step 10)
`lead-check` accepts four handoffs and rejects one: empty evidence, a step without a source, and a citation to an acceptance criterion that does not exist. "The Lead re-derives, it does not trust summaries. Two rejections in a row go to me."

## 8. Cost and honesty [0:30] (steps 11 and 12)
Cost log per role against budget caps; point at the "illustrative" note. Then the README's "Honest limits": recorded mode is a replay, the classifier is regexes, the hook is not a sandbox.

## Likely questions
- *Why two models?* Case writing is judgement (stronger model); flow writing has fast feedback from lint and a run (cheaper model). It is a hypothesis I would revise with measured cost and quality.
- *Why not let the agents file tickets?* Outward actions are the owner's. Drafts, not sends.
- *What if the model ignores the prompt?* That is why the controls are structural: tool allowlists, hook, deny rules, redaction, budget caps.
- *How would this run in CI?* Headless roles with `--max-budget-usd` and their own permission files; secrets as CI secrets; the run lock replaced by one device per job.
- *What did you not verify?* A live Maestro run, and `--agents` mode with fresh model output. Say it first, before they ask.
