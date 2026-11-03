# 01: The reader

**What to build:** A pure function in core that turns the interviewer's line as written into the line as the voice should say it, so code and maths come out as words: big-O ("O(n log n)", "O(n^2)", "O(1)"), powers and exponents ("10^9", "1e9", "2^k"), numbers (cardinals, ordinals, decimals, negatives, ranges like "1–3"), indexing and calls ("nums[i]", "nums[i+1]", "len(s)", "dp[i][j]"), operators and comparisons ("k = 3", "i < j", "!=", "<=", "->"), camelCase, PascalCase and snake_case names split into words, all-caps acronyms spelled out (with a short list said as words), and inline code marks dropped. A word it doesn't understand passes through unchanged; it never removes one. Nothing uses it yet: ticket 07 puts it in front of the voice. The transcript, the log and the check always keep the written line (ADR 0022).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Lives in core, with no I/O and no imports beyond core (the layering lint passes)
- [ ] A table of written → spoken cases covers every notation above, including the prototype's lines ("So that is O(n log n) because of the sort?", "What does seen hold after index 1?", "Could nums[i] be negative?", "What if n is up to 10^9?", "Why a HashMap rather than sorting first?", "Want to walk through BFS on the small grid?", "we have about 15 minutes left")
- [ ] Words it doesn't know, plain prose and the empty line pass through unchanged
- [ ] Punctuation that shapes speech (sentence ends, commas, question marks) is kept

Spec: `.scratch/v0-2-0/spec.md`.
