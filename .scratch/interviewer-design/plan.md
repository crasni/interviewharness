# Implementation plan: candidate-led, observant interviewer

## Scope cut (2026-10-31)

v0.1.0 builds only the seven tickets in [issues/](issues/): the four reproduced bugs, help only when asked, sparse time reminders and one goodbye, and a few scripted rounds on a real model. Everything else in this plan that isn't covered by those tickets is put off; [later.md](later.md) lists it. The owner decided: help is offered only when the candidate says directly they're stuck or after repeated failed attempts, and the check keeps ADR 0019's trigger list.

## Owner clarification: candidate-led v0.1.0 (2026-10-30)

This clarification supersedes earlier “quiet but active” language and recommendations to proactively gather missing evidence or choose the next activity.

The candidate leads the approach, implementation, testing, and explanations. The interviewer observes by default, answers direct requests, gives sparse time reminders, and handles closure. A pause, missing rubric item, or elapsed phase time alone does not justify assigning the next task.

An explicit statement of difficulty or sustained repeated unsuccessful attempts may justify one brief neutral poke, such as “What feels blocked?” Then wait. Silence alone permits only a neutral availability check; it does not establish an impasse or authorize a hint. Productive thinking/editing and declined help suppress repeated pokes. Do not infer failure merely because the candidate differs from the reference solution.

A poke must not name a defect, suggest a diagnostic case, prescribe the next activity, or supply an algorithmic insight. Substantive help requires a scoped request or accepted offer and remains recorded as assistance. Reasoning probes and follow-ups require a clear candidate handover or completion; a natural boundary determines when an eligible question can be asked, not whether it is justified. Do not turn follow-ups into a checklist interrogation.

Required behavior tests: productive silence stays quiet; candidate independently moves through approach, coding, and testing; an explicit impasse permits one neutral poke; declined help suppresses repeated checks; missing testing/complexity evidence does not trigger automatic questions. Evaluate unnecessary interventions and preserved candidate initiative, not question count.

Keep this delivery within v0.1.0: text interaction, minimal replay tooling, and focused complete-round evaluation. Preserve assistance provenance and current numerical rules; report grading limitations instead of silently changing the rubric.


Date: 2026-10-30
Status: planned; no implementation performed
Contract: [spec.md](spec.md)
Background and code map: [design-review.md](design-review.md)

The user requested Matt's `/to-spec` first, then planning. The spec is now the scoped implementation document. The detailed review preserves history and broader proposals. These documents do not silently amend accepted ADRs or authorize unrelated feature work.

## Working assumptions

- The owner-selected target is the candidate-led interviewer in the clarification above; earlier “quiet but active” wording elsewhere is superseded.
- Owner-confirmed testing boundary (2026-10-30): public Interviewer signals to visible events and records, using fake models and a fake clock; grading through gradeRound; and a few desktop E2E checks.
- Numerical scoring redesign is separate. Fix known attribution and completion bugs, retain current numerical caps and verdict mapping, and report their limitations. Do not claim calibrated Feedback until calibration is complete.
- Decided by the owner: help is offered only when the candidate says directly they're stuck or after repeated failed attempts; the check keeps ADR 0019's trigger list.
- Preserve all pre-existing uncommitted work. Start by inspecting the current checkout; the review's locations and test totals may have changed.

## 1. Establish baseline and repair demonstrated regressions

Dependencies: none.

Read AGENTS.md, docs/STATUS.md, the glossary, the spec, and ADRs 0014 and 0017–0019. Inspect the current diff and run the engine tests. Work primarily through packages/engine/src/interviewer.ts, grading.ts, their existing tests, and test/fakes.ts.

Write public-behavior regressions for the four reproduced failures: check-in diagnosis escaping a negative check; fallback-generated testing credited as independent; observations lost on speech rejection; debugging before completion treated as a completed submission with an uncaught bug. Repair each through the smallest consistent change. If completion scope requires a small record extension, introduce it here and carry it into the later evidence model.

Acceptance: each test fails for the demonstrated reason before its repair and passes afterward; existing behavior remains covered. An expired or cancelled reply cannot corrupt candidate evidence. No new numerical rubric is introduced.

## 2. Make the new behavior contract explicit

Dependencies: baseline inspection; may proceed alongside regression analysis without conflicting edits.

Prepare docs/interviewer-behavior.md from the spec's bounded scope. Amend ADR 0017 where the owner clarification replaced it (no unasked hints; neutral check-ins; sparse time reminders); amend ADRs 0018–0019 for evidence separation, observation retention, and checking. The phase rule in ADR 0018 stays. Use a new numbered ADR if that better fits repository history; verify numbering first. Define newly adopted terms in GLOSSARY.md and link the current contract from AGENTS.md. Update the relevant STATUS entry without overwriting unrelated work.

Explain the policy and assistance boundary to the owner as the interesting design work. Keep the numerical grading proposal separate. An explicit later implementation assignment supplies authorization for the described scope; resolve only genuinely unspecified product choices.

Acceptance: current behavior, superseded history, content examples, and implementation scope have unambiguous roles. A new agent can identify what is adopted and what remains a proposal.

## 3. Retain candidate evidence independently of speech

Dependencies: 1 and adopted contract from 2.

Evolve the round record used by packages/engine/src/interviewer.ts and grading.ts. Add source turn identities, code revisions, versioned observations, question identities/status, completion scope, and explicit assistance attribution. Separate lifecycle, current activity, and accumulated evidence. Prefer a small pure state transition module behind the existing public API.

Move candidate observation recording out of successful-speech handling. Persist unresolved interpretation on failures, apply accepted observations once, and allow corrections with provenance. Maintain compatibility for existing grading inputs during migration rather than guessing absent evidence.

Acceptance through Interviewer: retries, rejected drafts, silence decisions, and barge-in preserve valid evidence; returning to Code preserves checks; an interviewer question changes the topic without fabricating candidate achievement; a completion claim identifies its scope and code.

## 4. Add understanding and explicit policy for routine turns

Dependencies: 3.

Extend packages/engine/src/model.ts with the necessary request purpose and validated observation schema. Separate observation prompts from speaker prompts in the engine. Support multiple acts, source references, and unknown meaning. Retain the existing provider abstraction and scripted fake.

Introduce a pure policy that selects one eligible action with a reason and disclosure bounds. First deliver the routine path: listen, acknowledge, answer a known public fact, and manage a pending question. Use reviewed templates where sufficient. The Floor Manager decides when an eligible action can take the floor; observation work alone must not mark the interviewer as preparing to speak.

Acceptance: productive thinking stays quiet, direct questions take priority, one question is pending at a time, existing evidence avoids repeated questions, and missing testing evidence triggers no question. Tests observe events/records and relevant model request content rather than private helper calls.

## 5. Add bounded substantive turns and action-aware checking

Dependencies: 4.

Refactor packages/engine/src/prompt.ts and content parsing in problem.ts. Separate public facts, private assessment material, approved help, and follow-ups. Revise content/interviewer/lines.md into reviewed fallback material and action-appropriate examples. Review the current problem's concrete hint for excessive disclosure.

Generate words only for the selected action, with its authorized context. Check freely generated problem-specific content, including clarification answers. Approved templates with validated bounded facts may bypass the model check. Apply the same verdict logic to check-ins and all other action kinds. Allow one bounded rewrite and an appropriate fallback. Record each model step and its outcome.

Acceptance: approved insight is not rejected solely because it relates to the solution; extra diagnosis or algorithmic information is rejected. Self-labels cannot bypass checking. A failed factual answer cannot turn into a walkthrough request. A prolonged silence cannot grant more help.

## 6. Connect code freshness, delivery, and cancellation to the desktop

Dependencies: 3–5.

Update shared IPC types/validation, preload exposure, main active-round orchestration, and renderer room input/delivery handling. Send revisioned code snapshots at useful boundaries and debounce editing updates. Refresh before code-specific actions. Add idempotent text-display delivery acknowledgement; keep candidate input and delivered interviewer effects in the engine's authoritative record.

Revalidate action-specific prerequisites before dispatch. Barge-in, a newer turn, relevant code edits, or End round can cancel pending work. Cancel stale output without erasing observations of completed earlier turns. General time reminders need not be invalidated by unrelated code edits.

Acceptance: current-code questions, duplicate delivery, stale responses, renderer acknowledgement, and End round work through E2E tests. Text displayed in full is not treated as only partially delivered according to a simulated speaking timer. No voice implementation is added.

## 7. Complete agenda, time management, follow-ups, and closing

Dependencies: 4–6.

Use the selected policy and Floor Manager to follow candidate-led progression and permit only justified interventions at natural boundaries. Keep the phase rule of ADR 0018. Add help offers (as decided in the scope cut), relevant follow-ups after the candidate finishes, sparse time reminders, and one-time closure. Keep End round explicit.

Keep timing parameters centralized. Choose initial engineering values with documented reasoning and measure them; do not present them as human-behavior research findings. Add a total foreground deadline as well as per-step cancellation so retries cannot create an unbounded wait.

Acceptance: completed testing/complexity is not repeated; productive work is not interrupted by a phase timer; early finish leads to useful follow-ups or closure; thanks after goodbye does not reopen the round; declined help does not trigger an immediate hint.

## 8. Integrate Feedback provenance and reproducible logs

Dependencies: 3 and 5–7.

Adapt grading.ts to use the new question, completion, and assistance relationships. Preserve numerical caps and verdict mapping for this scope. Correct prose that calls unsolicited assistance a candidate request. Log policy, prompt, content, and event schema versions plus the observations and decisions needed for replay. Define explicit handling of historical records.

Acceptance: prompted topic, candidate-selected test, interviewer-selected case, diagnosis, and repair remain distinguishable. The original four regressions stay fixed. A replay of recorded inputs/observations requires no provider call. Model failure never becomes fabricated negative candidate evidence.

Known limitation: current numerical caps can still undervalue competent testing that followed an interviewer question. Document it and prepare evidence for separate rubric calibration; do not silently remove the cap or announce calibrated assessment.

## 9. Evaluate complete interactions and iterate

Dependencies: 1–8.

Build the manually invoked fake-candidate evaluation suite described in the spec. Include fixed input scenarios for comparison and open-ended simulated rounds for interaction failures. Use the same problem/content and model configuration when comparing the baseline and redesign. Record repeated complete-round outcomes, first-response and total latency, retries, interruptions, repeated questions, excess disclosure, and attribution errors.

Review natural rounds with the owner, especially useful probes, hints, valid alternative algorithms, and Feedback limitations. Changes discovered here return to the relevant implementation slice and its regression scenario. Deterministic tests run without network; real-model evaluations remain outside CI.

Acceptance: engineering checks pass; no known critical disclosure or evidence-corruption failure remains in the agreed evaluated set; natural-round quality is reviewed with the sample size and configuration recorded. Missing credentials or unavailable hardware are reported as unperformed evaluation, not as success. Numerical rubric calibration remains a distinct follow-up before claims of calibrated Feedback.

## Checks and completion report

Run targeted engine regressions during development. For the integrated change run pnpm test, pnpm typecheck, pnpm lint, pnpm build, and pnpm test:e2e. Inspect desktop behavior on available platforms and report which platform checks were actually performed. Do not broaden tests repeatedly without a new concern.

The implementation report should include observable changes, ADR amendments, scenario evidence, model/hardware configurations evaluated, latency results, remaining grading limitations, and any unperformed validation. All source changes should be explainable against a user story and acceptance behavior in the spec.

This document is a plan, not a combined ticket file. The tickets are in [issues/](issues/), one file each, and follow the candidate-led clarification where this plan's older wording differs.
