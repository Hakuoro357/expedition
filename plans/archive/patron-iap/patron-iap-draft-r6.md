# Patron IAP — «Поддержать автора + ad-free» (v0.3.60) — draft-r6

## R5 → R6 summary

Reviewed codex + qwen. **R5 status:** qwen → NSC (2-й раз подряд); codex → CONCERNS REMAIN с 3 clean technical concerns (dropped repeats Z6/Z7 — accepted as v0.3.60 product risks).

**R6 surgical fixes (3 accepts, 0 rejects):**
1. **W1: existing-patron sticky-close on boot** — `processRestoreResult` в `platformPatron && localPatron` branch теперь зовёт `markPatronConfirmed()` (idempotent)
2. **W2: clear optimistic on SDK fail** — non-ok branch clears `localStorage.PATRON_LOCAL_KEY` + `ads.clearPatronOptimistic()` если `localHint && !localPatron`. Manipulator gets ≤ 1.5s ad-free, не infinite
3. **W3: distinct `not_found` reason** — legitimate empty manual restore returns `reason: "not_found"` (не `"error"`), отдельный toast `patronRestoreNotFound`

## Architecture — diff vs R5

### Layer 2 — PaymentsService

```ts
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

    if (!platformPatron && localPatron) {
      console.warn("[payments] manual restore: platform NOT patron, local says yes");
      this.analytics.track("patron_purchase_restore", { found: false, source: "manual", note: "local_only" });
      return { ok: true, alreadyActive: true, mismatch: true };
    }
    if (platformPatron && !localPatron) {
      await this.activatePatron("restore");
      this.analytics.track("patron_purchase_restore", { found: true, source: "manual" });
      return { ok: true, alreadyActive: false };
    }
    if (platformPatron && localPatron) {
      // W1: idempotent ad confirmation even when no save mutation needed
      this.ads.markPatronConfirmed();
      return { ok: true, alreadyActive: true };
    }
    // W3: !platformPatron && !localPatron — legitimate empty, NOT error
    this.analytics.track("patron_purchase_restore", { found: false, source: "manual" });
    return { ok: false, alreadyActive: false, reason: "not_found" };
  } finally {
    this.inFlight = false;
  }
}

private async processRestoreResult(
  result: PurchasesResult,
  ctx: { localHint: boolean; localPatron: boolean; source: "boot" | "manual" },
): Promise<void> {
  if (!result.ok) {
    this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: ctx.source });
    // W2: clear optimistic suppression if SDK failed AND local didn't confirm patron.
    // Real patrons (localPatron=true) NOT affected (no-revoke policy intact).
    if (ctx.localHint && !ctx.localPatron) {
      console.info("[payments] SDK failed, local hint unverified — clearing optimistic suppression");
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
    console.warn("[payments] platform NOT patron, local says yes — possible refund (observability only)");
    this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "local_only" });
    return;
  }
  if (!platformPatron && ctx.localHint && !ctx.localPatron) {
    console.info("[payments] local hint disproven by SDK — clearing optimistic suppression");
    try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch {}
    this.ads.clearPatronOptimistic();
    this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "hint_disproven" });
    return;
  }
  if (platformPatron && ctx.localPatron) {
    // W1: confirm to ads layer — closes sticky if showing.
    this.ads.markPatronConfirmed();
    return;
  }
}
```

### Layer 2 — type update (W3)

```ts
export type RestoreManualResult =
  | { ok: true; alreadyActive: boolean; mismatch?: boolean }
  | { ok: false; alreadyActive: false; reason: PurchaseFailureReason | "not_found" };
```

### Layer 8 — Settings UI (W3)

```ts
// SettingsScene.handleRestoreClick — добавить branch для not_found
private async handleRestoreClick(retried = false): Promise<void> {
  // ... existing branches
  if (result.reason === "not_found") {
    this.showToast(i18n.t("patronRestoreNotFound"));  // «Покупка не найдена»
    return;
  }
  // ... остальные
}
```

### Layer 12 — i18n (W3 +1 key)

Adds `patronRestoreNotFound`. **Total: 21 keys × 7 locales = 147 strings** (R5: 20 × 7 = 140).

## File-level changes (diff vs R5)

| Path | R6 change |
|---|---|
| `src/services/payments/PaymentsService.ts` | restorePatronManual: not_found branch + markPatronConfirmed в both-agree; processRestoreResult: clear optimistic в non-ok if hint && !localPatron + markPatronConfirmed в both-agree |
| `src/scenes/SettingsScene.ts` | handleRestoreClick handles `reason === "not_found"` |
| `src/services/i18n/locales.ts` | + `patronRestoreNotFound` × 7 locales |

## Tests (diff vs R5)

Adds:
- `PaymentsService.test.ts` — manual restore empty (platform=false, local=false) returns `{ok:false, reason:"not_found"}`, analytics `found:false` без error reason
- `PaymentsService.lateRestore.test.ts` — SDK error + localHint=true + localPatron=false → optimistic cache cleared, `localStorage.PATRON_LOCAL_KEY` removed
- `PaymentsService.test.ts` — boot restore both-confirm (platform=true + local=true) calls `markPatronConfirmed()` (verify via spy)
- `SettingsScene.restoreFlow.test.ts` — `not_found` reason → distinct toast key

## Verification (unchanged from R5)

## Phases (unchanged total ~28h)

## Risks (R6 — closure status)

| Risk | Status |
|---|---|
| Refund/revocation false-positive entitlement forever | **Accepted v0.3.60 product risk** (telemetry foundation in plan; v0.3.61 spec) |
| Strict once-per-account not enforced | **Accepted v0.3.60 product risk** (player-facing «один раз» correct for ≥99% flow; backend marker v0.3.61) |
| Existing-patron sticky not closed on boot | **Closed (R6 W1)** |
| Optimistic suppression infinite on SDK fail | **Closed (R6 W2)** — manipulator gets ≤ 1.5s |
| Empty manual restore = generic error | **Closed (R6 W3)** |
| localStorage hint suppresses sticky | **Closed (R5 Z2)** |
| Late-restore async errors lost | **Closed (R5 Z4)** |
| TS type uninferred | **Closed (R5 Z1)** |
| Login retry infinite recursion | **Closed (R5 Z3)** |
| Local-vs-platform mismatch hidden | **Closed (R5 Z5)** |

## Open questions (v0.3.61+)

(unchanged from R5)
