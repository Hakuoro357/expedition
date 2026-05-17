Looking at R4 against R3's 5 concerns and the new additions.

## Prior Concerns — Closure Status

All 5 R3 concerns are closed:

| # | R3 Concern | R4 Resolution |
|---|---|---|
| 1 | Late-restore timeout discards fetch | `.then()` chain stored in `pendingLateRestore` — processes post-timeout ✓ |
| 2 | Unix env-prefix fails on Windows | `cross-env` devDep added ✓ |
| 3 | Optimistic `markPatron` doesn't set `progress.patronSupport` | Re-framed as Y3: localStorage = ad-delay hint (not entitlement), revert path via `unmarkPatron()` ✓ |
| 4 | `patron_purchase_open` analytics dual-fire ambiguity | Y11: `mountPatronDialog(source)` is single owner ✓ |
| 5 | Achievement toast fires on restore | Y12: gated on `origin === "purchase"`, silent `reconcile()` on restore ✓ |

## New Concerns Introduced by R4

### [MINOR] `handleRestoreClick` recursive retry — comment says "Retry once" but code retries indefinitely

**(1)** The comment reads `// Retry once after login dialog closes (user may have authenticated)` but `return this.handleRestoreClick()` is unbounded recursion. If `triggerLogin` returns without authenticating, the next cycle hits `unauthorized` again, shows the confirm dialog again, and if the user keeps confirming, loops.

**(2)** Why it matters: In practice the confirm dialog is the exit point — users will cancel after 1–2 attempts. But the comment is misleading to future maintainers, and a sleep-deprived user mashing "OK" could cycle 3–4 times before noticing nothing changed.

**(3)** Suggested fix: Either fix the comment to say `// retry` (honest) or add a `retried = false` guard passed as a parameter to cap at one retry, which matches the stated intent.

---

### [MINOR] `unmarkPatron()` reverts ad flag but sticky banner stays hidden

**(1)** `markPatron()` calls `this.sdk.closeSticky()`. When `unmarkPatron()` later reverts `patronCached = undefined`, the ad polling gate re-enables, but the sticky banner has already been dismissed with no "reopen" counterpart. On a scene where the sticky was the only ad surface, the manipulator gets permanent sticky-hiding for that session.

**(2)** Why it matters: The plan accounts for "0–1.5s free ad-free" trade-off for the localStorage manipulator but doesn't mention the sticky staying hidden. In practice sticky re-triggers on scene transitions so impact is limited, but it's a gap in the threat model.

**(3)** Suggested fix: Add one sentence to the Risks table: "Sticky banner does not auto-reappear after `unmarkPatron`; next scene transition re-triggers it normally — net exposure ≤ one scene."

---

No further concerns. The late-restore chain, `processRestoreResult` helper, Yandex login flow, and cross-env additions are all well-specified. The idempotency of `activatePatron` cleanly defuses the race scenarios. The "once per save state" framing with v0.3.61 server-marker TODO is a pragmatic scope boundary.

## Alternative Approaches

None — R4's surgical fixes are proportional to the problems they address. Plan is converging well.

---

NO SIGNIFICANT CONCERNS
