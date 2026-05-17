Source isn't in the working directory — reviewing purely from the plan text and domain knowledge. Here is my full review.

---

## Concerns

### [CRITICAL] GP `payments.purchase()` may be event-listener, not Promise

**(1)** The plan's own risk table acknowledges uncertainty: *"Использовать прямой `gp.payments.purchase` + on('purchase'); проверить в GP-sandbox."* Yet Layer 1 code uses `await gp.payments.purchase({ tag })` as if it returns a Promise. GamePush's `gp.socials.share()` is known to be event-based (no off-token, singleton-listener). If `gp.payments.purchase()` follows the same pattern, the `SdkService.purchase()` contract — `Promise<{ok, reason?}>` — cannot be fulfilled as written. The entire PaymentsService depends on this being awaitable.

**(2) Why it matters:** If it's event-based, `purchase()` will resolve immediately (or never), the `activatePatron()` path will fire at the wrong time (or not at all), and the user gets charged with no patron status set. Money lost, user angry.

**(3) Suggested fix:** Before writing any code, verify in GP sandbox with a minimal test page. If event-based, wrap it: `purchase(tag) { return new Promise((resolve) => { gp.payments.on('purchase', (data) => { if (data.tag === tag) resolve({ok:true}); }); gp.payments.on('error', (e) => resolve({ok:false, reason:'error'})); gp.payments.purchase({tag}); }); }`. The `SdkService` interface stays the same — the wrapping is internal to `GamePushSdkService`. **Also register listeners once in `init()`** (singleton pattern, same as you did for `gp.socials.share`).

---

### [MAJOR] No double-purchase guard — rapid clicks open parallel purchase flows

**(1)** `purchasePatron()` has no `isPurchasing` lock. If the player taps "Поддержать" twice quickly (or taps it, then taps again while the native purchase sheet is loading), two concurrent `sdk.purchase(PATRON_TAG)` calls fire. Depending on SDK behavior, this could: (a) charge twice, (b) crash the native sheet, (c) produce a race where `activatePatron()` runs twice → double +300 coins.

**(2) Why it matters:** Real money + duplicate coin credit.

**(3) Suggested fix:** Add `private purchasing = false` field to `PaymentsService`. Guard at the top of `purchasePatron()`:
```ts
if (this.purchasing) return { ok: false };
this.purchasing = true;
try { /* existing logic */ } finally { this.purchasing = false; }
```
Also disable the "Поддержать" button in the UI while the flow is in progress (add a `.is-loading` class or `disabled` attr).

---

### [MAJOR] Sticky banner remains visible after patron activates mid-session

**(1)** `showStickyBanner()` gates on `isPatron()` for **new** calls, but there's no mechanism to **dismiss** a sticky banner that's already rendered on screen. If the player purchases patron while a sticky banner is visible (e.g., on MapScene), it stays until the next scene transition.

**(2) Why it matters:** The player just paid to remove ads and immediately sees an ad still on screen. Feels broken. Support tickets incoming.

**(3) Suggested fix:** Add a `hideStickyBanner(): void` method to `AdsService` (if not already present) that calls the platform's sticky-banner-dismiss API. Call it from `activatePatron()` after setting the flag. If the platform has no dismiss API, at minimum hide the DOM container via CSS (`display:none`). In the longer term, consider a reactive `onPatronChanged` event that AdsService subscribes to.

---

### [MAJOR] Cross-device coin loss if save sync fails between purchase and device switch

**(1)** The flow: `purchasePatron("purchase")` → `activatePatron("purchase")` → sets `patronSupport=true` and `coins += 300` → `save.flush()`. If the device loses network *after* the purchase SDK call succeeds but *before* `flush()` syncs to cloud, the local save has +300 coins but cloud doesn't. Player opens game on tablet → `save.init()` loads cloud save (no patronSupport, no +300) → `restoreOnBoot` finds patron in `getPurchases()` → `activatePatron("restore")` → sets `patronSupport=true` but **no coins**. Player permanently lost 300 coins.

**(2) Why it matters:** Real money was paid for a benefit that was silently lost. Player has no way to know or recover.

**(3) Suggested fix:** Option A (simple): store a `patronBonusPending: boolean` in ProgressState alongside `patronSupport`. On purchase, set both to true. On `activatePatron`, if `patronBonusPending` is true, credit coins regardless of origin, then set `patronBonusPending = false`. Option B (simpler): on restore, always check if `coins` history is missing the bonus — but this is fragile. Option A is recommended; it adds one field and 3 lines of logic.

---

### [MAJOR] Two toasts fire in rapid succession — visual overlap

**(1)** After a successful purchase: (1) `patronThankYouToast` fires immediately, (2) AchievementsReconciler detects new `patron` unlock on next tick → fires achievement toast. Both toasts appear within ~100ms of each other.

**(2) Why it matters:** Visual clutter. The thank-you toast gets immediately pushed up or obscured by the achievement toast. Neither message is fully read. Feels janky.

**(3) Suggested fix:** Delay the achievement toast by ~2s when the unlock origin is a purchase. Options: (a) in `activatePatron`, set a flag `this.justActivated = true` and have the toast callback check it, delaying if set; (b) call `achievements.reconcile()` manually after a `setTimeout(2000)` instead of relying on next-tick auto-reconcile; (c) have a toast queue that staggers multiple toasts by 2s intervals (more general solution, good for future).

---

### [MAJOR] `purchase()` error-code discrimination for GP/Yandex is unverified

**(1)** The plan maps SDK errors to `cancelled | error` via "GP error code (`'CANCELLED' | 'NOT_FOUND' | 'UNKNOWN'`)" and Yandex rejection mapping. Neither SDK's actual error taxonomy is confirmed. If GP returns a generic Error object with a string message (not a code field), the discrimination logic silently misclassifies everything as `"error"`, and the analytics `reason` field becomes `"unknown"`.

**(2) Why it matters:** Analytics data quality. You can't distinguish "user intentionally cancelled" from "SDK crashed" → can't optimize the purchase funnel.

**(3) Suggested fix:** Add a `// TODO: verify actual GP error shape in sandbox` comment, and in the initial implementation, log the full error object (`console.error('[payments] raw error', err)`) so sandbox testing reveals the actual shape before shipping. For Yandex, check if rejection uses a specific error class or code.

---

### [MAJOR] `restoreOnBoot` delays game start by up to 5 seconds

**(1)** The plan places `await payments.restoreOnBoot()` (with 5s timeout) between `save.init()` and `sdk.signalReady()`. If `getPurchases()` is slow (e.g., degraded network), the player stares at a loading screen for 5 seconds every boot.

**(2) Why it matters:** Boot-time is critical for retention. 5s added latency on every boot for a feature that rarely fires (most players aren't patrons) is a poor tradeoff.

**(3) Suggested fix:** Don't `await` restoreOnBoot synchronously. Instead, fire it as a background task: `payments.restoreOnBoot(); // no await`. The `activatePatron()` call inside will set the flag and flush, and AdsService reads the flag on each call anyway. The only risk is a single ad showing in the ~5s window before restore completes — acceptable tradeoff. Alternatively, use a fast local flag (`localStorage.getItem('patron_restore_needed')`) to decide whether to await: only block boot if the local flag says "maybe patron" but save doesn't have it yet.

---

### [MINOR] "Не показывать снова" button is functionally identical to "Не сейчас"

**(1)** The flag `patronPushShown` is set **before** the dialog opens. Both "Не сейчас" and "Не показывать снова" just close the dialog — neither triggers any additional logic. The labels imply different behaviors.

**(2) Why it matters:** User confusion. "Why are there two buttons that do the same thing?"

**(3) Suggested fix:** Either (a) remove "Не показывать снова" and keep only "Не сейчас" with a note that the push won't repeat, or (b) reframe the second button as "Больше не интересно" (permanent opt-out of all future patron prompts, setting a `patronOptOut` flag) — which is actually different behavior.

---

### [MINOR] `canShowRewarded` condition is correct but unnecessarily complex

**(1)** `canShowRewarded = !sdk.canUsePayments() || !save.load().progress.patronSupport` — the `!canUsePayments()` clause is logically dead: when `patronSupport` is false, the OR short-circuits to true regardless. When `patronSupport` is true, `canUsePayments()` must be true (you can't be a patron without payments). The condition simplifies to just `!save.load().progress.patronSupport`.

**(2) Why it matters:** Readability. Future maintainers will wonder what `canUsePayments` has to do with rewarded ads.

**(3) Suggested fix:** Use `!this.save.load().progress.patronSupport` directly. Add a comment: `// Patron users don't see rewarded ads`.

---

### [MINOR] i18n key count inconsistency: scope says ~14, Layer 11 lists 15

**(1)** Scope section: "~14 ключей × 7 локалей (~98 строк)". Layer 11 lists exactly 15 keys. 15 × 7 = 105.

**(2) Why it matters:** Scope tracking. If someone audits scope compliance, the count doesn't match.

**(3) Suggested fix:** Update scope to "15 ключей × 7 локалей (~105 строк)".

---

### [MINOR] Analytics event count inconsistency: scope says 5, table lists 6

**(1)** Scope: "Analytics: 5 новых events". Layer 10 table lists 6: `purchase_open`, `purchase_attempt`, `purchase_success`, `purchase_cancelled`, `purchase_error`, `purchase_restore`.

**(2)** Same as above — scope tracking discrepancy.

**(3) Suggested fix:** Update scope to "6 новых events".

---

### [MINOR] Locale file count: "7 локалей" but narrative entry files list 8

**(1)** The plan references entry files as `{ru, global, en, tr, es, pt, de, fr}.ts` — that's 8 files. The i18n section says "7 локалей". Is `global` a separate locale or a fallback alias? This ambiguity could lead to a missed file during implementation.

**(2) Why it matters:** A missed locale file = runtime error or silent fallback in some locales.

**(3) Suggested fix:** Clarify in the plan: "global is the EN-fallback alias, not a separate locale. Entry files: 7 unique locales (ru, en, tr, es, pt, de, fr) + global as EN-default." Make sure the developer knows which file pattern to follow by checking existing entries.

---

### [MINOR] Yandex `signed:true` — no mention of token validation

**(1)** `ysdk.getPayments({signed:true})` returns cryptographically signed purchase receipts. The `signed:true` flag implies server-side validation is intended. The plan does all validation client-side only. For a ~200 RUB single IAP this is pragmatically acceptable (client-side manipulation gives the player patron status, which removes ads — the "damage" is self-inflicted ad removal). But `signed:true` is unnecessary overhead if you're not validating signatures.

**(2) Why it matters:** Minor. Using `signed:true` without validation is dead code, not a bug. But it sets false expectations in code review.

**(3) Suggested fix:** Either (a) switch to `signed:false` to avoid confusion, or (b) add a comment: `// signed:true for future server-side validation; currently only client-side check`.

---

### [MINOR] `completedNodes.length >= 3` may include non-win nodes

**(1)** The trigger checks `completedNodes.length >= 3`, but the plan doesn't clarify whether `completedNodes` contains only solitaire-wins or also includes narrative-only nodes, tutorial completions, etc. If it includes non-win completions, the push fires earlier than "3 wins".

**(2) Why it matters:** Minor UX — the emotional framing is "you've won 3 games, consider supporting." If it fires after 3 narrative clicks with no wins, the messaging feels off.

**(3) Suggested fix:** Verify what `completedNodes` contains. If mixed, filter by node type (e.g., `completedNodes.filter(n => n.type === 'chapter').length >= 3`).

---

### [MINOR] 5-second `withTimeout` fallback promise never cancels the underlying SDK call

**(1)** `Promise.race` resolves with the fallback when the timer fires, but the underlying `getPurchases()` promise continues running in the background. This isn't a memory leak (it'll resolve eventually), but if the SDK has side effects on resolution (e.g., updating internal state), those fire after the code has already moved on.

**(2) Why it matters:** Negligible in practice, but a code-review flag.

**(3) Suggested fix:** Document this as expected behavior. No action needed unless the SDK has stateful side-effects on `getPurchases()` resolution.

---

## Alternative approaches

### A. Reactive patron-status change event instead of polling `isPatron()`

**Current design:** AdsService calls `this.save.load().progress.patronSupport` on every ad-show call. This is poll-based.

**Alternative:** Add a `onPatronActivated` event/callback to `PaymentsService` that `AdsService` subscribes to in its constructor. When patron activates, AdsService immediately: (a) sets an internal `this._isPatron = true` flag, (b) hides any visible sticky banner, (c) cancels any pending ad queue.

**Tradeoff:** Adds an observer pattern (+~15 lines) but eliminates the sticky-banner race condition (concern #3) and the readability issue of re-reading save on every call. More importantly, it makes ad-cessation **instantaneous** rather than "next time an ad is requested." If AdsService ever adds a timer-based interstitial scheduler, the polling approach would miss the first timer fire.

**Recommendation:** Implement this if the sticky banner issue is real (i.e., if `hideStickyBanner()` exists in the platform). Otherwise, the simpler polling approach is fine.

### B. Background restore instead of blocking boot

**Current design:** `await payments.restoreOnBoot()` blocks `signalReady()` for up to 5s.

**Alternative:** Fire-and-forget: `payments.restoreOnBoot(); /* no await */`. Accept that the first ~5s of a session might show one ad to a patron. The `AdsService.isPatron()` poll will pick up the flag as soon as restore completes.

**Tradeoff:** One potential ad impression for a patron on first boot after a cross-device purchase. Versus 5s boot delay for **every** player on every boot. The tradeoff strongly favors fire-and-forget for this game's audience (casual/mobile, sensitive to load times).

**Recommendation:** Background restore. Add a fast-path: store `localStorage.getItem('isPatron')` locally, and only `await` if the local flag says yes but `save.patronSupport` is false (meaning cloud might have newer data). This makes the blocking case rare (only on first cross-device restore).

### C. Separate `PatronState` slice instead of adding fields to `ProgressState`

**Current design:** `patronSupport` and `patronPushShown` are optional fields on `ProgressState`.

**Alternative:** Create a separate `PatronState` object in the save schema: `{ patron: { support: boolean; pushShown: boolean; bonusPending: boolean } }`.

**Tradeoff:** Cleaner separation, easier to reason about patron-related state. But: adds a new top-level key to the save schema, requires changes to `SaveService` access patterns, and creates a precedent for feature-scoped save slices that may not be warranted for a single IAP.

**Recommendation:** Not worth it for two boolean fields. Keep as optional fields on `ProgressState`. If a second IAP tier is added later, revisit.

---

CONCERNS REMAIN
