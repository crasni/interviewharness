# The model reports what it observed; the app keeps the round

A real round on 2026-10-30 (Two sum, 5.5 minutes) showed the model keeping the round's state badly. It reported the phase itself, so its own question ("what's the complexity?") moved the round to Complexity. It rated its own help, so naming the candidate's bug ("the return value uses the number rather than its index") counted as no hint. It led the testing ("try a negative value"), asked "anything else?" twice in a row, and ended a round with 40 minutes left. The grader then credited the candidate with tests the interviewer had asked for. Most of this was the prompt inviting it ("one follow-up if something important is missing: complexity, an edge case"), but the deeper cause was that the round's state lived in the model's reading of twelve recent lines.

So each reply to a turn still comes back as one structured call (ADR 0017), now in two parts. **What the model observed** about the candidate's turn: what they're doing, the phase *their own words* moved to (`movesTo`), whether they traced an example, and whether they found their own mistake. **What its reply does:** its kind and words, the hint rung, whether it names a mistake (`pointsOutMistake`), and what it asks for (`asks`: a trace, an edge case, complexity, a follow-up). The model only reports. **The app keeps the books:**

- The round moves only on the candidate's words, or when the interviewer begins the follow-up questions; never on its other questions.
- Naming what or where a mistake is counts as help: a reply that does so unasked is written again (`mistake-unasked`).
- Each trace is recorded with who started it (the interviewer if its last line asked for a trace or an edge case), and each mistake with who found it.
- Every prompt carries **the round so far**: time, phase, the offer waiting on an answer, hints given, mistakes pointed out, traces by who, follow-ups asked, whether goodbye was said. The model is told to trust it over the conversation lines.

## Two additions decided with this

- **A Follow-up phase**, between Complexity and Wrap-up. When the candidate finishes Complexity with at least 5 minutes left and the problem has follow-up questions, the interviewer asks them one at a time instead of offering to wrap up. It's the only phase the interviewer leads. With no time or no questions left, the round goes on to Wrap-up.
- **The interviewer closes once.** In Wrap-up it asks once for the candidate's questions, then says goodbye once (reply kind `goodbye`) and stays quiet after. The candidate still ends the round with End round.

## Grading

The grader is told who started each trace, who found each mistake and what the interviewer asked for. It's also told to ignore typos and lines about the mock itself. Testing is capped at 2 when the candidate never checked their code on their own (research: `docs/research/11-testing-expectations.md`).

## Considered options

- **MCP:** a protocol for connecting an AI host to outside tool servers. Here the app is already the host, and the model already calls our one tool. It would add a server and a transport, and make the state no more consistent.
- **Several tool calls per turn** (move phase, record a test, end the round, then speak): more flexible, but each turn would wait on several model round trips. Small local models also use tools poorly.
- **Only a better prompt:** fixes the wording, but leaves the phase and the help to the model's judgement, which is what failed.
