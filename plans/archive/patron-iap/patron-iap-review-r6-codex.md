[MAJOR] prior-concern-not-closed: local-entitlement branches still do not confirm ads.  
(1) R6 calls `markPatronConfirmed()` only for `platformPatron && localPatron`. But `!platformPatron && localPatron` and `!result.ok && localPatron` preserve entitlement under the accepted no-revoke policy without notifying `AdsService`.  
(2) A locally entitled patron can still fail to close sticky ads when platform restore says “not found”, errors, or is unavailable. This is the same ad-free guarantee risk, just in the local-only branches.  
(3) Whenever the service decides “user remains patron”, call an idempotent ads confirmation method. Concretely add `this.ads.markPatronConfirmed()` in `!platformPatron && localPatron` for both boot/manual paths, and in non-ok restore when `ctx.localPatron === true`.

[MAJOR] prior-concern-not-closed: hung `getPurchases()` is not explicitly covered by W2.  
(1) The fix clears optimistic suppression on `!result.ok`, but the shown code does not prove that a never-resolving SDK call is converted into a non-ok timeout result. The new test covers SDK error only, not hang/timeout.  
(2) Prior concern included SDK hang. If timeout handling is outside this method and does not call `processRestoreResult()`, a forged local hint can still suppress ads for the session.  
(3) Add an explicit boot `Promise.race`/timeout path that clears optimistic state after `RESTORE_BOOT_TIMEOUT_MS`, and add a test where `sdk.getPurchases()` never resolves.

## Alternative approaches

Centralize entitlement finalization: one private helper like `confirmPatronEntitlement(source)` should update save if needed, set/remove local hint as appropriate, call `ads.markPatronConfirmed()`, unlock achievement, and emit analytics. Then every branch that returns “active patron” goes through the same path.

CONCERNS REMAIN