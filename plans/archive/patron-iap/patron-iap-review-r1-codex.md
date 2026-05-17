[CRITICAL] Yandex `signed:true` несовместим с текущим клиентским планом: при `signed:true` `purchase()`/`getPurchases()` возвращают `{ signature }`, а не `{ productID }[]`; это сломает restore и маппинг товара. Fix: либо `getPayments()` без `signed` для client-only entitlement, либо добавить backend-валидацию signature и серверное начисление.

[CRITICAL] GP payments API в плане, похоже, назван неверно: typed docs показывают `fetchProducts()`, `purchases`, `has()`, `purchase()`, но не `fetchPlayerPayments()` / `getPlayerPayments()`. Fix: перед реализацией зафиксировать адаптер по реальным GP typed docs и sandbox-тесту.

[CRITICAL] В текущем коде `BootScene` всегда создает `GamePushSdkService`; `YandexSdkService` и планируемый `DevStubSdkService` не выбираются фабрикой. Yandex/Dev ветки из плана фактически не будут использованы. Fix: добавить явный SDK factory/build flag и типы для всех adapters.

[CRITICAL] Примеры `save.updateProgress((p) => { p.patronSupport = true; ... })` и `patronPushShown` не возвращают `ProgressState`, а текущий `SaveService.updateProgress` требует return. Это compile/runtime-break. Fix: всегда возвращать `{ ...p, patronSupport: true, coins: ... }`.

[MAJOR] `save.flush()` в `activatePatron` не awaited, а `SaveService.flush()`/adapter errors сейчас плохо наблюдаемы. Игрок может купить, обновить страницу и потерять cloud-флаг/бонус. Fix: сделать `activatePatron` async, await flush, UI держать в pending; для paid state желательно иметь flush result.

[MAJOR] `AchievementsReconciler` не “next tick”: он срабатывает только на `bootstrap()` или явный `reconcile()`. После покупки patron-achievement может не открыться. Fix: после успешной активации вызвать `achievements.reconcile({ progress: save.load().progress })` после закрытия purchase UI.

[MAJOR] Уже показанный sticky banner не исчезнет сам: gate в `showStickyBanner()` блокирует только будущие показы. Fix: при `activatePatron` вызвать `ads.hideStickyBanner()`/`sdk.closeSticky()` и запретить refresh.

[MAJOR] Rewarded UI-gate неверный: `!sdk.canUsePayments() || !patronSupport` покажет кнопку patron’у на платформе без payments. Fix: `canShowRewarded = !progress.patronSupport` плюс отдельная проверка доступности rewarded, если она есть.

[MAJOR] Нет in-flight guard для покупки. Двойной клик или две точки входа могут открыть/запустить purchase дважды. Fix: `purchaseInFlight`, disabled button, идемпотентная активация.

[MAJOR] `restoreOnBoot` пропускается, если `save.progress.patronSupport` уже true. Это не ловит refund/revocation и навсегда доверяет клиентскому save. Fix: локальный true использовать для UX, но периодически/на boot фоново сверять platform entitlement; не снимать entitlement при transient failure.

[MAJOR] 5s restore timeout может показать preloader/sticky платящему игроку на fresh device. Fix: для payment-capable platform до завершения restore лучше пропустить initial ads или показывать ads только после confirmed non-patron.

[MAJOR] Cross-device +300 coins policy спорная: “bonus only on purchase” означает, что покупка на телефоне и первый запуск на планшете восстановит ad-free без обещанных +300 в этом save. Fix: добавить `patronBonusGranted?: boolean` и явно решить: grant once per account via backend/platform token, или честно писать “+300 на устройстве покупки”.

[MAJOR] Если покупка успешна, но app падает до cloud flush, restore даст patron без +300. Fix: тот же `patronBonusGranted`/processed purchase marker или backend.

[MAJOR] Покупка “ad-free + rewarded removed” может ухудшить экономику после 6 rewarded-просмотров: платящий игрок теряет будущие doubled rewards. Fix: либо patron получает free post-win bonus вместо rewarded, либо увеличить/переописать бонус как одноразовую компенсацию без ощущения pay-to-lose.

[MAJOR] `canUsePayments() = Boolean(gp.payments)` недостаточно для Crazy/Poki/blocked IAP: namespace может быть, но платежи недоступны. Fix: использовать `gp.payments.isAvailable`, catalog/product presence, platform blocklist только как fallback.

[MAJOR] Нет explicit “Restore purchase” в Settings. Boot restore с timeout/login errors недостаточен для поддержки. Fix: показывать restore button/status там, где payments доступны, даже если purchase button скрыт.

[MAJOR] Yandex prerequisites неполные: помимо product в Console, docs требуют включение покупок/договор/запрос games-partners. Fix: добавить это в runbook до QA.

[MAJOR] Yandex login/authorization не учтены: `getPurchases()` может падать для неавторизованного пользователя, cross-device restore без login не гарантирован. Fix: SdkService должен различать unavailable / unauthorized и UI должен предлагать login/restore path.

[MAJOR] `DiaryScene.openEntryDetail()` ищет node через `getNodeByEntryId`; `author_thanks` не привязан к node, значит клик по архивной записи ничего не откроет. Fix: поддержать node-less archive detail или отдельный detail overlay по `entryId`.

[MAJOR] Patron modal/push не описывает input-lock/cleanup. В проекте уже есть ghost-click проблемы; modal поверх Map/Settings может пробивать клики в nav/canvas. Fix: использовать существующий modal pattern с cleanup, pointer lock, scene shutdown guard.

[MAJOR] Post-win push ставит `patronPushShown=true` до фактического показа. Если scene уйдет до `setTimeout`, показ потерян навсегда. Fix: Phaser timer tied to scene; флаг ставить на impression/close, не на eligibility.

[MAJOR] Trigger `completedNodes.length >= 3` в `MapScene.create()` покажет плашку старым игрокам при обычном boot, не только после 3-й победы. Fix: триггерить crossing 2→3 в RewardScene или передавать флаг в MapScene после win.

[MAJOR] Save validation не проверяет `patronSupport`/`patronPushShown`. Tampered cloud-save со строкой может дать странное поведение. Fix: добавить optional boolean validation и defaults в `createInitialProgressState`.

[MAJOR] `env.d.ts` не содержит `gp.payments`, Yandex `getPayments(options)`, `getPurchases()`. План не указал этот файл, build упадет. Fix: добавить типы как часть SDK foundation.

[MAJOR] Product setup не фиксирует тип товара. Для restore нужен non-consumable/permanent product; если GP/Yandex продукт будет consumable, entitlement исчезнет или потребует consume. Fix: явно задокументировать product type и moderation expectation.

[MINOR] Analytics section говорит “5 events”, но таблица содержит 6. Fix: привести счетчик/тест в соответствие.

[MINOR] `patron_purchase_open` сейчас вызывается внутри `purchasePatron`, но тест ожидает no analytics при `canUsePayments=false`. Fix: `open` трекать при открытии диалога, `attempt` при клике, `unavailable` отдельно при необходимости.

[MINOR] Цена вообще не показывается. Это снижает поддержку региональных валют и availability-check. Fix: брать `getCatalog()` и показывать native `product.price` в confirm button/subtitle, без hardcode RUB.

[MINOR] `withTimeout(..., [])` маскирует timeout как “нет покупок”. Fix: возвращать typed result `{ ok:false, reason:"timeout" }` и логировать diagnostic event.

[MINOR] `patron.png` как копия locked icon будет выглядеть как заблокированная ачивка. Fix: хотя бы временная brass/star/support иконка, не замок.

[MINOR] File list упоминает `entries.en.ts`, но в проекте есть `entries.global.ts`, без `entries.en.ts`. Fix: не планировать несуществующий файл.

Источники SDK: Yandex Games IAP docs подтверждают различие `signed:false` vs `signed:true`, форму `signature`, fulfilled/rejected purchase и обработку permanent purchases: https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases. GamePush typed docs показывают текущую форму `Payments`: https://gamepush.com/sdk/docs/classes/Payments.html.

## Alternative approaches

1. Разделить `PatronEntitlementService` и `PaymentsService`: payments только делает purchase/restore, entitlement хранит `isPatron`, сверяет platform state, гасит ads, закрывает sticky, дергает achievements/archive/UI. Так меньше риска размазать paid-state по сценам.

2. Ввести async `PaymentAvailability` вместо `canUsePayments(): boolean`: `{ available, reason, product, restoring, inFlight }`. Тогда UI не гадает по SDK namespace, а показывает purchase/restore/hidden корректно для GP, Yandex, Crazy/Poki, sandbox и offline.

3. Для +300 выбрать один честный режим: либо backend/validated once-per-account grant, либо “grant on first entitlement activation in this save” с `patronBonusGranted`, либо заменить rewarded на бесплатный patron bonus после победы. Первый самый надежный, третий лучше для UX, второй самый дешевый.

CONCERNS REMAIN