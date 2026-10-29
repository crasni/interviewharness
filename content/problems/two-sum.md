# Two sum

You're given a list of integers `nums` and a number `target`.

Find two different positions in the list whose values add up to `target`, and return those two positions (indexes from 0) in any order.

There is always exactly one such pair. A position can't be used twice.

## Example 1

```
nums = [3, 9, 14, 2]
target = 11
```

Answer: `[1, 3]`. 9 + 2 = 11.

## Example 2

```
nums = [5, 1, 5]
target = 10
```

Answer: `[0, 2]`. The two 5s are at different positions, so both can be used.

## Example 3

```
nums = [-4, 7, 0, 12]
target = 8
```

Answer: `[0, 3]`. -4 + 12 = 8.

## Constraints

- `2 ≤ len(nums) ≤ 100,000`
- `-1,000,000,000 ≤ nums[i] ≤ 1,000,000,000`
- `-1,000,000,000 ≤ target ≤ 1,000,000,000`
- Exactly one pair adds up to `target`.
