# 03: Scripted transcripts show what the candidate was told

Spec: `.scratch/failed-replies/spec.md`

Status: done

**What to build:** In a scripted round's transcript (`formatPlayedRound`), a reply to the candidate's turn that fails is followed by a note that the interviewer said nothing and the room told the candidate the model failed, so the transcript isn't read as the interviewer ignoring them.

- [x] A failed turn reply in a transcript reads as unanswered-with-a-notice, not as silence
- [x] A failed intro or check-in still shows the example line that was said

## Comments
