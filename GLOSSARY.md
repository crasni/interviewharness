# InterviewHarness

A desktop app for live voice mock CS interviews, built around an interviewer that listens and knows when to speak.

## Language

### Rounds

**Round**:
One complete mock interview with an interviewer, from start to verdict, of one kind: a coding round, a system design round or an AI-assisted round.
_Avoid_: Session, interview, mode

**Phase**:
One stage of a round with its own goal; a coding round runs Clarify, Approach, Code, Test, Complexity, Follow-up, Wrap-up. Follow-up (the problem's follow-up questions) happens only when the candidate finishes early. Feedback comes after the round, not as a phase of it. The interviewer leads the move to the next phase but never forces the candidate past one.
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

**Check-in**:
A line from the interviewer after a long stretch with no talking or typing ("Want to talk me through where you are?"). The first in a silence is neutral; if the silence goes on, it checks in again, waiting twice as long each time, and may offer the smallest next hint if the candidate seems stuck.
_Avoid_: Nudge, prompt, reminder

### Help and feedback

**Candidate turn**:
What the candidate is doing with a turn, as the interviewer hears it: thinking aloud, a murmur, a clarifying question, seeking affirmation, asking for help, being stuck, explaining, saying they're done, answering the interviewer, agreeing, declining, or small talk. The interviewer's reply follows from it (ADR 0017).
_Avoid_: Intent, message type, utterance class

**Hint**:
Help toward the next step, one rung of the problem's hint ladder at a time and never the answer. Given when the candidate asks, or, a small insight at most (never the concrete rung), when they're stuck. Hints used lower the problem-solving score, as in a real interview, but the candidate never sees a hint count or budget.
_Avoid_: Clue, help, hints left

**Feedback**:
The interviewer's written assessment after a round: a verdict, what went well and what to fix, each point tied to a moment in the round. Each area is scored inside the app to reach the verdict, but the candidate never sees a score.
_Avoid_: Debrief, report, scorecard, results, stats

**Verdict**:
The interviewer's overall call at the end of a round, on a six-level scale: Strong hire, Hire, Lean hire, Lean no hire, No hire, Strong no hire. Always given with reasons.
_Avoid_: Score, grade, result
