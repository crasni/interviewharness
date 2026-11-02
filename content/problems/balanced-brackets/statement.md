# Balanced brackets

You're given a string `s` made of brackets: `(`, `)`, `[`, `]`, `{` and `}`.

Return whether the brackets are balanced: every opening bracket is closed by a bracket of the same kind, and pairs close in the reverse order they were opened, so a pair never crosses another.

## Example 1

```
s = "{[]}()"
```

Answer: `true`. Each bracket closes the most recent one still open.

## Example 2

```
s = "([)]"
```

Answer: `false`. The `)` arrives while `[` is still the most recent open bracket, so the two pairs cross.

## Example 3

```
s = "(()"
```

Answer: `false`. One `(` is never closed.

## Constraints

- `0 ≤ len(s) ≤ 100,000`
- `s` contains only the six bracket characters.
