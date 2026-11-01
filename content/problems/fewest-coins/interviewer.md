# Fewest coins: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: dynamic programming over amounts. The fewest coins for an amount `a` is one more than the fewest for `a - c`, taken over every coin `c` no bigger than `a`; the fewest for 0 is 0. Fill a table from 0 up to `amount`, marking amounts that can't be made (with infinity, say). That's O(amount × len(coins)) time and O(amount) space. Breadth-first search over amounts, one coin per step, gives the same answer in the same time. Recursion without remembering results is exponential; with a cache it's the same as the table.

The hard part is seeing that greedy fails. Taking the biggest coin that fits works for many real coin sets, and the candidate may try it first; the first example breaks it. Let them find that through their own testing if they can.

Answers to likely questions:

- There's no limit on how many of each coin.
- The coin values are all different, but not sorted.
- An amount of 0 needs 0 coins.
- Return only the number of coins, not which ones.
- If no mix works, return -1.

Common mistakes:

- Greedy: always taking the biggest coin that fits. `coins = [1, 3, 4]`, `amount = 6` gives 3 instead of 2.
- Starting the table with 0 for every amount instead of "can't be made", so impossible amounts look free.
- Standing in for "can't be made" with a large number, then adding one to it, so in some languages it overflows and wins a comparison it shouldn't.
- Returning the table's infinity value instead of -1 when the amount can't be made.

When the candidate says they're done, a good check is to ask them to trace the first example through their code, then `coins = [2]`, `amount = 3`.

## Hint ladder

- Nudge: Think about whether always taking the biggest coin that fits gives the fewest coins.
- Question: Suppose the last coin you use is `c`. What would you need to know about the amount `amount - c`?
- Concrete: If you knew the fewest coins for every smaller amount, you could get this one by trying each coin as the last. In what order could you work those smaller amounts out, and where would you keep them?

## Follow-ups

- What if you had to return which coins to use, not just how many?
- How many different ways are there to make the amount, ignoring order?
- What if you had only a limited number of each coin?
