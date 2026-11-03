# 07: The interviewer speaks

**What to build:** The interviewer's replies read aloud by Pocket TTS, with one CC0 voice at 1×. When the voice is on, every line the interviewer says (replies after the check has passed them, backchannels, check-ins, time reminders, the closing line) goes through the reader (ticket 01), then the speech engine's synthesise, then to the renderer with its line; the renderer plays the audio itself (so echo cancellation hears it) and shows the line as the audio starts. Nothing the check hasn't passed is ever said. The Floor Manager holds the floor exactly as long as the audio lasts: the interviewer is given a way to learn a line's speaking time, which is the audio's length when the voice is on and today's 15-characters-a-second estimate when it's off. Synthesis counts as preparing, so the "Thinking" seconds include it. Talking over the interviewer and ending the round stop playback at once; the cut-off line stays whole in the transcript, marked as cut off. A line whose voice fails is shown as text, logged, and a notice says the voice couldn't speak. The first round after the voice can be downloaded asks whether to hear the interviewer, with its size: yes downloads it and turns the voice on, no keeps text; a switch in Settings → Voice changes it later. Each spoken line logs its voice's length. The voice's reference clip is one of Kyutai's CC0 voice donations, listed in a small voices table (id, name, clip address, checksum, licence), never a clip from sherpa-onnx's archive.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] With the voice on, every kind of interviewer line is spoken, through the reader; the transcript and log keep the written line
- [ ] The line shows as its audio starts; the floor is held for exactly the audio's length
- [ ] With the voice off, behaviour is exactly as today
- [ ] Barge-in and ending the round stop the audio at once; the transcript marks the line cut off
- [ ] A failed synthesis falls back to text with a notice, and is logged
- [ ] The first-round prompt and the Voice tab switch turn the voice on and off, and the answer is remembered
- [ ] Floor Manager tests with the fake clock: a given speaking time is held exactly; barge-in during a spoken line still stops it
- [ ] The voice module's synthesise path is tested with a fake speech engine
- [ ] End to end with the fake engine: a reply plays, talking over it cuts it off, and turning the voice off returns to text

Spec: `.scratch/v0-2-0/spec.md`.
