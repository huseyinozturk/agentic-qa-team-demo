# Source hierarchy

When two sources disagree, the higher one wins **as a working assumption**, and the disagreement is sent to the people who own the lower source (and, when it matters, the higher one) to be clarified. A case is completed only when its sources agree or the answer is written down.

| Rank | Source | Owner (fake) | Cited as |
|---|---|---|---|
| 1 | Product requirements | Product | `PRD §2.2` |
| 2 | API specification | Backend team | `API §2.2` |
| 3 | Design notes | Design | `Design §2.1` |
| 4 | Ticket acceptance criteria | Ticket owner | `TE-160 AC2` |
| 5 | Ticket comments and chat | anyone | never a source for a case step on its own |
| - | A written answer to a clarification | the person asked | `Clarification C1` |

Every case, every step and every expectation names at least one source. A step without a source is rejected.
