[MAJOR] prior-concern-not-closed: refund/revocation remains observability-only.  
What’s wrong: confirmed platform NOT-patron still leaves local/cloud patron entitlement active.  
Why it matters: false-positive local/cloud state can keep ad-free forever.  
Suggested fix: if v0.3.60 intentionally defers this, mark it as accepted product risk; otherwise add a disputed/revoked entitlement state on confirmed non-patron, while still ignoring timeout/error.

[MAJOR] prior-concern-not-closed: bonus semantics still do not match “once-per-account”.  
What’s wrong: plan changes semantics to “once per save state” without actually changing the stated product requirement.  
Why it matters: cross-device/account-level duplication or inconsistency remains possible.  
Suggested fix: either get explicit product sign-off and rename requirement everywhere, or add platform/account-level processed marker plus merge tests.

[MAJOR] new-concern-introduced: manual restore return type likely does not compile.  
What’s wrong: `PurchasesResult extends { ok: false; reason: infer R } ? R : never` over a concrete union likely resolves to `never`.  
Why it matters: `reason: result.reason` becomes a TS type error.  
Suggested fix: define `type PurchaseFailureReason = Extract<PurchasesResult, { ok: false }>["reason"];`.

[MAJOR] new-concern-introduced: optimistic localStorage hint still closes sticky ads irreversibly.  
What’s wrong: `restoreOnBoot()` calls `ads.markPatron()`, and `markPatron()` calls `closeSticky()`. Later `unmarkPatron()` only resets cache; it cannot re-open a sticky banner already closed.  
Why it matters: a manipulated hint can suppress at least sticky ads for the session, despite SDK disproving entitlement.  
Suggested fix: split optimistic ad delay from confirmed patron activation. Do not call `closeSticky()` until SDK confirms patron, or add a reversible sticky restore path.

[MINOR] prior-concern-not-closed: manual restore still hides local-vs-platform mismatch from the user.  
What’s wrong: local-true/platform-false returns `alreadyActive`, so Settings shows “Вы уже поддержали проект”.  
Why it matters: support/debug restore flow cannot distinguish real platform ownership from stale local state.  
Suggested fix: return a distinct `localOnly`/`disputed` note and show neutral copy while preserving no-revoke behavior.

[MINOR] new-concern-introduced: login retry is recursive, not actually “retry once”.  
What’s wrong: `return this.handleRestoreClick()` can repeat indefinitely if the user keeps confirming but auth remains unauthorized.  
Why it matters: bad UX and brittle tests around cancel/error/no-op platforms.  
Suggested fix: make retry explicit: `restore -> login -> restore once`, then show final unauthorized/error state.

[MINOR] new-concern-introduced: `processRestoreResult()` fires async activation without awaiting/catching it.  
What’s wrong: `this.activatePatron("restore")` is not awaited.  
Why it matters: analytics can report restore found before persistence completes, and unexpected activation errors become unhandled.  
Suggested fix: make `processRestoreResult` async and chain/catch it in `pendingLateRestore`.

CONCERNS REMAIN