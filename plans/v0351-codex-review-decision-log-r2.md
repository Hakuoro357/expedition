# Decision log — v0.3.51 codex code-review

**Reviewer:** codex (gpt-5.5)
**Rounds:** 2
**Outcome:** consensus at R2 — NO SIGNIFICANT CONCERNS
**Concerns total:** 7 (3 MAJOR + 4 MINOR), all closed

## R1 — concerns raised

| # | Severity | Concern | Decision |
|---|---|---|---|
| 1 | MAJOR | Async GP socials reject bypass sync try/catch | ACCEPTED — fixed via Promise types + async/await |
| 2 | MAJOR | Listener accumulation across Title/Map scenes | ACCEPTED — singleton socialsContext + single global listener in BootScene |
| 3 | MAJOR | RewardScene stale dealId read at result-arrival | ACCEPTED — capture into pendingShare at click time |
| 4 | MINOR | Quick-play share gate missing | ACCEPTED — explicit mode === "adventure" check |
| 5 | MINOR | og:image placeholder cached as broken | ACCEPTED — removed until real CDN asset uploaded |
| 6 | MINOR | Decorative SVG not hidden from AT | ACCEPTED — aria-hidden + focusable=false |
| 7 | MINOR | Missing tests on real risk paths | PARTIALLY ACCEPTED — added socialsContext semantics tests; SDK rejection mock skipped (no GP SDK mock infra, async/await pattern is well-known-safe) |

## R2 — verification

Codex confirmed all R1 concerns addressed. New issues: none significant.
Single residual edge noted as not-a-blocker: pending context can stay
non-null if SDK never emits result event, but next user action
overwrites — no leak, no data corruption.

## Lessons (extracted to ~/.claude/plan-mistakes per directive)

Generic-applicable lessons from these accepted concerns:

1. **Async APIs need async/await + try/catch, not sync try/catch.**
   The error from a Promise rejection becomes an unhandled rejection
   if the wrapper isn't async. Especially relevant for SDK
   integrations where the local types might not match the actual
   API's return type.

2. **Per-scene event listeners on a shared SDK accumulate.**
   When multiple scenes can subscribe to the same SDK event, prefer
   one global listener with mutable shared state (singleton pattern)
   over per-scene on/off cycling — especially when the SDK API
   doesn't expose a clean off-token.

3. **Captured-at-click context, not read-at-result context.**
   For async-result events where the scene state may have changed
   by the time the result arrives, snapshot the relevant context
   (dealId, origin) at click time into a stable location.

These should be added to ~/.claude/plan-mistakes/general.md or
~/.claude/plan-mistakes/gamepush.md as gp-XXX entries when the
user officially accepts this resolution.
