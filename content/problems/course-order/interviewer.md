# Course order: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: a topological sort of the graph with an edge from `before` to `course`. Count each course's unmet prerequisites; start a queue with every course that has none. Take a course from the queue, add it to the order, and lower the count of each course that needed it, queueing any that reach zero. If the order ends up shorter than `count`, some courses wait on each other in a cycle: return `[]`. That's O(count + prerequisites) time and space. Depth-first search with three states per course (not visited, in progress, done) also works: an edge back to a course in progress is a cycle, and courses in the reverse of the order they finish make a valid order.

Answers to likely questions:

- Any valid order is fine; the answer isn't unique.
- A pair can appear twice. Counting it twice is fine as long as both copies are removed again.
- A course can list itself as a prerequisite; then no order works.
- Courses that no pair mentions can go anywhere in the order.
- Return the course numbers in the order they're taken.

Common mistakes:

- Getting the edge's direction backwards, so the order comes out reversed.
- Forgetting the courses with no prerequisites and no dependents, which never enter the queue if only courses named in pairs are considered.
- Not detecting a cycle: returning a partial order instead of `[]`.
- In the depth-first version, using only "visited" without "in progress", which can't tell a cycle from a course reached twice by two paths.

When the candidate says they're done, a good check is to ask them to trace `count = 2`, `prerequisites = [[0, 0]]` through their code.

## Hint ladder

- Nudge: Think about which courses could be taken first of all.
- Question: Once you've taken a course, which other courses get closer to being ready, and how would you know when one is ready?
- Concrete: Keep track, for each course, of what still stands in its way. Which courses can you take right now, what changes once you take one, and what would it mean to get stuck before every course is taken?

## Follow-ups

- If several courses can be taken in the same term, what's the fewest terms needed?
- What if you had to return the lowest-numbered course first whenever there's a choice?
- How would you tell the student which courses form the cycle?
