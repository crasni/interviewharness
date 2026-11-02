# v0.1.3: faster replies

Status: open

Grilled with the owner on 2026-11-02, after the fake-candidate run `~/interviewharness-scripted-rounds/2026-11-02T14-41-43-800Z` (`chatgpt/gpt-6.1-sol`, Two sum, five candidates). Builds on ADR 0017 (a reply is never faked), ADR 0019 (the check) and ADR 0021 (connections, your models). It comes before v0.2: with a voice, 15–20 s of silence after the candidate speaks feels broken.

## Problem Statement

Every model call takes about 5 s on ChatGPT, even at reasoning effort `low` and under 130 output tokens. Most replies are one call, but the ones that matter most take several:

- **A turn that moves the round** ("I'm done", "Let's move on") is written for the phase the candidate just left, thrown away as `written-for-old-phase`, and written again. Four of 38 replies in the run, 16–18 s each.
- **A risky turn** (done, stuck, asking for help) gets the check (ADR 0019): a second call after the words are written. "Done" turns took 10–11 s.
- **A rejected reply** is written once more with its own check. A hint request took 19.3 s for four calls, then said the safe line.
- **Nothing limits the whole reply.** The one-minute limit is per call, so a reply that's rewritten and checked can run past a minute.

The candidate can't make any of it faster: the effort is fixed at `low` in code, and the check always uses the interviewer's model.

The fake-candidate suite (`pnpm scripted-rounds`) is also only half of what the grilling's decision 9 asked for: no candidate fishes for the answer, nothing checks `events.jsonl` in code, and no model reads the transcripts. A person reads every transcript to tell whether a change made the interviewer worse.

## Solution

- **Write once.** A reply's prompt also carries the part for the phase the candidate's turn may move the round to, so the first attempt is written for the phase they're in after their turn. The old-phase rewrite stays only as a safety net.
- **The check stays** on every turn it runs on today.
- **Reply check**: a third model slot in Settings → Model, under Interviewer and Feedback. It uses the interviewer's model unless another is picked. No warning for small models.
- **One minute for the whole reply**, every attempt and check included. When it runs out, the candidate sees the notice that says to say it again (failed-replies, ticket 02), as for a call that timed out.
- **Reasoning effort per model.** Each model in your models has its own effort, from the levels that model offers (pi-ai's `getSupportedThinkingLevels`), shown with the provider's own names. It's set on the model's row in Your models, and shown and changeable next to each role's picker; two roles using one model share its effort. In the room, a "Reasoning" picker next to the model name changes the interviewer model's effort mid-round, and each change is logged. Models with no levels show no picker.
- **Defaults from a speed test.** The agent measures each provider's levels and sets a newly added model's effort to the fastest level that still passes the suite. Users get no speed test.
- **The suite, finished**: a fishing candidate; code checks of each round's log that fail the run (exit non-zero); and the Feedback model judging each transcript, with its notes in the report for the owner to read, never failing the run.

## User Stories

### Replies
1. As a candidate who says "I'm done", I want the interviewer's reply to fit the phase I've moved to on its first try, so that I don't wait for it to be written twice.
2. As a candidate, I want the check to keep running on done, stuck and help turns, so that faster replies never let help slip in.
3. As a candidate, I want a reply never to take more than a minute in total, however many tries and checks it took, so that a reply that keeps being rejected doesn't leave me waiting.
4. As a candidate whose reply ran out of time, I want the same notice as for a model that didn't answer, saying to say it again, so that I know what to do.

### Reply check
5. As a candidate, I want a Reply check slot in Settings → Model, so that a fast model can check replies while a strong one writes them.
6. As a candidate, I want Reply check to use the interviewer's model until I pick another, so that nothing changes unless I choose.
7. As a candidate, I want Reply check to list only my models, like the other pickers, with Add a model…, so that it works the same way.
8. As someone reading a round's log, I want each check call to name the model it used, so that I can tell which model judged which reply.

### Reasoning effort
9. As a candidate, I want to set a model's reasoning effort on its row in Your models, so that I can trade speed for thought per model.
10. As a candidate, I want the effort to show the model's own levels and only those, so that I never pick a level it can't use.
11. As a candidate, I want each role's picker to show and change its model's effort, so that I can set Feedback's effort where I pick Feedback's model.
12. As a candidate using one model for two roles, I want one effort for it, so that the same model behaves the same everywhere.
13. As a candidate whose model has no effort levels, I want no effort picker, so that nothing offers a choice that does nothing.
14. As a candidate, I want a "Reasoning" picker next to the model name in the room, so that I can make a slow interviewer faster mid-round.
15. As someone reading a round's log, I want every model call to record its effort, and every change of effort mid-round to be logged, so that slow replies can be traced to a setting.
16. As a candidate adding a model, I want its effort to start at the fastest level that still makes a good interviewer, so that the default is quick without my tuning it.
17. As a candidate upgrading from v0.1.2, I want my models to keep working at the effort they had (`low` where they reason), so that nothing changes on its own.

### The suite
18. As the owner, I want a fake candidate who fishes for the answer ("Is it something with a hash map?"), so that I see how the interviewer handles a guess angling for confirmation.
19. As the owner, I want a fishing guess to count as asking for help: it may get the next hint rung, and Feedback counts that hint, so that fishing isn't a free hint.
20. As the owner, I want each round's log checked in code (no hint the candidate didn't ask for, no phase moved except by the candidate's words, no failed reply), so that a regression fails the run.
21. As the owner, I want a run to exit non-zero and say which check failed in which round, so that I don't have to read every transcript to see that something broke.
22. As the owner, I want the Feedback model to read each transcript and note where the interviewer talked when it needn't, helped unasked or repeated itself, so that I read its notes instead of every line.
23. As the owner, I want the judge's notes in the run's report without failing the run, so that a judge's mistake never blocks a release.
24. As the owner, I want each round's reply times summarised in the report (median and slowest, by kind of turn), so that I can see whether a change made replies faster.

## Implementation Decisions

- **Write once** (`packages/engine`, `prompt.ts`, `interviewer.ts`): `phaseParts` gains the next phase's part ("If their turn moves the round on to X: …"), as `whenDone` already knows the next phase. The attempt says which phase it wrote for; `writtenForOldPhase` still guards, and its rewrite still costs a call when it fires. Moving back a phase keeps today's behaviour.
- **Whole-reply limit** (`interviewer.ts`): one deadline per `Call`, from its start; every attempt and check gets what's left of it. Running out is a `timeout` failure, logged with its `reason` like any other (failed-replies, ticket 01).
- **Reply check slot**: settings.json gains `checkModel` (null = the interviewer's), migrated like `feedbackModel`. The engine takes the check's model apart from the interviewer's; `buildCheckPrompt` is unchanged.
- **Effort**: each `yourModels` entry gains `effort` (a level name or absent). `packages/providers` reads the levels from pi-ai's `getSupportedThinkingLevels`, passes the model's effort instead of the hard-coded `low`, and keeps lifting the output cap for reasoning models. Migration sets `low` on models that reason. `modelCall` events gain `effort`; the room's change is an `effort-changed` event with the old and new levels.
- **Defaults** live in one table in `packages/providers`, by provider (and by model where measured), with the speed test's numbers in a comment and in this spec. The speed test is the agent's, run with `pnpm scripted-rounds` at each level; no new user-facing feature.
- **Suite checks** read the `events.jsonl` the player already writes: a hint level other than none with `askedForHelp` false; a phase change not caused by the candidate's turn; any `failed` outcome. The fishing candidate's guesses are judged by what the reply heard (`asking-for-help` or `seeking-affirmation`), so a fished hint passes.
- **Judge**: the Feedback model (`INTERVIEWHARNESS_JUDGE=provider/model` overrides), given each transcript and the "what to look for" note, writes short notes per round into `index.md`.

## Testing Decisions

- Deterministic tests with the scripted fake model, no network, as today. A good test drives the public Interviewer and asserts on what's said and logged, not on the prompt's text.
- Write once: a "done" turn that moves the round produces one model call and no `written-for-old-phase`; the safety net still fires when the fake model writes for the old phase. Prior art: `interviewer.test.ts`'s phase and rejection tests.
- Whole-reply limit: a fake model that's rejected and slow runs out at one minute in total, and the notice shows. Prior art: the timeout tests in `interviewer.test.ts`.
- Effort and the check slot: providers tests with the fake OpenAI server assert the effort sent and the model each call used; settings migration tests as in `server-migration`; end-to-end tests in the desktop app for the pickers, as for your models.
- The suite's checks are tested on hand-written logs (one passing, one per failure), with no model.

## Out of Scope

- Reading the turn and writing the reply in two separate calls (`.scratch/interviewer-design/later.md`).
- Skipping the check on plain acknowledgements.
- Grading a fished hint more lightly than one asked for, and letting users edit the interviewer's and grader's instructions per role or situation (`later.md`).
- A rambling fake candidate (dropped by the owner).
- A speed test for users.
- Voice, backchannels while the reply is written, streaming words before they're checked (v0.2).

## Further Notes

- The run's numbers: intro 4.4–5.0 s; ordinary turns 5–8 s; done turns 9.6–11 s; done turns with a rewrite 16.4–17.7 s; a check-in once 25.2 s; a hint request with two rejections 19.3 s. No reply failed in 38.
