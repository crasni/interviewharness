# Longest calm stretch

A sensor on a quiet street records the noise level once a minute. You're given those readings as a list of integers, and a tolerance `t`.

A **calm stretch** is a run of consecutive readings where the loudest and the quietest reading differ by at most `t`.

Return the length of the longest calm stretch.

## Example 1

```
readings = [4, 6, 5, 9, 8, 8, 7, 12]
t = 2
```

Answer: `4`. The stretch `[9, 8, 8, 7]` has a loudest of 9 and a quietest of 7, a difference of 2. No longer stretch stays within 2.

## Example 2

```
readings = [3, 3, 3]
t = 0
```

Answer: `3`. Every reading is the same.

## Example 3

```
readings = [1, 10, 1, 10]
t = 5
```

Answer: `1`. Any two neighbours differ by 9.

## Constraints

- `1 ≤ len(readings) ≤ 100,000`
- `0 ≤ readings[i] ≤ 1,000,000,000`
- `0 ≤ t ≤ 1,000,000,000`
