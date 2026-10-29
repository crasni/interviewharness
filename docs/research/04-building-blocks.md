# Research: coding and system design building blocks, prior art, content, grading

_Researched 2026-10-29. [V] = verified; [U] = unverified._

## Prior-art open-source interviewers
| Project | Stack and providers | Good | Weak |
|---|---|---|---|
| [IliaLarchenko/Interviewer](https://github.com/IliaLarchenko/Interviewer) (Apache-2.0, ~127★) | Python + Gradio; OpenAI, Claude, HF, Ollama | Coding, ML/system design and behavioral; voice | Gradio UI; no scorecard; no whiteboard |
| [ajadreddy/ai-mock-interviewer](https://github.com/ajadreddy/ai-mock-interviewer) | Next.js 16, Monaco, AI SDK, Judge0 (Python only), Moonshine/Piper | **Five phases** (clarify, plan, code, follow-up, feedback), hidden tests, code snapshots, **evidence-based scorecard** | Python only; web only; tiny project |
| [ngoanpv/DeepInterview](https://github.com/ngoanpv/DeepInterview) (Apache-2.0, 66★) | LiveKit + LangGraph + Next.js + Python | A rubric per competency; question-bank packs | Built around CV/job description; no code runner; heavy infrastructure |
| [notKanaa/mockroom](https://github.com/notKanaa/mockroom) (MIT) | Node/TS/Vite on a local server | **YAML question packs**; local JSON history | Q&A only |
| [kirilxd/swe-interview-coach](https://github.com/kirilxd/swe-interview-coach) (91★) | Claude Code plugin | Good prompt and rubric material | No UI |
| SystemDesign.ai **[U]** | Reportedly Electron + Excalidraw + an AI judge | **Closest competitor. Check before v0.4** | Repo and license unverified |

No project combines desktop + coding + system design + any LLM + a whiteboard + good turn-taking.

## Running code
- **Judge0:** GPL-3.0, needs Docker, had sandbox-escape CVEs (CVE-2024-28185/28189) → no.
- **Piston:** MIT, needs privileged Docker and cgroup v2; **its public API went paid on Feb 15, 2026** → at most an optional Docker mode.
- **Default plan:**
  - **Pyodide** (Python) and **QuickJS** (JS) in WASM, so nothing to install.
  - The **user's own toolchains** for Java/C++/Go, wrapped in a sandbox: **bubblewrap** on Linux, **sandbox-exec** on macOS (deprecated but works), **Job Objects / AppContainer** on Windows (no turnkey wrapper).
  - Every run: timeout, output cap, no network, and **fail closed** if the sandbox is missing.
  - Disable Electron's runAsNode fuse.
- **WASM coverage:** C++ via clang-in-wasm is possible but heavy. Go is mostly the Yaegi interpreter. Java in WASM is weak.

## Editor
- **CodeMirror 6** ✅. Sourcegraph migrated to it from Monaco, Replit bet on it, Vim mode (`@replit/codemirror-vim`) is mature, and theming is just CSS. LSP support would come later through a community client.
  - https://sourcegraph.com/blog/migrating-monaco-codemirror · https://blog.repl.it/code-editors
- Monaco is about 5 MB, looks like VS Code, and needs a third-party Vim mode. Real interviews (CoderPad) have little autocomplete anyway.

## Excalidraw (MIT)
- **API:** `getSceneElements()`, `getAppState()`, `updateScene({elements, appState, captureUpdate})`, `onChange()`, `scrollToContent`, `setActiveTool`, `getFiles`, `theme` prop, `exportToSvg/Blob`. https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api
- **Creating elements in code:** `convertToExcalidrawElements(skeletons)`. Mermaid diagrams go through `parseMermaidToExcalidraw(mermaid)` first. Excalidraw's own text-to-diagram feature uses Mermaid as its intermediate format.
- **Scene → text graph** (we build it; no library exists):
  - Nodes are shapes with bound text (`boundElements` / `containerId`).
  - Edges are arrows (`startBinding` / `endBinding`) plus their labels.
  - Frames and groups are subsystems; loose text becomes notes.
  - Unbound arrows need proximity heuristics.
  - Also send a PNG export to multimodal models.
- **tldraw:** source-available, not OSS. Production use needs a license key; free use shows a watermark → **no.**

## Content and licensing
- **Avoid LeetCode text.** The "Apache" `newfacade/LeetCodeDataset` on Hugging Face is LeetCode text.
- **system-design-primer is CC BY 4.0** [V], so it's reusable with attribution. Check its images individually. ByteByteGo is proprietary.
- CodeContests (CC BY 4.0 data / Apache-2.0 code), but its problems come from Codeforces, so rights are murky. HumanEval and MBPP are too easy.
- **Plan:** write original problems (algorithms can't be copyrighted; problem statements can) and take community contributions through pull requests. Content is CC BY 4.0. CI checks that the reference solution passes the tests. The format is in BLUEPRINT §5.4.

## Grading
- **interviewing.io:** technical, problem solving and communication, each 1–4. Problem solving best predicts outcomes. https://interviewing.io/blog/we-analyzed-100k-technical-interviews-to-see-where-the-best-performers-work-here-are-the-results
- **Hello Interview system design:** Problem Navigation, Solution Design, Technical Excellence, Communication, with expectations scaling by level. https://hellointerview.com/blog/the-system-design-interview-what-is-expected-at-each-level
- Tech Interview Handbook signals: https://www.techinterviewhandbook.org/coding-signals/
- **LLM-judge biases:** position, length (verbosity) and self-preference. https://arxiv.org/pdf/2410.21819
- **Mitigations:**
  - Anchored rubrics with behavioral descriptors for each level
  - **Quote evidence before scoring**
  - Objective signals: tests passed, run timestamps
  - A reference checklist per problem
  - Low temperature, median of several samples
  - Optionally a judge from a different model family
  - Show the evidence to the user

## Meta's AI-assisted coding round (for our "AI-assisted round" mode)
https://www.hellointerview.com/blog/meta-ai-enabled-coding · https://interviewing.io/blog/how-to-use-ai-in-meta-s-ai-assisted-coding-interview-with-real-prompts-and-examples
- Piloting since Oct 2025; replaces one onsite coding round.
- 60 minutes in CoderPad, with a file tree, editor and AI chat. The AI reads all files but **only replies in chat** (sources conflict on whether it can edit).
- Model switcher includes GPT-5, Claude, Gemini 2.5 Pro and Llama 4.
- **Phases:**
  1. Fix a non-algorithmic bug.
  2. Implement the core feature (~120+ lines).
  3. Optimize against tiered larger tests.
- **Graded on:** Problem Solving, Code Quality (including understanding the AI's code), Verification, Communication.
- **What we need to build it:** multi-file repo problems with test tiers, a separate *assistant* persona, and logs of prompts and pastes that the grader can see.
