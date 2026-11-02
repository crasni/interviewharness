# 01: Log why a reply failed

Spec: `.scratch/failed-replies/spec.md` · ADR 0017

Status: done

**What to build:** A failed model call's entry in `events.jsonl` keeps a short reason next to its `error` kind: the error's own message, trimmed (say 200 characters), so `error: other` can be diagnosed. The reason never holds a key or a prompt: provider messages already have saved keys stripped (`d26b728`); an error that isn't a `ModelError` (a bug in our own code) gives its name and message. The scripted transcripts show the reason too.

- [x] A failed call's log entry has `reason`, at most 200 characters
- [x] A thrown `TypeError` (our bug) logs as `other` with `TypeError: …` as its reason
- [x] A timeout and an abort need no reason (their kind says it all)
- [x] The transcript's note for a failed call shows the reason

## Comments
