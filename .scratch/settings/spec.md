# Settings: let candidates tailor the room and their rounds

_Planned after v0.0. Owner's request (2026-10-29), not yet grilled: run `/grill-with-docs` before building._

## Problem Statement
Every candidate interviews differently: some want a big editor, some want the transcript out of the way, some prefer speaking to clicking. Today the room is one fixed layout with fixed sizes and one way to talk.

## Solution
A Settings screen, reachable from the start screen and the room, whose choices persist between rounds. Each setting changes only how the room looks or behaves for this candidate, never how the interviewer judges them.

## User Stories (first draft)
1. As a candidate, I want to resize the problem, editor and conversation areas by dragging their edges, so that I see what matters to me.
2. As a candidate, I want my panel sizes remembered, so that every round opens the way I like it.
3. As a candidate, I want a text size setting (small / medium / large), so that the room is comfortable on my screen.
4. As a candidate, I want to choose my code language, so that the editor highlights and indents it correctly.
5. As a candidate, I want to turn editor autocomplete on or off, so that practice matches the interview I expect.
6. As a candidate, I want to turn syntax highlighting on or off.
7. As a candidate, I want to choose how I talk (click to talk, or speech detection once the mic exists), so that I talk the way that suits me.
8. As a candidate, I want to choose whether the transcript is shown by default.
9. As a candidate, I want to choose the theme (system, light, dark).
10. As a candidate, I want round preferences (round length, difficulty, interviewer strictness) later, so that I can tailor what I get.

## Out of Scope (for the first settings ticket)
Interviewer personas (ADR 0014), accounts or sync, anything that changes grading.
