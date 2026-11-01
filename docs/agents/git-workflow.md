# Git workflow: a branch per version, merged with a merge commit

Decided by the owner on 2026-11-01, with v0.1.0's PR (#9) as the first.

- **One branch per version**, cut from `main` when work on that version starts.
- **Branch names follow [Conventional Branch](https://conventionalbranch.org/)**: lowercase, words joined by hyphens, dots only in version numbers.
  - `release/v0.1.1`: a version's work (the `release/` prefix keeps the branch apart from the `v0.1.1` tag a release gets).
  - `feat/<short-name>`, `fix/<short-name>`, `hotfix/<short-name>`, `chore/<short-name>`: small work outside a version (`chore/` for docs and dependencies).
  - `main` takes no prefix. The spec's agent prefixes (`claude/`, `ai/`) aren't used: commits and branches carry no AI attribution.
- **Commits stay as they are** on the branch: one logical change each (about a ticket, or one fix), with its tests. Titles are short (about 50 characters, never over 72); the details go in the body. No Claude attribution, ever.
- **Open the PR when the version is done**: every ticket closed and CI green on Linux, macOS and Windows. Its title names the version ("v0.1.1: connections").
- **Merge with a merge commit**, never squash or rebase, so `main` keeps each version's steps and one merge commit marking the version.
- **Push only when the owner asks.** CI runs on every push to any branch.
