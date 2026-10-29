# InterviewHarness: Project Blueprint

_Draft v1 · 2026-10-29 · name: **InterviewHarness** (decided 2026-10-29)_

> **Thesis.** Every AI tutor talks too much. Real interviewers mostly **listen**: they let you think, nod, wait, probe the weak spot, and hint only when you ask.
> This is an open-source desktop app for **live voice mock interviews** (coding first, system design second) that runs on **any model**: local, your API key, or your existing plan.

Inspired by [LearnHarness](https://github.com/amosblomqvist/learnharness): one clear thesis, honest packaging (free, BYOK, local files, editable prompts), shipped as a real desktop app.

---

## 1. What the research says (condensed)

### 1.1 LearnHarness, the inspiration
Repo at commit 3dd5211, v0.3.9; 3.5k★ in 13 days; 206 open issues.

- **Stack:** Electron + Next.js 16 + React + Tailwind 4 + radix.
  - LLM layer is **pi-ai / pi-agent-core**, which supplies its "30+ providers"; it does *not* use the Vercel AI SDK.
  - Plain JSON/JSONL files under userData. 188 deterministic tests with a scripted fake LLM engine.
- **Architecture:**
  - `src/core` is pure domain with no I/O, `src/agent` holds agents, `src/server` and `src/store` hold the adapters.
  - Layering is enforced by ESLint.
  - Prompts are **numbered Markdown fragments** the user can override.
- **Agents:** Prober → Teacher (handover via a `probe_done` tool call) and a separate Practice session that **commits a hidden solution before posing a problem** and gives one hint step per request.
- **Voice:** **dictation only.**
  - Uses Deepgram nova-3 with a short-lived token minted in the backend, and the transcript is inserted only when you stop.
  - No TTS, no turn-taking. → **The space we want is open.**
- **Pain points from its issue tracker:**
  - **Top request:** local and custom models (Ollama, OpenAI-compatible, Bedrock, Azure).
  - **Keys:** stored in plaintext, and a file tool can read them.
  - **Reliability:** no retry, context growing out of control, a random port wiping localStorage.
  - **Packaging:** Linux packages break.
  - **Voice:** dictation English-only until recently; local Whisper requested.
- **License:** AGPL-3.0. → **Learn from it; don't copy its code** if we go Apache-2.0.

### 1.2 Prior art in interview tools
| Project | Takeaway |
|---|---|
| ajadreddy/ai-mock-interviewer | **Best flow to learn from:** 5 phases (clarify → plan → code → follow-up → feedback), hidden tests, code snapshots, evidence-based scorecard. Python-only, web-only, tiny. |
| IliaLarchenko/Interviewer (Apache-2.0, ~127★) | Coding, ML/system design and behavioral, with voice and any provider, but a Gradio UI and no whiteboard |
| ngoanpv/DeepInterview (Apache-2.0) | Rubric per competency, community "question-bank packs"; heavy LiveKit + LangGraph infrastructure |
| notKanaa/mockroom (MIT) | **YAML question packs**, local JSON history, same provider model |
| kirilxd/swe-interview-coach | Claude Code plugin; good prompt and rubric material |
| SystemDesign.ai (unverified) | Reportedly Electron + Excalidraw + AI judge. **Check before launching system design** |
| Commercial: Hello Interview, interviewing.io AI, Aced, Mockingly, LeetCode extensions | Whiteboard + rubric is the standard; phased Socratic interviewer is the standard. **None are BYO-model, none are open, none handle turn-taking well** |

**Gap confirmed:** nobody combines desktop, live voice with good turn-taking, coding *and* system design, any model, and open source.

### 1.3 Voice and turn-taking
- **Research supports the thesis.** Int-Bench (Stanford, 2026) found that LLMs step in **earlier and more often than humans and hand over full solutions**. Restraint has to be engineered; prompting alone won't do it.
- **Building blocks that exist and run locally:**
  - **Silero VAD v5:** in the renderer via `@ricky0123/vad-web`.
  - **Pipecat Smart Turn v3** (BSD-2): an 11 MB ONNX model that detects end of turn from audio, about 20–40 ms on CPU.
  - **sherpa-onnx-node** (Apache-2.0): a single native addon covering streaming STT (Moonshine/Parakeet/zipformer), VAD and **Kokoro TTS**.
- **Cloud:**
  - **Deepgram Flux** has built-in end-of-turn detection.
  - **OpenAI Realtime** has `semantic_vad` with an `eagerness` setting.
  - Cartesia and ElevenLabs Flash give about 150–190 ms to first audio.
- **Full-duplex models (Moshi)** can't use an arbitrary LLM, which breaks "any model". Use a cascade instead: STT → LLM → TTS.
- **Echo trap:** Chromium's echo cancellation only cancels audio that **the same Chromium process plays**. So TTS must play in the renderer, never from a sidecar's speaker output.
- **Frameworks:** Pipecat (Python) and LiveKit (needs a server) are wrong for a desktop app. → **Write a small TypeScript orchestrator modelled on Pipecat's design:** frames, cancellable tasks, interruption.

### 1.4 Using any model
- **pi-ai** (`@earendil-works/pi-ai`):
  - One interface for 30+ providers, a model catalog, cost calculation, and any OpenAI-compatible endpoint.
  - **Subscription logins:** ChatGPT/Codex, Copilot, Gemini CLI.
  - LearnHarness uses it; a proven choice.
- **ChatGPT plan:** OpenAI launched official "Sign in with ChatGPT" for third-party apps on **2026-09-29**, for **approved partners** (OpenCode, Pi, T3, Kilo, Warp…). Users set per-app weekly caps. → **Apply as a partner**; until approved, ship it as experimental or not at all.
- **Claude Pro/Max:** **prohibited** in third-party apps; Anthropic says so in writing and enforces it. → Only offer *"use your installed Claude Code"*, spawning the user's own `claude` CLI. Never touch their tokens. Confirm with Anthropic before promoting it.
- **Keys:** use Electron `safeStorage` (keytar is dead). On Linux without a keyring it falls back to `basic_text`, so **warn the user or refuse to save.**
- **Metadata:** models.dev for capabilities and pricing; Ollama `/api/show` and LM Studio `/api/v0/models` for live capability detection.
- **Small local models** produce malformed tool calls → validate, retry, and fall back to JSON mode.

### 1.5 Coding and system design building blocks
- **Editor: CodeMirror 6.** Sourcegraph and Replit migrated to it. It's small, fully themable, has a mature Vim mode, and feels like a real interview (CoderPad has little autocomplete). Monaco is about 5 MB and looks like VS Code.
- **Code runner:**
  - Judge0 is GPL, needs Docker and has had sandbox-escape CVEs → no.
  - Piston needs privileged Docker and its public API went paid in Feb 2026 → optional at most.
  - → **Hybrid:**
    - Pyodide and QuickJS (WASM, no install) for Python and JS.
    - The user's installed toolchains for Java/C++/Go, wrapped in **bubblewrap** (Linux), **sandbox-exec** (macOS) or **Job Objects** (Windows).
    - Every run gets timeouts, output caps and no network, and fails closed.
- **Whiteboard: Excalidraw** (MIT).
  - The API (`getSceneElements`, `onChange`, `updateScene`, `convertToExcalidrawElements`, mermaid-to-excalidraw) covers everything we need.
  - **No library exists that turns a scene into a text graph an LLM can read → we build it.**
  - tldraw is not open source (license key plus watermark) → no.
- **Content:**
  - Can't use LeetCode text, and the "Apache" LeetCodeDataset on Hugging Face is LeetCode text → avoid.
  - **system-design-primer is CC BY 4.0** → reusable with attribution.
  - Algorithms can't be copyrighted; problem statements can. → **Write original problems** and take community contributions as files.
- **Grading:**
  - interviewing.io scores 1–4 on **technical / problem solving / communication**, and problem solving best predicts outcomes.
  - Hello Interview's system design axes: **navigation / design / technical excellence / communication**, scaled by level.
  - LLM judges are biased by length, position and their own outputs → **cite evidence before scoring**, anchored rubrics, objective signals (tests, timestamps), take the median of several samples.
- **Meta's AI-assisted round:**
  - 60 minutes in CoderPad with a file tree, editor and AI chat; multi-file codebase.
  - Three phases: fix a bug → build the feature → optimize against tiered tests.
  - Graded on: problem solving, code quality and understanding of AI code, verification, communication.

---

## 2. Critique: what changed from the original idea

| Original idea | Verdict | Revised |
|---|---|---|
| "All-in-one: LeetCode, system design, behavioral, enterprise" | ❌ Scope trap. LearnHarness won with **one** thesis | **v0.1 = live voice coding interview only.** System design in v0.2. Behavioral later, maybe never |
| "Main feature = any provider" | ⚠️ A feature, not a thesis. Also LearnHarness already has it | Any model is **table stakes**. The thesis is **the interviewer that listens** |
| "Beat SKILL.md" | ✅ Absorb it instead | Interviewer **personas are SKILL.md-style files**; ship an Agent Skill so Claude Code and Codex can analyse your interview history |
| "Use ChatGPT plan, Claude plan" | ⚠️ Legal minefield | ChatGPT: official partner program. Claude: spawn the user's own CLI only. API keys and local models are the safe default |
| "Enterprise subscription" | ❌ Dropped | Open source, Apache-2.0. Impact and reputation are the goal |
| "Rust for native, lightweight" | ⚠️ Doesn't match the risks | **Electron + Vite + React + TS.** WebKitGTK media support is weak on Linux; voice needs consistent Chromium. Native work goes in a utility process / N-API addons. Rust is an optional handcraft project later (a sandbox helper?) |
| "Local LLM as interviewer" | ⚠️ Small models make poor interviewers | **The Floor Manager is deterministic**, so the model only *writes the lines*. Small models then work acceptably. Measure it with evals |
| "Voice via dictation" | ❌ LearnHarness already does dictation | **Full duplex-ish cascade:** streaming STT, turn detection, backchannels, barge-in, TTS. Typing and push-to-talk as first-class fallbacks |
| "The AI decides when to speak" | ⚠️ Research says LLMs can't restrain themselves | **Split the decision from the speech.** The Floor Manager decides, the LLM speaks only when allowed |

### Risks that still stand
1. **Turn-taking is research-grade hard.** Expect it to be wrong some of the time. Mitigations:
   - Tunable eagerness per persona
   - Push-to-talk always available
   - Headphones recommended
   - An eval harness that replays recorded sessions
2. **Latency.** Budget: end of turn ~300 ms + LLM first token ~300–800 ms + TTS ~150 ms ≈ **0.8–1.3 s cloud; 2–3 s local.** Pre-rendered backchannels, speculative generation and short responses hide most of it.
3. **Windows sandboxing** has no turnkey solution. Ship Windows with WASM languages only at first.
4. **Content is work.** Twenty excellent original problems beat 500 copied ones. Make contributing easy.
5. **Solo bandwidth.** Ship v0.1 in about 6–8 weeks or it dies in polish.

---

## 3. Product

### 3.1 Principles
1. **Silence is the default.** The interviewer has to justify every word.
2. **Never give away the answer.** Hints come as a ladder, only when you ask or are truly stuck, and every rung costs points.
3. **Evidence over vibes.** Every score cites a transcript line, a code snapshot or a test result.
4. **Yours.** Any model, local files, editable prompts and personas, no account, no telemetry by default.
5. **Feels like a room, not a chat.**

### 3.2 Modes (in shipping order)
1. **Coding round:** live voice, 45 min, CodeMirror + runner, phases:
   - Clarify → Approach → Code → Test → Complexity → Wrap-up, then the debrief
2. **System design round:** Excalidraw + the scene-to-graph converter, phases:
   - Requirements → Estimates → API → High-level design → Deep dive → Wrap-up
3. **AI-assisted round (Meta-style):** a multi-file repo, a separate *assistant* AI in a side panel, an interviewer who watches how you use it. Grades verification and whether you understand the AI's code. **Unique and timely.**
4. **Practice / drill:** no voice, fast reps on one pattern; the interviewer is just a hint ladder.
5. _Later:_ behavioral (STAR), a debugging round, a "reverse interview" where you interview the AI.

### 3.3 The Floor Manager (the heart of the app)
```
mic ─► AudioWorklet ─► VAD (Silero) ─► streaming STT ─┐
                     └► Smart Turn (end of turn) ─────┤
editor events (typing, run, test results) ────────────┼─► Signals ─► FLOOR MANAGER ─► decision
whiteboard events (scene diff → graph diff) ──────────┤   (100-200 ms)   (rules + persona knobs)
clock (phase timer, time since progress) ─────────────┘
                                                        decision ─► SILENT
                                                                 ─► BACKCHANNEL (cached audio / visual nod, no LLM)
                                                                 ─► ACK | ANSWER | PROBE | HINT(n) | REDIRECT | ADVANCE_PHASE
                                                                       └► Interviewer LLM (persona skill) ─► TTS ─► speaker
```
- **Signals:**
  - VAD state and silence length
  - Smart Turn probability
  - Partial-transcript completeness
  - Think-aloud markers ("so…", "let me think")
  - Is it a question? Is it aimed at the interviewer?
  - Typing activity, test runs and results
  - Time since last progress, phase, hints given so far
- **Rules (first version):**
  - **SILENT** while the user is thinking aloud and making progress. Never interrupt mid-utterance.
  - **BACKCHANNEL** when a clause ends but the turn isn't over and there's been 600–1200 ms of silence. At most one every 8–10 s.
  - **ANSWER** only when a direct question is detected *and* the turn has ended.
  - **PROBE** when the turn ended and the rubric shows a gap (complexity, edge cases, a hand-waved component).
  - **HINT** only on request, or after a stall (60–120 s with no new code or idea, or circular talk). The ladder is nudge → question → concrete. Never the solution.
  - Barge-in cancels TTS and the LLM; user backchannels during AI speech are ignored.
- **Persona knobs** (deferred, see ADR 0014; v0.0 uses fixed defaults): `patience`, `talkativeness`, `hint_policy`, `strictness`, `backchannel_rate`, `probe_depth`.
- **Every decision is logged with its signals** → the eval harness replays sessions to tune thresholds. This is also great video and blog content.

### 3.4 Interviewer personas = skills
> **Deferred (ADR 0014):** we build one well-defined, human-like interviewer first. Personas may return later as variations on it.

```
skills/interviewers/
  faang-coding/SKILL.md          # phases, tone, knobs, rubric anchors
  senior-system-design/SKILL.md
  friendly-new-grad/SKILL.md
  ai-assisted-round/SKILL.md
```
Frontmatter holds the knobs; the body holds tone, phase scripts and probe banks. Every file can be edited or overridden from Settings (the LearnHarness pattern).

### 3.5 Debrief
- **Written feedback, not metrics:** a verdict on a six-level scale (Strong hire … Strong no hire) with reasons, then what went well and what to fix, each tied to a moment in the round. Hints used shape the feedback but are never shown as a count.
- **Scorecard (internal):** 1–4 per axis (problem solving, coding, verification, communication; design axes for system design), with **evidence links** that jump to the moment in the replay.
- **Replay timeline:** audio, transcript, code snapshots and whiteboard states on one scrubbable timeline. Interviewer decisions show as ticks ("why did it stay quiet here?").
- **Weak-pattern tracker** across sessions: plain files, so you can query them from Claude Code via the bundled skill.

---

## 4. UX and visual design

**Monochrome, "Editorial" identity (ADR 0015).**
- Newsreader (serif) for the interviewer's voice and titles, Geist for the interface, Geist Mono for code.
- A cool stone neutral, light and dark following the system. Soft surfaces and light hairlines instead of black rules; radius by role.
- Hierarchy comes from type, weight and space; secondary text is muted grey; labels are sentence case. The one primary action is solid ink.
- One reserved colour, for "recording".
- 4 px grid, no gradients or glass, no ✨, no AI avatar with a face.
- Keyboard-first, with a ⌘K palette.
- All values live as role tokens in `ui/tokens.css`, so the identity can change in one place.

**The interview room:**
```
┌──────────────────────────────────────────────────────────────┐
│ ● REC   Coding round                  Phase 3/6  CODE   23:41 │
├───────────────────────┬──────────────────────────────────────┤
│ Problem               │  editor                    [Run ⌘↵]   │
│ (collapsible)         │                                      │
│                       │                                      │
│ Tests  4/6 ✓          │                                      │
├───────────────────────┴──────────────────────────────────────┤
│  ◉ ▁▂▅▃▁  "What happens if the input has duplicates?"         │  ← interviewer presence + subtitle
│  you  …so I'd keep a hashmap from value to index…            │  ← your live transcript (dim)
│  [Talk]  open-mic ○                                           │
└──────────────────────────────────────────────────────────────┘
```
- **The interviewer's presence:** a dot that **breathes** while listening, **nods** (a brief scale pulse) on a backchannel, and shows a waveform while speaking. Never a chat bubble.
- **Subtitles** fade out; the full transcript is in a drawer (⌘T).
- **Talk modes:** click **Talk** / **Stop talking** (default), open mic with speech detection (v0.2), or type. Barge-in is always on. Space is never a talk key: it belongs to the editor and the text field.
- **No hint counter.** Hints are asked for by talking; they shape the debrief but are never shown as a count or budget.

---

## 5. Architecture

### 5.1 Process model (Electron)
| Process | Responsibilities |
|---|---|
| **Renderer** (Vite + React) | UI, CodeMirror, Excalidraw, AudioWorklet mic capture (with echo cancellation), Silero VAD, **TTS playback**. Never sees API keys. |
| **Main** | Windows, IPC, `safeStorage` keys, the provider layer (pi-ai), sessions, storage, spawning CLIs (`codex`, `claude`) |
| **Utility process: voice** | sherpa-onnx-node (local streaming STT, Kokoro TTS synthesis → PCM sent to the renderer for playback), Smart Turn via onnxruntime-node, cloud STT sockets (Deepgram Flux) |
| **Utility process: runner** | Pyodide / QuickJS workers, native toolchains in the sandbox, test harness |
| **Interview engine** (pure TS, runs in main) | Floor Manager, phase machine, persona loader, interviewer agent, grader |

No Next.js and no local HTTP port; IPC only. This avoids LearnHarness's random-port and packaging bugs.

### 5.2 Core interfaces
```ts
// providers
interface LLMProvider { id; auth: 'apiKey'|'none'|'oauthPartner'|'externalCli';
  listModels(): Promise<ModelInfo[]>; stream(req, signal): AsyncIterable<ChatEvent>; validate(): Promise<Health>; }
interface STTProvider { id; caps:{streaming; endOfTurn; languages}; openStream(opts): TranscriptStream; }
interface TTSProvider { id; voices(): Promise<Voice[]>; synthesize(text, opts): AsyncIterable<PCMChunk>; }

// model slots, as in LearnHarness: interviewer (strong), floor-classifier (cheap/fast), grader (strong), assistant (AI-assisted round)

// engine
type Signal = VadEvent | TurnProb | PartialTranscript | EditorEvent | RunResult | SceneDiff | Tick;
type Decision = 'SILENT'|'BACKCHANNEL'|'ACK'|'ANSWER'|'PROBE'|{hint:1|2|3}|'REDIRECT'|'ADVANCE_PHASE';
interface FloorManager { onSignal(s: Signal): Decision | null; }
```

### 5.3 Storage (plain files, versioned)
```
~/interviewharness/                          # or Electron userData
  settings.json                   # stores only what differs from defaults
  rounds/<start time>/            # one folder per round (GLOSSARY: round, not session)
    round.json                    # meta, models, verdict
    events.jsonl                  # every candidate signal + decision; ticks only when they weigh something
    transcript.jsonl
    code/*.snap                   # snapshots at each run/phase
    board/*.excalidraw            # whiteboard states
    audio.opus                    # optional, off by default
  progress/patterns.jsonl         # weak-pattern ledger
  overrides/prompts|skills/       # user overrides
  format.json                     # schema version
```

### 5.4 Content format (community-contributable)
```
content/coding/<slug>/
  problem.yaml        # id, title, difficulty, patterns[], statement(md), constraints, examples,
                      # hints[3], follow_ups[], probes[], rubric_overrides, license: CC-BY-4.0
  starters/{py,js,java,cpp,go}
  tests/cases.yaml    # public + hidden; function-call style
  reference/solution.py   # CI verifies the tests pass
content/design/<slug>/
  prompt.md  requirements.yaml  deep_dives.yaml  checklist.yaml   # components the grader expects
content/ai-assisted/<slug>/
  repo/  tests/tiers.yaml  phases.yaml
```

---

## 6. Repository layout
```
/
├─ apps/desktop/                 # Electron app
│  ├─ electron/                  # main, preload, utility-process entries
│  └─ src/                       # renderer (React)
│     ├─ room/                   # interview room: layout, presence, subtitles, hint ladder
│     ├─ editor/                 # CodeMirror 6 setup, mono theme, vim
│     ├─ board/                  # Excalidraw wrapper, mono theme, scene→graph bridge
│     ├─ debrief/                # scorecard, replay timeline
│     ├─ settings/               # providers, models, voice, personas
│     └─ ui/                     # design system: tokens, primitives (own, not stock shadcn)
├─ packages/
│  ├─ core/                      # pure domain, no I/O: phases, rubric, scoring math, types
│  ├─ engine/                    # Floor Manager, phase machine, interviewer agent, grader
│  ├─ providers/                 # LLM (pi-ai adapter, openai-compatible, external CLI), model catalog
│  ├─ voice/                     # STT/TTS provider registry, orchestrator, turn detection
│  ├─ runner/                    # Pyodide/QuickJS workers, native sandbox wrappers, test harness
│  ├─ board-graph/               # Excalidraw scene → text graph (+ diff); standalone npm package
│  └─ content-schema/            # zod schemas + linter for problems/personas
├─ content/                      # problems, design prompts, AI-assisted repos (CC BY 4.0)
├─ skills/
│  ├─ interviewers/              # persona skills (used by the app)
│  └─ interviewharness-data/              # Agent Skill so Claude Code / Codex can analyse your sessions
├─ evals/
│  ├─ floor/                     # recorded/synthetic sessions → expected decisions; threshold tuning
│  └─ grader/                    # scored transcripts → judge agreement
├─ docs/                         # architecture.md, decisions/ (short ADRs), contributing-content.md
├─ AGENTS.md                     # rules for coding agents working on this repo (CLAUDE.md imports it)
└─ LICENSE                       # Apache-2.0 (code); content/ is CC BY 4.0
```
Layering rule, enforced by lint as LearnHarness does: `core` ← `engine` ← `providers|voice|runner` ← `apps/desktop`. Tests use a **scripted fake LLM and fake audio**, so they are deterministic and need no network.

Packages that stand alone and could become separate open-source wins: **`board-graph`** (nobody has this) and the **Floor Manager / turn-taking engine**.

---

## 7. Roadmap (each milestone = a demo-able story)

| Milestone | Scope | "Wow" moment |
|---|---|---|
| **v0.0 Interview room** | Real Electron scaffold; start, room and debrief screens; early Floor Manager with canned lines, no AI, no mic (spec: `.scratch/v0-0/spec.md`) | The look and feel |
| **v0.1 Coding, text-first** (2–3 wk) | Providers (pi-ai + OpenAI-compatible + Ollama), safeStorage, CodeMirror, Pyodide/QuickJS runner, phase machine, 10 original problems, scorecard with evidence | A real interview on a local model, offline |
| **v0.2 Voice** (3–4 wk) | AudioWorklet, Silero, Smart Turn, sherpa-onnx local STT + Kokoro, Deepgram Flux, Floor Manager v1, backchannels, barge-in, push-to-talk | **"It stayed quiet while I thought, and said 'mm-hm'"** |
| **v0.3 Debrief and evals** | Replay timeline, decision ticks, floor eval harness, grader median sampling | "Why did it stay quiet here?" made visible |
| **v0.4 System design** | Excalidraw mono theme, board-graph, design phases and checklist, AI sketches suggestions back as ghost elements | AI critiques *your diagram* |
| **v0.5 AI-assisted round** | Multi-file repo, assistant pane, prompt/paste logging, verification grading | The only place to practice Meta-style AI rounds |
| **v1.0** | Native-toolchain sandbox (Java/C++/Go), Claude Code CLI provider, ChatGPT partner sign-in (if approved), 50+ problems, signed builds | Polished launch |

---

## 8. Brainstorm backlog
- **Interviewer "tells":** the presence dot leans in (subtle scale-up) when you're onto something, or goes still when you're off track. Optional, can be turned off.
- **Pressure dial:** relaxed ↔ real ↔ brutal (time, patience, interruptions).
- **Stall detector** using the "illusion of progress" idea: talking a lot without changing the code.
- **Think-aloud coach:** after the session, "you went silent for 3:20 here; interviewers can't grade silence."
- **Ghost replay:** watch a strong-candidate run of the same problem side by side (generated or community-recorded).
- **Pattern map:** a graph of patterns (two pointers, DP on intervals…) coloured by your performance, a nod to LearnHarness's graph.
- **Spaced repetition** of failed patterns (a top LearnHarness request).
- **Company packs** as community personas plus problem sets.
- **Peer mode:** two humans, with the AI acting as silent grader or note-taker (later).
- **`board-graph` MCP server** so any agent can read Excalidraw diagrams.
- **Export** the session as Markdown to share or post.

## 9. Open questions
1. ~~Name~~: decided **InterviewHarness** (see research/05-naming.md).
2. Is SystemDesign.ai really open source, and how good is it? Check before v0.4.
3. pi-ai's license and maintainer. Confirm before depending on it; fall back to the Vercel AI SDK v6 plus our own OpenAI-compatible adapter.
4. Apply for OpenAI's "Sign in with ChatGPT" partner program. When?
5. Default local stack on an 8–16 GB laptop: which model sizes give acceptable interviewer quality? (An eval episode.)

---

## Sources
LearnHarness: [repo](https://github.com/amosblomqvist/learnharness) · [site](https://learnharness.ai/) · [issues](https://github.com/amosblomqvist/learnharness/issues) · [explainx write-up](https://explainx.ai/blog/learnharness-open-source-agent-harness-for-learning-knowledge-graph-2026)

Prior art: [ai-mock-interviewer](https://github.com/ajadreddy/ai-mock-interviewer) · [Interviewer](https://github.com/IliaLarchenko/Interviewer) · [DeepInterview](https://github.com/ngoanpv/DeepInterview) · [mockroom](https://github.com/notKanaa/mockroom) · [swe-interview-coach](https://github.com/kirilxd/swe-interview-coach) · [topic: mock-interview](https://github.com/topics/mock-interview)

Voice: [Pipecat](https://docs.pipecat.ai/overview/introduction) · [Smart Turn](https://github.com/pipecat-ai/smart-turn) · [LiveKit turn detector](https://docs.livekit.io/agents/logic/turns/turn-detector) · [LiveKit EOT blog](https://livekit.com/blog/solving-end-of-turn-detection) · [vad-web](https://docs.vad.ricky0123.com/user-guide/api/) · [sherpa-onnx-node](https://www.jsdelivr.com/package/npm/sherpa-onnx-node) · [Moonshine v2](https://arxiv.org/abs/2602.12241) · [Kyutai streaming](https://github.com/kyutai-labs/delayed-streams-modeling) · [Deepgram Flux](https://developers.deepgram.com/reference/speech-to-text/listen-flux) · [OpenAI realtime VAD](https://developers.openai.com/api/docs/guides/realtime-vad.md) · [AssemblyAI streaming](https://www.assemblyai.com/universal-streaming) · [Chromium AEC](https://developer.chrome.com/blog/more-native-echo-cancellation/) · [Int-Bench](https://cicl.stanford.edu/publication/teo2026assistants/) · [Full-Duplex-Bench](https://arxiv.org/abs/2503.04721) · [Moshi](https://arxiv.org/pdf/2410.00037v1) · [illusion of progress](https://ceur-ws.org/Vol-4265/paper2.pdf)

Providers: [pi-ai README](https://cdn.jsdelivr.net/npm/@earendil-works/pi-ai@0.84.0/README.md) · [AI SDK v6](https://v6.ai-sdk.dev/docs/foundations) · [ChatGPT plan in other apps](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites) · [The New Stack](https://thenewstack.io/?p=22838568) · [Claude Code legal](https://code.claude.com/docs/en/legal-and-compliance) · [Copilot + OpenCode](https://github.blog/changelog/2026-01-16-github-copilot-now-supports-opencode/) · [Electron safeStorage](https://electronjs.org/docs/latest/api/safe-storage) · [models.dev guide](https://aiengineerguide.com/blog/models-dev-open-source-ai-models-database) · [LM Studio tool use](https://lmstudio.ai/docs/advanced/tool-use)

Building blocks: [Judge0](https://github.com/judge0/judge0) · [Piston](https://github.com/engineer-man/piston) · [Sourcegraph → CodeMirror](https://sourcegraph.com/blog/migrating-monaco-codemirror) · [Replit editors](https://blog.repl.it/code-editors) · [Excalidraw API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api) · [mermaid-to-excalidraw](https://docs.excalidraw.com/docs/@excalidraw/mermaid-to-excalidraw/api) · [tldraw license](https://tldraw.dev/sdk-features/license-key) · [system-design-primer](https://github.com/donnemartin/system-design-primer) · [CodeContests](https://github.com/google-deepmind/code_contests) · [interviewing.io 100k analysis](https://interviewing.io/blog/we-analyzed-100k-technical-interviews-to-see-where-the-best-performers-work-here-are-the-results) · [Hello Interview levels](https://hellointerview.com/blog/the-system-design-interview-what-is-expected-at-each-level) · [Meta AI-enabled coding](https://www.hellointerview.com/blog/meta-ai-enabled-coding) · [LLM-judge bias](https://arxiv.org/pdf/2410.21819)
