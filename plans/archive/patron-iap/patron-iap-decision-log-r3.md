# Patron IAP — Decision log R3

R3 reviewers: **codex** (4 prior-not-closed-MAJOR + 3 new-MAJOR + 2 new-MIN) + **qwen** (1 MAJOR + 4 MINOR — все 8 R2 concerns закрыты, "converging well").

R3 — last default-accept round. R4+ — стрictly focus on real risks.

## Overlap (both reviewers flagged)

**Y1 — Late restore success discarded (qwen MAJOR + codex prior-MAJOR):**
`Promise.race` returns при timeout, late `fetchPromise.then` discarded → patron на slow connection (2-3s SDK) никогда не auto-restoring. Reactivates каждый boot.
**Accept** — chain `.then(processLateResult)` после race; idempotent activatePatron handles late call безопасно. Patron видит ads 0-1.5s, потом markPatron от late-resolution.

**Y2 — Build scripts POSIX-only (codex new + qwen):**
`"PLATFORM=X npm run build"` ломается на Windows cmd. **Accept** — use `cross-env`, dev-dep.

## Codex MAJOR (unique)

**Y3 — localStorage isPatron too trusted (codex new):**
Любой user может set localStorage→ session ad-free. Если platform NOT confirm — не undo optimistic.
**Accept** — переосмыслить localStorage как **ad-delay hint только**, не entitlement:
- На boot если `localHint=true` — `ads.markPatron()` СРАЗУ (zero-delay ad-suppression)
- Background SDK check 1.5s
- Если SDK confirms → activatePatron() persists в save (truth)
- Если SDK NOT confirm (timeout/error) → revert `ads.patronCached=undefined` через ads.unmarkPatron() метод. Ads return to default poll-from-save. Save.patronSupport остаётся false.
- Если SDK confirms NOT-patron (proven refund) → clear localStorage + revert ad-cache. Не downgrade save (v0.3.60 не revoke).

**Y4 — Yandex login flow underspecified for restorePatronManual (codex prior-MAJOR):**
`triggerLogin()` defined, но restore handler не invoke'ит.
**Accept** — concrete UI flow:
```
restorePatronManual() → { reason: "unauthorized" }
  → SettingsScene shows toast «Войдите чтобы восстановить»
  → Login button → await sdk.triggerLogin()
  → on resolve → retry restorePatronManual()
  → success/failure → standard handling
```

**Y5 — "once-per-account" vs "once-per-save-state" semantics (codex prior-MAJOR):**
**Accept formulation** — внутри кода и plan'а единообразно «one-time per save state». Player-facing text не претендует «once-per-account». В коде комментарии:
```ts
// patronBonusGranted: once per save state. Cross-device first-activation
// concurrency edge case: last-write-wins on flush may merge away one device's
// +300. Strict once-per-account requires server-validated processed-purchase
// marker — out-of-scope v0.3.60. UI claims «один раз», без «per account».
```

**Y6 — Production URL override bypass (codex new):**
`?platform=dev` в production может switch на DevStub.
**Accept** — gate URL override на `import.meta.env.DEV` ONLY:
```ts
const forced = import.meta.env.DEV ? params.get("platform") : null;
```

## Reject (codex prior-MAJOR)

**Y7-REJECT — Refund/revocation log-only (codex prior-prior-MAJOR):**
Codex настаивает 3-й раз. **Reject** с уточнением:
1. Revocation в v0.3.60 требует careful UX (player paid → suddenly ads return = hostile experience). Это отдельный feature spec с notification, retry logic, edge cases.
2. v0.3.60 ships **observability foundation**: `patron_purchase_restore` analytics event с `note: "local_only"` flag. Все mismatch'и логируются и трекаются.
3. v0.3.61 plan: decided revocation policy (grace period? notification? auto-downgrade?) на основе production telemetry от v0.3.60.

Rationale: shipping observability-without-action в v0.3.60 — minimum-viable approach. Codex's концерн is valid for v0.3.61 scope, не блокирует v0.3.60.

## Codex new MAJOR + MINOR

**Y8 — Manual restore should always platform-verify (codex new MIN):**
**Accept** — manual restore НЕ early-return на `patronSupport=true` (мой R3 поведение). Всегда fetch SDK, log mismatch если platform NOT confirm локальный true. Не downgrade. (Aligns с background re-check pattern X7 from R2.)

**Y9 — closeSticky/triggerLogin optional in interface (codex new MIN):**
**Accept** — сделать required с **no-op default** в Yandex/DevStub. Lever the typesystem чтобы новые adapters не забыли.

## Qwen MINOR (полишные)

**Y10 — Optimistic markPatron не sets patronSupport (qwen MIN):**
Player может open Settings в gap, увидеть «Поддержать», click — purchase flow trip. Это становится automatic-OK после Y3 fix: optimistic влияет на `ads.patronCached` только, `progress.patronSupport` остаётся false до SDK confirm. UI button читает progress → корректно показывает «Поддержать» до SDK confirm. После SDK confirm progress flag flip-flop → UI re-render.
**Accept** — поведение задокументировано в Y3.

**Y11 — patron_purchase_open ownership clarification (qwen MIN):**
**Accept** — добавить explicit note: «`mountPatronDialog()` fires `patron_purchase_open` internally with source passed as arg — single ownership point».

**Y12 — markPatronJustActivated spammy on restore (qwen MIN):**
На каждом boot где cloud confirms patron но local lost — toast «Достижение Меценат» спамится.
**Accept** — gate на `origin === "purchase"`:
```ts
if (origin === "purchase") {
  this.achievements.markPatronJustActivated();
}
this.achievements.reconcile(this.save.load().progress);  // silent reconcile
```

## Net result

R3: 10 accepted, 1 rejected (refund persistent).

R4 should be near-consensus. Major shifts vs R3:
1. **Y1: Late-restore chain** — `.then()` after timeout (idempotent activate)
2. **Y2: cross-env** в build scripts
3. **Y3: localStorage = ad-delay hint только**, не entitlement; ads.unmarkPatron() метод
4. **Y4: Yandex login UI flow** explicitly в restore path
5. **Y5: "once per save state"** formulation everywhere
6. **Y6: URL override gated на import.meta.env.DEV**
7. **Y7-REJECT: refund observability only** — explicit v0.3.61 scope
8. **Y8: manual restore always verifies platform**
9. **Y9: closeSticky/triggerLogin required + no-op defaults**
10. **Y11: mountPatronDialog owns open event**
11. **Y12: achievement toast только на purchase, не restore**

Expected at R4: qwen → NO SIGNIFICANT CONCERNS (converging well at R3); codex может ещё пара minor.
