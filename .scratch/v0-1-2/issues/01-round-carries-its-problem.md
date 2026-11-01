# 01: The round carries its problem

**What to build:** A coding round starts on a problem chosen by main instead of the one global Two sum. Start coding round picks uniformly at random from every problem loaded (only Two sum until the new problems land). The round snapshot carries the problem's name, title and statement, and the room's problem panel shows that statement. The first entry of the round's events.jsonl names the problem. The interviewer's prompt and Feedback grading use the round's problem. Starting a round takes an optional problem name; an unknown name is refused. A content test checks that every bundled problem is complete.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Starting a round with no name picks at random from all loaded problems; with a name, that problem; an unknown name is refused
- [x] The problem panel renders the statement from the round snapshot, not a bundled import of Two sum
- [x] The round's first log entry names its problem
- [x] The interviewer and Feedback grading use the round's problem, not a global one
- [x] A desktop test checks every bundled problem has a hint ladder, at least two follow-ups, at least five test cases and a valid difficulty
- [x] End-to-end: Start coding round shows a loaded problem's statement and the log names it

Spec: `.scratch/v0-1-2/spec.md`.
