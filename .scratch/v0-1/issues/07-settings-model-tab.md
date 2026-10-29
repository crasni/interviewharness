# 07: Settings → Model tab

**What to build:** A new **Model** tab in Settings shows which provider and model the interviewer uses, lets the candidate change it or log out, and offers an optional separate **Feedback model** (the grader slot) that falls back to the interviewer's model when unset. Choices are stored in settings.json; credentials stay in the credential store. A model counts as small (Feedback marked rough later) when it's local and under a documented size threshold, or the candidate marks it so.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] The Model tab shows the current interviewer model and provider
- [ ] Changing the model or logging out works, and logging out removes the stored credential
- [ ] The Feedback model can be left as "same as interviewer" or set separately
- [ ] The small-model rule is documented beside the slots and settable per model
- [ ] End-to-end tests cover the tab with the fake model switched in

Spec: `.scratch/v0-1/spec.md`.
