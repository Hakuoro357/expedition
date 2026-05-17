# Patron IAP — Decision log R5

R5 reviewers: **qwen → NO SIGNIFICANT CONCERNS** (2-й раз подряд) + **codex → CONCERNS REMAIN** (но reject'нул свои repeats — «would not keep repeating Z6/Z7 as blockers for v0.3.60»).

Codex остаточные: 1 prior-not-closed-MAJOR + 1 new-MAJOR + 1 new-MIN. Все чистые technical concerns — **accept all 3**.

## Accept (3 concerns, all real bugs)

**W1 — Existing patrons may not close sticky on boot (codex new-MAJOR):**
В `processRestoreResult`, branch `platformPatron && ctx.localPatron` — no-op. `markPatronConfirmed` вызывается только из `activatePatron`, который only when `!localPatron`. → Existing patron на boot НЕ получает `closeSticky()`, если sticky был отрендерен между init и restore-result.
**Accept** — в no-op branch добавить `this.ads.markPatronConfirmed()`:
```ts
if (platformPatron && ctx.localPatron) {
  // Both agree, no save mutation needed, BUT confirm to ads layer.
  this.ads.markPatronConfirmed();  // idempotent — closes sticky if visible
  return;
}
```

**W2 — Optimistic hint suppresses ads indefinitely on SDK error/hang (codex prior-MAJOR):**
`setPatronOptimistic` устанавливает `patronCached=true`. Если `getPurchases()` returns error/unauthorized/unavailable/timeout И `localPatron=false`, `processRestoreResult` не clear'ит optimistic. Manipulated `PATRON_LOCAL_KEY=true` + SDK fail → indefinite ads-off в session, **and every boot**.
**Accept** — clear optimistic в non-ok branch when `localPatron=false`:
```ts
private async processRestoreResult(result, ctx): Promise<void> {
  if (!result.ok) {
    this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: ctx.source });
    // W2: clear optimistic если local НЕ confirms — manipulator gets ≤ RESTORE_BOOT_TIMEOUT_MS ad-free, not infinite
    if (!ctx.localPatron && ctx.localHint) {
      console.info("[payments] SDK failed, local hint unverified — clearing optimistic suppression");
      try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch {}
      this.ads.clearPatronOptimistic();
    }
    return;
  }
  // ... rest
}
```
Trade-off documented: real patrons with offline boot → 1.5s ad-suppression cleared, ads visible until next boot or manual restore. Acceptable (rare offline scenario).

**W3 — "Nothing to restore" reported as generic error (codex new-MIN):**
Manual restore platform=false + local=false returns `{ok:false, reason:"error"}`. Это legitimate «no purchase exists», но шлёт `patron_purchase_error`-like analytics + показывает «error» toast.
**Accept** — add distinct reason `not_found`:
```ts
// In SdkService types:
type PurchasesResult = { ok: true; purchases } | { ok: false; reason: "timeout" | "error" | "unauthorized" | "unavailable" };
// note: 'not_found' НЕ добавляется в PurchasesResult — это PaymentsService-level concept.

// In restorePatronManual final branch:
if (!platformPatron && !localPatron) {
  this.analytics.track("patron_purchase_restore", { found: false, source: "manual" });
  return { ok: false, alreadyActive: false, reason: "not_found" };
}
```

Update `RestoreManualResult` type:
```ts
export type RestoreManualResult =
  | { ok: true; alreadyActive: boolean; mismatch?: boolean }
  | { ok: false; alreadyActive: false; reason: PurchaseFailureReason | "not_found" };
```

`SettingsScene.handleRestoreClick` — distinct toast:
```ts
if (result.reason === "not_found") {
  this.showToast(i18n.t("patronRestoreNotFound"));  // «Покупка не найдена»
  return;
}
```

New i18n key: `patronRestoreNotFound`. **Total: 21 keys × 7 locales = 147 strings**.

## Net result

R5: 3 accepted, 0 rejected.

R6 draft содержит 3 surgical fixes. Expected R6:
- Qwen → NSC (no regression)
- Codex → NSC (concerns были чёткие technical, не taste)

Если consensus в R6 → finalize. Если нет — R7 ceiling.

## R6 changes (concise)

1. **W1**: `processRestoreResult` — `markPatronConfirmed()` в `platformPatron && localPatron` branch
2. **W2**: `processRestoreResult` — clear optimistic в non-ok branch when `localHint && !localPatron`
3. **W3**: `restorePatronManual` returns `reason: "not_found"` для legitimate empty case + new i18n key + Settings toast
