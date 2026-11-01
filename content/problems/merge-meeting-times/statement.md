# Merge meeting times

You're given a list of meetings from one person's calendar. Each meeting is a pair `[start, end]` of times in minutes since midnight, with `start < end`.

Return the times the person is busy: a list of `[start, end]` blocks where overlapping meetings are merged into one, sorted by start time.

## Example 1

```
meetings = [[540, 600], [570, 630], [720, 780]]
```

Answer: `[[540, 630], [720, 780]]`. The first two meetings overlap from 570 to 600, so they become one block from 540 to 630.

## Example 2

```
meetings = [[900, 960], [600, 660], [630, 645]]
```

Answer: `[[600, 660], [900, 960]]`. The meetings aren't given in order, and the one from 630 to 645 sits inside the one from 600 to 660.

## Constraints

- `0 ≤ len(meetings) ≤ 10,000`
- `0 ≤ start < end ≤ 1,440`
