# Faster replies: write once, one minute in all, and effort per model

The fake-candidate run of 2026-11-02 (`chatgpt/gpt-6.1-sol`) showed every model call taking about 5 s at reasoning effort `low`, and the replies that matter most taking several calls: 16–18 s when a "done" turn was written for the phase the candidate had just left and written again, 10–11 s for a checked "done", 19 s for a hint request rejected twice. With a voice (v0.2), that silence after the candidate speaks would feel broken. The owner decided on 2026-11-02, grilled before v0.1.3.

## The decisions
- **Write once.** A reply's prompt also carries the next phase's part and what to do if the candidate finishes it too, so a turn that moves the round gets a reply written for where they are after it. The old-phase rewrite stays as a safety net. (Considered: reading the turn and writing the reply in two calls, which is cleaner but always two calls; it stays on the later list.)
- **The check stays on every turn it ran on** (ADR 0019). Speed comes from fewer calls and a faster check model, never from skipping it. (Considered: skipping it for plain acknowledgements.)
- **A Reply check model**, a third slot in Settings → Model: the interviewer's unless another is picked. No warning for a small one.
- **One minute for the whole reply**, every attempt and check included. Running out shows the notice that says to say it again, as any failed reply to a turn does (ADR 0017), even after a rejected attempt.
- **Reasoning effort belongs to the model**, not the role: one of your models has one effort, shared by every role that uses it. It's set under each role's picker in Settings → Model and, for the interviewer, in the room mid-round (logged as `effortChanged`). The levels are the model's own, by its provider's names (pi-ai's `getSupportedThinkingLevels`); a model that doesn't reason shows none. (Considered: effort per role.)
- **The default effort is the fastest level that still passes the suite**, measured by the agent; users get no speed test.

## Choices made while building it (v0.1.3)
- No settings migration: an absent effort means `low`, what v0.1.2 sent every reasoning model.
- Calls go through pi-ai's simple stream, which maps the effort to each provider's own field (OpenAI's reasoning effort, Anthropic's thinking), instead of sending OpenAI's field to everyone.
- The room shows no model name, so the room's picker sits in the round bar before the timer, labelled "Reasoning".
- A guess fishing for confirmation ("is it a hash map?") counts as asking for help: at most the next hint rung, counted as a hint taken. A "sounds reasonable" to a sound guess is fine: they find out themselves whether it works.
- **An asked-for hint at its rung passes the check's "describes the solution" verdict** (owner, 2026-11-03). The speed test showed every hint request replaced by the safe line after two such rejections. Past the rung, quoting the reference code, or unasked, it's still a leak.
- The default effort stays `low`: medium was slower (done turns 10.6 s against 9.7 s) and no better.
