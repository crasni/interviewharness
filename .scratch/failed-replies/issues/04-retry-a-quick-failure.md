# 04: Try a reply again after a quick failure?

Spec: `.scratch/failed-replies/spec.md`

Status: needs-info

**The question for the owner:** `.scratch/slow-model/spec.md` put "resending the turn automatically" out of scope (2026-11-01). The two `other` failures took about 3 s, which suggests a passing glitch. Should a reply that fails quickly (not `auth`, not a timeout) be tried once more, within the same one-minute limit, before the notice shows? Cost: one more model call on a failure; a real outage shows its notice a few seconds later. Wait for 01's reasons from a few more runs before deciding?

## Comments
- 2026-11-02 (owner): wait for reasons. Decide once a fake-candidate run logs why the quick `other` failures happen (01's `reason`).
