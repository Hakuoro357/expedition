You are reviewing a code phase implementation. This is Phase 1 of patron-iap plan (Layer 1: SDK foundation + types + factory + build flag).

Round: 1 of max 3 (R3 hard ceiling per phase).

Domain context: Phaser 3 + TypeScript solitaire game with GamePush + Yandex Games SDKs. Adding single IAP «Поддержать автора + ad-free». Phase 1 scope is ONLY SDK abstraction layer — no business logic, no UI. Existing infra: SdkService interface with GamePush/Yandex/DevStub adapters (some methods like ads, sounds, achievements already exist).

Phase 1 deliverables (per `plans/patron-iap-final.md` Layer 1):
1. `env.d.ts` — add gp.payments + Yandex Payments + __PLATFORM__ types
2. `vite.config.ts` + `package.json` — __PLATFORM__ define + cross-env scripts
3. `SdkService.ts` interface — add 5 methods (canUsePayments, getProductInfo, purchase, getPurchases, closeSticky*, triggerLogin) + types
4. `GamePushSdkService.ts` — payments impl via `has(tag)` canonical entitlement check
5. `YandexSdkService.ts` — payments via `getPayments({signed:false})` + triggerLogin via auth.openAuthDialog
6. `DevStubSdkService.ts` (NEW) — no-op default + localStorage-backed dev payments
7. `createSdkService.ts` (NEW) — factory with DEV-only URL override + __PLATFORM__ dispatch
8. `createSdkService.test.ts` (NEW) — factory routing tests

(* closeSticky already existed pre-Phase 1, just preserved)

Verification: 215 tests pass (was 210, +5 factory tests), TS clean, `npm run build:gp` + `npm run build:yandex` both clean.

Critical invariants to verify:
- GP `getPurchases()` uses `gp.payments.has(tag)` NOT iteration of `purchases` field (which may be catalog, not user entitlements)
- Yandex uses `signed: false` (client-side only, no server validation)
- Factory URL override gated on `import.meta.env.DEV` (NO production override)
- `closeSticky()` and `triggerLogin()` are REQUIRED interface methods with no-op defaults in adapters that don't support them
- Phase 1 must NOT modify other layers (no PaymentsService, no AdsService changes, no ProgressState fields, no UI)

Output format:
- For each concern: severity tag [CRITICAL] (will cause harm) / [MAJOR] (significant gap, should fix) / [MINOR] (polish, nice-to-have), followed by (1) what's wrong, (2) why it matters, (3) suggested fix
- At R3 it's the LAST round; remaining concerns become known TODO
- End with verdict (LAST non-empty line, no markdown/quotes/punctuation): NO SIGNIFICANT CONCERNS or CONCERNS REMAIN

=== IMPLEMENTATION DIFF ===
