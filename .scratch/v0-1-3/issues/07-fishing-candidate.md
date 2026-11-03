# 07: A fake candidate who fishes for the answer

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** A scripted candidate who angles for confirmation without asking outright ("Is it something with a hash map?", "So I should sort it first, right?"). A fishing guess counts as asking for help: the reply may give the next hint rung, and Feedback counts that hint. The prompt says so where it lists the kinds of turn.

**Blocked by:** None

**Status:** done

- [x] `fishing` in `scripted-candidates.ts`
- [x] The prompt treats a guess fishing for confirmation as asking for help
- [x] A fished hint is logged with `askedForHelp: true` and graded as a hint (test with the fake model)

Done: the prompt lists a fishing guess under asking-for-help, with at most the next rung and never a yes or no on the idea (that would skip the ladder; the owner to confirm). The `fishing` candidate guesses three times, then codes and tests.
