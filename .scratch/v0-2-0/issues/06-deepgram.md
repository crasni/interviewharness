# 06: Deepgram

**What to build:** Deepgram as a **connection of the Speech kind** (ADR 0021, 0023). It joins the key-provider table with its key page, and appears in the one searchable Add list under a Speech group. Adding it checks the key by sending a short bundled clip to Deepgram's pre-recorded endpoint and expecting text back; only then is the key saved (stored like every other key, never in settings.json) and Nova-3 added to your speech models. Its other speech-to-text models can be added from the Speech to text picker's "Add a model…". With a Deepgram model picked, a finished recording is sent once from main (never the renderer), with a one-minute limit; failures are sorted as auth, timeout or other and shown as plain notices ("Deepgram rejected your key", "Deepgram didn't answer"), typing still working. Removing the connection forgets its key, removes its models from your speech models and clears the slot if it used one. Audio goes to Deepgram only when a Deepgram model is picked.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Deepgram is in the Add list under Speech, searchable, with its key page
- [ ] The key is checked with a clip before it's saved; a rejected key saves nothing
- [ ] Nova-3 joins your speech models on add; other Deepgram models can be added and picked
- [ ] A spoken turn with a Deepgram model is turned into text by Deepgram, from main
- [ ] Auth, timeout and other failures show their notices; typing still works
- [ ] Removing the connection forgets the key and its models, and clears the slot
- [ ] Providers tests against a fake Deepgram on loopback: only the saved key is sent, nothing is read from the environment, failures are sorted
- [ ] End to end: add Deepgram against a fake Deepgram and make a spoken turn with it

Spec: `.scratch/v0-2-0/spec.md`.
