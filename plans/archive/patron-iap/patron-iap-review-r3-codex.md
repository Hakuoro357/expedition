[MAJOR] prior-concern-not-closed: refund/revocation is still “log only”.  
Why it matters: confirmed platform absence still leaves ad-free active forever from local/cloud false-positive state.  
Suggested fix: on confirmed non-patron result, mark entitlement disputed or revoke locally; do not revoke on timeout/error.

[MAJOR] prior-concern-not-closed: boot restore timeout drops late success.  
Why it matters: `Promise.race` returns after 1.5s, but the late `getPurchases()` result is not processed, so a fresh-device patron on slow SDK can still see ads.  
Suggested fix: attach `fetchPromise.then(processRestoreResult)` after timeout, or keep ads suppressed while entitlement is unknown.

[MAJOR] new-concern-introduced: standalone `localStorage.isPatron` is trusted too much.  
Why it matters: any user can set it and get session ad-free; if platform later says false and `localPatron` is false, current code does not undo `ads.markPatron()`.  
Suggested fix: use localStorage only as an ad-delay hint, not entitlement; on confirmed false, clear hint and undo optimistic ad gate.

[MAJOR] prior-concern-not-closed: Yandex login flow is still underspecified.  
Why it matters: `triggerLogin()` exists, but `restorePatronManual()` does not invoke it, and Settings handler/state machine is not defined. Cross-device restore can still dead-end.  
Suggested fix: specify unauthorized UI flow: show login CTA, call `sdk.triggerLogin()`, then retry restore and handle cancel/error distinctly.

[MAJOR] prior-concern-not-closed: “once-per-account” bonus is not actually guaranteed.  
Why it matters: R3 documents weaker “once per save-state” semantics, but the domain requirement still says once-per-account.  
Suggested fix: either change product wording everywhere, or store a platform/account-level processed marker with merge tests.

[MAJOR] new-concern-introduced: production URL override can bypass platform adapter.  
Why it matters: `?platform=dev` in a production build may disable SDK-backed ads/payments/cloud behavior.  
Suggested fix: allow URL override only in dev/staging builds, or behind a private debug flag.

[MAJOR] new-concern-introduced: build scripts are POSIX-only.  
Why it matters: `"PLATFORM=gamepush npm run build"` fails in Windows PowerShell.  
Suggested fix: use `cross-env PLATFORM=gamepush`, Vite modes, or separate `.env` mode files.

[MINOR] new-concern-introduced: manual restore returns `alreadyActive` without verifying platform.  
Why it matters: a user trying to fix/verify purchase state cannot surface a local-vs-platform mismatch.  
Suggested fix: manual restore should always be able to run platform verification, while still not revoking on transient errors.

[MINOR] new-concern-introduced: `triggerLogin?` / `closeSticky?` are optional despite being called “full contract”.  
Why it matters: adapters can silently omit behavior and tests may miss it.  
Suggested fix: make both required with no-op implementations in unsupported adapters.

Docs checked: Yandex IAP confirms login recommendation, `getPurchases()`, permanent purchases, and games-partners email; GamePush typed docs confirm `products`, `purchases`, `fetchProducts()`, and `has()`.

CONCERNS REMAIN