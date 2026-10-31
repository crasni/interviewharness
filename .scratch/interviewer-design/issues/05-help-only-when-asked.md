# 05: Help only when asked, no more than asked for

**What to build:** The interviewer never hints unasked. Silence gets at most a neutral check-in; a candidate who is stuck gets one neutral question and then space; real help comes only on request or an accepted offer.

**Blocked by:** 01

**Status:** needs-triage

- [ ] Silence alone allows only a neutral check-in ("Take your time, I'm here if you want to talk it through"); it never unlocks a hint, however long it lasts
- [ ] The interviewer offers help only when the candidate says directly that they're stuck, or after repeated failed attempts. Before offering, it may ask one neutral question ("What feels blocked?") and wait. That question names no bug, suggests no test case, prescribes no next step and gives no insight
- [ ] Declined help stops further offers and check-ins until something changes; productive work gets no check-in at all
- [ ] Help that is asked for or accepted stays within the candidate's obstacle and is recorded as a hint; a syntax question never reveals the algorithm
- [ ] Missing testing or complexity evidence never makes the interviewer ask for it; the phase still moves only as ADR 0018 says
- [ ] The check's trigger list stays as ADR 0019 has it
- [ ] The Two sum hint that gives away almost the whole algorithm is rewritten; prompt and `content/interviewer/lines.md` examples match; ADR 0017 is amended (no unasked hints, when help may be offered)
- [ ] Tested with scripted models and a fake clock: long silence gives no hint; "I'm stuck" gets one neutral question; repeated failed runs allow an offer; declined help stops offers; a candidate who works through approach, code and testing unprompted hears no instructions

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).
