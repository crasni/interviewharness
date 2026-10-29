# Research: the v0.1 code runner (Python and JavaScript)

_Researched 2026-10-30. [V] = verified against a primary source; [S] = secondary sources only; [U] = unverified._

"Tested" means we ran it ourselves on 2026-10-30: Linux x64, Node 22.22.1, and the repo's own Electron 45.1.0, with throwaway scripts in a scratch folder (not in the repo). Tests on macOS and Windows have not been run.

## Summary
- Pyodide works offline in Electron, but **only in a module Web Worker served from a custom protocol (`app://`) that sends COOP, COEP and CSP headers.** Then `SharedArrayBuffer` exists and the interrupt buffer stops `while True` in about 300 ms. Tested.
- **Do not run Pyodide under Node (utility process).** Python's `import js` reaches the host's JS globals, and in Node that includes `process.getBuiltinModule("os")`. Tested. This corrects BLUEPRINT §5.1, which puts Pyodide in the runner utility process.
- The meta-tag CSP in `index.html` **does not cover workers.** A worker loaded from `file://` could `fetch` the internet, and Python's `urllib` got through over a WebSocket. Tested.
- QuickJS (`quickjs-emscripten`, MIT) has a real interrupt handler, a memory limit and a stack limit. All three worked. Tested.
- TypeScript: strip types with **sucrase** (MIT, ~0.3 ms per call). TypeScript 7 is the Go-native compiler and has no in-process `transpileModule`. [V]

## 1. Pyodide (Python)

### Version, license, size
- **Latest: 314.0.7** (2026-09-14). Python **3.14.2**, Emscripten 5.0.3. [V] https://www.npmjs.com/package/pyodide · https://github.com/pyodide/pyodide/releases/tag/314.0.7 · https://pyodide.org/en/stable/project/changelog.html
  - The version jumped from 0.29.x to 314.0.0 on 2026-06-09. The changelog doesn't explain why; the number matches Python 3.14. [V] for the dates, [U] for the reason.
  - 0.29.5 and 0.27.8 maintenance releases came out on 2026-09-15/16, so "latest by date" is not the newest line. Pin `314.0.7`. [V] npm `time` field.
- **License: MPL-2.0** [V] (`package.json`). It's file-level copyleft: we can ship it unmodified inside an Apache-2.0 app. If we patch Pyodide's own files, those files stay MPL. [S] https://www.mozilla.org/en-US/MPL/2.0/FAQ/
- **Size of the npm package: 13.9 MB unpacked, 6.5 MB as a tarball.** [V] (we inspected the tarball)
  - `pyodide.asm.wasm` 9.6 MB, `python_stdlib.zip` 2.5 MB, `pyodide.asm.mjs` 1.25 MB, plus `pyodide.mjs`, `pyodide-lock.json` (119 KB).
  - No native binaries, so the same files work on every OS and CPU. [V]
- **Load time: about 1.0–1.2 s** for `loadPyodide()` with no extra packages. Tested: 1.18 s under Node, 1.03–1.09 s in an Electron 45 module worker. Slower machines will take longer [U].
- **Speed:** naive `fib(27)` took 23 ms in Pyodide vs 9 ms in native CPython on the same machine. Tested. Expect roughly 1.5–3× slower than CPython [S].

### Standard library
- Since 314.0.0 **the stdlib is no longer unvendored**: `sqlite3` and `lzma` ship in the core. `test` and `pydecimal` were removed. `ssl` is a stub. [V] changelog
- Tested working: `heapq, collections, bisect, functools, itertools, math, json, re, typing, dataclasses, sqlite3, decimal, fractions, statistics, unittest, string, array`. Everything an interview problem needs.
- **Threads:** `threading.Thread.start()` raises `RuntimeError: can't start new thread`. Tested. Interview code rarely needs threads, but concurrency questions would.
- **Recursion limit is 1000** (CPython default); deep recursion raises a normal `RecursionError`. Tested.
- **Filesystem:** an in-memory Emscripten FS (`/tmp`, `/home`, `/dev`, `/proc`, `/lib`). No host files. Tested.
- `pyodide-lock.json` lists packages (numpy etc.) that would be downloaded from a CDN by `loadPackage`. We won't call it, and the network is blocked anyway (see §4). [V]

### Loading offline with Vite (no CDN)
- `loadPyodide({ indexURL })` loads `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip` and `pyodide-lock.json` from `indexURL`. [V] https://pyodide.org/en/stable/usage/api/js-api.html
- Pyodide's bundler guide for Vite: `optimizeDeps: { exclude: ["pyodide"] }`, and copy the package files to the build output with `vite-plugin-static-copy` (excluding `*.md, *.html, *.d.ts, *.whl, node_modules`). [V] https://pyodide.org/en/stable/usage/working-with-bundlers.html (tested by them on Vite 5; we're on Vite 8, so re-check [U]).
- **Pyodide 314 refuses classic workers.** `loadPyodide` throws `Classic web workers are not supported`; use `new Worker(url, { type: 'module' })` and `import { loadPyodide } from './pyodide/pyodide.mjs'`. Tested; the check is `isClassicWorker()` in `pyodide.js` [V].
- **CSP must allow `'wasm-unsafe-eval'`** in `script-src`. Without it, loading hangs. Tested.

### Worker vs utility process
- **Web Worker in a sandboxed renderer: yes.** The worker has no Node, and network is blockable by CSP. Tested.
- **Electron utility process: no for Pyodide.** It's a Node process ([V] https://www.electronjs.org/docs/latest/api/utility-process). Tested escape: `import js; js.process.getBuiltinModule("os").hostname()` returned the host name. Hiding the `js` module (`sys.modules["js"] = None`) is undone with `del sys.modules["js"]`. Tested.
  - Pyodide 314 also added experimental socket support under Node. [V] changelog. Under Node, `urllib` tried to open a real connection. Tested.

### Capturing stdout/stderr
- `pyodide.setStdout({ batched: line => ... })` and `setStderr(...)` give whole lines. `raw` (per character) and `write` (bytes) also exist. [V] https://pyodide.org/en/stable/usage/streams.html. Tested: both streams captured.
- `setStdin({ error: true })` makes `input()` fail instead of calling the browser's `prompt()`. [V] same page.

### Timeouts: interrupt buffer + hard kill
- **Interrupt buffer:** share a `SharedArrayBuffer` with the worker, call `pyodide.setInterruptBuffer(new Uint8Array(sab))`, and write `2` from the other thread to raise `KeyboardInterrupt`. Pyodide resets it to 0. It only works in a worker. [V] https://pyodide.org/en/stable/usage/keyboard-interrupts.html
  - Tested in Electron 45: `while True: pass` stopped after 301 ms; the interpreter was still usable afterwards (`1+1` → 2).
  - Must be written from another thread. Setting it with `setTimeout` on the same thread never fires while Python is running. Tested (our first attempt hung).
- **It's cooperative.** Python checks between bytecodes. **A long C-level call ignores it:** `sum(range(10**10))` did not stop within 3 s. `10**(10**8)` and `for _ in itertools.repeat(None)` did stop. Tested.
- **So always have a hard kill:** `worker.terminate()`. Tested: under Node it took ~9 ms; in Electron it was immediate. After a kill, a fresh Pyodide costs ~1 s to load, so keep a warm spare worker.
- **`SharedArrayBuffer` needs cross-origin isolation in Electron too:**
  - `file://` page: `crossOriginIsolated === false`, `SharedArrayBuffer` undefined. Tested.
  - `app://` page via `protocol.handle` with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`: `crossOriginIsolated === true` in the page and in the worker. Tested.
  - The scheme was registered with `registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }])`. [V] https://www.electronjs.org/docs/latest/api/protocol
  - Without a SAB, the fallback is kill-and-restart only. Pyodide's `checkInterrupt()` doesn't help that case.

### Memory
- **There is no memory-limit API.** A 3 GB allocation (`[bytearray(10**8) for _ in range(30)]`) succeeded and grew the heap from 31 MB to 3,026 MB. Tested.
- The ceiling is wasm32's 4 GB [S] https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory. **WASM memory can grow but never shrink** [S] same page, so a worker that once hit 3 GB keeps it.
- **Plan:** after each run, read `HEAP8.byteLength` (internal, `pyodide._module`) [U for stability]. If it's over a cap (say 512 MB), throw the worker away and use the spare. A mid-run watchdog would need the heap size reported out of the worker's thread.

## 2. JavaScript: QuickJS
### Packages
- **`quickjs-emscripten` 0.32.0** (2026-02-16), **MIT** (wrapper © Jake Teton-Landis; QuickJS itself is MIT). [V] https://www.npmjs.com/package/quickjs-emscripten · https://github.com/justjake/quickjs-emscripten/blob/main/LICENSE
- Split packages: `quickjs-emscripten-core` (API, 795 KB unpacked) + one **variant** package. [V] npm.
  - `@jitl/quickjs-wasmfile-release-sync`: Bellard's QuickJS 2025-09-13, a 503 KB `.wasm`. [V] (package README)
  - `@jitl/quickjs-ng-wasmfile-release-sync`: **quickjs-ng v0.12.1**. [V] (package README)
  - Upstream quickjs-ng is at **v0.17.0** (2026-09-18), so the wrapper lags by five releases. [V] https://github.com/quickjs-ng/quickjs/releases
- The repo was last pushed 2026-07-23 with no npm release since February. Maintained, but slowly. [V] GitHub API.
- No other wrapper with a stable API is published on npm under the name `quickjs-ng`. [V] npm returned none.

### API (all tested)
- **Eval:** `QuickJS.newRuntime()` → `rt.newContext()` → `vm.evalCode(code)` returns `{ value }` or `{ error }`. Every handle must be `.dispose()`d. [V] https://github.com/justjake/quickjs-emscripten#readme
- **Timeout:** `rt.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + ms))`. `while(true){}` threw `InternalError: interrupted` at 301 ms, and the context still worked. Unlike Pyodide, this needs **no `SharedArrayBuffer`**: the check runs inside the interpreter loop.
- **Memory:** `rt.setMemoryLimit(64 * 1024 * 1024)`. Runaway allocation threw `InternalError: out of memory` inside the guest.
- **Stack:** `rt.setMaxStackSize(...)`. **With 1 MB, infinite recursion overflowed the host's stack first** (a host `RangeError` that killed the module). 256 KB gave a clean guest error (`InternalError: stack overflow` in Bellard's QuickJS, `RangeError` in quickjs-ng). Treat any host exception as fatal and recycle.
- **Console capture:** there is no `console` by default. Add one with `vm.newFunction('log', ...)` and `vm.setProp`. The guest also has no `fetch`, `require`, `process` or `setTimeout`. Tested.
- **Language level:** `Map`, spread, `.at()`, `BigInt` and `Object.groupBy` all worked in both variants. Tested.
- **Speed:** `fib(27)` took 19 ms (Bellard) / 25 ms (ng) vs 2 ms in V8. Tested. An interpreter with no JIT will be roughly 10–50× slower than Node on hot loops [S]. That's fine for correctness tests, but it will make "optimize" tiers time out earlier than in a real interview.
- Load: `getQuickJS()` took 5–9 ms. Tested.

### TypeScript
- **TypeScript 7.0.2 (latest) is the Go-native compiler.** Its npm package exposes only `./unstable/*` APIs that drive per-platform native binaries (20 `optionalDependencies`). It has no in-process `transpileModule`. [V] (package.json inspected). Not usable in a worker.
- **TypeScript 6.0.3** still has `transpileModule`, but it's 24 MB unpacked. [V] npm. Too heavy just to strip types.
- **sucrase 3.35.1** (MIT, 1.1 MB unpacked, last release 2025-11-19). Tested: handles `interface`, `enum`, generics and constructor parameter properties. 8 ms on first call, then **0.31 ms per call**. [V] https://github.com/alangpierce/sucrase
- **amaro 1.3.0** (MIT, Node's own type stripper, SWC in WASM, 6 MB). `strip-only` mode rejects `enum`; `transform` mode works. Tested. Bigger, and needs WASM init.
- `ts-blank-space` (54 KB) depends on the `typescript` package (5.1–6.0) for parsing [V], so it's not actually small.
- esbuild-wasm is 14.5 MB [V]. Overkill.
- **Plan:** sucrase with `transforms: ['typescript'], disableESTransforms: true`, run before QuickJS. **No type checking** (CoderPad doesn't type-check either [U]). Line numbers are preserved [S] (sucrase README).

## 3. Test harness design
### How others structure it
- **Exercism** [V] https://exercism.org/docs/building/tooling/test-runners/interface:
  - The runner writes `results.json`: top-level `status` `pass | fail | error` (error = nothing ran, e.g. a syntax error).
  - Then `tests[]` with `name`, `status`, `message`, `output` (the user's prints, **capped at 500 characters**) and `test_code`.
  - Limits: 20 s, 3 GB.
- **futurecoder** (MIT, an in-browser Python course) [V] https://github.com/alexmojaki/futurecoder/blob/master/frontend/src/Worker.js:
  - Pyodide runs in a worker behind Comlink, using the `pyodide-worker-runner` library.
  - **A `PyodideFatalErrorReloader` reloads Pyodide after a fatal error.** This is the same "recycle the worker" idea.
- **LeetCode-style:** typed function signatures per language (`def twoSum(self, nums: List[int], target: int) -> List[int]` in a `class Solution`), with the platform generating the driver code. [S] widely documented; we can't cite their text and shouldn't.
- **ajadreddy/ai-mock-interviewer** (MIT): hidden tests via Judge0, Python only. [S] from 04-building-blocks.md, not re-read.

### Proposed contract (extends to Java/C++/Go)
- **Function-call style, typed signature, JSON values.** Typed, because Java/C++/Go need types to generate driver code and parse arguments. Python/JS ignore the types except to convert special types like `ListNode`/`TreeNode`.
- Possible `tests/cases.yaml` (BLUEPRINT §5.4):
  ```yaml
  entry: { py: two_sum, js: twoSum, java: twoSum, cpp: twoSum, go: TwoSum }
  params: [{ name: nums, type: "int[]" }, { name: target, type: int }]
  returns: "int[]"
  compare: unordered        # exact | unordered | float(1e-6) | set-of-lists | ...
  cases:
    - { name: "Example 1", args: [[3, 9, 14, 2], 11], expected: [1, 3], visible: true }
    - { name: "Large input", args: { generate: large_random, seed: 7 }, expected_from: reference, visible: false }
  ```
  - A small type vocabulary: `int, long, float, bool, string, T[], T[][], ListNode, TreeNode`.
  - `long` exists because JS numbers lose precision above 2^53, so it maps to BigInt or a string.
  - `two-sum.md` says "in any order", which is why `compare` exists.
- **Where things run:**
  - The guest (worker) receives **only the code, the entry name and the argument JSON**.
  - It returns `{ value: <json>, stdout, ms }` or `{ error: {type, message, line} }` per case.
  - **Comparing to `expected` happens in the host, in TypeScript, in `packages/core`.** One comparator for every language. Hidden expected values never enter the guest: Python's `import js` can read anything in the worker's globals.
- **Per case:**
  - A fresh namespace (Python `exec` into a new dict; a fresh QuickJS context). Deep-copied args, so mutations don't leak between cases.
  - Time measured inside the worker with `performance.now()` around the call only.
  - stdout captured per case, capped (Exercism's 500 characters per test is a good default; plus a total cap of ~64 KB per run).
- **Statuses:** `pass | fail | error | timeout | killed` per case. Top-level `error` means compile or syntax failure, so no case ran. These map to `RunResult` signals for the Floor Manager and go into `events.jsonl`.
- **Runtime numbers:** WASM time isn't real-world time. Show milliseconds, but judge complexity by **how time grows across input-size tiers**, not by absolute thresholds [U — design proposal].
- **Accept `class Solution`?** In Python, if the code defines `class Solution`, call `Solution().<entry>`. This matches what candidates practise [U — product call].

## 4. Security
- **Threat model:** the user runs their own code, so the main risk is mistakes (infinite loops, memory blowups), not attacks. But problems and starters come from community content, and LLM-written code may be pasted in. So treat guest code as untrusted [U — judgement].
- **WASM in a Web Worker in a sandboxed renderer is enough isolation for v0.1**, if three things hold:
  1. **No Node in that context.** The worker is in a `sandbox: true` renderer (current `main/index.ts` already sets `sandbox: true, contextIsolation: true` [V]). Never enable `nodeIntegrationInWorker`. No utility process for Pyodide (§1).
  2. **CSP sent as an HTTP header on the worker's script**, not only as a meta tag. Tested: with the CSP header on `app://`, `fetch('https://example.com')` was blocked and Python's `urllib` failed with `Socket not connected`. Under `file://`, `fetch` was allowed and Python reached example.com over a WebSocket.
     - Suggested worker CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self'`. Tested.
     - Per CSP3, a worker gets its own policy from its response headers [S] https://www.w3.org/TR/CSP3/#initialize-global-object-csp
  3. **Fail closed on the network at the session level too:** `session.webRequest.onBeforeRequest` cancels anything that isn't `app://` (or the Vite dev origin in development). [S] https://www.electronjs.org/docs/latest/api/web-request
- **What not to expose in the worker:**
  - No `MessagePort` to the main process.
  - No preload bridge (workers don't get one anyway [S]).
  - No hidden test answers, no API keys, no file paths.
  - Messages from the worker are untrusted input: validate their shape and cap their size.
- **Recommended: a separate hidden runner window**, `sandbox: true`, loaded from `app://runner/`, with its own COOP/COEP/CSP.
  - Isn't this overkill vs a worker inside the main UI renderer? The point is crash isolation: a 4 GB Pyodide heap or an out-of-memory crash takes down the renderer process that owns it.
  - A separate window gets its own renderer process [S].
  - It also keeps COEP `require-corp` off the main UI, where it could break loading Excalidraw fonts or images later [U].
- **COEP side effects:** with `require-corp`, every subresource must be same-origin or send CORP headers. Everything is served from `app://`, so that's fine [V] (web.dev cross-origin isolation guide https://web.dev/articles/cross-origin-isolation-guide).
- **Electron hardening that already applies:** disable the `runAsNode` fuse (04-building-blocks.md).

## 5. How LearnHarness and others run code
- **LearnHarness does not run user code.** Searched at commit `dc4c398` (2026-10-29): no Pyodide, QuickJS, Judge0 or vm. [V]
  - It runs **model-generated HTML demos in an `<iframe sandbox="allow-scripts">` with `srcDoc` and no `allow-same-origin`**, so the demo gets an opaque origin. A bridge script posts resize messages, and the parent checks `event.source`. [V] `components/artifacts/demo-card.tsx` (lines 15–20, 159–217)
  - It also uses headless puppeteer to verify demos, launched with `--no-sandbox`. [V] `src/agent/subagents/headless.ts:266`
  - Its window uses `contextIsolation: true, sandbox: true, nodeIntegration: false`. [V] `electron/main.cjs:315–318`
  - Lesson: they keep generated code out of Node entirely. We should do the same.
- **futurecoder:** Pyodide in a worker, Comlink, reload after fatal errors (§3). [V]
- **JupyterLite / Pyodide console** use the same worker + interrupt-buffer pattern [S] https://pyodide.org/en/stable/usage/keyboard-interrupts.html

## 6. Cross-platform (macOS, Linux, Windows)
- **WASM assets are the same everywhere.** Neither package contains native binaries. That covers macOS arm64/x64, Windows x64/arm64 and Linux x64/arm64. [V] (tarballs inspected)
  - Avoid TypeScript 7 at runtime: it needs a per-platform native binary [V].
- **`SharedArrayBuffer` via COOP/COEP** is Chromium behaviour, not OS-specific. Tested on Linux only; macOS/Windows [S] https://web.dev/articles/cross-origin-isolation-guide. Add an end-to-end check (`crossOriginIsolated === true` in the runner) to Playwright CI on all three OSes.
- **`file://` vs `app://`:** use `app://` everywhere. It's needed for COOP/COEP and the worker CSP (§1, §4).
  - In the handler, turn paths into URLs with `pathToFileURL` (handles Windows drive letters and backslashes). [V] Electron protocol docs example
  - Reject `..` after normalising the path, so the handler can't serve files outside the app folder [U — standard practice].
  - Set `Content-Type: application/wasm` and `text/javascript` explicitly. Tested.
- **Packaging** (no packager chosen yet; electron-builder vs Forge is open):
  - asar is read-only. Files inside it can be read with `fs` and `file:` URLs. Only `execFile`/`dlopen` need unpacking [V] https://www.electronjs.org/docs/latest/tutorial/asar-archives.
  - WASM loaded through `net.fetch(file URL)` from inside asar *should* work [U — not tested]. The safe option is to ship `pyodide/` and the QuickJS `.wasm` via `extraResources` (electron-builder) / `extraResource` (Forge), outside asar, and resolve them with `process.resourcesPath` [S].
- **macOS signing:** a hardened-runtime build of Electron needs the JIT entitlement (`com.apple.security.cs.allow-jit`), which V8 and WASM use. It's part of every Electron app's standard entitlements, so nothing extra for the runner [S] https://www.electronjs.org/docs/latest/tutorial/code-signing.
- **Workers and utility processes** behave the same on all three OSes [S]. `UtilityProcess.kill()` sends SIGTERM on POSIX; Windows exit codes come from `GetExitCodeProcess` [V] utility-process docs. With a hidden-window runner, we kill it with `webContents.forcefullyCrashRenderer()` or by destroying the window [S].
- **Linux:** Electron's own renderer sandbox needs unprivileged user namespaces or the SUID `chrome-sandbox`. Ubuntu 24.04 restricts user namespaces through AppArmor, so packages need an AppArmor profile [S] https://documentation.ubuntu.com/release-notes/24.04/. The packager deals with this; we must not ship `--no-sandbox`.
- **Later, native toolchains (Java/C++/Go), one line per OS:**
  - **Linux:** bubblewrap hits the same Ubuntu 24.04+ user-namespace restriction (needs the `bwrap-userns-restrict` AppArmor profile; ships by default from 25.04) [S] https://github.com/microsoft/vscode/issues/316046. Landlock (kernel ≥ 5.13) can restrict the filesystem without namespaces, as a fallback [S]. Add seccomp, rlimits and no network.
  - **macOS:** `sandbox-exec` with a Seatbelt profile (deprecated, still works) [S]. Find toolchains through `xcrun` / Homebrew paths. Apple Silicon and x64 are both fine.
  - **Windows:** Job Objects (CPU time, memory, kill-on-close) + AppContainer or a restricted token for files and network [S]. There's no turnkey wrapper, so it's the most work. D9 already says Windows starts with WASM languages only.
  - All of them: fail closed if the sandbox is missing, and detect toolchains (`javac`, `g++`/`clang++`, `go`) per OS, including arm64 Windows, where toolchains are rarer [U].

## Recommendations for v0.1
1. **One runner per hidden window:** a `BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })` loading `app://runner/index.html`.
   - It hosts **two module workers**: Python (Pyodide 314.0.7) and JS/TS (quickjs-emscripten 0.32.0, Bellard variant; switch to quickjs-ng when the wrapper catches up).
   - Keep one warm spare of each.
   - Update BLUEPRINT §5.1: the "runner utility process" is for native toolchains later, not for WASM.
2. **`app://` protocol** registered as `standard + secure + supportFetchAPI`. Every runner response carries `COOP: same-origin`, `COEP: require-corp` and the CSP from §4. Also block every non-`app://` request for that window's session.
3. **Timeouts:**
   - Python: interrupt buffer at the deadline (default 5 s per run [U — product call]), then `worker.terminate()` 1 s later if it didn't stop.
   - JS: `shouldInterruptAfterDeadline`, with `terminate()` as the backstop.
   - Report `timeout` vs `killed`.
4. **Memory:**
   - QuickJS: `setMemoryLimit(256 MB)`, `setMaxStackSize(256 KB)`.
   - Pyodide: check the heap after each run and recycle above 512 MB.
   - Any host-level exception → recycle the worker.
5. **TS:** sucrase strips types in the JS worker. No type checking in v0.1.
6. **Harness:**
   - The typed `cases.yaml` contract from §3; the guest only sees arguments.
   - Comparison in `packages/core` (pure, unit-testable with no WASM).
   - Exercism-like result JSON. Per-case stdout capped at 500 chars.
   - `setStdin({ error: true })`.
7. **Vite:** `optimizeDeps.exclude: ['pyodide']`, copy Pyodide's files and the QuickJS `.wasm` as static assets. In dev, set the same three headers through Vite's `server.headers`.
8. **Packaging:** ship WASM assets via `extraResources`, outside asar.
9. **Tests:**
   - Unit tests for the comparator and the YAML loader (no WASM).
   - One Playwright test that runs `while True` and `sum(range(10**10))` and expects `timeout`/`killed`.
   - Run CI on macOS, Windows and Linux.
10. **Log** each run (`RunResult`: per-case statuses, ms, timeout or kill) to `events.jsonl` (AGENTS.md rule).

## Open questions for the owner
- **JS engine:** QuickJS (the decision in D9: tight limits, 10–50× slower) or a plain V8 module worker with CSP + `terminate()` (real speed, matches what candidates see in CoderPad, but a timeout is always a kill and there's no memory cap)? This affects how "optimize" tiers feel.
- **Default limits:** per-run timeout (5 s?), memory caps (256 MB JS / 512 MB Python?), output cap?
- **Signature style:** plain functions (`def two_sum(nums, target)`) or LeetCode's `class Solution`, or accept both?
- **Hidden-window runner vs a worker in the main window:** OK to spend a second renderer process (~tens of MB) for crash isolation?
- **Packager:** electron-builder or Electron Forge? It decides where WASM assets live and how the Linux AppArmor profile gets installed.
- **Should Python offer `numpy`?** It means bundling wheels (several MB) and real interviews rarely allow it. Suggest no.
