# 04: Sign in to OpenRouter

Spec: `.scratch/connections/spec.md` · ADR 0021

**What to build:** OpenRouter offers "Sign in" (its official PKCE flow, which pi-ai implements) next to pasting a key. It opens the browser, comes back by itself to a loopback listener, and saves the key OpenRouter issues in the credential store. As with ChatGPT, only OpenRouter's own sign-in page may be opened.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Sign in completes through the browser and returns by itself; cancelling saves nothing
- [ ] Tested against a fake OpenRouter on loopback
- [ ] Signed in, the row says so and offers Sign out
