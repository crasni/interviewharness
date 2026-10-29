# Research: what to buy or reserve

_Researched 2026-10-29. Prices come from comparison sites; confirm at checkout._

## Availability check (2026-10-29)
| Name | Status | How checked |
|---|---|---|
| `interviewharness.dev` | **available** | RDAP 404 |
| `interviewharness.app` | **available** | RDAP 404 |
| `interviewharness.org` | **available** | RDAP 404 |
| `interviewharness.ai`, `.io`, `.sh`, `.co`, `.so` | likely available | RDAP 404 + no NS records (RDAP coverage for these country-code TLDs can be patchy) |
| `interviewharness.com` | **taken**: registered 2026-09-02, expires 2027-09-02 | RDAP |
| npm `interviewharness`, `interview-harness` | **free** | registry 404 |
| GitHub user/org `interviewharness` | **free** | API 404 |

## Domains
| TLD | First year | Renewal | Verdict |
|---|---|---|---|
| **.dev** | ~$8–12 | **~$12** (Cloudflare, at cost) | ✅ **Buy.** Developer tool; HTTPS enforced by the registry |
| .app | ~$8–14 | ~$14 | Optional defensive buy |
| .ai | ~$70–75 | ~$70–100 | ❌ Skip. Expensive, and "AI" isn't our brand |
| .io | ~$28–50 | ~$46–63 | ❌ Skip |
| .com | taken | — | ❌ Don't chase it; it was registered a few weeks ago (possibly squatted on the "-harness" trend) |

**Registrar:** Cloudflare Registrar or Porkbun. Both charge the same to register and to renew, with no year-one bait. Namecheap and GoDaddy discount the first year and raise the renewal.

## Free: reserve now
- GitHub org `interviewharness` (repo `interviewharness/interviewharness`)
- npm: create the free org/scope `@interviewharness`. Optionally publish a placeholder `interviewharness` package, since npm has no reservation without publishing.
- Social handles if wanted (X, Bluesky, Discord server)

## Code signing (needed at release, not now)
| Platform | Option | Cost | Notes |
|---|---|---|---|
| macOS | **Apple Developer Program** | **$99/yr** | Needed for Developer ID + notarization. Since macOS Sequoia, unnotarized apps can no longer be opened with the Control-click shortcut, which hurts first impressions. No fee waiver for individuals. Notarization itself is free |
| Windows | **SignPath Foundation (OSS)** | **free** | For open-source projects (OSI license, public repo). Publisher shown is "SignPath Foundation". Requires MFA, origin verification (signed builds traced to the repo, e.g. via GitHub Actions) and a credit line in the README |
| Windows | Azure Artifact Signing | $9.99/mo | **Individuals: US/Canada only**, so likely not available to us. Organizations get broader access |
| Windows | Traditional OV certificate | ~$99+/yr | Fallback; SmartScreen reputation still builds slowly |
| Linux | — | free | AppImage/.deb/.rpm don't need signing (optionally a GPG-signed apt repo later) |

## Running costs during development
- Local models (Ollama) and local STT/TTS: $0.
- Cloud API credits for testing (OpenAI/Anthropic/Deepgram): a few $/month. Deepgram and others give trial credits.

## Don't buy
- A trademark (expensive and unnecessary at this stage)
- .ai / .io / the taken .com
- Paid certificates before there's a release

## Budget
- **Now:** ~$12 (.dev), or ~$26 with .app as well
- **At the first signed release:** +$99/yr (Apple); Windows free through SignPath

Sources: [tldprice.org renewals](https://tldprice.org/domain-renewal-price-comparison) · [namebuddy registrar prices](https://namebuddy.ai/guides/best-domain-registrars-2026) · [register.domains .io guide](https://register.domains/en/blog/io-domain-guide-2025) · [domainee: domain cost](https://domainee.dev/blog/how-much-does-a-domain-cost) · [tldspy](https://tldspy.com/) · [Apple: distribution](https://developer.apple.com/documentation/technologyoverviews/distribution.md) · [Apple forum: notarization fee](https://developer.apple.com/forums/thread/746992) · [flaviocopes: free vs paid](https://flaviocopes.com/apple-developer-free-vs-paid/) · [MS code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) · [Artifact Signing pricing (my-ssl)](https://my-ssl.com/learn/azure-trusted-signing-vs-code-signing-certificate) · [Trusted Signing for individuals](https://learn.microsoft.com/en-us/answers/questions/2113965/trusted-signing-for-individual) · [SignPath Foundation terms](https://signpath.org/terms) · [SignPath OSS](https://about.signpath.io/product/open-source)
