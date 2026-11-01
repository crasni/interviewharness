# 04: tests.json for classes

**What to build:** tests.json can describe a class problem: a `class` name instead of `function`, and each case a list of `calls` (the first constructs the class, each later one is a method and its arguments) with `expected` holding one result per call (null for the constructor and methods returning nothing). The engine's problem reader accepts either form, never both, and refuses a malformed class form naming the folder. The reference check replays the calls. The content README documents the form.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The engine reads the class form; the function form reads as before
- [ ] Refused with the folder's name: both forms, calls and expected of different lengths, a first call not naming the class
- [ ] The reference check replays class cases
- [ ] The content README describes the class form with a short example

Spec: `.scratch/v0-1-2/spec.md`.
