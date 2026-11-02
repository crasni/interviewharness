# Merge meeting times: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: sort the meetings by start time, then walk them once. Keep the block being built; if the next meeting starts at or before that block's end, stretch the block's end to the larger of the two ends; otherwise close the block and start a new one. That's O(n log n) time for the sort and O(n) space for the answer. Comparing every pair of meetings is O(n²) and gets merges that chain across several meetings wrong.

Answers to likely questions:

- Meetings that touch merge: one ending at 600 and one starting at 600 become a single block, since there's no free time between them.
- The list may be empty; then the answer is empty.
- The meetings aren't sorted, and two meetings may be identical.
- Return a new list; changing the input is fine too if they say so.
- Every meeting falls within one day, so the times stay between 0 and 1,440.

Common mistakes:

- Not sorting first, so a meeting that should merge with an earlier block is missed.
- Setting the block's end to the next meeting's end instead of the larger of the two, which shrinks the block when one meeting sits inside another (Example 2).
- Using `<` instead of `<=` when comparing a start with the block's end, so touching meetings stay apart.
- Forgetting to add the last block after the loop.

When the candidate says they're done, a good check is to ask them to trace `meetings = [[60, 300], [90, 120], [200, 240]]` through their code.

## Hint ladder

- Nudge: Think about which meetings could possibly overlap a given one.
- Question: If the meetings were in order of start time, what would you need to compare each one with?
- Concrete: Once they're sorted by start time, each meeting either overlaps the block you're building or starts a new one. What decides which, and how does the block change when it overlaps?

## Follow-ups

- Given two people's calendars, how would you find the times both are free?
- What if meetings kept arriving one at a time and you had to keep the busy blocks up to date after each one?
- How many meeting rooms would you need to hold all of these meetings at once?
