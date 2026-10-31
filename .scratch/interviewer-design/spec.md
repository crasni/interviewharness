# Candidate-led, observant interviewer

## Scope cut (2026-10-31)

v0.1a builds only the seven tickets in [issues/](issues/): the four reproduced bugs, help only when asked, sparse time reminders and one goodbye, and a few scripted rounds on a real model. Everything else below that isn't covered by those tickets is put off; [later.md](later.md) lists it. The owner decided: help is offered only when the candidate says directly they're stuck or after repeated failed attempts, and the check keeps ADR 0019's trigger list.

## Owner clarification: candidate-led v0.1a (2026-10-30)

This clarification supersedes earlier “quiet but active” language and recommendations to proactively gather missing evidence or choose the next activity.

The candidate leads the approach, implementation, testing, and explanations. The interviewer observes by default, answers direct requests, gives sparse time reminders, and handles closure. A pause, missing rubric item, or elapsed phase time alone does not justify assigning the next task.

An explicit statement of difficulty or sustained repeated unsuccessful attempts may justify one brief neutral poke, such as “What feels blocked?” Then wait. Silence alone permits only a neutral availability check; it does not establish an impasse or authorize a hint. Productive thinking/editing and declined help suppress repeated pokes. Do not infer failure merely because the candidate differs from the reference solution.

A poke must not name a defect, suggest a diagnostic case, prescribe the next activity, or supply an algorithmic insight. Substantive help requires a scoped request or accepted offer and remains recorded as assistance. Reasoning probes and follow-ups require a clear candidate handover or completion; a natural boundary determines when an eligible question can be asked, not whether it is justified. Do not turn follow-ups into a checklist interrogation.

Required behavior tests: productive silence stays quiet; candidate independently moves through approach, coding, and testing; an explicit impasse permits one neutral poke; declined help suppresses repeated checks; missing testing/complexity evidence does not trigger automatic questions. Evaluate unnecessary interventions and preserved candidate initiative, not question count.

Keep this delivery within v0.1a: text interaction, minimal replay tooling, and focused complete-round evaluation. Preserve assistance provenance and current numerical rules; report grading limitations instead of silently changing the rubric.


Status: needs-triage
Date: 2026-10-30
Scope: implementation and evaluation; numerical grading redesign excluded.

## Problem Statement

The candidate wants an interviewer that lets them lead: it listens, answers what they ask, gives sparse time reminders, and leaves the reasoning and solution to them. The current interviewer can interrupt, expose mistakes unasked, repeat questions, mishandle progression, and misattribute prompted work.

The underlying design mixes understanding the candidate, choosing an intervention, writing it, and judging its assistance in one model response. A phase doubles as topic and achievement. Candidate observations can disappear when interviewer speech fails. Attribution relies on counts and the latest question instead of relationships between specific turns, questions, and code revisions.

The owner first selected a “quiet but active” interviewer, then replaced it with the candidate-led clarification above. This specification turns that clarification and the design review into scoped work. Numerical grading changes discussed in the review remain separate work.

## Solution

The candidate leads the work and its progression; the interviewer maintains the interview boundary. It listens during productive work, answers factual questions briefly, asks reasoning questions or follow-ups only after the candidate hands over or finishes, and uses evidence already supplied instead of running a checklist.

Each intervention has a purpose and a limit on the information it supplies. A suggested boundary condition, diagnostic input, named defect, and algorithmic hint are recorded distinctly, and only ever given on request or accepted offer. Generated words are checked against the selected intervention before delivery. Routine turns can use reviewed wording.

Candidate evidence survives speech failures. The round records which question elicited a response, which code a claim concerns, and what assistance actually reached the candidate. Feedback receives those relationships. Existing numerical rules remain for this delivery, with demonstrated attribution and completion bugs repaired; calibration is required before claiming the active policy produces calibrated assessment.

## User Stories

1. As a candidate, I want space to think, so that I develop my own approach.
2. As a candidate, I want occasional brief acknowledgements, so that silence feels attentive.
3. As a candidate, I want casual phrasing and typos understood, so that special commands are unnecessary.
4. As a candidate, I want multiple acts in a turn recognized, so that finishing code and asking a question both count.
5. As a candidate, I want factual clarification grounded in the problem, so that constraints stay consistent.
6. As a candidate, I want ambiguity clarified, so that an uncertain request does not authorize unwanted help.
7. As a candidate, I want one focused question at a time, so that I can answer fully.
8. As a candidate, I want questions about my reasoning, so that understanding matters beyond final code.
9. As a candidate, I want to decide when and how to test, so that verification shows my own judgment.
10. As a candidate, I want the examples I choose recorded as mine, so that I demonstrate judgment.
11. As a candidate, I want supplied examples attributed to the interviewer, so that Feedback is accurate.
12. As a candidate, I want earlier testing and complexity remembered, so that questions are not repeated mechanically.
13. As a candidate, I want valid alternative approaches recognized, so that I need not match a reference implementation.
14. As a candidate, I want to return to code after testing, so that the conversation follows the work.
15. As a candidate, I want “done” understood in context, so that finishing implementation does not end the round.
16. As a candidate, I want debugging help distinguished from submitting finished work, so that grading does not invent a completion failure.
17. As a candidate, I want hints appropriate to my obstacle, so that help leaves meaningful work to do.
18. As a candidate, I want my request's scope respected, so that a syntax question does not reveal the algorithm.
19. As a candidate, I want an opportunity for more thinking time when stuck, so that another hint is not automatic.
20. As a candidate, I want gentle check-ins, so that silence does not trigger an escalating lesson.
21. As a candidate, I want time reminders at natural boundaries, so that I can prioritize without interruption.
22. As a candidate, I want useful follow-ups after early completion, so that the round explores depth.
23. As a candidate, I want natural closure, so that the interviewer does not manufacture work to fill the clock.
24. As a candidate, I want End round to remain my control, so that a timer cannot terminate my work silently.
25. As a candidate, I want to interrupt pending or spoken replies, so that the interviewer follows my latest turn.
26. As a candidate, I want comments grounded in current code, so that they do not diagnose a revision I already changed.
27. As a candidate, I want demonstrated work retained when models fail, so that technical failures do not erase evidence.
28. As a candidate, I want appropriate fallbacks, so that a failed answer does not become an unrelated task.
29. As a candidate, I want assistance recorded only when delivered, so that cancelled drafts do not count against me.
30. As a candidate, I want Feedback to distinguish my work from interviewer contributions, so that its explanations are traceable.
31. As a candidate, I want professional warmth without invented employer claims, so that the interaction is credible.
32. As a maintainer, I want decisions linked to inputs and policy, so that failures can be replayed offline.
33. As a maintainer, I want public-behavior tests, so that internal refactoring preserves the interaction.
34. As a maintainer, I want complete-round model evaluations, so that mechanical correctness is not mistaken for conversational quality.
35. As a maintainer, I want latency and failure paths measured, so that checking cannot create unbounded waits.
36. As the owner, I want important design choices explained in reviewable slices, so that I can handcraft the interesting parts.

## Implementation Decisions

1. Preserve the engine, model abstraction, Floor Manager, Electron IPC, and provider boundary. Add no service or orchestration framework.
2. Separate understanding, policy, wording, checking, and delivery. Models supply observations and possible probe targets; code selects eligible actions and enforces explicit constraints.
3. Persist candidate input before generating speech. Attach interpretations to source turn IDs and code revisions. Apply accepted observations once. Corrections preserve provenance; failed interpretation remains unresolved rather than negative evidence.
4. Support multiple candidate acts and unknown meaning. Assessment requests, language questions, and algorithmic help requests have different assistance scopes.
5. Separate lifecycle, conversation, and evidence. Existing phase labels describe current activity, and the phase moves only as ADR 0018 says (the candidate's words, or the start of the follow-up questions). Candidate achievement requires candidate evidence.
6. Give questions identities, purposes, targets, and resolution states. Reuse earlier evidence. Clarify unanswered parts without repeating already answered questions.
7. Give completion claims scope and code revision. Connect bug evidence, discovery, and repair to the relevant work. A completion penalty requires a corresponding completion claim; any interviewer-associated mistake is insufficient.
8. Define a small typed action vocabulary: listen, acknowledge, answer factual clarification, neutral check-in, ask explanation after a handover, probe, offer help, provide approved hint, manage time, introduce follow-up, and close. Actions carry their input basis, disclosure bounds, and delivery-dependent effects.
9. Prioritize direct questions and conversation repair, then current pending questions. Allow productive work to continue. Do not gather missing evidence by directing the next activity; natural boundaries only gate already justified interventions. Ask one substantive question, then wait; avoid a separate acceptance ritual at every activity transition.
10. Distinguish process management, open evidence questions, focused probes, diagnostic support, solution insights, and complete answers. Permission to ask and independent candidate evidence are separate concepts. A question can supply substantial help.
11. Per the owner clarification: no unasked hints. Silence allows only a neutral check-in; a stated difficulty or repeated failed attempts allows one neutral question, then waiting. Substantive help needs a scoped request or an accepted offer and stays scoped to the obstacle. This amends ADR 0017's spontaneous-hint rule. The owner decided: an offer of help only when the candidate says directly they're stuck, or after repeated failed attempts.
12. Split content into public facts, assessment notes, approved hints, and follow-ups while retaining plain files. Ordinary speaker prompts do not receive every hint and the full reference solution. Supply only context relevant to the selected action.
13. Approved hints must leave meaningful work. Review the current concrete hint, which supplies almost the entire algorithm. Complete answers remain outside the assessed round; adding a post-round tutorial is excluded.
14. Not adopted (owner, 2026-10-31: keep ADR 0019's trigger list; see later.md). Original recommendation: check all freely generated problem-specific turns, including factual answers. Reviewed templates with validated bounded facts may bypass the semantic call. Arbitrary model-written slots may not. Record this change to the earlier selective-check trigger and measure its latency.
15. Apply check results to every speech path, including check-ins. Writer self-labels do not determine checking eligibility. Inconclusive or malformed checks cannot authorize speech. Restating an approved hint is allowed; exceeding it is rejected.
16. Allow one rewrite within an overall foreground deadline, then use reviewed wording appropriate to the selected action. A failed factual answer does not become a walkthrough request. Record technical failures distinctly.
17. Templates, generated turns, check-ins, and fallbacks use one delivery/accounting boundary. Rejected, cancelled, or undelivered words cannot create assistance, a pending question, or a goodbye.
18. For text, delivery means renderer display, identified and applied once. Simulated speaking time is not proof of reading. Define the future audio-delivery boundary without implementing voice.
19. Capture revisioned code at relevant boundaries and refresh it before code comments. Revalidate action-specific assumptions before delivery; cancel stale diagnoses while preserving valid observations about earlier input.
20. Keep the Floor Manager responsive during model work. Understanding alone does not claim the floor. Barge-in and End round invalidate pending output. Time schedules management or closing actions, not automatic termination.
21. Pass causal evidence and assistance to Feedback. Preserve existing areas, verdict mapping, and numerical caps except the demonstrated completion/attribution corrections. Distinguish requested assistance from interviewer mistakes in records and prose. Record calibration limits explicitly.
22. Version behavior, prompts, content, and events. Record input references, observations, selected actions, checks, and delivery outcomes sufficient for deterministic replay. Exclude credentials. Read historical saved data explicitly or report an unsupported version instead of inventing missing evidence.
23. Consolidate the current behavior contract and amend superseded decisions as part of implementation. Coding-agent guidance links to that contract; examples and problem notes cannot override it.
24. Measure latency on actual model configurations before selecting new budgets. Centralize parameters and test deadlines with fake time. Preserve cross-platform support and renderer playback architecture.

## Testing Decisions

Owner-confirmed testing boundary (2026-10-30): the public Interviewer API, with candidate signals as inputs and visible events, model requests, logs, and completed round records as outputs; grading through gradeRound; and a few desktop E2E checks. Prefer the existing scripted models, fake clocks, and round fixtures. Test externally meaningful behavior, not private helpers or exact model wording.

Use the public grading entry point for score/evidence regressions. Retain direct Floor Manager tests for timing and barge-in. Add a few desktop E2E checks for snapshots, delivery, progression, and End round. Avoid making every new helper another broad testing boundary.

Required deterministic scenarios:

1. A second check-in naming an unauthorized mistake is rejected even when its hint level is none.
2. A walkthrough fallback opens a recorded question and its response is attributed correctly.
3. Candidate checking and mistake discovery survive speech rejection or failure, without retry duplication.
4. Debugging help before a completion claim never establishes a completed submission with a missed bug.
5. Missing testing or complexity evidence triggers no question; candidate-selected cases are recorded apart from interviewer-supplied ones.
6. Earlier testing and complexity evidence prevent redundant questions.
7. Returning to code preserves evidence and resolved questions.
8. Mixed or ambiguous acts do not grant unlimited assistance.
9. Scoped hints are allowed, excess disclosure is rejected, and silence does not expand help scope.
10. Stale, interrupted, undelivered, and duplicate-delivery actions cannot corrupt assistance or lifecycle state.
11. Code questions use the relevant revision; unrelated edits do not cancel a general time reminder.
12. Early completion, near-end timing, thanks after goodbye, and End round behave consistently.
13. Malformed model output and timeouts produce bounded fallbacks while preserving inputs.
14. Recorded observations and inputs replay deterministically without a model call.

Manually invoke real-model evaluation outside CI. Include fixed transcripts and simulated candidates who are stuck, fishing for answers, buggy, correct but suboptimal, early-finishing, silent, rambling, or reasoning out of order. Include different languages, long context, and valid non-reference approaches. Save complete rounds, configuration, prompt/content versions, repeated-trial results, and latency. Human review assesses useful questions, leading help, repetition, and fairness; a model judge assists triage.

A release candidate requires no known critical disclosure or evidence-corruption failure in the agreed regression set and an owner-reviewed sample of natural rounds. Report sample size, configuration, and unperformed evaluation. Fake-model tests alone cannot establish excellent interaction or calibrated Feedback.

## Out of Scope

- Numerical rubric redesign, removing hint/testing caps, changing areas, or changing the verdict table. These require the separate calibration work in the design review.
- Microphone capture, STT, TTS, code execution, system design, and AI-assisted rounds.
- New providers, personas, coaching modes, visual redesign, or a post-round solution tutorial.
- General workflow frameworks, additional servers, vector databases, or model-agent fleets.
- Automatic termination at the time limit or reliability claims for untested configurations.

## Further Notes

Synthesized with Matt's `/to-spec` from the existing discussion and inspected repository. Publishing this document changes no runtime behavior. The tickets are in [issues/](issues/) and stay needs-triage until the owner approves them; none expands into numerical grading redesign.

The candidate-led clarification is the owner's decision and wins over the rest of this spec, the plan and the design review. Both open questions are decided; see the scope cut at the top. On assignment, use the owner's actual authorization and record amendments. Do not repeat confirmations of choices already adopted.

[design-review.md](design-review.md) preserves the detailed rationale, sources, regression history, and code-reading map. [plan.md](plan.md) provides the implementation sequence. The review's broader grading recommendations are outside this spec's scope.

Inspect and preserve existing uncommitted changes, including the preceding interviewer redesign and ADR 0019. Another checkout needs that baseline too. The earlier 101-test result is historical and does not validate future changes.
