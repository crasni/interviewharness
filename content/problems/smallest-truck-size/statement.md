# Smallest truck size to ship in D days

A warehouse has a row of packages to ship, in a fixed order. `weights[i]` is the weight of the i-th package.

One truck makes one trip a day. Each day it's loaded with the next packages in the row, in order, as long as their total weight stays within the truck's capacity, and then it leaves. A package can't be split across trips, and the order can't change.

Return the smallest capacity that ships every package within `days` days.

## Example 1

```
weights = [3, 2, 2, 4, 1, 4]
days = 3
```

Answer: `6`. The trips are `[3, 2]`, `[2, 4]` and `[1, 4]`. With a capacity of 5 it would take four trips.

## Example 2

```
weights = [7, 2, 5]
days = 1
```

Answer: `14`. Everything has to go in one trip.

## Example 3

```
weights = [5, 1, 8]
days = 3
```

Answer: `8`. One package a day, so the truck needs to carry the heaviest one.

## Constraints

- `1 ≤ days ≤ len(weights) ≤ 50,000`
- `1 ≤ weights[i] ≤ 500`
