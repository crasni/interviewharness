# Fewest coins

A country's coins come in the values listed in `coins`, and you have as many of each as you like.

Return the fewest coins that add up to exactly `amount`, or `-1` if no mix of coins does.

## Example 1

```
coins = [1, 3, 4]
amount = 6
```

Answer: `2`. Two 3s.

## Example 2

```
coins = [2]
amount = 3
```

Answer: `-1`. Twos can't make an odd amount.

## Example 3

```
coins = [1, 5, 10]
amount = 0
```

Answer: `0`. No coins are needed.

## Constraints

- `1 ≤ len(coins) ≤ 12`
- `1 ≤ coins[i] ≤ 10,000`, all different
- `0 ≤ amount ≤ 10,000`
