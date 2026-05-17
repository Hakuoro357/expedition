[MAJOR] prior-concern-not-closed: `restoreOnBoot()` still skips local entitlement when payments are unavailable.  
(1) The first line is `if (!this.canUsePayments()) return;`, before reading `save.progress.patronSupport`. A local patron on a platform/session where payments SDK is unavailable never reaches `confirmPatronEntitlement()`.  
(2) This leaves the same ad-free guarantee hole for the “unavailable” case from the prior review. Local entitlement is accepted as authoritative in v0.3.60, so ads must be confirmed even if restore cannot run.  
(3) Read `localPatron` before `canUsePayments()`. If `localPatron === true`, call `confirmPatronEntitlement("preserved")` before returning from the unavailable-payments path.

[MAJOR] new-concern-introduced: timeout consumes the restore result and makes late successful SDK restores impossible.  
(1) `processOnce({ ok:false, reason:"timeout" })` sets `processed = true`; any SDK response after `RESTORE_BOOT_TIMEOUT_MS` is ignored, including `{ ok:true, purchases:[patron] }`. The new test explicitly locks this in: “late resolve becomes no-op”.  
(2) A merely slow SDK now fails to restore a valid platform patron on boot. That can skip ad-free, bonus, achievement, and archive activation until manual restore/reload. A 1.5s ceiling is especially risky on mobile/webview SDK startup.  
(3) Split “timeout clears optimistic ad suppression” from “SDK result processed”. Timeout may clear unverified `localHint`, but should not permanently consume the SDK result. Allow late positive platform results to call `activatePatron("restore")`; ignore only duplicate definitive SDK results.

[MAJOR] new-concern-introduced: manual restore can still hang forever and keep `inFlight = true`.  
(1) `restorePatronManual()` awaits `this.sdk.getPurchases()` directly. If the SDK promise never resolves, `finally` never runs.  
(2) The Settings restore UI can stay stuck, and future purchase/restore attempts are blocked by `inFlight` until page reload.  
(3) Wrap manual `getPurchases()` with the same timeout policy, returning `{ ok:false, alreadyActive: localPatron, reason:"timeout" }`; if `localPatron`, still call `confirmPatronEntitlement("preserved")`.

[MINOR] new-concern-introduced: `confirmPatronEntitlement()` is described as ad+achievement centralization, but preserved patron branches do not reconcile achievements.  
(1) For `localPatron === true` paths, the helper only confirms ads. If a prior crash/migration left `patronSupport=true` but the patron achievement/archive unlock missing, boot/manual restore will not repair it.  
(2) Rare, but it weakens the “single source of truth” promise and can leave paid users missing promised non-ad rewards.  
(3) Make the helper idempotently reconcile patron-derived unlocks for every confirmed patron path, or rename/scope it strictly to ad confirmation and document where reward reconciliation is guaranteed.

## Alternative approaches

Use two separate flows: `confirmLocalEntitlementNow()` for immediate ad-free from save state, and `verifyPlatformEntitlementEventually()` for SDK restore. The timeout should only end optimistic suppression and unblock boot/UI; it should not invalidate a later positive platform result.

CONCERNS REMAIN