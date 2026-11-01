# Slow models: let them think, never fake a reply

## Problem

Round `2026-11-01T12-21-16-057Z` (Two Sum, `nvidia/nemotron-3.5-lightning:free` on OpenRouter): the intro took 9.8 s, then all four of the candidate's turns ran past the 10 s reply limit (`replyRules.timeout`). Each time the interviewer said a stock acknowledgement instead:

- "will there be negative? duplicate? guaranteed answer?" got "Okay, that makes sense."
- "whut" got "Got it."
- "what do you mean" got "Okay, go on."
- "whaatt" got "Sounds reasonable."

Two things went wrong:

1. **10 s is too short** for reasoning models and slow free tiers. The answer was probably on its way and got thrown away.
2. **The fallback pretends it understood.** A clarifying question answered with "Okay, that makes sense" makes the interviewer look like it isn't listening, which breaks the whole thesis.

## Decisions (owner, 2026-11-01)

- **Show the thinking, the way modern chat apps do.** While the model works, the interviewer's tile reads "Thinking" with a running count of seconds. Wait much longer before giving up. No spoken holding line.
- **Never pretend.** When a reply to a candidate's turn fails, the interviewer says nothing that sounds like an answer. The room says plainly that the model didn't answer.
- **Show every failure, the same way.** No separate "after N failures" warning: each failure shows up in the room's notice as it happens, the way a chat app shows an error under the message.

## Out of scope

- A "Try again" button, or resending the turn automatically.
- Per-model or user-set timeouts.
- Faster turn-taking for voice (the v0.2 classifier in ADR 0017).
