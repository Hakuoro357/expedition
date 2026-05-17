# Patron IAP — «Поддержать автора + ad-free» (v0.3.60) — draft-r5

## R4 → R5 summary

Reviewed codex + qwen. **R4 status:** qwen → NSC (converging well), codex → CONCERNS REMAIN.

**R5 accepts (5 surgical fixes):**
1. **Z1: TS type fix** — `Extract<PurchasesResult, {ok:false}>["reason"]` (R4 type wouldn't compile)
2. **Z2: AdsService split — optimistic vs confirmed** — `setPatronOptimistic` НЕ closes sticky; `markPatronConfirmed` does
3. **Z3: Bounded retry** в `handleRestoreClick` (retried param prevents infinite recursion)
4. **Z4: `processRestoreResult` async** + .catch chain
5. **Z5: Manual restore mismatch flag** + neutral copy

**R5 rejects (R4-rule: push back on repeats):**
- **Z6-REJECT: Refund/revocation observability-only** — codex 4-й repeat. Accepted product risk v0.3.60. Telemetry foundation в plan; revoke spec → v0.3.61
- **Z7-REJECT: Once-per-account vs save-state** — codex 3-й repeat. Product decision. Player-facing UI «один раз», internal «save state», edge case <1% needs backend

## Architecture — diff vs R4

### Layer 1 — SDK interface (unchanged)

### Layer 2 — PaymentsService (Z1, Z2, Z4, Z5)

```ts
import type { PurchasesResult, PurchaseResult } from "@/services/sdk/SdkService";

// Z1: правильный type extraction
export type PurchaseFailureReason = Extract<PurchasesResult, { ok: false }>["reason"];

export type RestoreManualResult =
  | { ok: true; alreadyActive: boolean; mismatch?: boolean }
  | { ok: false; alreadyActive: false; reason: PurchaseFailureReason };

export class PaymentsService {
  private inFlight = false;
  private listeners = new Set<(isPatron: boolean) => void>();
  private pendingLateRestore?: Promise<void>;

  // ... existing accessors

  async restorePatronManual(): Promise<RestoreManualResult> {
    if (this.inFlight) {
      this.analytics.track("patron_purchase_blocked", { source: "restore", reason: "in_flight" });
      return { ok: false, alreadyActive: false, reason: "error" };
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

      // Z5: distinct mismatch flag для UI
      if (!platformPatron && localPatron) {
        console.warn("[payments] manual restore: platform says NOT patron, local says yes");
        this.analytics.track("patron_purchase_restore", { found: false, source: "manual", note: "local_only" });
        return { ok: true, alreadyActive: true, mismatch: true };
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
      return { ok: false, alreadyActive: false, reason: "error" };
    } finally {
      this.inFlight = false;
    }
  }

  async restoreOnBoot(): Promise<void> {
    if (!this.canUsePayments()) return;

    let localHint = false;
    try {
      if (typeof localStorage !== "undefined") {
        localHint = localStorage.getItem(PATRON_LOCAL_KEY) === "true";
      }
    } catch { /* private mode */ }

    if (localHint && !this.save.load().progress.patronSupport) {
      // Z2: optimistic — sticky НЕ закрывается (revocable)
      console.info("[payments] local hint optimistic ad-suppression (sticky stays)");
      this.ads.setPatronOptimistic();
    }

    const localPatron = this.save.load().progress.patronSupport === true;
    const fetchPromise = this.sdk.getPurchases().catch(err => {
      console.warn("[payments] getPurchases threw", err);
      return { ok: false, reason: "error" as const } as PurchasesResult;
    });

    // Z4: chain async + catch
    this.pendingLateRestore = fetchPromise
      .then(result => this.processRestoreResult(result, { localHint, localPatron, source: "boot" }))
      .catch(err => console.error("[payments] late restore process failed", err));

    await withTimeout(this.pendingLateRestore, RESTORE_BOOT_TIMEOUT_MS, undefined);
  }

  // Z4: async + always-resolved (errors swallowed по chain)
  private async processRestoreResult(
    result: PurchasesResult,
    ctx: { localHint: boolean; localPatron: boolean; source: "boot" | "manual" },
  ): Promise<void> {
    if (!result.ok) {
      this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: ctx.source });
      return;  // НЕ revert (transient)
    }
    const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

    if (platformPatron && !ctx.localPatron) {
      await this.activatePatron("restore");
      this.analytics.track("patron_purchase_restore", { found: true, source: ctx.source });
      return;
    }
    if (!platformPatron && ctx.localPatron) {
      // Z6-REJECT: log only. v0.3.61 will decide revoke policy on this telemetry.
      console.warn("[payments] platform NOT patron, local says yes — possible refund (observability only)");
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "local_only" });
      return;
    }
    if (!platformPatron && ctx.localHint && !ctx.localPatron) {
      // Z2: clear hint + revert optimistic. Sticky тоже становится pollable снова.
      console.info("[payments] local hint disproven by SDK — clearing optimistic suppression");
      try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch { /* ignore */ }
      this.ads.clearPatronOptimistic();
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "hint_disproven" });
      return;
    }
    // platformPatron && localPatron — both agree, no-op
  }

  // Z2: markPatronConfirmed используется здесь — closeSticky() inside.
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

    // Z2: confirmed (closes sticky permanently)
    this.ads.markPatronConfirmed();

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

### Layer 3 — AdsService (Z2)

```ts
class AdsService {
  private patronCached?: boolean;

  /** Z2: Optimistic (localStorage hint). Sticky NOT touched — revocable. */
  setPatronOptimistic(): void {
    this.patronCached = true;
  }

  /** Z2: Revert optimistic (SDK disproved hint). Polling resumes from save. */
  clearPatronOptimistic(): void {
    this.patronCached = undefined;
  }

  /** Z2: Confirmed entitlement. Sticky closed immediately. */
  markPatronConfirmed(): void {
    this.patronCached = true;
    try { this.sdk.closeSticky(); } catch { /* no-op safe */ }
  }

  private isPatron(): boolean {
    if (this.patronCached !== undefined) return this.patronCached;
    return Boolean(this.save.load().progress.patronSupport);
  }

  // 4 gate methods same
}
```

### Layer 4-7 (unchanged from R4)

### Layer 8 — Settings UI (Z3, Z5)

```ts
// SettingsScene.handleRestoreClick (Z3: bounded retry)
private async handleRestoreClick(retried = false): Promise<void> {
  const { payments, sdk } = getAppContext();
  const result = await payments.restorePatronManual();

  if (result.ok) {
    // Z5: distinct mismatch case
    if (result.mismatch) {
      this.showToast(i18n.t("patronRestoreDisputed"));  // «Покупка отмечена в этом save, но не подтверждена платформой»
    } else if (result.alreadyActive) {
      this.showToast(i18n.t("patronAlreadyActive"));  // «Вы уже поддержали проект»
    } else {
      this.showToast(i18n.t("patronRestoreSuccess"));  // «Покупка восстановлена. Спасибо!»
      this.render();
    }
    return;
  }

  // result.ok === false
  if (result.reason === "unauthorized") {
    if (retried) {
      // Z3: already retried — show final state, no more recursion
      this.showToast(i18n.t("patronRestoreUnauthorized"));
      return;
    }
    const wantsLogin = await this.confirmDialog(i18n.t("patronUnauthorizedLogin"));
    if (!wantsLogin) return;
    await sdk.triggerLogin();
    return this.handleRestoreClick(true);  // bounded
  }
  if (result.reason === "unavailable") {
    this.showToast(i18n.t("patronRestoreUnavailable"));
    return;
  }
  this.showToast(i18n.t("patronRestoreError"));
}
```

### Layer 12 — i18n (R5 +1 key)

Adds `patronRestoreDisputed`. **Total: 20 keys × 7 locales = 140 strings** (R4: 19 × 7 = 133).

## File-level changes (diff vs R4)

| Path | R5 change |
|---|---|
| `src/services/payments/PaymentsService.ts` | type fix (Extract), processRestoreResult async, mismatch flag, markPatronConfirmed |
| `src/services/ads/AdsService.ts` | split: setPatronOptimistic / clearPatronOptimistic / markPatronConfirmed |
| `src/scenes/SettingsScene.ts` | handleRestoreClick bounded retry + mismatch handling |
| `src/services/i18n/locales.ts` | + `patronRestoreDisputed` × 7 locales |

## Tests (diff vs R4)

Adds:
- `AdsService.test.ts` — optimistic suppression doesn't close sticky; confirmed does
- `PaymentsService.lateRestore.test.ts` — localStorage hint disproved → clearPatronOptimistic called (NOT markPatronConfirmed)
- `SettingsScene.restoreFlow.test.ts` — bounded retry: unauthorized × 2 in a row stops at retried=true with patronRestoreUnauthorized toast
- `PaymentsService.test.ts` — mismatch flag returned для local-true + platform-false case
- TS compile test (via `tsc --noEmit`) — RestoreManualResult union resolves correctly

## Verification (unchanged from R4)

## Phases (unchanged total ~28h)

## Risks (R5 refined — explicit «accepted v0.3.60 risks»)

| Risk | Status | Mitigation |
|---|---|---|
| Refund/revocation = false-positive entitlement forever | **Accepted v0.3.60** product risk | Telemetry foundation: `patron_purchase_restore` events с `note: "local_only"` track real rate. v0.3.61 spec will use this data to decide revoke policy (grace period / notification / auto-downgrade) |
| Strict once-per-account not enforced | **Accepted v0.3.60** product risk | Cross-device concurrent activation rare (<1%). Player-facing UI «один раз» (true для normal flow). Backend marker = v0.3.61+ если telemetry shows real complaints |
| localStorage hint suppresses sticky | **Closed (R5 Z2)** | Optimistic path не calls closeSticky. Только confirmed activation closes |
| Late-restore async errors lost | **Closed (R5 Z4)** | `.catch()` chain logs errors |
| Manual restore type uninferred | **Closed (R5 Z1)** | Extract pattern resolves |
| Login retry infinite recursion | **Closed (R5 Z3)** | `retried` param bounds |
| Local-vs-platform mismatch hidden | **Closed (R5 Z5)** | `mismatch: true` flag + distinct toast |

## Open questions (v0.3.61+)

(unchanged)
