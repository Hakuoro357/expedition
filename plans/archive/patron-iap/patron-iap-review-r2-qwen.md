Looking at R2 against R1's 15 concerns, I need to verify closure and spot any new gaps.

---

## Prior Concerns — Closure Status

All 15 prior concerns are addressed in R2. Specifically:
- **CRITICAL GP event-based purchase** → dual strategy with singleton fallback ✓
- **Double-purchase guard** → `purchasing` lock + UI disable ✓
- **Sticky banner** → `markPatron()` → `closeSticky()` ✓
- **Cross-device coin loss** → `patronBonusGranted` idempotent flag ✓
- **Toast overlap** → 1.8s `markPatronJustActivated` grace period ✓
- **Error discrimination** → raw error logging + default `"error"` ✓
- **Boot delay** → fire-and-forget + localStorage fast-path ✓
- **"Не показывать снова"** → removed; only two buttons in post-win push ✓
- **`canShowRewarded` complexity** → simplified ✓
- **i18n/analytics/locale count inconsistencies** → all harmonized to 16 keys / 6 events ✓
- **`signed:true`** → switched to `signed:false` ✓
- **`completedNodes` ambiguity** → *partially addressed* (see below) ✓
- **`withTimeout` underlying call** → acknowledged, acceptable ✓

---

## New / Remaining Concerns

### [MAJOR] `closeSticky()` absent from `SdkService` interface

**(1)** `AdsService.markPatron()` calls `this.sdk.closeSticky?.()`. But the `SdkService` interface defined in Layer 1 does not include `closeSticky`. The optional chaining makes it safe at runtime, but the interface contract is incomplete — any future adapter implementor won't know this method is expected.

**(2) Why it matters:** If a new SDK adapter is added and doesn't implement `closeSticky`, the sticky banner silently persists after patron activation. The bug is invisible until a patron user complains.

**(3) Suggested fix:** Add `closeSticky?(): void` to the `SdkService` interface. In GamePush adapter, implement it as `gp.ads.closeStickyBanner?.()`. In Yandex/DevStub, it's a no-op (or not implemented — the `?` makes it optional).

---

### [MAJOR] Narrative entry file changes contradict fallback strategy

**(1)** The file-level changes table says to modify `entries.{es,pt,de,fr}.ts` — implying EN text is added to each locale file. But the narrative section says "остальные локали fallback через global". These are contradictory. If you add EN text directly into `entries.es.ts`, it overrides the global fallback with identical text (redundant) OR the developer may forget and leave the files unchanged (relying on fallback), but the table says "modify" creating ambiguity about what's actually needed.

**(2) Why it matters:** Implementation confusion. Developer either adds redundant EN text to 4 files (wasted effort, maintenance burden when text changes) or skips them thinking fallback handles it but the table says "modify" causing a checklist mismatch.

**(3) Suggested fix:** Pick one strategy and state it explicitly:
- **Option A (recommended):** Only modify `entries.ru.ts`, `entries.global.ts`, and `entries.tr.ts`. Remove `entries.{es,pt,de,fr}.ts` from the changes table. Add a note: "es/pt/de/fr fall back to global automatically — no changes needed."
- **Option B:** Add EN text to all 4 files explicitly. But then update the narrative section to remove "fallback" language.

---

### [MAJOR] `completedNodes` composition still unverified — patron push may fire on non-wins

**(1)** The prior MINOR concern about `completedNodes.length >= 3` including non-win nodes was noted but not explicitly closed. R2 still checks `after.completedNodes.length === 3` in RewardScene's continue-handler. The implicit assumption is "RewardScene = win, so each visit = 1 win." But if `completedNodes` is also incremented by narrative-only nodes, tutorial completions, or other scene paths that also call the increment logic, the push fires too early.

**(2) Why it matters:** The emotional framing is "you've won 3 games — consider supporting." If it fires after 3 narrative clicks with zero wins, the messaging feels wrong and the player hasn't built enough investment to be receptive.

**(3) Suggested fix:** Verify by reading the actual codebase: where is `completedNodes` incremented? If only in RewardScene's continue-handler, the concern is closed. If elsewhere, filter by node type or count RewardScene visits via a separate counter (e.g., `winsCount`).

---

### [MINOR] `restorePatronManual()` has no in-flight lock

**(1)** `purchasePatron()` has `this.purchasing` lock preventing double-fire. `restorePatronManual()` has no equivalent guard. Rapid clicks on "Восстановить" spawn concurrent `getPurchases()` calls.

**(2) Why it matters:** No money risk, but duplicate success/failure toasts could stack. Also, if `activatePatron()` runs twice in parallel, the `patronBonusGranted` idempotency guard protects coins, but `markPatron()` and `reconcile()` fire twice (harmless but wasteful).

**(3) Suggested fix:** Add a `private restoring = false` lock, same pattern as `purchasing`. Or reuse a single `inFlight` boolean since purchase and restore shouldn't overlap either.

---

### [MINOR] `getProductInfo` / `getPurchases` calls `fetchProducts()` every time (GP adapter)

**(1)** GP's `fetchProducts()` is a network round-trip. Both `getProductInfo()` and `getPurchases()` call it unconditionally. Opening the Settings dialog → close → reopen → 2 network calls for the same data.

**(2) Why it matters:** Minor perf + unnecessary network traffic. On slow connections, price display may flicker.

**(3) Suggested fix:** Cache the `fetchProducts()` result with a short TTL (e.g., 60s) or call it once in `init()` and again only on explicit refresh. Since the product catalog for a single IAP never changes at runtime, caching until page unload is fine.

---

### [MINOR] `patron_purchase_open` event with `blocked: "not_eligible"` is semantically misleading

**(1)** In `purchasePatron()`, when `canPurchasePatron()` is false, the plan tracks `patron_purchase_open` with `blocked: "not_eligible"`. This fires when the user *clicks* "Поддержать" but is already a patron — it's a guard/rail, not an "open" event. Meanwhile, the actual "open" event fires at dialog mount. Same event name, different semantics.

**(2) Why it matters:** Analytics confusion. Filtering `patron_purchase_open` by source will mix real opens with blocked-attempt guard events. Funnel analysis becomes unreliable.

**(3) Suggested fix:** Rename the guard event to `patron_purchase_blocked` or `patron_purchase_guard`, or remove it entirely (the `canPurchasePatron()` check is a defensive rail, not worth tracking unless debugging).

---

### [MINOR] DetailScene `authorThanksEntry` mode is underspecified

**(1)** The plan says "DetailScene — добавить `init({authorThanksEntry, returnTo})` branch, рендерить entry без node-specific UI." No further detail on what the rendering looks like: back button behavior, layout, portrait display, whether existing DetailScene HTML template can handle node-less mode without breaking.

**(2) Why it matters:** If DetailScene is heavily coupled to node-based navigation (route graph, artifact panels, chapter headers), the "special-case" could require more surgery than expected, blowing the 2.5h estimate for Layer 7.

**(3) Suggested fix:** Add a brief implementation note: "Reuse existing entry-body renderer; skip `getNodeByEntryId()` call; render back button as `scene.start(returnTo)`; portrait via initials-кружок (no webp)." This gives the implementer enough to scope the actual coupling.

---

### [MINOR] GP adapter `getPurchases()` calls `fetchProducts()` then reads `purchases` — naming mismatch

**(1)** The method is called `getPurchases()` (which implies "what the user bought") but it calls `fetchProducts()` (which fetches the product catalog) and reads `this.gp.payments.purchases`. The GP API's `purchases` field after `fetchProducts()` may represent the catalog, not the user's purchase history. For checking if the user bought something, `gp.payments.has(tag)` is the correct API (as noted in the plan for restoreOnBoot).

**(2) Why it matters:** If `purchases` is the catalog (all products), then `getPurchases()` always returns `{patron_support}` regardless of whether the user bought it. The restore logic would incorrectly grant patron to everyone.

**(3) Suggested fix:** Verify in GP sandbox: after `fetchProducts()`, does `purchases` contain all products or only purchased ones? If catalog-only, use `gp.payments.has(tag)` instead. The plan already notes this for `restoreOnBoot` ("gp.payments.has(tag) — boolean local check после fetchProducts. Используется ВМЕСТО getPurchases внутри restoreOnBoot для скорости") — but `getPurchases()` is also called from `restorePatronManual()`. This inconsistency needs resolution.

---

## Alternative Approaches

### D. Unify `getPurchases` and `has` in GP adapter

The plan uses `gp.payments.has(tag)` for boot restore but `getPurchases()` (which calls `fetchProducts()` + iterates `purchases`) for manual restore. If `purchases` is the catalog (see concern above), these two paths have different semantics and one is wrong.

**Recommendation:** Use `gp.payments.has(tag)` as the single source of truth for GP entitlement checks. The `SdkService.getPurchases()` interface can still exist, but the GP implementation should delegate to `has()`:
```ts
async getPurchases(): Promise<PurchasesResult> {
  if (!this.gp?.payments) return { ok: false, reason: "unavailable" };
  try {
    await this.gp.payments.fetchProducts(); // ensure data loaded
    return { ok: true, purchases: this.gp.payments.has(PATRON_TAG) ? [{ tag: PATRON_TAG }] : [] };
  } catch { ... }
}
```
This also simplifies `restoreOnBoot` to just call `getPurchases()` instead of having a separate `has()` fast-path.

---

## Verdict

CONCERNS REMAIN
