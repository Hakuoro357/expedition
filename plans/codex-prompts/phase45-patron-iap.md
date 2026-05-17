You are reviewing Phase 4 + Phase 5 of patron-iap plan (Layer 2: PaymentsService + Layer 3: AdsService gate). **MOST critical phase** — race conditions, R7-ceiling U1-U4 fixes integrated.

Round: 1 of max 3 (R3 hard ceiling per phase).

Domain context: Phaser 3 + TypeScript game с GamePush+Yandex SDK. Adding single IAP «Поддержать автора + ad-free».
- Phase 1 (SDK foundation): SdkService.canUsePayments / purchase / getPurchases / closeSticky / triggerLogin — done & committed
- Phase 2 (Save): ProgressState fields (patronSupport / patronBonusGranted / patronGrantedAt / patronPushShown) + validation — done
- Phase 3 (Reconciler): markPatronJustActivated() + 1.8s patron-tag toast delay — done

Phase 4+5 implements:
- `src/services/payments/PaymentsService.ts` — full class per plan Layer 2
- `src/services/payments/withTimeout.ts` — Promise-race helper
- `src/services/payments/PaymentsService.test.ts` — 18 tests
- `src/services/ads/AdsService.ts` modified — 3 patron-flag methods + 4 ad-method gates
- `src/services/ads/AdsService.test.ts` — 12 tests

Plan contract: `plans/patron-iap-final.md` (Layer 2, Layer 3 + R7 fixes U1-U4).

## R7-ceiling U1-U4 invariants to verify

**U1 (codex's prior-MAJOR Phase R7):** `restoreOnBoot` must call `confirmPatronEntitlement("preserved")` BEFORE `!canUsePayments() return` early-return. Reason: existing patron on Crazy/Poki (canUsePayments=false) должен закрыть sticky banner.

**U2 (codex's new-MAJOR R7):** Timeout in `restoreOnBoot` must NOT consume late SDK success. `Promise.race`-style consumption is BAD. Correct pattern: `getPurchases().then(processRestoreResult)` chain runs ALWAYS (even after timeout); SEPARATE setTimeout only clears optimistic localStorage hint if SDK still pending. Late patron success via .then() activatePatron — OK.

**U3 (codex's new-MAJOR R7):** `restorePatronManual` must wrap `sdk.getPurchases()` в `withTimeout(..., RESTORE_MANUAL_TIMEOUT_MS=10000)`. SDK hang must NOT lock `inFlight` permanently.

**U4 (codex's new-MIN R7):** `confirmPatronEntitlement` helper must ALWAYS call `achievements.reconcile(state)` — repairs missing patron achievement on preserved paths (post-crash / migration edge).

## Other critical invariants

- `purchasePatron` has in-flight lock (analytics blocked event если 2nd call while 1st pending)
- `activatePatron` patronBonusGranted guards +300 coins idempotency (once per save state)
- `activatePatron` calls `confirmPatronEntitlement(origin)` ВКЛЮЧАЯ early-return path (когда both flags уже set — ads ещё нужно sync, even если save mutation skipped)
- `getPatronPrice` try/catch — dialog renders без price если SDK throws
- localStorage operations всегда обёрнуты try/catch (private mode safe)
- AdsService `setPatronOptimistic` НЕ trogue sticky (revocable); `markPatronConfirmed` zовёт sdk.closeSticky() (irreversible)
- AdsService 4 ad-method gates: showPreloader/Interstitial/StickyBanner/RewardedVideo — first statement
- showRewardedVideo gate fires `rewarded_offer_skipped` analytics with `reason: "patron"`
- Phase 4+5 must NOT touch other layers (AppContext, BootScene, UI, etc.)

Verification: 252/252 tests pass (was 222), build:gp clean.

Output format:
- [CRITICAL] / [MAJOR] / [MINOR] tag + (1) what's wrong (2) why matters (3) suggested fix
- Flag specifically any U1-U4 invariant violations as MAJOR
- At R3 — last round; remaining concerns = known TODO
- End with verdict (LAST non-empty line): NO SIGNIFICANT CONCERNS or CONCERNS REMAIN

=== IMPLEMENTATION DIFF ===
