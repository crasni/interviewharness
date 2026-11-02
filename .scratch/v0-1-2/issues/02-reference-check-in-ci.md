# 02: Reference check in CI

**What to build:** A small standard-library Python script reads every problem folder, runs its reference solution on each test case (the input as keyword arguments) and compares the result with what's expected, exiting non-zero and naming each failing case. A test file may mark the comparison as unordered for problems that accept any order. CI runs it as its own step on macOS, Windows and Linux with a pinned Python; `pnpm test` never needs Python.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The script passes on Two sum and fails with a clear message when a case's expected answer is wrong
- [x] Unordered comparison works where a problem marks it
- [x] CI runs it on all three OSes as a separate step
- [x] The content README says how to run it

Spec: `.scratch/v0-1-2/spec.md`.
