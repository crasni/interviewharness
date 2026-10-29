# CS Interview Prep App: Product Research

_Oct 2026. Sources are mostly vendor pages and review/affiliate blogs, so verify prices on vendor sites before using them in a pitch._

## 1. Market map

| Segment | Players | What they do well | Weak spots |
|---|---|---|---|
| **AI mock interview SaaS** | interviewing.io (free AI Interviewer + $179+ human mocks), Aced (formerly Exponent, $79–99/mo), DevInterview.AI ($20/mo), Final Round AI | Realistic interview flow, human-expert option, brand trust | Locked to their own model; one segment each; expensive monthly |
| **System design tools** | Hello Interview ($99/yr, AI reads whiteboard), Mockingly.ai ($14/mo), Codemia, MockMe (voice + whiteboard) | Whiteboard + rubric feedback is now the standard | Mockingly sends drawings to OpenAI (privacy); none are BYO-model; design-only |
| **Coding practice** | LeetCode, NeetCode Pro (NeetBot AI hints), Codemia | Huge problem banks, community, company tags | NeetBot is a tutor, not an interviewer; LeetCode has no official AI interviewer |
| **Browser extensions on LeetCode** | IntuitCode, LeetDuck, LeetCopilot, AI Interview Coach, 2Code Daily (Ollama) | Phased interviewer (clarify → brute → optimize → review), Socratic hints, voice | Bolted onto someone else's site; no progress model; fragile; mostly solo devs |
| **Institutional / enterprise** | Big Interview (org licenses), Uncharted Career ($9–15/student/yr, ~$5–7.5k min, SAML), ScreenReady, Hiration, Huru (SSO+SCIM) | Sell to career centers & bootcamps per seat; SSO; cohort dashboards | Mostly behavioral/general interviews, **weak on technical CS** |
| **Hiring-side platforms** | CoderPad, HackerRank, Codility (AI Copilot in VS Code, beta) | Where real interviews happen | Employer tools, not practice |
| **Open source** | ajadreddy/ai-mock-interviewer (Next.js, Ollama, Judge0, voice, scorecard), DeepInterview (LiveKit+LangGraph, all-local, Apache-2.0), mockroom, Seekr | Local-first, BYO model, voice | Prototype quality, small banks, no system design, no product polish |
| **DIY: VS Code + AI extension** | LeetCode Plus extension + Copilot/Continue/Cline prompted as "interviewer" | Free, real editor, any model | No interview structure, no timer, no rubric, AI happily leaks the answer, no whiteboard, no history |
| **DIY: SKILL.md packs** | interview-coach, interview-prep-generator, etc. | Free, decent prompts | Text only; can't run code, see a diagram, or track progress |

**Copilots for cheating in live interviews** (Final Round copilot, Interview Coder, Natively) are a different category. **Don't build this.** It's an ethical and legal risk and would kill any enterprise sale.

## 2. Key trends

1. **Interviews now include AI.** Meta runs an AI-assisted coding round in CoderPad (60 min; interviewer sees your prompts). Google reportedly piloting similar. → Nobody offers good practice for *"how well do you work with an AI"* rounds. **Big opening.**
2. **Whiteboard + AI reviewer** is the standard for system design (Excalidraw is the de facto tool).
3. **Phased interviewer** (clarify → brute force → optimize → code review) and **Socratic hints** are the standard for coding.
4. **Voice** is becoming expected (MockMe, LeetDuck, DeepInterview).
5. **BYOK / local models** exist only in hobby OSS and extensions, **never in a polished product**.
6. **ChatGPT plan login** is spreading in dev tools (Codex CLI, OpenHands SDK, Cline). Check OpenAI's terms before reusing that OAuth directly; running the official `codex` CLI as a subprocess is the safe path. Don't reuse Claude consumer-plan OAuth in a third-party app.

## 3. Gaps = our positioning

> **"The interview gym that runs on any model: yours, your company's, or local."**

| Gap | Our answer |
|---|---|
| No product is BYO-model | Provider layer: API keys, OpenAI-compatible (Ollama/LM Studio/vLLM), Azure/Bedrock for orgs, ChatGPT plan via official CLI |
| Tools cover one segment each | One app: coding + system design + behavioral + **AI-assisted round** |
| Enterprise vendors are weak at technical CS | Seat-based plan for bootcamps/universities/CS clubs, with SSO + cohort dashboards + **private model deployment** (data never leaves their setup) |
| VS Code DIY has no structure | Real Monaco editor + runner, but with interviewer state machine, timer, hint budget, rubric, history |
| Privacy (drawings/code sent to OpenAI) | Local-first option; self-hostable enterprise build |

## 4. How we beat each alternative

- **vs VS Code + AI extension:** the AI there is a *helper*; ours is an *interviewer*. It holds back answers, follows interview phases, enforces time, asks follow-ups, and grades against a rubric. We also add a whiteboard, voice, a problem bank with test runner, and progress tracking. Optionally ship a **VS Code extension later** that connects to our backend, so users can practice in their real editor.
- **vs SKILL.md packs:** same prompts could exist, but we execute code, read diagrams, track weak spots, and simulate real conditions.
- **vs interviewing.io / Aced / Hello Interview:** any model, cheaper (BYOK free plan), local/private mode, all segments in one place, AI-assisted-round practice.
- **vs enterprise career platforms:** much deeper technical content, plus private/on-prem model support.

## 5. Pricing sketch (based on market)

| Plan | Price idea | Contents |
|---|---|---|
| Free | $0 | BYOK / local model, limited problem bank |
| Pro | ~$10–15/mo or ~$99/yr | Hosted models, full bank, voice, analytics (undercuts Aced/Final Round, matches Hello Interview) |
| Team / Edu | ~$9–15/seat/yr (Uncharted benchmark) | Cohorts, assignments, dashboards, SSO |
| Enterprise | Custom | SAML/SCIM, org model policies (Azure/Bedrock/self-host), audit logs, self-hosted deployment |

## 6. Open source we can reuse

- **Editor:** Monaco · **Whiteboard:** Excalidraw (MIT)
- **Code runner:** Judge0 or Piston (sandboxed multi-language)
- **Voice:** LiveKit + Whisper + Kokoro (as in DeepInterview)
- **Providers:** Vercel AI SDK / LiteLLM; OpenAI-compatible base URL covers most local servers
- **Reference implementations to study:** ajadreddy/ai-mock-interviewer, DeepInterview

## 7. Recommended MVP wedge

1. Provider layer (BYOK + Ollama + OpenAI-compatible) and settings
2. **Coding interviewer** with phases, hint budget, runner, rubric
3. **AI-assisted round** mode (unique; timely because of Meta)
4. Then system design + whiteboard, then Team/Edu plan

## 8. Open questions

- First paying customer: individuals or bootcamps/universities?
- Problem bank: license, write our own, or AI-generated + curated? (Can't copy LeetCode content.)
- Web-first vs desktop-first (enterprise favors web + SSO; local models favor desktop) → likely both from one codebase.

## Sources

- [Best AI mock interview tools 2026 (DEV)](https://dev.to/hamzaibrahim49/best-ai-mock-interview-tools-for-software-engineers-in-2026-prices-checked-from-someone-who-built-2e86) · [four-leaf.ai comparison](https://four-leaf.ai/blog/best-mock-interview-platforms-2026) · [SpaceComplexity breakdown](https://spacecomplexity.ai/blog/best-ai-mock-interview-platforms) · [devinterview.ai compare](https://devinterview.ai/compare/best-ai-mock-interview-tools-2026)
- [Hello Interview practice](https://www.hellointerview.com/practice) · [Mockingly.ai review](https://prachub.com/resources/mockingly-ai-review-2026-ai-system-design-mocks-vs-real-interview-questions) · [Design Gurus on SD tools](https://www.designgurus.io/answers/detail/platforms-offering-interactive-system-design-interview-practice)
- [NeetCode Pro](https://neetcode.io/pro) · [NeetCode Pro review](https://prachub.com/resources/neetcode-pro-review-2026-is-the-paid-upgrade-worth-it) · [IntuitCode](https://chromewebstore.google.com/detail/cgehhdenccjfmbkeeaegaibghlpcfjhd) · [LeetDuck](https://chromewebstore.google.com/detail/ahhpbbcbgdhachaiahiompglpmhoflco) · [2Code Daily](https://chromewebstore.google.com/detail/eamejmihabhegokmlajmahmpgkfadphl) · [LeetCode Plus for VS Code](https://github.com/Sanju-S/vscode-leetcode-plus) · [Codility AI Copilot in VS Code](https://support.codility.com/hc/en-us/articles/39925970318993-AI-Copilot-in-VSCode)
- [Big Interview pricing](https://www.biginterview.com/pricing/personal) · [Uncharted for institutions](https://unchartedcareer.com/for-institutions) · [ScreenReady for universities](https://getscreenready.com/for-universities) · [Career center tools](https://copilotinterview.com/blog/best-ai-interview-tools-for-career-centers)
- [ai-mock-interviewer](https://github.com/ajadreddy/ai-mock-interviewer) · [DeepInterview](https://github.com/ngoanpv/DeepInterview) · [mockroom](https://github.com/notKanaa/mockroom) · [GitHub ai-interviewer topic](https://github.com/topics/ai-interviewer)
- [awesome-byok-apps](https://github.com/yatsyk/awesome-byok-apps) · [OpenHands LLM subscriptions](https://docs.openhands.dev/sdk/guides/llm-subscriptions) · [OpenCode vs Codex CLI](https://codex.danielvaughan.com/2026/04/09/opencode-vs-codex-cli/)
- [interviewing.io on Meta AI-assisted round](https://interviewing.io/blog/how-to-use-ai-in-meta-s-ai-assisted-coding-interview-with-real-prompts-and-examples) · [Meta AI coding interview (PracHub)](https://prachub.com/resources/meta-ai-coding-interview) · [CO/AI news](https://getcoai.com/news/meta-now-allows-ai-assistants-in-coding-interviews-to-match-real-work-environments/)
