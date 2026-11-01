# Longest run with no repeated letter

You're given a string `s` of letters.

A run is a stretch of consecutive letters in `s`. Return the length of the longest run in which no letter appears twice.

## Example 1

```
s = "parallel"
```

Answer: `3`. The run `"par"` has no repeated letter; every longer run has two `a`s or two `l`s.

## Example 2

```
s = "mmmm"
```

Answer: `1`. Any two consecutive letters are both `m`.

## Example 3

```
s = "brisket"
```

Answer: `7`. No letter repeats, so the whole string is the run.

## Constraints

- `0 ≤ len(s) ≤ 100,000`
- `s` contains only English letters, `a` to `z` and `A` to `Z`.
