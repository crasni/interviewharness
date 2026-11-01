# Later: interviewer work put off on 2026-10-31

The spec first broke into 12 tickets. After the owner's candidate-led clarification, most of that was more than v0.1.0 needs, so the set was cut to the seven in [issues/](issues/). These are put off until a real round, or voice, shows they're needed. The reasoning for each is in [design-review.md](design-review.md).

- **Separate understanding a turn from choosing the reply** (spec decisions 2, 4, 8). Another rework of the interviewer right after ADRs 0017–0019. Revisit if the one structured reply keeps misreading turns.
- **Question tracking**: ids, answered/declined/replaced states, who started each topic (spec decisions 5–6). A candidate-led interviewer asks few questions; ticket 04 covers the one known bug.
- **Code versions and delivery confirmation over IPC** (spec decisions 17–19). Matters once voice can cut speech off halfway; text shows at once.
- **Versioned, replayable round logs** and old-log handling (spec decision 22). No saved rounds worth protecting yet.
- **Splitting problem content** into public facts, private notes, approved hints and follow-ups (spec decision 12).
- **Checking every reply about the problem.** The owner chose to keep ADR 0019's trigger list; add factual answers only if a real round shows one leaking a hint.
- **A full evaluation harness and release validation**: simulated candidates, model judges, sample sizes, latency reports. Ticket 07 is the small version.
- **A total wait limit across retries** (spec decision 16). Worth doing if real rounds show long waits.
