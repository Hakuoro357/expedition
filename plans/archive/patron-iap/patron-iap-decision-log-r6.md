# Patron IAP — Decision log R6

R6 reviewers: **qwen → NO SIGNIFICANT CONCERNS** (3-й раз подряд) + **codex → CONCERNS REMAIN** (2 prior-not-closed-MAJOR + 1 alternative).

Все codex's concerns — clean technical risks, не taste. Accept both + adopt alternative D (centralization).

## Accept (3 fixes for R7)

**V1 — `markPatronConfirmed` не вызывается во всех "remains patron" branches (codex prior-MAJOR):**
В R6 `markPatronConfirmed()` called только в `platformPatron && localPatron` (boot+manual). НЕ called в:
- `!platformPatron && localPatron` (mismatch — local-only, no-revoke policy)
- `!result.ok && localPatron` (transient SDK fail — preserve local entitlement)

Если existing patron начал session с visible sticky banner (`AdsService.showStickyBanner` ran before restore returns), И SDK errors / says not-patron → sticky stays visible. Ad-free guarantee violated.

**Accept** — централизованный helper `confirmPatronEntitlement(origin)` который зовётся в **каждой** branch где decision = «user remains/becomes patron»:
```ts
private confirmPatronEntitlement(origin: "purchase" | "restore" | "preserved"): void {
  // Idempotent. Safe to call multiple times.
  this.ads.markPatronConfirmed();
  if (origin === "purchase") {
    this.achievements.markPatronJustActivated();
  }
  // achievements.reconcile() уже вызывается отдельно
}
```

Call sites:
- `activatePatron` (replaces inline `ads.markPatronConfirmed` + `markPatronJustActivated` logic)
- `restorePatronManual` — `platformPatron && localPatron` branch
- `restorePatronManual` — `!platformPatron && localPatron` (mismatch — preserved)
- `processRestoreResult` — `platformPatron && localPatron` branch
- `processRestoreResult` — `!platformPatron && localPatron` (local-only preserved)
- `processRestoreResult` — non-ok branch когда `localPatron === true` (transient — preserve)

**V2 — hung `getPurchases()` не покрыт W2 (codex prior-MAJOR):**
`processRestoreResult` fires в `.then()` chain. Если `getPurchases()` never resolves — chain never runs, optimistic suppression навсегда.

**Accept** — explicit timeout → `processRestoreResult` firing:
```ts
async restoreOnBoot(): Promise<void> {
  // ... existing local hint setup

  let processed = false;
  const processOnce = (result: PurchasesResult): void => {
    if (processed) return;
    processed = true;
    this.processRestoreResult(result, { localHint, localPatron, source: "boot" })
      .catch(err => console.error("[payments] processRestoreResult threw", err));
  };

  // Late-resolution path
  this.sdk.getPurchases()
    .then(processOnce)
    .catch(err => {
      console.warn("[payments] getPurchases threw", err);
      processOnce({ ok: false, reason: "error" });
    });

  // Hung-resolution fallback — guaranteed to fire after timeout
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      processOnce({ ok: false, reason: "timeout" });
      resolve();
    }, RESTORE_BOOT_TIMEOUT_MS);
  });
}
```

Now processRestoreResult **always** fires в пределах 1.5s либо on SDK resolve, либо on timeout. W2 (clear optimistic on non-ok + !localPatron) reliably triggers.

**V3 — Adopt Alternative D (centralize entitlement finalization):**
Codex's суggestion — already covered by V1. Single helper `confirmPatronEntitlement` keeps invariant «ads + achievements + analytics synced» в одном месте.

## Net result

R6: 3 accepted, 0 rejected.

R7 — **hard ceiling**. Если codex всё ещё CONCERNS REMAIN → stalled, document open concerns in final artifact.

Expected R7:
- Qwen → NSC (no regression, V1-V3 surgical fixes consistent с R5/R6 architecture)
- Codex → NSC (V1 closes prior-MAJOR on local-only branches; V2 closes hang concern; V3 centralizes per their suggestion)

## R7 changes

1. **V1**: `confirmPatronEntitlement(origin)` helper — single place для ad-confirm + ach-trigger. Called from ALL "remains patron" branches across activatePatron / restorePatronManual / processRestoreResult
2. **V2**: explicit timeout-fires-processRestoreResult — eliminates SDK hang gap
3. **V3**: centralization through V1's helper (codex's Alternative D)
