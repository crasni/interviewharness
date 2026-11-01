# Git workflow: a branch per version, merged with a merge commit

Decided by the owner on 2026-11-01, with v0.1.0's PR (#9) as the first.

- **One branch per version**, named after it (`v0.1.1`, `v0.1.2`, `v0.2`), cut from `main` when work on that version starts. Small fixes outside any version get a short branch of their own.
- **Commits stay as they are** on the branch: one logical change each (about a ticket, or one fix), with its tests. Titles are short (about 50 characters, never over 72); the details go in the body. No Claude attribution, ever.
- **Open the PR when the version is done**: every ticket closed and CI green on Linux, macOS and Windows. Its title names the version ("v0.1.1: connections").
- **Merge with a merge commit**, never squash or rebase, so `main` keeps each version's steps and one merge commit marking the version.
- **Push only when the owner asks.** CI runs on every push to any branch.
