# Patron IAP — «Поддержать автора + ad-free» (v0.3.60) — draft-r4

## R3 → R4 summary

Reviewed codex + qwen. **10 R3 concerns accepted, 1 rejected** (refund/revocation persistent — explicit v0.3.61 scope, v0.3.60 ships observability-only).

**R4 surgical fixes:**
1. **Late-restore chain** (Y1) — `.then()` после timeout вместо drop. Idempotent `activatePatron` обрабатывает late call безопасно
2. **cross-env в build scripts** (Y2) — Windows/POSIX compat
3. **localStorage = ad-delay hint, не entitlement** (Y3) — `ads.unmarkPatron()` revert path при SDK NOT-confirm
4. **Yandex login flow явный** (Y4) — restorePatronManual → unauthorized → triggerLogin → retry
5. **«Once per save state»** formulation (Y5) — единообразно в коде + UI: «один раз»
6. **URL override DEV-only** (Y6) — `import.meta.env.DEV` gate
7. **Manual restore always platform-verify** (Y8) — log mismatch если local-true но SDK NOT-confirm
8. **`closeSticky` + `triggerLogin` required в interface** (Y9) — no-op defaults в unsupported adapters
9. **`mountPatronDialog` owns `patron_purchase_open` event** (Y11) — single source
10. **Achievement toast только origin="purchase"** (Y12) — silent reconcile on restore

## Context (unchanged)

См. R3.

## Architecture — diff vs R3

### Layer 1 — SDK interface (Y9)

```ts
interface SdkService {
  // ... existing
  canUsePayments(): boolean;
  getProductInfo(tag: string): Promise<ProductInfo | null>;
  purchase(tag: string): Promise<PurchaseResult>;
  getPurchases(): Promise<PurchasesResult>;
  /** Hide active sticky banner. Required — no-op default в unsupported platforms. */
  closeSticky(): void;
  /** Native login dialog. Required — no-op default if platform не supports auth flow. */
  triggerLogin(): Promise<void>;
}
```

Yandex impl `triggerLogin` → `await this.sdk?.auth?.openAuthDialog()`. GamePush `triggerLogin` — no-op (player login handled by GP host). DevStub — no-op.

GamePush `closeSticky` → `gp.ads.closeStickyBanner?.()`. Yandex — no-op (sticky not user-controllable). DevStub — no-op.

### Layer 1 — Factory с DEV-only URL override (Y6)

```ts
export function createSdkService(): SdkService {
  // URL override — ТОЛЬКО в dev mode для testing.
  const forced = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("platform")
    : null;
  if (forced === "yandex") return new YandexSdkService();
  if (forced === "gamepush") return new GamePushSdkService();
  if (forced === "dev") return new DevStubSdkService();
  // Production: build-flag primary.
  if (__PLATFORM__ === "gamepush") return new GamePushSdkService();
  if (__PLATFORM__ === "yandex") return new YandexSdkService();
  return new DevStubSdkService();
}
```

### Layer 1 — Build scripts с cross-env (Y2)

`package.json`:
```json
"scripts": {
  "build": "tsc --noEmit && vite build",
  "build:gp": "cross-env PLATFORM=gamepush npm run build",
  "build:yandex": "cross-env PLATFORM=yandex npm run build",
  "preview": "vite preview",
  "test": "vitest run"
},
"devDependencies": {
  "cross-env": "^7.0.3",
  // ... existing
}
```

### Layer 2 — PaymentsService (Y1, Y3, Y8)

```ts
export class PaymentsService {
  private inFlight = false;
  private listeners = new Set<(isPatron: boolean) => void>();

  /** Y1: process late-success после timeout. Chain stored для cleanup. */
  private pendingLateRestore?: Promise<void>;

  // ... existing canUsePayments / canPurchasePatron / getPatronPrice / onChange

  async purchasePatron(source): Promise<{ ok: boolean }> { /* same as R3 */ }

  /**
   * Y8: всегда platform-verify, даже если local-true (observability).
   * Y4: handle unauthorized → каллер показывает login CTA.
   */
  async restorePatronManual(): Promise<{ ok: boolean; alreadyActive: boolean; reason?: PurchasesResult extends { ok: false; reason: infer R } ? R : never }> {
    if (this.inFlight) {
      this.analytics.track("patron_purchase_blocked", { source: "restore", reason: "in_flight" });
      return { ok: false, alreadyActive: false };
    }
    this.inFlight = true;
    try {
      const localPatron = this.save.load().progress.patronSupport === true;
      const result = await this.sdk.getPurchases();
      if (!result.ok) {
        this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: "manual" });
        return { ok: false, alreadyActive: false, reason: result.reason };
      }
      const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

      // Y8: log mismatch (refund observability)
      if (!platformPatron && localPatron) {
        console.warn("[payments] manual restore: platform says NOT patron, local says yes");
        this.analytics.track("patron_purchase_restore", { found: false, source: "manual", note: "local_only" });
        return { ok: true, alreadyActive: true };  // не revoke
      }
      if (platformPatron && !localPatron) {
        await this.activatePatron("restore");
        this.analytics.track("patron_purchase_restore", { found: true, source: "manual" });
        return { ok: true, alreadyActive: false };
      }
      if (platformPatron && localPatron) {
        return { ok: true, alreadyActive: true };
      }
      this.analytics.track("patron_purchase_restore", { found: false, source: "manual" });
      return { ok: false, alreadyActive: false };
    } finally {
      this.inFlight = false;
    }
  }

  /** Y1: late-success chain. Y3: localStorage = ad-delay hint, не entitlement. */
  async restoreOnBoot(): Promise<void> {
    if (!this.canUsePayments()) return;

    // Y3: optimistic ad-delay только (НЕ persistent entitlement)
    let localHint = false;
    try {
      if (typeof localStorage !== "undefined") {
        localHint = localStorage.getItem(PATRON_LOCAL_KEY) === "true";
      }
    } catch { /* private mode */ }

    if (localHint && !this.save.load().progress.patronSupport) {
      // Tentative ad-suppression, revertable.
      console.info("[payments] local hint optimistic ad-suppression (pending SDK confirm)");
      this.ads.markPatron();
    }

    const localPatron = this.save.load().progress.patronSupport === true;
    const fetchPromise = this.sdk.getPurchases().catch(err => {
      console.warn("[payments] getPurchases threw", err);
      return { ok: false, reason: "error" as const } as PurchasesResult;
    });

    // Y1: process LATE results after timeout via .then()
    this.pendingLateRestore = fetchPromise.then(result => {
      this.processRestoreResult(result, { localHint, localPatron, source: "boot" });
    });

    // Wait up to 1.5s
    await withTimeout(this.pendingLateRestore, RESTORE_BOOT_TIMEOUT_MS, undefined);
    // If timeout — pendingLateRestore continues in background, fire processRestoreResult eventually.
  }

  private processRestoreResult(
    result: PurchasesResult,
    ctx: { localHint: boolean; localPatron: boolean; source: "boot" | "manual" },
  ): void {
    if (!result.ok) {
      this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: ctx.source });
      // Transient failure — НЕ revert optimistic markPatron. Next boot retries.
      return;
    }
    const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

    if (platformPatron && !ctx.localPatron) {
      // SDK confirms entitlement — persist locally.
      this.activatePatron("restore");
      this.analytics.track("patron_purchase_restore", { found: true, source: ctx.source });
      return;
    }
    if (!platformPatron && ctx.localPatron) {
      // Y7-REJECT: log only, don't revoke в v0.3.60.
      console.warn("[payments] platform says NOT patron, local says yes — possible refund (observability only)");
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "local_only" });
      return;
    }
    if (!platformPatron && ctx.localHint && !ctx.localPatron) {
      // Y3: localStorage hint was wrong (manipulated / stale). Revert optimistic.
      console.info("[payments] local hint disproven by SDK — reverting optimistic ad-suppression");
      try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch { /* ignore */ }
      this.ads.unmarkPatron();
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "hint_disproven" });
      return;
    }
    if (platformPatron && ctx.localPatron) {
      // Both agree, no-op.
      return;
    }
  }

  /** Y12: achievement toast только на fresh purchase. Restore — silent. */
  private async activatePatron(origin: "purchase" | "restore"): Promise<void> {
    const before = this.save.load().progress;
    if (before.patronSupport && before.patronBonusGranted) return;

    this.save.updateProgress((p) => ({
      ...p,
      patronSupport: true,
      patronBonusGranted: true,
      patronGrantedAt: p.patronGrantedAt ?? Date.now(),
      coins: p.patronBonusGranted ? p.coins : (p.coins ?? 0) + PATRON_BONUS_COINS,
    }));

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PATRON_LOCAL_KEY, "true");
      }
    } catch { /* ignore */ }

    this.ads.markPatron();

    // Y12: toast только на fresh purchase
    if (origin === "purchase") {
      this.achievements.markPatronJustActivated();
    }
    this.achievements.reconcile(this.save.load().progress);

    this.listeners.forEach((fn) => fn(true));

    try { await this.save.flush(); }
    catch (err) { console.error("[payments] activate flush failed; local state holds", err); }
  }
}
```

**Y5: «once per save state» semantics** — комментарий в коде + plan-level note:
```ts
// patronBonusGranted: once per save state, not per account.
// Cross-device concurrent first-activation: last-write-wins merge may
// silently drop one device's +300 (rare in practice). Strict once-per-
// account requires server-validated processed-purchase marker — out-of-scope
// v0.3.60. Player-facing UI uses «один раз» (true for normal single-device
// flow); cross-device edge case in v0.3.60 risks table.
```

### Layer 3 — AdsService (Y3 unmarkPatron)

```ts
class AdsService {
  private patronCached?: boolean;

  /** Set internal flag + immediate sticky-hide. */
  markPatron(): void {
    this.patronCached = true;
    try { this.sdk.closeSticky(); } catch { /* no-op safe */ }
  }

  /** Y3: revert optimistic ad-suppression if SDK disproves localStorage hint. */
  unmarkPatron(): void {
    this.patronCached = undefined;  // back to polling save
  }

  private isPatron(): boolean {
    if (this.patronCached !== undefined) return this.patronCached;
    return Boolean(this.save.load().progress.patronSupport);
  }

  // ... 4 gate methods same as R3
}
```

### Layer 4 — ProgressState (unchanged from R3)

### Layer 5 — AchievementsReconciler (unchanged)

### Layer 6 — Achievement `patron` (unchanged)

### Layer 7 — Archive entry + speaker fallback (unchanged from R3)

### Layer 8 — Settings UI (Y4, Y8, Y11)

**Y11: `mountPatronDialog(source)` — single owner of `patron_purchase_open`:**
```ts
function mountPatronDialog(source: "settings" | "post_win_push"): void {
  getAppContext().analytics.track("patron_purchase_open", { source });
  // ... render HTML, attach handlers
}
```

`SettingsScene.openPatronDialog()` → `mountPatronDialog("settings")`.
`MapScene.openPatronPush()` → `mountPatronDialog("post_win_push")` (после `await save.flush()`).

**Y4: Restore button с login flow:**

```ts
// SettingsScene.handleRestoreClick()
private async handleRestoreClick(): Promise<void> {
  const { payments } = getAppContext();
  const result = await payments.restorePatronManual();

  if (result.ok && result.alreadyActive) {
    this.showToast(i18n.t("patronAlreadyActive"));  // «Вы уже поддержали проект»
    return;
  }
  if (result.ok && !result.alreadyActive) {
    this.showToast(i18n.t("patronRestoreSuccess"));  // «Покупка восстановлена. Спасибо!»
    this.render();  // hide patron button
    return;
  }
  // result.ok === false
  if (result.reason === "unauthorized") {
    // Y4: offer login → retry
    const wantsLogin = await this.confirmDialog(i18n.t("patronUnauthorizedLogin"));  // «Войдите чтобы восстановить»
    if (wantsLogin) {
      await getAppContext().sdk.triggerLogin();
      // Retry once after login dialog closes (user may have authenticated)
      return this.handleRestoreClick();
    }
    return;
  }
  if (result.reason === "unavailable") {
    this.showToast(i18n.t("patronRestoreUnavailable"));
    return;
  }
  // timeout / error / etc
  this.showToast(i18n.t("patronRestoreError"));
}
```

### Layer 9 — Post-3-wins push (unchanged from R3)

### Layer 10 — Boot integration (unchanged from R3; restoreOnBoot internals updated)

### Layer 11 — Analytics (unchanged)

### Layer 12 — i18n (R4 +3 keys)

R4 додаёт **3 new i18n keys** для Yandex login + restore feedback:
- `patronUnauthorizedLogin` — «Войдите чтобы восстановить»
- `patronAlreadyActive` — «Вы уже поддержали проект»
- `patronRestoreUnavailable` — «Восстановление недоступно на этой платформе»

Total: **19 keys × 7 locales = 133 strings** (R3 had 16 × 7 = 112).

### Layer 13 — GP / Yandex setup (unchanged)

## File-level changes (diff vs R3)

| Path | R4 change |
|---|---|
| `package.json` | + `cross-env` devDep + `build:gp`/`build:yandex` scripts |
| `src/services/sdk/SdkService.ts` | `closeSticky` / `triggerLogin` required (был optional) |
| `src/services/sdk/createSdkService.ts` | URL override gated на `import.meta.env.DEV` |
| `src/services/sdk/YandexSdkService.ts` | `closeSticky` no-op impl |
| `src/services/sdk/DevStubSdkService.ts` | `closeSticky` + `triggerLogin` no-op impls |
| `src/services/payments/PaymentsService.ts` | late-restore chain + processRestoreResult helper + manual platform-verify + activate toast gated on origin |
| `src/services/ads/AdsService.ts` | + `unmarkPatron()` method |
| `src/services/i18n/locales.ts` | + 3 new keys × 7 locales |
| `src/scenes/SettingsScene.ts` | restore handler с Y4 login flow |
| `src/ui/patronDialog.ts` | + single owner для `patron_purchase_open` analytics |

## Tests (diff vs R3)

R4 adds:
- **`PaymentsService.lateRestore.test.ts`** (new):
  - timeout triggers → SDK resolves 2s later → `activatePatron` called via `.then()`
  - localStorage hint optimistic → SDK disproves → `ads.unmarkPatron()` called + hint cleared
  - localStorage hint optimistic → SDK confirms → standard activatePatron
  - manual restore: local-true + platform-false → log warning, return alreadyActive (no revoke)
  - manual restore: unauthorized → returns `reason: "unauthorized"`

- **`SettingsScene.restoreFlow.test.ts`** (new):
  - unauthorized → confirm dialog opens
  - login confirmed → triggerLogin called → retry restore
  - login cancelled → no retry

- **`AchievementsReconciler.test.ts`** (extend):
  - `markPatronJustActivated` triggers delayed toast for patron tag
  - reconcile() WITHOUT markPatronJustActivated — no toast (silent)

- **`createSdkService.test.ts`** (extend):
  - `import.meta.env.DEV = false` + `?platform=dev` → DOES NOT override (returns build-flag adapter)
  - `import.meta.env.DEV = true` + `?platform=dev` → returns DevStub

`npm test` — 210 → ~240 (+30 тестов).

## Verification (diff vs R3)

R4 adds:
- **Slow SDK simulation:** в DevStub `getPurchases()` artificially delay 3s, verify late-restore chain calls activatePatron after timeout
- **localStorage manipulation test:** manually set `localStorage.isPatron=true` без real purchase. Boot → optimistic markPatron → SDK returns NOT-patron → ads return after ~1.5s
- **Yandex login flow:** logged-out player → restore → unauthorized → login dialog → success → retry → patron restored

## Phases (unchanged total estimate ~28h)

R4 changes absorbed in existing phases.

## Risks (refined R4)

| Risk | Mitigation |
|---|---|
| Late-restore race с user navigation | `activatePatron` idempotent (early-return если patronBonusGranted) — safe to call after user moved to другой сцене |
| localStorage hint creates 1-1.5s ad-suppression for non-patrons (manipulation) | После SDK disproves — `ads.unmarkPatron()` reverts cache, ads resume from poll. Net loss: 0-1.5s "free" ad-free для manipulator. Acceptable tradeoff for paying-patron UX |
| Yandex `auth.openAuthDialog()` reject | `triggerLogin` catches и не throws. Retry restore все равно happens, returns same reason если still unauthorized |
| `cross-env` adds dev dependency | ~10KB, widely-used, no runtime cost |
| Build-flag default fallback dev → production-mismatch | CI must explicitly set `PLATFORM` env. Document в release runbook |
| Refund/revocation v0.3.60 = observability only | Explicit decision, documented in plan + code. v0.3.61 spec будет включать UX/notification |

## Open questions (v0.3.61+)

- **Refund/revocation policy** — backed by v0.3.60 telemetry (`note: "local_only"` events count)
- Strict once-per-account через server-validated marker
- Custom art (patron.png + author portrait)
- Multi-tier IAP
- Anti-cracked-save periodic re-verification
