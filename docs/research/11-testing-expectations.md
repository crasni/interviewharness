# How interviewers score testing

_2026-10-30. Question: how should we score testing when the candidate tests only when the interviewer asks, and the interviewer found the bug?_

## Sources

- **Tech Interview Handbook, coding rubric** (secondary; written by an ex-Meta engineer), https://www.techinterviewhandbook.org/coding-interview-rubrics/
  - Testing is its own area.
  - Strong hire means testing with cases the candidate picks themselves, done systematically, and correcting their own bugs.
  - At the bottom, the candidate didn't spot glaring bugs and announced they were done.
- **Hello Interview, Meta guide** (secondary), https://www.hellointerview.com/guides/meta/e5
  - Verification is one of four graded areas.
  - Candidates are expected to trace their own code, because they can't run it.
  - Minor bugs are tolerated if the candidate can debug them when prompted.
- **Amazon, SDE prep** (primary), https://www.amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep
  - Checking edge cases and testing are framed as the candidate's job. There are no rubric levels.
- **interviewing.io, an interviewer's post on 600+ interviews** (primary for that platform), https://interviewing.io/blog/ive-conducted-over-600-technical-interviews-on-interviewing-io-here-are-5-common-problem-areas-ive-seen
  - Candidates are expected to walk through their code before running it.
  - Finding the root cause of a bug yourself counts under problem solving.
- **Gayle McDowell** (primary), https://gayle.com/blog/2016/3/coding-interviews-and-the-importance-of-perfection
  - A bug alone isn't fatal. What matters is what it reveals and how the candidate responds.
- **Google and Meta** have no public rubric text on this.

## What it means for our scale

Every source treats testing as something the candidate starts.

- **4:** tests unprompted, with their own cases including an edge case, and finds their own bugs.
- **3:** tests unprompted, but misses a corner case.
- **2:** tests only when asked, traces the interviewer's example correctly, and fixes a bug once it's pointed out.
- **1:** never tests, or says they're done with a visible bug.

A bug the interviewer had to point out counts mainly against testing. It counts lightly against coding if it was a small slip. A clean fix once it's pointed out is a small plus.

## Decided

Testing is capped at 2 in code when the candidate never checked their code on their own (ADR 0018). Coding and problem solving get no cap for an interviewer-found bug: how much it costs depends on the bug, so that's left to the grader, who is told who found it.

Any checking the candidate starts counts, not only tracing. The cap is 1 only when they said "done" with a bug they never caught themselves, the bottom of the rubrics. Correct code never checked stays at most 2 (the owner's decision, 2026-10-30, ADR 0019).
