# 05: The pickers list only your models

Spec: `.scratch/v0-1-1/spec.md` · ADR 0021

**What to build:** settings.json keeps a list of **your models**: every model you've added, each checked to answer when it was added. The Interviewer and Feedback pickers list only these, each with the connection it comes from ("GPT-6.1 Sol · ChatGPT"), and end with **Add a model…**. That opens one search across every connected provider's full catalog; picking a model runs the one-short-reply check and adds it to your models (and to the slot it was opened from). Adding a connection adds the model checked with it. Removing a connection removes its models from the list, and unpicks them if they were in use. Your models can be removed one at a time.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] The pickers list only your models, with their connection, and end with Add a model…
- [ ] Add a model… searches every connection's catalog; a model is added only after it answers
- [ ] Adding a connection adds its checked model; removing a connection removes its models
- [ ] Existing settings migrate: the interviewer and Feedback models already picked become your models
- [ ] End-to-end tests cover adding from the search, a model that doesn't answer, and removal
