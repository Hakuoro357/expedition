# Patron IAP — Decision log R2

R2 reviewers: **codex** (6 prior-not-closed-MAJOR + 1 prior-MIN + 3 new-MAJOR + 4 new-MIN) + **qwen** (3 MAJOR + 5 MINOR — все 15 R1 concerns закрыты).
Default accept (R2 ≤ R3), reject только если ошибочно.

## Highest impact (both reviewers flag — fix immediately)

**X1 — GP `purchases` field semantics — catalog vs purchase-history (codex new-M + qwen M5):**
Оба reviewer'а указали что `gp.payments.purchases` после `fetchProducts()` может быть **catalog** всех products, не purchase-history игрока. План мапит `purchases.map(p => ({tag}))` что вернёт `{patron_support}` всем — restore сработает для **каждого** игрока. Это потенциально critical bug.
**Accept** — переписать GP adapter единообразно через `gp.payments.has(tag)` как единственный источник entitlement. `purchases` (или `products`) использовать только для catalog/price display.

**X2 — `closeSticky` отсутствует в SdkService interface (qwen M1):**
`AdsService.markPatron()` вызывает `sdk.closeSticky?.()` через optional chaining — runtime safe, но contract неполный. Если новый adapter забудет — sticky висит навсегда.
**Accept** — добавить `closeSticky?(): void` в SdkService interface.

## CRITICAL/MAJOR new (R2 surfaced)

**X3 — SDK factory race с async-loaded external scripts (codex new-M):**
`window.__gp`/`YaGames` могут ещё не быть установлены при `BootScene.create()` — production silently уйдёт в DevStub.
**Accept** — bounded `waitForGamePush(2000ms)` / `waitForYaGames(2000ms)` перед fallback. ИЛИ build-time flag `__PLATFORM__` через vite define как primary signal. Я выбираю **build flag** — он надёжнее URL-detection и не зависит от script-load timing.

**X4 — Narrative entries files — strategy contradiction (qwen M2):**
Table говорит modify es/pt/de/fr, narrative section говорит fallback. **Accept option A (qwen recommended)** — только ru/global/tr. Fallback в `getNarrativeEntry` через global. Verification step: read getNarrativeEntry resolver to confirm fallback exists. Если нет — extend resolver, не файлы.

**X5 — Speaker `author` в 3 локалях vs archive insert требует non-null (codex new-M):**
Если speaker resolver не fallback'ит на global для es/pt/de/fr — entry скрывается. **Accept** — speaker `resolveProfilePack` уже dispatches: ru→ru, tr→tr, остальное→global. Добавление `author` в `ru/global/tr` покрывает все 7 локалей. Документировать явно в plan'е (с code-citation).

**X6 — completedNodes composition unverified (codex prior-M + qwen M3):**
Я отметил «по recon agents — да, only wins», но не задокументировал явно с code-pointer. **Accept** — added explicit code-reading step: verify `completedNodes` mutation site (RewardScene continue-handler) и document assumption. Если включает narrative-only — switch на отдельный `winsCount`.

## Codex prior-not-closed concerns

**X7 — restoreOnBoot skip when local-true → no refund/revocation detection (codex prior-M):**
В R2 я ответил «out-of-scope v0.3.61». Codex настаивает.
**Accept частично** — добавить **background re-check observability** (не revoke): на boot если patron-true локально, всё равно вызвать `getPurchases()` async, log mismatch если platform НЕ confirm. Telemetry для будущей решения о revocation. Не downgrade access в v0.3.60.

**X8 — Fire-and-forget allows 1-2 ad impressions to patron (codex prior-M):**
Codex настаивает что contradiction с «paid ad-free». **Accept** — компромисс через **localStorage-gated pre-restore**:
- Если `localStorage.getItem("isPatron") === "true"` → AdsService.markPatron() сразу на boot до SDK confirm. Patron remembers через хранение.
- Если empty/false → 1.5s bounded await на `getPurchases()` ПЕРЕД preloader. Если SDK respond — gate properly. Если timeout — fire-and-forget continues, ads показываются (rare на slow connections).

**X9 — Yandex auth/login path не спроектирован (codex prior-M):**
В R2 `unauthorized` reason detected но UI flow нет. **Accept** — добавить `sdk.triggerLogin?()` в interface. Yandex adapter wraps `ysdk.auth.openAuthDialog()`. Restore button при `unauthorized` показывает «Войдите чтобы восстановить» с triggerLogin.

**X10 — Yandex setup не указывает games-partners@yandex-team.ru (codex prior-M):**
**Accept** — добавить в runbook explicit step «Отправить запрос на games-partners@yandex-team.ru с просьбой включить платежи в проекте».

**X11 — save.flush reject leaves session inconsistent (codex prior-M):**
Если flush fails ПОСЛЕ платформенной покупки, текущая сессия не получает markPatron / reconcile / listeners / analytics. **Accept** — split: local activation сначала (immediate), потом async cloud sync с retry. Если flush fails — save state в memory уже мутирован, next-page-reload восстановит.

**X12 — patronBonusGranted concurrent-save edge case (codex prior-M):**
В реальности почти невозможно (purchase = user interaction). **Accept formulation fix** — переименовать в plan «once-per-save-state, не строгий account marker». Strict account marker требует backend, out-of-scope.

**X13 — analytics timing inconsistency (codex prior-m + qwen m3):**
`patron_purchase_open` фиресится в `purchasePatron()` early-return AND на dialog mount — два разных события одним именем. **Accept** — переименовать early-return случай в `patron_purchase_blocked` с `reason: "not_eligible"`. `_open` остаётся только на dialog mount.

## Codex new concerns

**X14 — openPatronPush flush no await (codex new-m):**
**Accept** — `await save.flush()` в openPatronPush. Если reject — patronPushShown остался в memory, на refresh плашка может повториться (acceptable tradeoff: rare network fail).

**X15 — getPatronPrice no error handling (codex new-m):**
**Accept** — try/catch внутри service, return null. Dialog обрабатывает null gracefully.

**X16 — double tracking patron_purchase_open (codex new-m):**
**Accept** — `openPatronPush()` НЕ tracks open (только sets flag). Dialog mount tracks open. Single owner.

**X17 — completedNodes before/after scalar capture (codex new-m):**
**Accept** — `const beforeCount = save.load().progress.completedNodes.length;` до mutation, чтобы не зависеть от potential mutation/aliasing.

**X18 — Yandex env types incomplete (codex new-m):**
**Accept** — расширить shapes (`purchaseToken`, `imageURI` etc) — не блокирует MVP но уменьшает type drift.

## Qwen MINOR

**X19 — restorePatronManual no in-flight lock (qwen m1):**
**Accept** — переиспользую `inFlight` boolean (covers и purchase и restore). Или отдельный `restoring`.

**X20 — fetchProducts called repeatedly (qwen m2):**
**Accept** — cache result после первого fetch (forever-cached, products не меняются runtime).

**X21 — DetailScene authorThanksEntry underspecified (qwen m4):**
**Accept** — добавить implementation note: «reuse entry-body renderer, skip getNodeByEntryId, back-button → returnTo, portrait initials-fallback».

## Net result

22 accepted, 0 rejected.

Major shifts vs R2:
1. GP entitlement через `has(tag)` единообразно (X1)
2. SDK factory через **build-time flag** не runtime detection (X3)
3. Local activation первой, async flush с retry (X11)
4. LocalStorage pre-restore ad-gate (X8)
5. Background refund-observation на boot (X7)
6. `closeSticky` + `triggerLogin` в interface (X2, X9)
7. Locale strategy locked: 3 entries-files + fallback (X4, X5)
8. Analytics events renamed (X13)
9. fetchProducts cached (X20)
10. inFlight unified lock (X19)

R3 draft содержит эти изменения. Expecting convergence — большинство R2 concerns были «closing the loop» и «edge case formulation», не fundamental.
