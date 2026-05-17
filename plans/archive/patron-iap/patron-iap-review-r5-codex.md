Prior R4 concerns: Z1-Z5 are addressed. Z6/Z7 are now explicitly accepted product risks, so I would not keep repeating them as blockers for v0.3.60.

[MAJOR] new-concern-introduced: confirmed existing patrons may not close sticky ads on boot.  
(1) In `processRestoreResult`, the `platformPatron && ctx.localPatron` path is a no-op. `markPatronConfirmed()` is only called from `activatePatron()`, which only runs when platform is true and local is false.  
(2) Existing patrons with saved local entitlement may never call `sdk.closeSticky()` in the current session, so the “ad-free removes all 4 ad types” guarantee can fail if sticky was initialized/shown before restore resolution.  
(3) In the `platformPatron && ctx.localPatron` branch, call `this.ads.markPatronConfirmed()` and add a boot test for local true + platform true closes sticky.

[MAJOR] prior-concern-not-closed: optimistic localStorage hint can still suppress ads indefinitely on SDK error/hang.  
(1) R5 avoids irreversible `closeSticky()`, but `setPatronOptimistic()` still sets `patronCached = true`. If `getPurchases()` returns `error`/`unauthorized`/`unavailable` or never resolves, `processRestoreResult()` does not clear the optimistic cache.  
(2) A manipulated `PATRON_LOCAL_KEY=true` can make all ad gates return patron for the whole session, and potentially every boot where restore fails. This is still more than a short optimistic delay.  
(3) Make optimistic suppression time-bounded: clear it after `RESTORE_BOOT_TIMEOUT_MS` unless platform confirms patron. Alternatively clear on all non-ok restore results when local save is not patron, while still preserving real `localPatron` no-revoke behavior.

[MINOR] new-concern-introduced: “nothing to restore” is reported as generic error.  
(1) Manual restore with `platformPatron=false` and `localPatron=false` returns `{ ok:false, reason:"error" }`.  
(2) A normal user action, pressing restore without owning the purchase, shows failure/error copy and pollutes analytics as an SDK error.  
(3) Add a distinct `not_found`/`empty` reason and user copy like “Покупка не найдена”.

CONCERNS REMAIN