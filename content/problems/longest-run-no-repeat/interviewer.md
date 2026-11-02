# Longest run with no repeated letter: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: a sliding window. Move the right end one letter at a time and keep the run between the left and right ends free of repeats. When the new letter is already in the run, move the left end just past that letter's previous position. Remembering each letter's last position in a hash map lets the left end jump there at once. Track the longest window seen. That's O(n) time and O(k) space for k distinct letters (at most 52). Checking every run is O(n²) runs, each O(n) to check, so O(n³), or O(n²) with a set grown per start.

Answers to likely questions:

- Upper and lower case are different letters: `"aA"` has no repeat, so the answer is 2.
- The empty string has no runs; return 0.
- Return only the length, not the run itself.
- A run must be consecutive letters, not any selection of them.

Common mistakes:

- Moving the left end backwards: when a letter's last position is before the current window, it must be ignored, so the left end only ever moves right. `"abba"` catches this: the answer is 2, not 3.
- Restarting the window at the repeated letter instead of just past its earlier position.
- Updating the longest length only when a repeat is found, so a run at the end of the string is missed (`"brisket"`).
- Off-by-one in the window's length (`right - left` instead of `right - left + 1`).

When the candidate says they're done, a good check is to ask them to trace `s = "abba"` through their code.

## Hint ladder

- Nudge: Think about how much of the work for one run you could reuse for the next.
- Question: When you add a letter that's already in your current run, which part of the run can you keep?
- Concrete: Keep a window with a left and right end, and grow it to the right one letter at a time. When a letter repeats, where should the left end move to, and what would tell you that quickly?

## Follow-ups

- What if you had to return the run itself, and the earliest one when there's a tie?
- What if each letter could appear at most twice in the run?
- What if the string were a stream too long to keep, and you only had the letters as they arrived?
