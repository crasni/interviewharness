# InterviewHarness

A desktop app for live voice mock CS interviews, built around an interviewer that listens and knows when to speak.

## Language

### Rounds

**Round**:
One complete mock interview with an interviewer, from start to verdict, of one kind: a coding round, a system design round or an AI-assisted round.
_Avoid_: Session, interview, mode

**Phase**:
One stage of a round with its own goal; a coding round runs Clarify, Approach, Code, Test, Complexity, Wrap-up. The debrief comes after the round, not as a phase of it. The interviewer leads the move to the next phase but never forces the candidate past one.
_Avoid_: Step, stage, section

**Interviewer**:
The AI on the other side of a round, modelled on one well-defined, human-like good interviewer: it stays quiet unless speaking helps, probes reasoning, frames the round, and adapts to the candidate.
_Avoid_: Bot, assistant, persona

**Candidate**:
The person practising in a round.
_Avoid_: User, interviewee, student

### Turn-taking

**Turn**:
A stretch of the conversation during which one side, candidate or interviewer, holds the floor.
_Avoid_: Message, reply

**Floor Manager**:
The part of the interviewer that decides *whether* to speak at each moment, separately from deciding *what* to say.
_Avoid_: Turn detector, orchestrator

**Backchannel**:
A brief sign of listening (a nod, "mm-hm") given while the candidate keeps their turn; it never takes the floor.
_Avoid_: Ack, filler

**Acknowledgement**:
A short spoken reply after the candidate's turn ends ("Okay, that makes sense") that takes the floor briefly and hands it back.
_Avoid_: Backchannel, reply

### Help and feedback

**Hint**:
Help the interviewer gives toward the next step, never the answer. The candidate never sees a hint count or budget; hints used only shape the feedback afterwards.
_Avoid_: Clue, help, hints left

**Debrief**:
The interviewer's written feedback after a round: a verdict, what went well and what to fix, each point tied to a moment in the round.
_Avoid_: Report, scorecard, results, stats

**Verdict**:
The interviewer's overall call at the end of a round, on a six-level scale: Strong hire, Hire, Lean hire, Lean no hire, No hire, Strong no hire. Always given with reasons.
_Avoid_: Score, grade, result
