# 05: The Speech to text picker

**What to build:** A Speech to text picker in Settings → Voice that lists only the candidate's speech models (your models, of the speech kind), the picked one in use for every spoken turn. Its last item, "Add a model…", lists the local speech models from the speech model table; adding one downloads it (with the same progress, cancel and retry as ticket 02) and adds it to your speech models. Parakeet TDT 0.6B v2 is offered as "More accurate". Removing a speech model from the picker removes it from your speech models; if it was in use, the slot falls back to another of your speech models, or to none.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The picker lists only your speech models and uses the app's own Picker
- [ ] "Add a model…" adds Parakeet by downloading it, and it can then be picked
- [ ] The picked model is the one used to turn speech into text (seen in the spoken turn's log)
- [ ] Removing the model in use leaves a sensible slot, and talking still works or offers a download
- [ ] Settings behaviour for adding and removing speech models is tested
- [ ] End to end: add Parakeet from a fake download server, pick it, and a spoken turn logs it

Spec: `.scratch/v0-2-0/spec.md`.
