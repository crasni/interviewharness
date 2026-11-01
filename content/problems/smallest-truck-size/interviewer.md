# Smallest truck size to ship in D days: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: binary search on the answer. For a given capacity, a greedy pass counts the days needed: fill each trip until the next package won't fit. A bigger truck never needs more days, so the capacities that work form a range with a smallest member. The answer is between the heaviest package (anything smaller can't carry it) and the total weight (one trip). Searching that range takes O(log(total)) checks of O(n) each, so O(n log(total)) time and O(1) extra space. Trying every capacity from the heaviest package upwards works but is O(n · total).

Answers to likely questions:

- The truck leaves each day with what fits; it can leave with less than its capacity, and it can't leave empty while packages wait.
- Finishing in fewer than `days` days is fine.
- Weights and capacity are whole numbers.
- There's always at least one package, and `days` is never more than the number of packages.
- The greedy filling is the rule, not something to optimise: the order is fixed and each trip takes the next packages in the row.

Common mistakes:

- Starting the search at 1 or 0 instead of the heaviest package, so the day count loops forever or comes out wrong when a single package doesn't fit.
- Off-by-one in the binary search, returning a capacity one too big or one too small. Searching for the first capacity that works, with `low < high` and `high = mid` when it works, avoids it.
- Counting days wrong in the greedy pass: forgetting the last trip, or starting a new trip before adding the package that didn't fit.
- Searching with the check reversed (moving to bigger capacities when one works).

When the candidate says they're done, a good check is to ask them to trace `weights = [5, 1, 8]`, `days = 3` through their code.

## Hint ladder

- Nudge: Think about how you'd check whether one particular capacity is enough.
- Question: If a capacity of 10 works, what do you know about a capacity of 11? And what's the smallest and largest the answer could be?
- Concrete: The capacities that work are everything from some value upwards, and you can check any one capacity in a single pass. How could you find where that range starts without trying every capacity?

## Follow-ups

- What if packages could be loaded in any order? Is the problem still easy?
- What if there were two trucks a day?
- What if the weights could be fractions of a kilogram?
