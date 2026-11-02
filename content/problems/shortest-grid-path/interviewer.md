# Shortest path in a grid with walls: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: breadth-first search from the start. A queue holds squares in the order they're reached, so every square is first reached by a shortest path; mark squares as visited when they're added to the queue, and stop when the bottom-right square comes out (or the queue empties: -1). That's O(rows × columns) time and space. Depth-first search finds a path, not the shortest one, unless it tries every path, which is exponential.

Answers to likely questions:

- No diagonal moves; only up, down, left and right.
- If the start or the bottom-right square is a wall, the answer is -1.
- A one-square grid that's open needs 0 steps.
- Return only the number of steps, not the path.
- All steps cost the same.

Common mistakes:

- Using depth-first search and returning the first path found, which isn't always the shortest.
- Marking a square visited when it comes out of the queue instead of when it goes in, so it's queued many times. Still correct, but much slower on open grids.
- Not checking the grid's edges before looking at a neighbour, or mixing up rows and columns on a grid that isn't square.
- Forgetting that the start itself might be a wall.

When the candidate says they're done, a good check is to ask them to trace the second example, and then a grid whose start square is `#`.

## Hint ladder

- Nudge: Think about which squares you can reach in one step, then in two.
- Question: If you explored every square reachable in k steps before any reachable in k + 1, what would the first time you reach the exit tell you?
- Concrete: Explore outwards in layers from the start, taking squares in the order you first reached them. What structure gives you that order, and when should a square count as seen?

## Follow-ups

- What if you also had to return the path itself?
- What if you could break through at most one wall?
- What if some squares were slower to cross, say mud that takes three steps?
