# The model understands each turn; the interviewer never pushes the round

_Amended by ADR 0018: the model no longer reports the phase. It reports what the candidate's own words did, and the app keeps the round's state._

_Amended 2026-10-31 (owner, candidate-led v0.1a): no unasked hints. See "Help only when asked" below; it replaces the stuck row and the "Help when stuck" consequence._

Playing real rounds showed the keyword rules planned for v0.1 (a question needs a "?", "that's it" means done, "yes" accepts) misread typed, casual speech, and that time-based offers to move on interrupt candidates mid-thought, for example 15 seconds into tracing an example they'd just been asked to trace. So the Floor Manager keeps only *when* the interviewer may speak (the beat after a turn, barge-in, silence), and what the candidate meant is the model's to understand.

Every reply to a turn comes back structured: what the candidate was doing (a **candidate turn**), the kind of reply that fits, its words, the hint rung it gives and the phase the conversation is really in. Code then checks the help and the solution guard before anything is said, and the round follows the reported phase forward.

| Candidate turn | The interviewer |
|---|---|
| thinking aloud | stays quiet, or a brief "mm-hm" |
| murmur, noise | stays quiet |
| clarifying question | answers briefly and factually |
| seeking affirmation | doesn't grade mid-round: "sounds reasonable" if sound, else one probing question, never the fix |
| asking for help | the next rung of the hint ladder, kept to what they're blocked on |
| stuck | one neutral question ("What feels blocked?"), then waits; if still stuck, offers help |
| explaining | a short acknowledgement, or one follow-up if something important is missing |
| done | reads the work; asks for a trace if it looks wrong, else offers the next phase |
| answering the interviewer | acknowledges, or one follow-up |
| agreeing / declining | moves on, or the next rung if it was an offer of help / keeps going, and no more offers |
| small talk, logistics | a brief natural reply |

## Consequences

- **The candidate drives the round.** The interviewer never offers to move on because of the clock or a pause: only when the candidate says they're done. How far they get in 45 minutes is part of what's judged. There are no Move on / Not yet buttons; offers are answered in words.
- ~~**Help when stuck, a little at a time.**~~ Replaced by "Help only when asked" below.
- Replies to a turn may be silent or a backchannel, so thinking aloud is never answered with a full line.
- Each turn now waits on the model (a few seconds) even when the reply is silence. The mic (v0.2) may bring a faster classifier for whether to reply at all.

## Help only when asked (amendment, 2026-10-31)

The owner's candidate-led clarification: the interviewer never hints unasked.

- **Silence** gets a check-in at most, and it is a reviewed line from the example lines, never words the model writes, so no silence however long can unlock a hint. Check-ins still wait twice as long each time (2.5, 5, 10 minutes).
- **A stuck candidate**, one who says so directly, gets one neutral question ("What feels blocked?") and then space. That question names no bug, suggests no input, prescribes no next step and gives no insight; a reply to a stuck turn that asks for a trace, an edge case or the complexity is written again.
- **An offer of help** ("Want a hint?") comes only when the candidate says they're stuck or has said two attempts failed since the last hint. Any other offer is written again.
- **Real help** comes only on request or an accepted offer, one rung at a time and kept to the obstacle: a syntax question never reveals the algorithm. It is checked like a help request (ADR 0019) and recorded as a hint.
- **Declined help** stops offers and check-ins until something changes: the candidate types in the editor, says they're stuck again, or asks for help. Productive work never gets a check-in, since talking and typing restart the wait.
- **Missing testing or complexity** is never a reason to ask for it; the phase still moves only as ADR 0018 says.

## Considered options

- **Better keyword rules:** cheap and instant, but always one phrasing behind real speech; the owner rejected hard-coded phrases.
- **Timed phase suggestions, model-gated:** the model would decide whether a long phase is a good moment to suggest moving on. Rejected: the interviewer shouldn't push at all.
