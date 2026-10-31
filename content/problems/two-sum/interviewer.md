# Two sum: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: while walking the list once, remember each value's position in a hash map, and for each new value check whether `target - value` is already there. That's O(n) time and O(n) space. Checking every pair is O(n²) time and O(1) space; sorting first loses the original positions unless they're carried along.

Answers to likely questions:

- The list always has at least two values, and exactly one pair adds up to `target`.
- Values can be negative or zero, and can repeat.
- The same position can't be used twice, but two equal values at different positions can.
- Return the two positions in any order.
- The input fits in memory; no need to stream it.

Common mistakes:

- Putting every value in the map before looking any up, then pairing a value with itself (6 + 6 for target 12 with a single 6).
- Losing a position when a value repeats, if the map is filled first and later positions overwrite earlier ones.
- Returning the values instead of their positions.

When the candidate says they're done, a good check is to ask them to trace `nums = [5, 1, 5]`, `target = 10` through their code.

## Hint ladder

- Nudge: Think about what you need to know about the values you've already seen.
- Question: For each value, which other value would complete the pair, and how fast can you check whether you've seen it?
- Concrete: Some structure could tell you in constant time whether a value's partner has already appeared. Which one, and what would it hold?

## Follow-ups

- What if the list were sorted? Can you do it in O(1) extra space?
- What if there could be several pairs, and you had to return all of them?
- What if the list were too big to fit in memory?
