# Patron IAP — Decision log R1

R1 reviewers: **codex** (4 CRIT + 18 MAJOR + 6 MIN) + **qwen** (1 CRIT + 6 MAJOR + 8 MIN).
~35 unique concerns после dedup. Default accept (R1 ≤ R3 rule), reject только если ошибочно.

## CRITICAL

**C1 — GP payments API names (codex):** `fetchPlayerPayments`/`getPlayerPayments` нет в GP typed docs. Правильно: `fetchProducts()`, `purchases`, `has()`, `purchase()`. **Accept** — переписываю GP-адаптер по реальному API.

**C2 — Yandex `signed:true` shape (codex):** возвращает `{signature}`, не `{productID}[]`. **Accept** — переключаюсь на `signed:false` (client-only entitlement). MINOR от qwen про validation покрыт.

**C3 — BootScene SDK factory (codex):** сейчас всегда `new GamePushSdkService()`, нет Yandex/Dev ветки. **Accept** — добавляю `createSdkService()` factory с runtime detection (URL params / vite env / userAgent).

**C4 — `save.updateProgress` contract (codex):** требует `return newState`, не mutate. **Accept** — переписываю все примеры в плане.

**C5 — GP purchase Promise vs event (qwen):** unverified. **Accept** — добавляю verification step + fallback wrapper. Если event-based — singleton listener pattern (как `gp.socials.share`, см. gp-013 в plan-mistakes).

## MAJOR

**M1 — in-flight purchase lock (qwen+codex):** двойной клик → дубль-purchase. **Accept** — `purchasing` field в PaymentsService.

**M2 — sticky banner мид-session (qwen+codex):** активный sticky остаётся после patron activate. **Accept** — `ads.hideStickyBanner()` в `activatePatron()`.

**M3 — Reconciler not next-tick (codex):** срабатывает на bootstrap/explicit reconcile, не на mutation. **Accept** — явный `achievements.reconcile()` после activatePatron (плюс delay 1.5s для разнесения toast'ов).

**M4 — rewarded UI gate logic (codex):** `!canUsePayments || !patronSupport` показывает кнопку patron'у на платформах без payments. **Accept** — `!progress.patronSupport`. Qwen MINOR про "redundant clause" покрыт.

**M5 — `canUsePayments` недостаточно для Crazy/Poki (codex):** namespace может быть, но IAP заблокирован. **Accept** — `gp.payments.isAvailable` + catalog check.

**M6 — Cross-device +300 coin guarantees (codex+qwen):** purchase-only flag создаёт edge cases (refund / cross-device first-activation / pre-flush crash). **Accept** — ввожу `patronBonusGranted?: boolean`. Кредит при первой активации (purchase OR restore), idempotent. Refund detection — out-of-scope (v0.3.61).

**M7 — restoreOnBoot блокирует boot 5s (qwen) / показывает ads patron'у (codex):** trade-off. **Accept (qwen вариант B)** — fire-and-forget без await + fast-path через `localStorage.getItem('isPatron')`. Boot не блокируется. На первом cross-device запуске возможен 1 ad impression (≤ 5s окно). Документировано как acceptable.

**M8 — DiaryScene.openEntryDetail node-less entry (codex):** клик не откроет detail. **Accept** — special-case в `DiaryScene` для `entryId==="author_thanks"` → отдельный detail overlay path без node lookup.

**M9 — modal cleanup / ghost-click (codex):** новые dialog'и могут пробивать клики через canvas. **Accept** — используется существующий pattern `createCanvasAnchoredOverlay` + `lockClicksFor(350)`.

**M10 — Post-win-push trigger semantics (codex):** в MapScene.create() сработает у старых игроков на обычном boot. **Accept** — переношу trigger в **RewardScene `continue`-handler** при `wins===3 && !patronPushShown`. MapScene получает push через `scene.start(MapScene, { showPatronPush: true })`.

**M11 — Eligibility vs impression flag (codex):** `patronPushShown=true` ставится ДО показа. **Accept** — флаг ставится на impression (после `requestAnimationFrame` от dialog mount), не на eligibility.

**M12 — Save validation (codex):** `isValidSaveState` не проверяет новые поля. **Accept** — optional boolean validation + defaults в `createInitialProgressState`.

**M13 — `env.d.ts` types (codex):** нет `gp.payments`/Yandex Payments — TS build упадёт. **Accept** — добавляю в SDK foundation phase.

**M14 — product type non-consumable (codex):** GP/Yandex консумируемые товары теряют entitlement. **Accept** — документирую non-consumable + acceptance step в runbook.

**M15 — Yandex prereqs неполные (codex):** договор/games-partners review/login. **Accept** — добавляю в `docs/specs/2026-05-16-patron-iap-setup.md`.

**M16 — Yandex login/auth для getPurchases (codex):** unauthorized → reject. **Accept** — SdkService различает `unavailable`/`unauthorized`, UI предлагает login path для restore.

**M17 — Restore button explicit (codex):** boot restore с timeout/login недостаточен. **Accept** — кнопка «Восстановить покупку» в Settings dialog (видна если payments available, независимо от patron status).

**M18 — Double toast (qwen):** thank-you toast + achievement toast в ~100ms. **Accept** — delay achievement toast 1.8s после purchase origin (вариант (a) в qwen — flag в reconciler/listener).

**M19 — Error code discrimination unverified (qwen):** error shapes неизвестны. **Accept** — initial impl логирует raw error в console + TODO для sandbox refinement.

**M20 — Reactive AdsService (qwen alternative A):** **Accept частично** — AdsService получает `markPatron()` method (вызывается из activatePatron), hides sticky + sets internal flag. Polling save в gate-методах остаётся как fallback.

## MINOR

**m1 — "Не показывать снова" = "Не сейчас" (qwen):** **Accept** — убираю вторую кнопку. Флаг `patronPushShown` уже предотвращает повторный показ.

**m2 — i18n count 14→15 (qwen):** **Accept** — scope обновлён.

**m3 — analytics 5→6 (qwen+codex):** **Accept** — scope обновлён.

**m4 — locale count 7 vs 8 (qwen):** **Accept** — clarify: `global` это EN-fallback alias, не отдельная локаль. 7 unique locales (ru/en/tr/es/pt/de/fr) + global file как EN-default container.

**m5 — completedNodes mixed (qwen):** **Accept** — verify в коде что это win-nodes (по recon agents — да, completedNodes only includes wins). Документирую assumption.

**m6 — withTimeout typed result (qwen+codex):** **Accept** — discriminated union `{ ok: true; purchases } | { ok: false; reason: "timeout" | "error" }`.

**m7 — patron.png as lock placeholder (codex):** **Accept** — использую brass-star или другой простой positive glyph, не lock. Можно сделать SVG inline или копию любой существующей не-lock иконки (например, `first_win.png`).

**m8 — `entries.en.ts` не существует (codex):** **Accept** — file pattern: `entries.{ru,global,tr,es,pt,de,fr}.ts` (без en — он покрыт `global`).

**m9 — `patron_purchase_open` место (codex):** **Accept** — `open` трекать на dialog mount (не в purchasePatron); `attempt` — на click "Поддержать".

**m10 — price display from catalog (codex):** **Accept** — `sdk.getProductInfo(tag)` → native price string в confirm button. Регионы/валюты — платформа.

## REJECT (с rationale)

**R-codex-MAJOR-rewarded-economy:** «Patron теряет doubled rewards после 6 просмотров». **Reject** — user explicit decision in plan-mode interview (locked answer to question 2 — «Скрыть тоже»). Компенсация +300 coins документирована как одноразовая, не «6 rewarded views replacement». UX rationale: patron-experience должен быть полностью без рекламы, иначе фрейминг «реклама исчезает полностью» подрывается.

## Net result

35 accepted, 1 rejected (user-locked decision).

R2 draft содержит major rewrite: SDK factory, env.d.ts types, GP API названия по typed docs, Yandex signed:false, save.updateProgress contract fix, in-flight lock, sticky hide on activate, manual reconcile call, +300 coin idempotency через `patronBonusGranted`, fire-and-forget restore, RewardScene-triggered push, modal cleanup pattern, restore button, double-toast delay, env.d.ts shapes, product-type doc, runbook expansion.
