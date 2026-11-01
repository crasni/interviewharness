# Research: v0.1 AI interviewer, problem content and debrief

_Researched 2026-10-30. [V] = verified against a primary source; [S] = secondary sources only; [U] = unverified._

Scope: what v0.1 needs to replace the canned lines with an AI interviewer, write 10 original problems, and give a real debrief. Read with `BLUEPRINT.md` §3, §5.2–5.4, D5, D10, D11 and ADR 0014.

## 1. Interviewer prompting

### What the evidence says about LLM restraint
- **LLMs step in too early and give too much, and asking them not to barely helps.** [V] https://arxiv.org/abs/2607.21306 (Int-Bench, "AI Assistants Overassist", Stanford/UCSD/UW, 2026)
  - LLM teachers step in more often and earlier than humans.
  - In the human comparison, LLMs gave the full solution in 10–14% of interventions; humans did so in 5–7%. LLMs gave a "near-solution" nudge about 48% of the time; humans about 22%.
  - Appendix E.3: adding "only intervene if truly necessary" or "scaffold and guide" to the prompt **did not noticeably change** how often or when GPT-5.2 stepped in.
  - **For us:** this backs D5. The *when* has to come from code (the Floor Manager), not from the prompt. The prompt can only shape *what* is said once code has decided to speak.
- **Tutoring LLMs give away answers.** [V] https://arxiv.org/abs/2305.14536 (MathDial, EMNLP Findings 2023): LLMs solve problems well but tutor badly, partly by "telling" the solution too early. Fine-tuning small open models on teacher dialogues made them tell less often.
- **Answer-revealing is a named failure dimension** in the NAACL 2025 tutor taxonomy (MRBench); the paper also checks Llama-3.1-8B and Prometheus 2 as automatic judges of tutor replies. [S for the "reveals too quickly" wording, which came from a project summary] https://arxiv.org/abs/2412.09416
- **LearnLM** treats teaching behaviour as "pedagogical instruction following": system instructions describe the behaviour wanted, and the model is trained to follow them. Raters preferred it to GPT-4o and Claude 3.5 Sonnet. [V abstract] https://arxiv.org/abs/2412.16429. We can't train models; we can borrow the idea that the behaviour lives in the system instructions.

### What existing tools actually do
- **CS50 Duck (Harvard, GPT-4)** [V] https://cs.harvard.edu/malan/publications/V1fp0567-liu.pdf
  - A system prompt sets the course rules. Each student query goes inside a fixed user-prompt template. Prompts live in YAML config files, one per use case.
  - A separate "guard" call checks suspicious input for prompt injection, such as attempts to extract homework solutions.
  - Students get 10 "hearts" that refill one every 3 minutes, a deliberate limit on how much help they can ask for.
- **IliaLarchenko/Interviewer (Apache-2.0)** [V] https://github.com/IliaLarchenko/Interviewer/blob/main/resources/prompts.py
  - Prompt rules: "Be very concise", never give away "the solution or any part of it", never repeat or summarise what the candidate said, and in coding rounds don't point out bugs directly.
  - **Hidden notes:** the interviewer writes private notes after a `#NOTES#` delimiter (mistakes, missed points), which feed the feedback. This is a cheap way to collect evidence during the round.
  - **Interviewer-quality tests** [V] https://github.com/IliaLarchenko/Interviewer/blob/main/tests/testing_prompts.py
    - An LLM plays "a very bad developer" candidate. There are also empty, gibberish and repeat modes.
    - A strict grader scores the *interviewer* against about 35 yes/no checks, including "didn't provide the solutions", "didn't repeat questions", "didn't leak hidden notes" and "feedback illustrated all main points with specific examples".
    - This checklist could seed our `evals/`.
- **ajadreddy/ai-mock-interviewer (MIT)**: the most detailed open prompt found. [V] https://github.com/ajadreddy/ai-mock-interviewer/blob/main/lib/interviewer-prompt.ts
  - Rules worth learning from (not copying wholesale):
    - Ask one question per reply.
    - Naming a technique is not explaining it.
    - Never volunteer the optimal algorithm or complexity target just because the candidate proposed something slower.
    - Accept a correct but suboptimal plan.
    - Don't over-probe correct reasoning.
    - While the candidate codes, "default … is SILENCE".
    - Never mention phases, tools or the app.
  - **Grounding:** the editor snapshot is the only truth about the code. "Sure" does not mean the code changed. Stub code isn't analysed.
  - **Clarifications** are answered from an "Interviewer reference" in the problem file. The interviewer never invents constraints.
  - **Hidden tests never reach the model.** On a failed submit, it describes the failing *behaviour*, never the hidden input. [V README] https://github.com/ajadreddy/ai-mock-interviewer
  - **Phase changes:** the model emits inline tokens (`[->coding]`), and the app strips them. Our app owns phases instead (`phases.ts`), which is safer.
  - **Prompt-injection defence:** control notes carry a per-turn secret token.
- **Khan Academy:** a 7-step process (ideal tutor relationship, learning science, persona testing, iterate). The fixes it reports were for repetition and tone. [V] https://blog.khanacademy.org/khan-academys-7-step-approach-to-prompt-engineering-for-khanmigo. Khan's learning officer has said very long prompts made the model "randomly" ignore parts of them. [S, interview repost] https://rickhess99.medium.com/can-an-ai-powered-tutor-produce-meaningful-results-b67d7376cb51
- **LearnHarness** commits a hidden solution before posing a practice problem and gives one hint step per request. [V, our teardown] `docs/research/01-learnharness.md`

### Prompt-writing rules from model vendors
- Give the model a role in the system prompt. Separate instructions, context and examples with XML-style tags. Explain *why* a rule exists. Use 3–5 examples. [V] https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Put long material (problem, code) **above** the instructions and the question at the end. Anthropic reports up to 30% better answers this way on complex inputs. [V] same page
- Say what to do rather than what not to do. [V] same page. For us: "Reply in one or two short spoken sentences" works better than "don't lecture".
- **Long conversations:** inject reminders into the user turn, or refresh context through tools. [V] same page
- **Prompt caching:** keep stable content (rules, problem, notes) first and changing state last. A changed prefix breaks reuse. OpenAI caches automatically from 1,024 tokens. [V] https://developers.openai.com/api/docs/guides/prompt-caching

### Phases
- Our phases live in code (`packages/engine/src/phases.ts`): the interviewer offers to move on and only the candidate's yes moves it. **Keep it that way.** The LLM gets the current phase and a per-phase goal as context and never decides the phase. This matches ai-mock-interviewer's "app owns the phase" [V], minus its model-emitted tokens.
- **Per-phase guidance**, adapted from ai-mock-interviewer [V] and Tech Interview Handbook's rubric [S]:
  - **Clarify:** answer only from the problem's interviewer notes, and give no approach.
  - **Approach:** get the candidate's complexity out of them, accept a suboptimal plan, and ask at most one open "can you do better?".
  - **Code:** silent unless asked.
  - **Test:** ask them to walk through a case and don't name the bug.
  - **Complexity:** let them state it first.
  - **Wrap-up:** answer their questions.
- `round.ts` already holds per-phase time shares, so the prompt never needs to talk about time.

### Keeping the interviewer consistent
- **Persona drift is real:** popular chat models (LLaMA2-70B, GPT-3.5) drift noticeably from their system-prompt persona within 8 rounds. Attention to the system prompt decays over a long dialogue. [V] https://arxiv.org/abs/2402.10962
- **All models do worse in multi-turn conversations:** a 39% average drop versus single-turn, mostly from unreliability, and they "get lost and do not recover". [V] https://arxiv.org/abs/2505.06120
- **What follows for us:**
  - Rebuild each call from state rather than replaying a long chat: rules + problem + phase + a short running summary + the last few turns + the current code.
  - Repeat the 3–4 key rules (length, no hints, one question) in the per-turn block. Anthropic's "inject reminders into the user turn" [V] supports this.
  - Keep `content/interviewer/lines.md` as few-shot tone examples. The file already says it becomes "guidance for tone and length".

### Feeding it the editor and run results
- **Send the current code in full each turn** (a 45-minute solution is about 30–150 lines, roughly 0.3–2k tokens) [U estimate], plus whether it changed since the interviewer last spoke.
  - Interviewer's simulated candidate sends code only when it changed. [V] tests/testing_prompts.py
  - ai-mock-interviewer reads the live snapshot before any comment on code. [V]
  - A small diff is useful *in addition*, for "what did they just do". On its own it forces the model to rebuild the file, and small models struggle with that [U].
- **Run results:** a compact block per run:
  - public tests passed/failed, and the first failing public case (input, expected, got)
  - trimmed stderr
  - for hidden tests, only counts and a behaviour description written in the problem file (e.g. "fails when all numbers are negative"), never hidden inputs. Same rule as ai-mock-interviewer [V].
- **Budget:** Ollama's default context is **4,096 tokens** unless `num_ctx` or `OLLAMA_CONTEXT_LENGTH` is set, and memory grows with context × parallel requests. [V] https://docs.ollama.com/faq. **Always set `num_ctx` explicitly** (8k–16k) for local models. Without it, a problem plus code plus transcript overflows quietly [U on the exact truncation behaviour].
- **Rough per-call layout** [U, to be measured]: rules ~800 tokens + problem and notes ~1,000 + summary ~300 + last 6 turns ~600 + code ~1,000 + run block ~200, about 4k tokens in total.

### Small local (8B) models vs frontier
- **Instruction following and tool use drop with size.** Llama 3.1 instruct scores, 8B vs 405B: IFEval 80.4 vs 88.6; tool use (Nexus) 38.5 vs 58.7; BFCL 76.1 vs 88.5. [V] https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md
- **Small models produce malformed tool calls** [V, in our 03-providers note]. So **don't give the interviewer tools in v0.1**: put code and run results in the prompt, as above.
- **Expected failures at 8B** [U, needs our own eval]:
  - drifting into lecturing
  - leaking the approach when the candidate is stuck
  - repeating questions
  - inventing constraints
  - losing track of the phase
  - ignoring the length rule over long rounds
- **Mitigations:**
  - The Floor Manager decides when to speak (D5).
  - Cap output tokens (about 60 for an ack, 120 for an answer).
  - Strip or reject replies over N sentences or with code blocks, and regenerate once.
  - Use few-shot examples from `lines.md`.
  - Rebuild the prompt from state each turn.
- **Hints:** pre-write the hint ladder in the problem file. The LLM *rephrases* rung n in context instead of inventing a hint. The stronger the model, the more freedom it can have [U].

## 2. The floor decision with an LLM

### Where an LLM call fits the existing engine
- Today `floor-manager.ts` sorts each typed turn with regexes: `question` if it ends in "?", `done` for phrases like "that's it", otherwise `statement`. `acceptPhrases` handles "yes" to a move-on offer. **This is exactly where a small classifier helps.** "So I guess I'd use a hash map?" is thinking aloud, not a question to the interviewer.
- **Keep D5:** the classifier produces a **signal**, and the rules still produce the **decision**. The rules stay deterministic and testable with the fake clock.
- **Proposed classifier output** (structured, enum fields only):
  - `addressed`: `interviewer | self`
  - `kind`: `question | thinking-aloud | statement | done | wants-hint | accepts-move | declines-move | off-topic`
  - `reason`: short text, for the log only
- The `Decision` union lacks `probe` and `hint` (BLUEPRINT §3.3 lists PROBE, HINT, REDIRECT). v0.1 needs at least `hint` ("wants-hint" or a stall) and probably `probe` (for example, complexity never stated before moving on).

### Structured output per provider
- **OpenAI:** Structured Outputs guarantees schema-valid JSON, unlike JSON mode. [V] https://developers.openai.com/api/docs/guides/structured-outputs
  - The **first request with a new schema is slower**, so warm it up at round start.
  - Check the `refusal` and incomplete-response fields.
- **Ollama:** pass a JSON schema in `format`. Also say "return JSON" in the prompt, and use temperature 0. [V] https://ollama.com/blog/structured-outputs
- **Other local servers:** validate with zod and retry once with the error. If the call fails or is late, fall back to the current regex rules. [V pattern, 03-providers]

### Latency budget
- People leave about 200 ms between turns across languages. [S, Stivers et al. 2009, PNAS 106(26); the page was blocked] https://www.pnas.org/doi/10.1073/pnas.0903616106
- The engine already waits `respondAfter = 600 ms` after a typed turn. **Fire the classifier at `said` (later: at end of turn) and give it that window.** If it's not back by then, decide with the regex rules and log `classifier: 'timeout'`.
- For an ack or backchannel, the line comes from `lines.md`, so no LLM wait is needed. Only answer, probe and hint wait on the interviewer LLM, and they can stream.
- **Local timings** [U, must measure on the owner's machines]: a classifier call with a ~300-token prompt and ~30-token JSON output on a warm 3–8B model fits in a few hundred ms on Apple Silicon or an NVIDIA GPU, and likely not on CPU-only laptops.
  - Ollama unloads a model after 5 minutes by default. **Preload at round start and set `keep_alive`.** [V] https://docs.ollama.com/faq
  - Ollama serves one request per model by default (`OLLAMA_NUM_PARALLEL`). [V] same. A classifier call and an interviewer call on the *same* model queue behind each other. Use a smaller second model, or accept the wait.

### Logging every decision for replay
- The existing shape fits: `FloorLogEntry { at, signal, decision, state }` goes to `rounds/<start>/events.jsonl` (`apps/desktop/src/main/events-log.ts`).
- **Add, without changing that shape:**
  - A `classified` signal, logged as its own entry: `{ type: 'classified', ofSaidAt, result, model, promptVersion, latencyMs }`. On timeout or error, use `result: null` with a reason.
  - `state.classifier` showing what the rules used: the classifier's kind or the regex fallback.
  - An `llm` entry per interviewer call: slot, model, promptVersion, input/output tokens, latency, finish reason, and the final line. Store the full prompt in a side file or by hash, not inline, to keep the log readable [U].
- **Replay:** re-run the Floor Manager over logged signals, *including* logged `classified` results, so replay never calls a model and stays deterministic. This is the "scripted fake" rule in AGENTS.md. A floor eval can then swap in a different classifier and compare decisions.

## 3. Real hiring rubrics

Primary rubric documents are scarce. Most company pages are JavaScript-rendered or gated PDFs, and most detail online comes from prep sites.

- **Google, structured interviewing (primary, re:Work):** [V] https://rework.withgoogle.com/intl/en/guides/a-guide-to-structured-interviewing-for-better-hiring-practices
  - Same questions for every candidate, one shared scale, predetermined qualifications.
  - Each question has a rubric with examples of **Poor / Borderline / Solid / Outstanding** answers.
  - Interviewers take detailed notes so later reviewers can check the evidence.
- **Google's four attributes** (general cognitive ability, role-related knowledge, leadership, "Googleyness"): widely reported, but not found on a Google page we could load. [S] https://www.businessinsider.in/Heres-Exactly-What-Google-Grades-Interviewees-On-When-Its-Hiring/articleshow/43247184.cms
- **Meta** [V] https://www.metacareers.com/blog/preparing-for-your-software-engineering-interview-at-meta/
  - Meta says it pays "a lot of attention to the way you solve problems".
  - Its other advice: think out loud, find and fix your own bugs, and get a working solution before an optimal one.
  - The four named focus areas (**problem solving, coding, verification, communication**), which D11 already uses, come from Meta's Full Loop prep PDF. We couldn't load it, so they rest on secondary reports here. [S] https://www.tryexponent.com/guides/meta-software-engineer-interview
- **Amazon** [V] https://www.amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep
  - Code should be "scalable, robust, and well-tested". Check edge cases so no bad input slips through.
  - The topic list includes "logical and maintainable" code.
  - Every loop has a Bar Raiser. [S] https://www.interviewquery.com/interview-guides/amazon-software-engineer
- **Stripe:** bug-squash and integration rounds, reportedly graded on method and on code read like a production pull request. Nothing official was found. [S] https://nodeflair.com/blog/stripe-software-engineer-interview-questions-and-process
- **Tech Interview Handbook rubric** (written by an ex-Meta staff engineer) [S] https://www.techinterviewhandbook.org/coding-interview-rubrics/. "All rights reserved", so learn from it but don't copy it.
  - **Four axes:**
    - communication: clarifying questions, explaining the approach and trade-offs, talking while coding
    - problem solving: a systematic approach, an optimal solution with correct complexity, few hints
    - technical competency: clean, working code
    - testing: typical and corner cases, catching and fixing its own bugs
  - **Verdict scale:** levels from Strong hire to Strong no hire. Some companies add a middle band.
- **Our six-level verdict** (GLOSSARY) is finer than both. Mapping:
  - Google's Outstanding / Solid / Borderline / Poor fits our per-axis 1–4.
  - Strong hire … Strong no hire is the overall call.
  - **Lean hire / Lean no hire** are our "Borderline" split in two.
- **Feedback with evidence:**
  - re:Work: detailed notes for later review. [V]
  - ai-mock-interviewer: timestamped code snapshots and a test history feed the feedback; deterministic pacing facts (forced wrap-up, skipped brute force, few think-aloud words) are passed in as ground truth and **cap scores**, e.g. "comms must be at most 2" when think-aloud was negligible. [V] https://github.com/ajadreddy/ai-mock-interviewer/blob/main/lib/feedback.ts
  - Interviewer's grader checks that feedback "illustrated all main points with specific examples". [V]

## 4. LLM-as-grader reliability

- **Known biases:** position, verbosity and self-enhancement bias. Strong judges such as GPT-4 reach more than 80% agreement with humans, about the human–human level. [V] https://arxiv.org/abs/2306.05685
  - For us, **verbosity bias** means a talkative candidate may score higher on communication than they deserve [U, inferred].
  - Self-enhancement matters if the grader is the same model as the interviewer: it may rate its own hints as the candidate's work [U].
- **Only the biggest judges align reasonably with humans**, and even they fall well short of human–human agreement; scores can differ by up to 5 points. Judges are lenient and sensitive to prompt length and complexity. Percent agreement alone hides large score gaps. [V] https://arxiv.org/abs/2406.12624
  - **So a debrief from an 8B model should be labelled as rough**, or the grader slot should default to the strongest model configured.
- **A panel of smaller models from different families beat a single GPT-4 judge** and cost over 7× less. [V] https://arxiv.org/abs/2404.18796. This is an option when a user has two or three local models, and an alternative to D11's "median of several samples" from one model.
- **Reasoning, then form-filling (G-Eval):** chain-of-thought followed by a form improves agreement. It also warns that LLM judges favour LLM-written text. [V] https://arxiv.org/abs/2303.16634
- **Open rubric judges exist:** Prometheus 2 does direct scoring against user-defined criteria and has the best human agreement among open judges. [V abstract] https://arxiv.org/abs/2405.01535
- **Fixed rubric + quoted evidence + calibration beats a rubric written as prose.** The judge must cite evidence for each score, and scores are mapped to human boundaries. The result agreed better with humans and stayed stable when the rubric was reworded. [V] https://arxiv.org/abs/2601.08654
- **Objective rubric items agree with humans; subjective ones don't.** On programming-grading data, LLM graders agree with each other on subjective items but drift from humans. [V] https://aclanthology.org/2026.emnlp-main.2465/
  - **Write axis anchors as observable checks**, e.g. "stated time complexity before coding", "ran or traced at least one edge case", "found own bug". Avoid wording like "communicated clearly".
- **Vendor guidance:**
  - Use a clear rubric with defined endpoints.
  - Wrap the graded material in tags.
  - Constrain the output.
  - Generally grade with a **different model** from the one that produced the output.

  [V] https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
- **What this means for the debrief:**
  - **Compute the facts in code first**, never by the LLM:
    - tests passed (public and hidden)
    - hints given and their rungs
    - time per phase
    - whether complexity was stated, and when
    - think-aloud word count during Code (v0.2)
    - runs made, and whether they fixed a failure themselves
  - The grader returns JSON: per axis, a score 1–4, 1–3 evidence references (`event` index or transcript line id, snapshot id, run id), and one sentence.
    - **Reject and retry if a reference doesn't exist in the round's files.**
  - Apply code-side caps, e.g. "hidden tests failing → problem solving ≤ 2 unless…".
  - Sample 3 times at low temperature and take the per-axis median (D11). With two or more model families available, a panel is better.
  - Then map axes to a verdict, and have one final LLM call write the prose that the debrief screen shows.

## 5. Problem content

### How open problem sets are structured
- **Exercism problem-specifications (MIT):** each exercise is `description.md` + `metadata.toml` (source, blurb) + an optional `canonical-data.json`. [V] https://github.com/exercism/problem-specifications
  - Each test case has a `uuid`, `description`, `property` (the function), `input` and `expected`; errors are written `{ "error": "…" }`.
  - **Cases are never edited.** A fix adds a new case with `reimplements: <old uuid>`.
  - Language tracks generate their tests from this one file.
- **Kattis / ICPC problem package format (2025-09)** [V] https://www.kattis.com/problem-package-format/spec/2025-09.html
  - `problem.yaml` holds `name`, `uuid`, `license` (e.g. `cc by`), `rights_owner`, `credits.authors` and `source`.
  - `statement/problem.en.md`; `data/sample/` (shown) vs `data/secret/` (hidden).
  - `submissions/accepted/` holds at least one reference solution, which tooling runs against all data.
  - Input validators.
  - **It is the closest prior art to BLUEPRINT §5.4.** Its license and rights-owner fields are a good model for CC BY 4.0 credits.
- **ai-mock-interviewer**'s question bank has public tests, server-only `hiddenTestCases`, and an "Interviewer reference" used to answer clarifications. [V] https://github.com/ajadreddy/ai-mock-interviewer

### Proposed v0.1 format (plain files, CC BY 4.0)
BLUEPRINT §5.4 plans `content/coding/<slug>/problem.yaml`; the repo today has `content/problems/two-sum.md`. Suggested merge:
```
content/problems/<slug>/
  statement.md        # what the candidate sees: story, examples, constraints (current two-sum.md style)
  problem.yaml        # id (uuid), title, difficulty, patterns[], function signature per language,
                      # time_budget, license: CC-BY-4.0, authors[], source: original
  interviewer.md      # never shown: key insight, expected complexities, answers to likely
                      # clarifying questions, common mistakes, hint ladder (3 rungs), probes, follow-ups
  tests.json          # Exercism-style cases: {uuid, description, input, expected, hidden: bool, behaviour}
  reference/solution.py, solution.js   # CI runs both against tests.json
```
- **Why JSON for tests:**
  - Exercism uses it. [V]
  - Pyodide and QuickJS parse it natively.
  - It avoids YAML's implicit typing traps such as `no` → false in YAML 1.1 parsers [U on which parser we'd use].
- **`behaviour`** on hidden cases is the sentence the interviewer may say when that case fails. That keeps hidden inputs out of the prompt, the same rule as ai-mock-interviewer. [V]
- **Hint ladder rungs:** nudge → question → concrete (BLUEPRINT §3.3), each one sentence, never code.
- **A content-schema zod check plus CI**: every `reference/` passes every case, uuids are unique, and every hidden case has a `behaviour`.

### Writing originals that don't copy LeetCode
- US copyright excludes "any idea, procedure, process, system, method of operation…" and protects only the original expression. [V] https://www.copyright.gov/circs/circ33.pdf. **Algorithms and classic problem ideas are free to use; someone else's statement text, examples and test data are not.**
- LeetCode's terms page returned 403, so its content terms are unverified [U]. AGENTS.md already rules out LeetCode text.
- **Practice:**
  - Write each statement from the idea alone, without the original open.
  - Use our own story, names, examples, constraints and test data.
  - Don't reuse well-known titles where we can give a literal one of our own.
  - Record `source: original` and authors in `problem.yaml`.
  - CodeContests is mostly scraped from contest sites; check per-problem rights before reuse [U]. system-design-primer (CC BY 4.0) can be used with attribution (D10).

### Ten classic patterns that fit a 45-minute round
All have a brute force and a better solution, so the Approach and Complexity phases have something to discuss. Working titles are literal, per AGENTS.md.

| # | Working title | Pattern | Natural follow-up |
|---|---|---|---|
| 1 | Two sum (existing, own words) | hash map | input sorted → two pointers, O(1) space |
| 2 | Check balanced brackets | stack | report the position of the first error |
| 3 | Merge overlapping bookings | sort + sweep | insert one new booking into a merged list |
| 4 | Longest stretch with no repeats | sliding window | at most k distinct values |
| 5 | First failing build | binary search on a predicate | the predicate is expensive; count the calls |
| 6 | Count islands on a map | grid BFS/DFS | size of the largest island; do it without recursion |
| 7 | Most frequent words in a log | hash map + heap / buckets | streaming input |
| 8 | Recently used cache | hash map + linked list (design) | add time-based expiry |
| 9 | Order tasks with dependencies | topological sort | detect and report a cycle |
| 10 | Fewest coins for an amount | dynamic programming | count the ways instead of the minimum |

Coverage: arrays, strings, stacks, sorting, binary search, graphs, heaps, design and DP. That spans most of the common pattern lists [S, e.g. Tech Interview Handbook]. Difficulty: 1–4 easy, 5–8 medium, 9–10 medium; tune with playtests.

## Cross-platform notes (macOS, Linux, Windows)
- **events.jsonl and transcript.jsonl:** UTF-8, no BOM, one value per line, `\n` terminator. Readers must tolerate `\r\n`, which the spec allows because JSON ignores surrounding whitespace. [V] https://jsonlines.org/. `events-log.ts` already writes `\n`. **Readers should split on `/\r?\n/` and skip a trailing empty line.**
- **Round folder names:** Windows forbids `< > : " / \ | ? *` and the names CON, PRN, AUX, NUL, COM1–9, LPT1–9 (with or without an extension). It doesn't distinguish case, and paths have a 260-character limit unless long paths are enabled. [V] https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
  - `events-log.ts` already replaces `:` and `.` in the ISO time.
  - **Problem slugs:** lowercase ASCII with hyphens, and never a reserved name. Add a content lint for this, since macOS and Windows are case-insensitive by default.
- **Content files and line endings:** the repo has **no `.gitattributes`**. Windows clones with `core.autocrlf=true` get CRLF files.
  - Add `* text=auto eol=lf`, which overrides autocrlf. [V] https://git-scm.com/docs/gitattributes
  - `lines.ts` splits on `\n` but `trim()`s each line, so it already tolerates CRLF. New parsers (statement, interviewer notes) must do the same.
  - Test comparisons must normalise line endings in captured stdout.
- **Paths inside problem files:** use relative forward-slash paths only, and resolve them with `path.join` in main. Never build paths in the renderer.
- **Local models by OS:** [V] https://docs.ollama.com/gpu
  - **macOS:** Metal on Apple Silicon.
  - **Windows and Linux:** NVIDIA CUDA (compute 5.0+). AMD via ROCm v7 covers only a few cards on Windows (RX 7600–7900, PRO W7xxx) and more on Linux. Vulkan works on both but needs extra packages on most Linux distros.
  - Typical Windows laptops without a discrete GPU run on CPU, so an 8B interviewer will be slow there and the floor classifier should fall back to rules [U, needs measuring].
  - Ollama's model folder differs per OS (`OLLAMA_MODELS` overrides it). [V] https://docs.ollama.com/faq. We should never touch it.
- **Runner:** Pyodide and QuickJS are WASM, so they are the same on all three OSes; Windows stays WASM-only per D9.

## Recommendations for v0.1
1. **Keep "when" in code, add the LLM only for "what".** The Int-Bench result (prompts don't reduce over-intervention) is the strongest evidence for D5.
2. **Add an optional floor classifier as a signal, not a decider.** Enum JSON output; fired at `said` inside the existing 600 ms beat; falls back to regex on timeout; logged as a `classified` entry, so replays never call a model.
3. **Interviewer prompt built from state each turn:** rules (role, one or two spoken sentences, one question, never the approach or complexity target, never name bugs, never mention phases or the app) + problem + interviewer notes + phase goal + running summary + last few turns + full current code + run block, with reminders repeated in the user turn. Cap output tokens; reject and regenerate long or code-bearing replies.
4. **No tools for the interviewer in v0.1**, so 8B models work. Hidden test inputs never enter any prompt; use `behaviour` sentences.
5. **Hints come from the problem file's 3-rung ladder**; the LLM rephrases and never invents them. Add `hint` and `probe` to the `Decision` union.
6. **Debrief pipeline:**
   1. code-computed facts
   2. grader JSON (per-axis 1–4, observable anchors, evidence ids that are checked)
   3. code-side caps
   4. median of 3 samples
   5. verdict mapping
   6. one prose call

   Label the debrief as rough when the grader is a small model.
7. **Problem format:** `statement.md` + `problem.yaml` + `interviewer.md` + `tests.json` (Exercism-style uuids) + `reference/`, checked in CI. Write the 10 problems in the table, from the idea only.
8. **Interviewer-quality eval early:** copy the *method* of Interviewer's tests (simulated bad, empty and gibberish candidates, plus a yes/no checklist such as "gave no solution", "didn't repeat") into `evals/`, using scripted candidates, so it runs without network in CI.
9. **Cross-platform:** add `.gitattributes` (`* text=auto eol=lf`), CRLF-tolerant readers, a slug lint against Windows reserved names, and an explicit `num_ctx` and `keep_alive` for Ollama.

## Open questions for the owner
1. **Floor classifier in v0.1, or rules only until voice (v0.2)?** With typed turns, the regex rules may be enough for now.
2. **What does the interviewer see of the reference solution?** Only the key insight and notes, which is safer against leaks, or the full code, which helps it judge correctness?
3. **Verdict:** computed from axis scores by a fixed table (predictable, explainable), or chosen by the grader with reasons (more holistic)?
4. **Should hints asked for lower the problem-solving score**, as BLUEPRINT §3.1 says ("every rung costs points"), or only be mentioned in the written feedback, as GLOSSARY says? The two disagree.
5. **Problem folder layout:** move to `content/problems/<slug>/` with four files as proposed, or keep BLUEPRINT's single `problem.yaml` with the statement inside?
6. **Grader model default:** use the interviewer slot's model, or require or recommend a separate, stronger "grader" slot (as vendors advise) and warn when it's a small local model?
7. **Is Python + JavaScript enough** for v0.1 reference solutions and tests, given the editor offers six languages?
