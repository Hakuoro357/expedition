# Patron IAP — «Поддержать автора + ad-free» (v0.3.60) — draft-r7

## R6 → R7 summary — HARD CEILING ROUND

Reviewed codex + qwen. **R6 status:** qwen → NSC (3-й раз подряд); codex → CONCERNS REMAIN (2 prior-MAJOR + alternative).

**R7 surgical fixes (3 accepts, 0 rejects):**
1. **V1: Centralized `confirmPatronEntitlement(origin)` helper** — single source of truth для ad-confirm + ach-trigger across all "remains patron" branches
2. **V2: Explicit timeout → processRestoreResult firing** — eliminates SDK-hang gap (W2 fix реально срабатывает)
3. **V3: Alternative D adopted** через V1 helper

R7 — hard ceiling. После этого либо consensus, либо stalled artifact.

## Architecture — diff vs R6

### Layer 2 — PaymentsService (V1, V2, V3)

```ts
export class PaymentsService {
  // ... existing fields

  /** V1/V3: Centralized ad+ach confirmation. Idempotent — safe many calls. */
  private confirmPatronEntitlement(origin: "purchase" | "restore" | "preserved"): void {
    this.ads.markPatronConfirmed();  // closes sticky if visible
    if (origin === "purchase") {
      this.achievements.markPatronJustActivated();
    }
    // reconcile() — called separately by activatePatron path
  }

  async purchasePatron(source): Promise<{ ok: boolean }> { /* unchanged */ }

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
        // V1: preserve entitlement если local was patron — confirm to ads
        if (localPatron) this.confirmPatronEntitlement("preserved");
        return { ok: false, alreadyActive: localPatron, reason: result.reason };
      }
      const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

      if (!platformPatron && localPatron) {
        console.warn("[payments] manual restore: platform NOT patron, local says yes");
        this.analytics.track("patron_purchase_restore", { found: false, source: "manual", note: "local_only" });
        this.confirmPatronEntitlement("preserved");  // V1
        return { ok: true, alreadyActive: true, mismatch: true };
      }
      if (platformPatron && !localPatron) {
        await this.activatePatron("restore");
        this.analytics.track("patron_purchase_restore", { found: true, source: "manual" });
        return { ok: true, alreadyActive: false };
      }
      if (platformPatron && localPatron) {
        this.confirmPatronEntitlement("preserved");  // V1: idempotent
        return { ok: true, alreadyActive: true };
      }
      // !platformPatron && !localPatron — legitimate empty
      this.analytics.track("patron_purchase_restore", { found: false, source: "manual" });
      return { ok: false, alreadyActive: false, reason: "not_found" };
    } finally {
      this.inFlight = false;
    }
  }

  /** V2: Guaranteed processRestoreResult firing — either SDK resolve OR timeout. */
  async restoreOnBoot(): Promise<void> {
    if (!this.canUsePayments()) return;

    let localHint = false;
    try {
      if (typeof localStorage !== "undefined") {
        localHint = localStorage.getItem(PATRON_LOCAL_KEY) === "true";
      }
    } catch { /* private mode */ }

    if (localHint && !this.save.load().progress.patronSupport) {
      console.info("[payments] local hint optimistic ad-suppression");
      this.ads.setPatronOptimistic();
    }

    const localPatron = this.save.load().progress.patronSupport === true;
    const ctx = { localHint, localPatron, source: "boot" as const };

    // V2: ensure processRestoreResult fires exactly once
    let processed = false;
    const processOnce = (result: PurchasesResult): void => {
      if (processed) return;
      processed = true;
      this.processRestoreResult(result, ctx)
        .catch(err => console.error("[payments] processRestoreResult threw", err));
    };

    // Late-resolution path
    this.sdk.getPurchases()
      .then(processOnce)
      .catch(err => {
        console.warn("[payments] getPurchases threw", err);
        processOnce({ ok: false, reason: "error" });
      });

    // Hung-resolution fallback — guaranteed firing
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        processOnce({ ok: false, reason: "timeout" });
        resolve();
      }, RESTORE_BOOT_TIMEOUT_MS);
    });
  }

  private async processRestoreResult(
    result: PurchasesResult,
    ctx: { localHint: boolean; localPatron: boolean; source: "boot" | "manual" },
  ): Promise<void> {
    if (!result.ok) {
      this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: ctx.source });
      // V1: preserve entitlement if local was patron
      if (ctx.localPatron) {
        this.confirmPatronEntitlement("preserved");
      } else if (ctx.localHint) {
        // W2: clear unverified optimistic suppression
        console.info("[payments] SDK failed, local hint unverified — clearing optimistic");
        try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch {}
        this.ads.clearPatronOptimistic();
      }
      return;
    }
    const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

    if (platformPatron && !ctx.localPatron) {
      await this.activatePatron("restore");
      this.analytics.track("patron_purchase_restore", { found: true, source: ctx.source });
      return;
    }
    if (!platformPatron && ctx.localPatron) {
      // Refund-suspected: observability only, no revoke v0.3.60
      console.warn("[payments] platform NOT patron, local says yes — possible refund (observability)");
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "local_only" });
      this.confirmPatronEntitlement("preserved");  // V1
      return;
    }
    if (!platformPatron && ctx.localHint && !ctx.localPatron) {
      console.info("[payments] local hint disproven by SDK — clearing optimistic");
      try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch {}
      this.ads.clearPatronOptimistic();
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "hint_disproven" });
      return;
    }
    if (platformPatron && ctx.localPatron) {
      this.confirmPatronEntitlement("preserved");  // V1
      return;
    }
  }

  /** V1: uses helper for ad+ach. */
  private async activatePatron(origin: "purchase" | "restore"): Promise<void> {
    const before = this.save.load().progress;
    if (before.patronSupport && before.patronBonusGranted) {
      this.confirmPatronEntitlement(origin === "purchase" ? "purchase" : "preserved");
      return;
    }

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

    this.confirmPatronEntitlement(origin);  // V1: replaces inline markPatronConfirmed + markPatronJustActivated
    this.achievements.reconcile(this.save.load().progress);
    this.listeners.forEach((fn) => fn(true));

    try { await this.save.flush(); }
    catch (err) { console.error("[payments] activate flush failed; local state holds", err); }
  }
}
```

### Layer 3 — AdsService (unchanged from R5/R6)

### Layer 4-12 (unchanged)

## File-level changes (diff vs R6)

| Path | R7 change |
|---|---|
| `src/services/payments/PaymentsService.ts` | + `confirmPatronEntitlement(origin)` helper; all "remains patron" branches use it; restoreOnBoot uses processOnce guard + setTimeout fallback fires processRestoreResult |

## Tests (diff vs R6)

Adds:
- `PaymentsService.lateRestore.test.ts`:
  - SDK never resolves (mock returns infinite promise) → after RESTORE_BOOT_TIMEOUT_MS, processRestoreResult fires with `{ok:false, reason:"timeout"}`. Optimistic suppression cleared if `localHint && !localPatron`
  - SDK resolves later than processOnce already fired (timeout case): late resolve becomes no-op (processed=true)
- `PaymentsService.test.ts`:
  - Boot: `!result.ok && localPatron=true` → `confirmPatronEntitlement` called (sticky closes if visible)
  - Manual: `!result.ok && localPatron=true` → returns `alreadyActive: true` with reason, `confirmPatronEntitlement` called
  - Manual: `!platformPatron && localPatron=true` → returns `mismatch:true`, `confirmPatronEntitlement` called
  - Manual: `platformPatron && localPatron=true` → `confirmPatronEntitlement` called (idempotent verify)
  - Boot: `platformPatron && localPatron=true` → no save mutation, `confirmPatronEntitlement` called

## Verification (unchanged total)

Manual QA добавляет explicit hang-simulation step:
- В DevStub mock `getPurchases()` returns `new Promise(() => {})` (never resolves) → boot waits 1.5s → ads return to default polling, optimistic cleared

## Phases (unchanged total ~28h)

R7 absorbs в Phase 4 (PaymentsService).

## Risks (R7 — closure status)

| Risk | Status |
|---|---|
| Refund/revocation = false-positive entitlement forever | **Accepted v0.3.60 product risk** (telemetry foundation; v0.3.61 spec) |
| Strict once-per-account not enforced | **Accepted v0.3.60 product risk** (player-facing «один раз» correct ≥99% flow) |
| Existing-patron sticky not closed on local-only branches | **Closed (R7 V1)** — confirmPatronEntitlement в каждой "remains patron" branch |
| SDK-hang allows infinite optimistic suppression | **Closed (R7 V2)** — explicit timeout fires processRestoreResult |
| Optimistic suppression infinite on SDK fail | **Closed (R6 W2)** — clear in non-ok branch |
| Existing-patron sticky not closed on boot | **Closed (R6 W1)** |
| Empty manual restore = generic error | **Closed (R6 W3)** |
| localStorage hint suppresses sticky | **Closed (R5 Z2)** |
| Late-restore async errors lost | **Closed (R5 Z4)** |
| TS type uninferred | **Closed (R5 Z1)** |
| Login retry infinite recursion | **Closed (R5 Z3)** |
| Local-vs-platform mismatch hidden | **Closed (R5 Z5)** |

## Open questions (v0.3.61+)

(unchanged)
