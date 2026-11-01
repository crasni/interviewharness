# Shortest path in a grid with walls

You're given a map of a building as a grid: a list of strings `grid`, all the same length. `.` is an open square and `#` is a wall.

You start in the top-left square and want to reach the bottom-right square. Each step moves to the next square up, down, left or right, and can't enter a wall or leave the grid.

Return the fewest steps it takes, or `-1` if the bottom-right square can't be reached.

## Example 1

```
grid = [
  "..#",
  ".##",
  "...",
]
```

Answer: `4`. Down, down, right, right.

## Example 2

```
grid = [
  ".#",
  "#.",
]
```

Answer: `-1`. Walls close off the start.

## Example 3

```
grid = ["."]
```

Answer: `0`. The start is already the bottom-right square.

## Constraints

- `1 ≤ len(grid) ≤ 500`
- `1 ≤ len(grid[i]) ≤ 500`
- Every `grid[i]` has the same length and contains only `.` and `#`.
