I've carefully traced all branches of the R7 code against the prior review. Let me verify closure of the three R6 concerns and check for any new gaps.

## Prior Concerns — Closure Status

| # | R6 Concern | R7 Resolution |
|---|---|---|
| 1 | Existing-patron sticky not closed on all local-only branches | **Closed (R7 V1).** `confirmPatronEntitlement("preserved")` now called in every "remains patron" branch — boot fail+localPatron, boot !platform+localPatron, boot platform+localPatron, manual fail+localPatron, manual !platform+localPatron, manual platform+localPatron, and activatePatron early-return guard. ✓ |
| 2 | SDK-hang allows infinite optimistic suppression | **Closed (R7 V2).** `processOnce` guard + setTimeout fallback guarantees `processRestoreResult` fires exactly once, even if SDK never resolves. ✓ |
| 3 | `not_found` generic error UX | **Closed (R6 W3), carried forward correctly.** Separate toast, clean type. ✓ |

All three R6 concerns are closed. R5 concerns remain closed from R6.

## New Concerns Introduced by R7

**None found.** The three V-changes are correct:

- **V1 (`confirmPatronEntitlement`):** Single-source helper called in all 8 "remains patron" entry points. `origin` type union `"purchase" | "restore" | "preserved"` correctly gates `markPatronJustActivated` to purchase-only. Idempotent. ✓
- **V2 (`processOnce` guard + timeout):** Closure-based guard is safe — JS single-threaded, no concurrent access to `processed` flag. Late SDK resolution correctly becomes no-op. ✓
- **V3 (Alternative D via V1):** `activatePatron` early-return guard uses `confirmPatronEntitlement(origin === "purchase" ? "purchase" : "preserved")` — correct since restore can't hit that guard (localPatron was false). ✓

## Branch Coverage Verification — `processRestoreResult`

| `result.ok` | `platformPatron` | `localPatron` | `localHint` | Action |
|---|---|---|---|---|
| ✓ | ✓ | ✓ | any | `confirmPatronEntitlement("preserved")` — no save mutation ✓ |
| ✓ | ✓ | ✗ | any | `activatePatron("restore")` → confirm + save + reconcile ✓ |
| ✓ | ✗ | ✓ | any | `confirmPatronEntitlement("preserved")` — observability log ✓ |
| ✓ | ✗ | ✗ | ✓ | Clear optimistic + remove localStorage key ✓ |
| ✓ | ✗ | ✗ | ✗ | No-op (legitimate empty) ✓ |
| ✗ (error/timeout) | — | ✓ | any | `confirmPatronEntitlement("preserved")` ✓ |
| ✗ | — | ✗ | ✓ | Clear optimistic + remove hint ✓ |
| ✗ | — | ✗ | ✗ | Analytics only, no-op ✓ |

All 8 branches covered. No unreachable code, no conflicting actions.

## Alternative Approaches

One **MINOR efficiency note** (not a blocker): `restoreOnBoot` always takes `RESTORE_BOOT_TIMEOUT_MS` to return because it `await`s the timeout promise. If the SDK resolves in 100ms, `processOnce` fires at 100ms (correct), but the function doesn't return until 1500ms. If the caller awaits this, boot is delayed unnecessarily. A `Promise.race` pattern would return as soon as either the SDK or timeout resolves. However, this is only a concern if the caller `await`s — if called fire-and-forget (likely for a "restore on boot" pattern), it's irrelevant. Not worth flagging at R7.

---

NO SIGNIFICANT CONCERNS
