# The check: help is judged apart from writing the words

_Amended 2026-10-31 (owner's round): probes are checked too. See "When it runs" below and ADR 0017's "One probe for a wrong answer"._

ADR 0018 had the model label its own reply: the hint rung it gives, and whether it names a mistake. Research says a model judging its own words is least reliable exactly when it matters (Huang et al., ICLR 2024). Prompt-only withholding leaks: CS50's Duck shows code up to a quarter of the time despite being told not to. The systems that withhold reliably either fine-tune, let code pick the move (StratL), or check the reply separately (Daheim et al., EMNLP 2024). The owner settled the details in grilling (`.scratch/interviewer-check/grilling.md`).

So on turns where help could slip in, the reply's words get **the check** before they're said. It's a second, separate call to the same model, which sees the candidate's lines, their code, the hint ladder, the reference solution and the words alone, and answers three things:
- whether the words name a mistake;
- which hint rung they give;
- whether they describe the solution.

## The decisions
- **When it runs:** only where help could slip in, which keeps the usual reply to one call:
  - the candidate said they're done, asked for help, sounds stuck, or asked "does this look right?";
  - a second check-in in a silence;
  - a probe (`asks: "probe"`): one neutral question about a wrong answer they handed over. The check is told a probe that points at a constraint or asks what one step gives is not naming the mistake; one that says the answer is wrong, where the mistake is or what the fix is still names it, and is written again;
  - any reply that labels itself as help.
  A reply its own labels already rule out isn't checked; it's written again at once.
- **Its verdict wins.** Its hint rung is what's recorded and graded, and its "names a mistake" replaces the reply's own. "Describes the solution" counts as a leak, next to the code n-gram guard, which can't catch a solution described in words.
- **When it catches something,** the reply is written once more with the reason. If that fails too, a plain safe line from the example lines is said instead ("Could you walk me through it with a small example?"). This can mean a long pause; the owner chose correctness here.
- **Each model call gets its own time limit,** so a reply and its check don't share the 10 seconds.
- **Small local models must stay safe**, if plainer. The check uses the same model, so its reliability on an 8B model is unproven until the fake-candidate suite runs on Ollama.

## Decided with it
- **Phases follow the candidate both ways:** finding a bug while testing and going back to fix it moves the round back to Code. The interviewer's own questions still never move it.
- **The whole conversation** goes into every prompt, not the last 12 lines. A 45-minute typed round is a few thousand words.
- **Rules that always apply, plus the current phase's part.** The hint ladder is left out in Wrap-up. The follow-up questions are in only around the Follow-up phase.
- **Testing caps.** Any checking the candidate starts counts: walking an input through the code, test cases with expected results, or an edge case.
  - If they never checked on their own, testing is at most 2: correct code never checked is a weakness, not a fail.
  - It's at most 1 when they said "done" with a bug they never caught, one that only the interviewer's check or words brought out. That's the bottom of the published rubrics (`docs/research/11-testing-expectations.md`).
  - At first we capped any never-tested round at 1. The owner changed this on 2026-10-30, because a 1 rules out a hire however good the code.
- **Moves are told, not blocked.** The prompt says what not to do; the schema doesn't grey out moves by state.

## Considered options
- **Trust the self-labels:** no wait, but they're the weak point.
- **Check every reply:** most careful, but doubles every wait, and most replies can't leak anything.
- **Speak, and check alongside the speech** (OpenAI's realtime guardrails): no added wait, but the line may already be half said when the check fails. Reconsider when the mic lands.
- **A separate checker agent with its own model:** later. The check is already its own call and prompt, so it could get its own model, e.g. a small fast checker next to a bigger interviewer.
