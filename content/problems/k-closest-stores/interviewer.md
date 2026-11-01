# K closest stores: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: keep the k closest stores seen so far in a max-heap keyed by distance. For each store, push it; when the heap holds more than k, pop the farthest. What's left are the k closest. That's O(n log k) time and O(k) space. Sorting every store by distance and taking the first k is O(n log n) and a fine first answer; the heap matters when k is much smaller than n or the stores arrive as a stream. Quickselect gives O(n) on average. Comparing squared distances avoids square roots and floating-point error.

Answers to likely questions:

- Distance is the straight line: the square root of dx² + dy². Comparing dx² + dy² gives the same order.
- When two stores are equally far at the cut-off, either one is fine; the tests never have such a tie.
- Two stores can be at the same point; they count as two stores.
- A store can be at home itself, distance 0.
- Return the stores as points, in any order.

Common mistakes:

- Measuring from the origin instead of from `home`.
- Capping a min-heap at k stores: popping its smallest drops the closest store each time, leaving the farthest. (A min-heap of every store, popped k times, is fine: O(n + k log n).)
- In Python, `heapq` is a min-heap: pushing the negative distance makes it act as a max-heap. Forgetting the minus sign keeps the k farthest stores.

When the candidate says they're done, a good check is to ask them to trace the second example, with home away from the origin.

## Hint ladder

- Nudge: Think about whether you need every store in order, or only some of them.
- Question: As you go through the stores, what's the one store you'd drop from your best k so far when a closer one turns up?
- Concrete: Keep only k stores at a time in something that always tells you the farthest of them quickly. What structure does that, and what do you do when it holds k + 1?

## Follow-ups

- What if stores kept opening, and you had to answer "k closest" after each new one?
- What if k were close to the number of stores? Would you still use a heap?
- How would you find the k closest when there are a billion stores on many machines?
