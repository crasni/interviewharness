# Course order

A degree has `count` courses, numbered `0` to `count - 1`. Some courses need others first: each pair `[course, before]` in `prerequisites` means `before` must be taken before `course`.

Return an order to take all the courses in, one at a time, that respects every prerequisite. If several orders work, return any of them. If no order works, return an empty list.

## Example 1

```
count = 4
prerequisites = [[1, 0], [2, 1], [3, 1]]
```

Answer: `[0, 1, 2, 3]`, or `[0, 1, 3, 2]`. Course 0 comes first, then 1; after that 2 and 3 can go in either order.

## Example 2

```
count = 3
prerequisites = [[0, 1], [1, 2], [2, 0]]
```

Answer: `[]`. Each course needs another one first, all the way round, so none can be taken.

## Constraints

- `1 ≤ count ≤ 10,000`
- `0 ≤ len(prerequisites) ≤ 50,000`
- `0 ≤ course, before < count`
