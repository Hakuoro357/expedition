# Patron IAP — Decision log R4

R4 reviewers: **qwen → NO SIGNIFICANT CONCERNS** (2 MIN polish, plan converging well) + **codex → CONCERNS REMAIN** (3 prior-not-closed + 4 new = 7).

R4+ rule: higher bar; push back on repeats, taste-only, doesn't reduce real risk.

## Accept (R4-level real risks)

**Z1 — TS type doesn't compile (codex new-M):**
`PurchasesResult extends { ok: false; reason: infer R } ? R : never` over concrete union resolves to `never`. Compile-time error.
**Accept** — replace with `Extract`:
```ts
type PurchaseFailureReason = Extract<PurchasesResult, { ok: false }>["reason"];
// → "timeout" | "error" | "unauthorized" | "unavailable"
```

**Z2 — Optimistic markPatron closes sticky irreversibly (codex new-M + qwen MIN):**
`markPatron()` calls `sdk.closeSticky()`. `unmarkPatron()` reverts cached flag но НЕ reopens sticky. Manipulator получает sticky-hide на session.
**Accept** — split:
```ts
class AdsService {
  /** Optimistic suppression — sticky НЕ закрывается. */
  setPatronOptimistic(): void { this.patronCached = true; }
  /** Revert optimistic (sticky still showing если был) — back to polling. */
  clearPatronOptimistic(): void { this.patronCached = undefined; }
  /** Confirmed entitlement — закрываем sticky if visible. */
  markPatronConfirmed(): void {
    this.patronCached = true;
    try { this.sdk.closeSticky(); } catch {}
  }
}
```
`restoreOnBoot` использует `setPatronOptimistic` для localStorage hint. `activatePatron` использует `markPatronConfirmed` (после SDK confirm).

**Z3 — Login retry infinite recursion (codex MIN + qwen MIN):**
Comment says "retry once" но код unbounded.
**Accept** — bounded retry с параметром:
```ts
private async handleRestoreClick(retried = false): Promise<void> {
  // ... existing
  if (result.reason === "unauthorized") {
    if (retried) {
      this.showToast(i18n.t("patronRestoreUnauthorized"));
      return;
    }
    const wantsLogin = await this.confirmDialog(i18n.t("patronUnauthorizedLogin"));
    if (!wantsLogin) return;
    await getAppContext().sdk.triggerLogin();
    return this.handleRestoreClick(true);  // retried=true, no more recursion
  }
  // ...
}
```

**Z4 — processRestoreResult не awaited (codex MIN):**
`this.activatePatron("restore")` внутри `processRestoreResult` не awaited. Analytics fires до persistence, errors unhandled.
**Accept** — make async + await через `pendingLateRestore` chain:
```ts
private async processRestoreResult(...): Promise<void> {
  // ... if platformPatron && !ctx.localPatron:
  await this.activatePatron("restore");
  // ...
}
// in restoreOnBoot:
this.pendingLateRestore = fetchPromise
  .then(result => this.processRestoreResult(result, ctx))
  .catch(err => console.error("[payments] late restore process failed", err));
```

**Z5 — Manual restore hides local-vs-platform mismatch (codex MIN):**
Local-true/platform-false возвращает `alreadyActive` → Settings показывает «Вы уже поддержали проект». Support/debug не может различить.
**Accept** — distinct return + neutral copy:
```ts
return { ok: true, alreadyActive: true, mismatch: true };
// Settings:
if (result.mismatch) this.showToast(i18n.t("patronRestoreDisputed"));
// «Покупка отмечена в этом save, но не подтверждена платформой»
```
Один новый i18n key: `patronRestoreDisputed`.

## Reject (R4-level)

**Z6-REJECT — Refund/revocation observability-only (codex prior-MAJOR, 4-й repeat):**
Codex repeats 4 раза подряд. Per CLAUDE.md R4+ rule «push back on repeated taste-only concerns that don't reduce real risk». **Final reject** as **accepted product risk**:
- v0.3.60 scope: SHIP observability. Revoke = future work с explicit UX spec
- Real-world risk: false-positive entitlement count after refund. Estimated impact: **<0.5% players** (refund rates на mobile IAP). Mitigation: telemetry в `patron_purchase_restore` events с `note: "local_only"`
- v0.3.61 will use v0.3.60 telemetry для decided revocation policy (grace? notification? auto-downgrade?)
- Документировано в plan-level «Open questions» + Risks table «accepted v0.3.60 risk»

**Z7-REJECT — Once-per-account vs once-per-save-state (codex prior-MAJOR, 3-й repeat):**
**Final reject**. My product decision (codified в R3 X12 + R4 Y5):
- Player-facing claim: «один раз» (true для normal single-device flow, который ≥99% игроков)
- Internal semantic: «once per save state, not strict account marker»
- Cross-device first-activation concurrent edge case: rare in practice, requires backend для real fix
- v0.3.61+: server-validated processed-purchase marker if telemetry shows real complaints

R4 plan уже документирует это явно. Codex's persistent flag — taste-level on scope, not new info.

## Net result

R4: 5 accepted + 2 rejected (repeated codex concerns). 

Going to R5 с surgical fixes. Expected:
- Qwen → NSC (was NSC в R4, не должен regress)
- Codex → может NSC если переберёт повторные claims, или CONCERNS REMAIN с 2 same-rejected

R7 ceiling — accept что повторно-rejected concerns останутся «known TODO», document в stalled artifact если no consensus.

## R5 changes

1. **Z1**: TS type fix — `Extract<>` pattern
2. **Z2**: AdsService split — `setPatronOptimistic` / `clearPatronOptimistic` / `markPatronConfirmed`. PaymentsService uses `setPatronOptimistic` для localStorage hint, `markPatronConfirmed` для activatePatron. closeSticky только after SDK confirm
3. **Z3**: Bounded retry в handleRestoreClick (retried param)
4. **Z4**: processRestoreResult async с .catch chain
5. **Z5**: Manual restore returns mismatch flag; new i18n key `patronRestoreDisputed`
6. **Z6/Z7**: explicit «accepted v0.3.60 product risk» в Risks table с rationale
