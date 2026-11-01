# K closest stores

You're given the locations of stores on a city map as points `[x, y]`, your home as a point `home`, and a number `k`.

Return the `k` stores closest to your home, by straight-line distance, in any order.

## Example 1

```
stores = [[3, 4], [1, 1], [-2, 0], [5, 5]]
home = [0, 0]
k = 2
```

Answer: `[[1, 1], [-2, 0]]`. They're about 1.4 and 2 away; the others are 5 and about 7.1 away.

## Example 2

```
stores = [[10, 10], [12, 9], [4, 4]]
home = [11, 11]
k = 1
```

Answer: `[[10, 10]]`. Home isn't at the origin, so distances are measured from `[11, 11]`.

## Constraints

- `1 ≤ k ≤ len(stores) ≤ 100,000`
- `-10,000 ≤ x, y ≤ 10,000`, for the stores and for home
