# 04: Reply check model

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** A Reply check slot in Settings → Model under Interviewer and Feedback: "Uses the interviewer's model unless you pick another." It lists your models with Add a model… and shows the model's effort like the other pickers. The check (ADR 0019) uses this model; each check call logs the model it used.

**Blocked by:** 03

**Status:** done

- [x] settings.json gains `checkModel` (null = the interviewer's), migrated like `feedbackModel`
- [x] The engine takes the check's model apart from the interviewer's
- [x] Removing the model clears the slot back to the interviewer's
- [x] Tests: a check runs on the picked model; end-to-end picking and clearing

Done: `checkModel` in settings.json (missing in older files, so it reads as null). The interviewer takes `checkModel`; a reply checked on it logs `checkModel` with its identity (and so does a check that failed). Settings → Model has "Reply check model" with "Same as interviewer", its reasoning picker, and one hint line.
