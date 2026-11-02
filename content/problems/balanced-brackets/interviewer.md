# Balanced brackets: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: walk the string once, pushing each opening bracket onto a stack. For each closing bracket, the stack must be non-empty and its top must be the matching opening bracket; pop it. At the end the stack must be empty. That's O(n) time and O(n) space. A map from each closing bracket to its opening one keeps the code short.

Answers to likely questions:

- An empty string counts as balanced.
- The string holds only the six bracket characters; no letters or spaces.
- Return a boolean.
- A single kind of bracket on its own is fine, like `"(())"`.
- The input fits in memory.

Common mistakes:

- Counting each kind of bracket separately. Counts can be equal while pairs cross, as in `"([)]"`.
- Popping or reading the top of an empty stack when a closing bracket comes first, as in `")("`.
- Forgetting to check that the stack is empty at the end, so `"(()"` passes.
- Returning early with `true` as soon as one pair matches.

When the candidate says they're done, a good check is to ask them to trace `s = "(]"` and then `s = "(("` through their code.

## Hint ladder

- Nudge: Think about which opening bracket a closing bracket has to match.
- Question: When a closing bracket arrives, which of the open brackets must it close, and how would you keep track of that one?
- Concrete: Something that hands back the most recently added item first would always show you the bracket that must close next. What would you put in it, and when would you take it out?

## Follow-ups

- If the string had only one kind of bracket, could you do it in O(1) extra space?
- What if you had to return the position of the first bracket that breaks the balance?
- What if the string also had letters and other characters in it, which should be ignored?
