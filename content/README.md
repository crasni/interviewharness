# Content

Plain files the app reads: problems, and examples of what the interviewer says. Edit them without touching code.

Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). No LeetCode text.

## Problems

One folder per problem in `problems/<name>/`. The name is lower case with dashes, like `two-sum`.

- `statement.md`: what the candidate sees, with examples and constraints.
- `problem.yaml`: the title, pattern, difficulty (easy, medium or hard), license, credits and source.
- `interviewer.md`: never shown to the candidate. It has three sections:
  - `## Notes`: the key idea, answers to likely questions and common mistakes.
  - `## Hint ladder`: three lines, `- Nudge:`, `- Question:` and `- Concrete:`. Each one is a sentence and never code.
  - `## Follow-ups`: questions for after a working solution.
- `reference/solution.py`: a solution the interviewer judges against. It is never revealed.
- `tests.json`: the function's name and its test cases, each with a unique `id`. Add `"unordered": true` when the answer is a list the statement accepts in any order.

  For a problem where the candidate writes a class, name the `class` instead of a `function`. Each case is then a list of `calls`: the first makes the class, each later one is a method's name and its arguments. `expected` holds one result per call, `null` for the first and for methods that return nothing:

  ```json
  { "id": "evicts-oldest", "description": "A full cache drops what was used longest ago",
    "calls": [["RecentCache", 1], ["put", 1, 10], ["put", 2, 20], ["get", 1]],
    "expected": [null, null, null, -1] }
  ```

Check that every reference solution passes its own tests (Python 3, nothing to install; CI runs it on every OS):

```
python scripts/check-references.py
```

Write every problem from the idea alone, in your own words.
