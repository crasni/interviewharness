# 03: Choose a problem

**What to build:** A quiet "Choose a problem" text link under Start coding round, shown only when Start coding round is. It swaps the round list for the problem list in place: a Back control, the heading "Choose a problem", and one row per problem with its title, difficulty (Easy, Medium, Hard) and, when above zero, how many rounds were done on it ("Done once", "Done twice", "Done 3 times"). The topic is never shown. Clicking a row starts the coding round on that problem. Main lists the problems over IPC (name, title, difficulty, done count; never the topic, notes or reference), counting from the rounds folder: each round counts once for the problem its log names, a round naming none counts as Two sum, an unreadable log is skipped. The list scrolls inside its own region.

**Blocked by:** 01

**Status:** done

- [x] The link is under Start coding round and hidden with it when no model is set up
- [x] The list shows title, difficulty and done count; no topic; ordered by difficulty, then by title
- [x] Back returns to the round list; a row starts that problem; keyboard works
- [x] Done counts come from saved rounds, old rounds count as Two sum, bad logs are skipped
- [x] End-to-end on a throwaway data folder with seeded rounds: "Done once" and "Done twice" on the right rows, a row starts its problem

Spec: `.scratch/v0-1-2/spec.md`.
