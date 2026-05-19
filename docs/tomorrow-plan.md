# План на следующий рабочий день

После v0.3.60→v0.3.61 (2026-05-19). Сегодня закатили **patron IAP** —
полный pipeline от плана до production-ready ZIP. Plan через codex+qwen
review-loop (R1-R7, до hard ceiling). Execution через гибрид-цикл Sonnet
coder + Claude+Codex review (13 phases, 8 real bugs caught pre-merge).

## Что сделано сегодня

### Plan-review loop (R1-R7 ceiling)

- ✅ R7 hard ceiling после double-consensus convergence: qwen NSC начиная
  с R4, codex выявил 4 surgical bug'а на ceiling (применены без R8 per
  user Option A)
- ✅ 73 concerns accepted, 2 rejected persistent (refund-revocation +
  once-per-account — accepted product risks v0.3.60)
- ✅ `plans/patron-iap-final.md` + 49 intermediate в `plans/archive/patron-iap/`

### Phased execution (14 phases)

- ✅ **Phase 1** — SDK foundation + factory + env.d.ts types + build flag
- ✅ **Phase 2+3** — ProgressState (4 fields) + Reconciler 1.8s delay
- ✅ **Phase 4+5** — PaymentsService с U1-U4 R7-fixes (race conditions,
  in-flight lock, late-restore chain, ad reactive gating, 30 unit tests)
- ✅ **Phase 6+7+8** — patron achievement + speaker + entries в 3 локали
  + 23 i18n × 7 locales
- ✅ **Phase 9** — Settings UI + dialog + restore button + DiaryScene
  patron entry + DetailScene authorThanksMode
- ✅ **Phase 10+11** — RewardScene post-3-wins push trigger + BootScene
  factory wiring + restoreOnBoot
- ✅ **Phase 12+13** — scripts/uploadPatronProduct.mjs + Yandex setup
  runbook (Yandex soft-dropped после раз)

### GP backend (через admin GraphQL)

- ✅ Product `patron_support` ID 17521 создан в GP project 27547
  - tag=patron_support, type=IN_GAME, basePrice=199 RUB, icon uploaded
  - Verified через FetchProducts: title (ru+en), description, per-platform
    prices (YANDEX/VK/OK/TELEGRAM/VK_PLAY/SMARTMARKET/RUSTORE/CUSTOM/PARTNER/NONE)
- ✅ Script `scripts/uploadPatronProduct.mjs` исправлен после introspection
  реального GP API (Sonnet угадал имена неправильно: FetchPayments→
  FetchProducts, CreatePayment→CreateProduct, isPublished не существует,
  baseRealPrice required on Update)
- ✅ Memory MCP с full GP Admin API reference (id c0c5a9dc-7cf7-4bd3-97d9-35990d90c602)

### v0.3.61 UI polish stack (8 коммитов)

- ✅ Heart-иконка ❤ top-right на MapScene (persistent CTA, теплый коралл #e89a9a)
- ✅ Achievement toast: queue со стаггером 1000ms + duration 4s → 7s
- ✅ Patron dialog: «199 ₽» вместо голого «199» (currencySymbol support)
- ✅ Restore button: title «Восстановить покупку» + subtitle «Если уже
  покупали ранее» (новый i18n key × 7 локалей)
- ✅ Settings: убран support-author block (переехал в heart на карте);
  scroll-fix чтобы версия не залезала в restore
- ✅ Settings overlay → scroll'able (`overflow-y: auto`)
- ✅ author_thanks layout исправлен — правильные CSS классы (detail-page__home
  + modal-btn) + scroll-body structure
- ✅ Vite default `__PLATFORM__='dev'` в dev (DevStub on localhost — heart работает без `?platform=dev`)
- ✅ DEV console helpers `__testPatronPush()` / `__resetPatronDev()` /
  `__forcePatronActive()` для тестирования

### Билды

- ✅ `builds/gamepush/solitaire-expedition-v0.3.61.zip` — **37.40 MB**
- ✅ Yandex soft-dropped (37 MB cap нарушен на 0.4 MB; YandexSdkService
  + factory branch сохранены как dead code если решим вернуться)

## Приоритет 1 — заливка v0.3.61 в GP

1. **Залить ZIP** на panel.gamepush.com → проект 27547 → Builds → Upload Draft
2. **Открыть GP sandbox URL** (даёт preview link с test payment flow)
3. **Sandbox QA по чеклисту** (`docs/specs/2026-05-16-patron-iap-setup.md` Part 3):
   - До покупки: visible preloader / interstitial / sticky / rewarded
   - Click heart → GP test payment → confirm (sandbox без оплаты)
   - После: sticky disappears (closeSticky), ads suppressed, ачивка
     «Меценат экспедиции», запись «От автора» в Архив, +300 монет
   - Refresh → patron сохранился через cloud-save
   - Settings → «Восстановить покупку» → toast `patronAlreadyActive`
4. **Если sandbox-проверка OK** — публикуй draft → production

## Приоритет 2 — мониторинг telemetry в первые дни

5. Watch analytics в GP dashboard:
   - `patron_purchase_open` (settings / post_win_push / map_top sources)
   - `patron_purchase_attempt` → `patron_purchase_success` / `_cancelled` / `_error`
   - `patron_purchase_restore` с `note: "local_only"` → telemetry refund-detection (v0.3.61 only logs, v0.3.62+ может revoke)
   - `rewarded_offer_skipped` (reason: patron) — proof что ad-gate работает live

6. Если конверсия низкая (< 1%) — посмотреть funnel:
   - Open events vs purchase clicks (entry pain point — диалог открывают но не покупают?)
   - Post-win-push vs settings vs map_top — какой источник конвертит лучше

## Приоритет 3 — потенциальные доработки v0.3.62+

7. **Custom art для patron**:
   - `patron.png` сейчас = копия first_win.png (brass-star). Заменить
     на дизайн «руки с сердцем» / «печать благодарности» / etc.
   - Portrait автора `author.webp` — pixel-style силуэт в narrative-tone.
     Сейчас initials-кружок «АЭ» fallback.
8. **Refund/revocation** — на основе v0.3.61 telemetry data. v0.3.62
   spec: grace period? auto-downgrade? notification?
9. **Once-per-account backend marker** — strict semantics через
   server-validated processed-purchase marker. Текущая once-per-save-state
   достаточна для ≥99% потока, но cross-device concurrent activation
   может дать false-positive (rare).
10. **Качественные переводы tr/es/pt/de/fr** — patron i18n keys
    используют EN fallback. Перевести когда найдём носителей.

## Приоритет 4 — техдолг (не горит)

11. **GameScene decomposition** — parked в `docs/specs/2026-05-02-gamescene-decomposition.md`. Триггер: GameScene > 2000 строк ИЛИ следующая фича требует трогать ≥3 кластера. Сейчас ~1950 строк.
12. **Yandex distribution** — soft-dropped. Возврат требует ~500 KB compression (аудио 320→128 kbps + WebP optimize) чтобы влезть в 37 MB Yandex cap. Не приоритет без бизнес-сигнала.
13. **CrazyGames / Poki via GP-distribution** — проверить что `gp.payments.isAvailable=false` корректно скрывает heart на этих платформах (canUsePayments check уже в коде).

## НЕ делать

- Не пушить v0.3.61 в Yandex — explicitly soft-dropped, distribution paused.
- Не убирать `YandexSdkService` / factory branch — оставляем как dead code на случай возврата.
- Не трогать v0.3.61 IAP backend product (patron_support ID 17521) до завершения sandbox-проверки.

## Артефакты

### Plans
- `plans/patron-iap-final.md` — R7 final plan
- `plans/patron-iap-decision-log-r7.md` — финальный decision log
- `plans/archive/patron-iap/` — 49 intermediate (R1-R6 drafts/reviews/prompts)

### Phase decisions
- `plans/phase1-patron-iap-decisions.md` + 5 codex-prompts/phase*-patron-iap.md
- Реview артефакты `plans/phase{1,23,45,678,9,1011}-patron-iap-review-r1-codex.md`

### Builds
- `builds/gamepush/solitaire-expedition-v0.3.60.zip` — pre-stability fixes
- `builds/gamepush/solitaire-expedition-v0.3.61.zip` — **готов к upload**

### Setup runbook
- `docs/specs/2026-05-16-patron-iap-setup.md`

### Memory MCP
- `ecb1aeb7-e5f4-426f-9cd0-02625c580ddd` — GP credentials + endpoint
- `c0c5a9dc-7cf7-4bd3-97d9-35990d90c602` — GP Products API names + schemas
