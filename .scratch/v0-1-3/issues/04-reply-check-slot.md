# 04: Reply check model

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** A Reply check slot in Settings → Model under Interviewer and Feedback: "Uses the interviewer's model unless you pick another." It lists your models with Add a model… and shows the model's effort like the other pickers. The check (ADR 0019) uses this model; each check call logs the model it used.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] settings.json gains `checkModel` (null = the interviewer's), migrated like `feedbackModel`
- [ ] The engine takes the check's model apart from the interviewer's
- [ ] Removing the model clears the slot back to the interviewer's
- [ ] Tests: a check runs on the picked model; end-to-end picking and clearing
