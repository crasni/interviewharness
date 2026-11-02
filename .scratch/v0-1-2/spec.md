# v0.1.2: ten problems

Status: done (2026-11-02: tickets 01–14 done; the owner approved the nine drafts)

Decisions: the owner's grilling on 2026-11-02 (in this spec), the v0.1.0 grilling's round 3 (`.scratch/v0-1-0/grilling.md`: the ten topics and the problem folder format) and AGENTS.md (content is CC BY 4.0, no LeetCode text).

## Problem Statement

A candidate can only ever practise one problem. Every coding round is Two sum, so after one or two rounds they know the answer before the interviewer says hello, and the round stops being practice for anything but talking. Real coding rounds draw from a handful of common topics (stacks, intervals, sliding windows, graphs, heaps, dynamic programming), and the candidate can't rehearse any of them here.

## Solution

v0.1.2 brings ten original problems, all written in our own words, one per common topic:

| # | Problem | Topic | Difficulty |
|---|---|---|---|
| 1 | Two sum (already here) | hash map | easy |
| 2 | Balanced brackets | stack | easy |
| 3 | Merge meeting times | intervals | medium |
| 4 | Longest run with no repeated letter | sliding window | medium |
| 5 | Smallest truck size to ship in D days | binary search | medium |
| 6 | Shortest path in a grid with walls | grid BFS | medium |
| 7 | K closest stores | heap | medium |
| 8 | Recently-used cache | LRU cache | medium |
| 9 | Course order | topological sort | medium |
| 10 | Fewest coins | dynamic programming | hard |

**Start coding round** gives a problem at random from the ten, like a real interview. A quiet **Choose a problem** link under it swaps the round list for the ten problems in place, each with its title, difficulty and how many times the candidate has done it ("Done twice"); clicking one starts that round. The topic is never shown, since it gives the approach away.

Claude drafts the nine new problems; the owner reads all of them before v0.1.2 merges and marks what to change.

## User Stories

### Getting a problem
1. As a candidate, I want Start coding round to give me a problem I didn't pick, so that the round feels like a real interview where I meet the question cold.
2. As a candidate, I want the random problem to come from all ten, so that I get practice across every topic over time.
3. As a candidate, I want a Choose a problem link under Start coding round, so that I can redo a problem on purpose or practise one topic I'm weak on.
4. As a candidate, I want the link to be quiet text rather than a second button, so that the one main action on the Start screen stays Start coding round.
5. As a candidate, I want the problem list to replace the round list in place, with a Back control, so that I stay on the Start screen and can return without losing anything.
6. As a candidate, I want each problem in the list to show its title and difficulty, so that I can pick something that fits how much I want to stretch.
7. As a candidate, I want the list not to show each problem's topic, so that choosing a problem doesn't tell me how to solve it.
8. As a candidate, I want each problem to say how many times I've done it ("Done once", "Done twice", "Done 3 times"), so that I can tell what I've already practised.
9. As a candidate who has never done a problem, I want nothing shown for it rather than "Done 0 times", so that the list stays quiet.
10. As a candidate, I want clicking a problem in the list to start the round on it straight away, so that choosing takes one click.
11. As a candidate, I want the list to scroll inside its own area when the window is short, so that the Start screen never scrolls as a page.
12. As a candidate, I want the list reachable and usable by keyboard, so that I don't need the mouse to choose.
13. As a candidate whose model isn't set up yet, I want the Choose a problem link to be hidden along with Start coding round, so that I can't start a round that can't run.

### In the room
14. As a candidate, I want the problem panel to show the statement of the problem this round is on, so that what I read matches what the interviewer is asking.
15. As a candidate, I want the interviewer to know the round's problem, its notes, hint ladder, follow-ups and reference, so that it answers my questions and judges my code for the problem I'm actually solving.
16. As a candidate, I want Feedback graded against the round's problem, so that the verdict is about what I solved.
17. As a candidate, I want the hint ladder of each problem to go from a nudge to a question to something concrete, never code, so that help works the same on every problem.
18. As a candidate who finishes early, I want each problem to have follow-up questions, so that the Follow-up phase works on all ten.

### The problems themselves
19. As a candidate, I want every statement written plainly with examples and constraints, so that I can start clarifying without guessing what's asked.
20. As a candidate, I want examples that include at least one edge case, so that the statement is honest about what the code must handle.
21. As a candidate, I want each statement to leave some details to ask about, as a real interviewer would, so that Clarify is worth doing; and I want the interviewer's notes to answer those questions consistently.
22. As a candidate, I want the medium problems to be solvable in a 45-minute round, and the one hard problem to be reachable in it, so that every round can end with a working solution.
23. As a candidate, I want the cache problem to be a class with methods, so that it feels like the design question it is in real interviews.
24. As a candidate, I want problems in our own words rather than copied from a practice site, so that the content is free to share.

### Rounds and history
25. As a candidate, I want each round's log to name its problem, so that I (and the app) can tell later which problem a round was.
26. As a candidate who played Two sum before v0.1.2, I want those rounds counted as Two sum, so that my history starts right.
27. As a candidate, I want my done counts to come from the rounds already saved in my data folder, so that nothing new is stored and deleting a round folder takes it out of the count.

### Contributors and the owner
28. As the owner, I want all nine drafts written before I review, so that I can read them side by side for consistency of tone and difficulty.
29. As the owner, I want each problem in its own commit, so that I can comment on and change one without touching the others.
30. As a contributor, I want tests.json to describe a class problem as a list of calls and what each returns, so that design problems fit the same folder format.
31. As a contributor, I want the app to refuse a problem folder that's incomplete or malformed, naming the folder and what's wrong, so that a broken problem never ships.
32. As a contributor, I want CI to run every reference solution against its own tests on macOS, Windows and Linux, so that a wrong reference or a wrong expected answer is caught before the interviewer judges anyone against it.
33. As a contributor, I want that check kept out of the normal test run, so that running the tests locally never needs Python.
34. As a contributor, I want the content README to describe the class form of tests.json, so that I can write a new design problem without reading code.
35. As a contributor, I want every problem.yaml to credit "InterviewHarness contributors" under CC BY 4.0 with source "original", so that the license is clear per problem.

## Implementation Decisions

### Problem content
- Nine new folders in the existing problem folder format: `statement.md`, `problem.yaml`, `interviewer.md` (Notes, Hint ladder with Nudge / Question / Concrete, Follow-ups), `reference/solution.py`, `tests.json`. Folder names are lower case with dashes and pass the existing name check.
- Two sum's folder is the model to follow: the same section names, tone and level of detail in the notes (key idea, answers to likely questions, common mistakes, a trace to suggest when the candidate says they're done).
- Every problem has at least five test cases with unique ids, including the statement's examples and the edge cases the notes name, and two or three follow-ups.
- Written from the idea alone, in our own words. No text, titles or examples from LeetCode or any other site.
- Difficulty is as in the table above; the `pattern` field holds the topic and is used only by the interviewer, never shown to the candidate.

### tests.json for classes
- A problem's tests are either the existing function form or a new class form; never both. The class form came from the grilling:

```json
{
  "class": "RecentCache",
  "cases": [
    {
      "id": "evicts-least-recent",
      "description": "…",
      "calls": [["RecentCache", 2], ["put", 1, 10], ["put", 2, 20], ["get", 1], ["put", 3, 30], ["get", 2]],
      "expected": [null, null, null, 10, null, -1]
    }
  ]
}
```

- The first call constructs the class; each later call is a method name and its arguments. `expected` has one entry per call (null for the constructor and for methods that return nothing).
- The engine's problem type gains a union for the two forms; the reader checks the class form (a class name, calls and expected of equal length, the first call naming the class) and fails with the folder's name otherwise.

### Picking a problem
- Main owns the problem list. A new IPC call lists the problems the Start screen may show: name, title, difficulty and how many rounds were done on each. It never sends the topic, notes or reference to the renderer.
- Starting a round takes an optional problem name. Without one, main picks uniformly at random from all problems. An unknown name is refused.
- The round's problem replaces the single global Two sum in main: the interviewer, the round's log and Feedback grading all use the problem the round started with.
- The round snapshot carries the problem's name, title and statement; the problem panel renders the statement from the snapshot instead of importing Two sum's file.
- The first entry of each round's events.jsonl records the problem's name.
- The done count is read from the rounds folder: each round folder whose log names a problem counts once for it; a round folder whose log names no problem predates v0.1.2 and counts as Two sum. Unreadable logs are skipped, never fatal.
- "Done" counts rounds started, whatever happened in them.

### Start screen
- "Choose a problem" is a text link under Start coding round, shown only when Start coding round is. It swaps the round list for the problem list in the same place: a Back control, the heading "Choose a problem", then one row per problem with its title, difficulty (Easy, Medium, Hard) and its done count when above zero ("Done once", "Done twice", "Done 3 times"). The list is ordered by difficulty, then by title.
- Each row is a button; clicking it starts the coding round on that problem. The list scrolls inside its own region. Styling uses the role tokens only.

### The reference check
- A small Python script (standard library only) reads every problem folder, imports its reference solution, and runs each test case: the function form calls the function with the input as keyword arguments; the class form replays the calls. It compares results to `expected` and exits non-zero naming each failing case.
- Where a problem accepts several right answers (Two sum's "any order"), the problem's tests.json may mark the comparison as unordered; the script honours it. Kept as small as the ten problems need. Course order accepts any valid order, which the function form can't compare, so its first example (two right orders) is left out of its tests and every case it has has exactly one right order.
- CI runs it on all three OSes with a pinned Python from actions/setup-python, as its own step, outside `pnpm test`.

## Testing Decisions

Good tests here check what a candidate or contributor would see: a folder accepted or refused with a clear message, the room showing the right statement, a count on the Start screen. They don't check private helpers or how the random pick is made.

- **Reading a problem folder** (engine, prior art: the existing problem reader tests): the class form is read; a class form with mismatched calls and expected, a missing constructor call, or both forms at once is refused with the folder's name; the function form still reads as before.
- **The bundled content** (desktop, prior art: the existing problems test): all ten problems load; each has a non-empty hint ladder, at least two follow-ups, at least five test cases, and a difficulty matching the table; names pass the OS check.
- **The real app** (Playwright, prior art: the start-round and room end-to-end specs, launched on a throwaway data folder): Start coding round opens the room on one of the ten problems and its statement shows in the problem panel; the round's log names that problem; Choose a problem lists ten rows with no topics shown, Back returns to the rounds, and clicking a row starts that problem; round folders put in the data folder before launch (including one with no problem named) produce "Done once" and "Done twice" on the right rows; the link is hidden when no model is set up.
- **Reference solutions**: the Python script in CI, as above. It's also run once by hand on each draft while writing it.
- No network in any test; the scripted fake model drives the interviewer as today.

## Out of Scope

- A mode that prefers problems you haven't practised, or haven't practised for a long time (the owner's idea; for later).
- Filtering or sorting the list by difficulty, and showing topics anywhere to the candidate.
- Reference solutions in languages other than Python.
- Running the candidate's code (v0.3's runner); tests.json is evidence for the interviewer and for that later runner.
- Problems for system design or AI-assisted rounds.
- Any change to the interviewer's behaviour, grading rules or round length.

## Further Notes

- Branch: `release/v0.1.2`, started on top of `release/v0.1.1` while v0.1.1's PR waits for CI; main is merged in once v0.1.1 lands.
- The owner approved the nine drafts on 2026-11-02.
- "Problem" isn't in GLOSSARY.md yet; add it (one coding question, with its statement, interviewer notes, hint ladder, reference and tests).
