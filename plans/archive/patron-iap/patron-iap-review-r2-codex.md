Использую первичные SDK-доки: Yandex IAP и GamePush typed Payments. R2 заметно лучше, но несколько реальных рисков остались.

[MAJOR] prior-concern-not-closed: `restoreOnBoot()` всё ещё `return`, если `save.progress.patronSupport` уже true. Это не ловит refund/revocation и сохраняет вечный false-positive patron из cloud/local save. Fix: на boot делать фоновую entitlement-сверку даже при local true; не снимать доступ при timeout/error, но снимать или помечать спорным при confirmed отсутствующей permanent purchase.

[MAJOR] prior-concern-not-closed: fire-and-forget restore допускает показ preloader/sticky/interstitial платящему игроку на fresh device. План прямо принимает “может увидеть 1 ad”, что противоречит paid ad-free. Fix: если platform payment-capable и patron ещё unknown, пропускать initial ads до restore result/timeout или использовать trusted local/cloud hint для временного ad gate.

[MAJOR] prior-concern-not-closed: Yandex auth/login path всё ещё не спроектирован. `getPayments()` reject превращается в `unavailable`, `getPurchases()` ищет unauthorized по строке, UI не предлагает login. Это ломает cross-device restore/support. Fix: добавить SDK-level `authStatus/requestLogin` или отдельный `unauthorized` state и manual restore flow с login prompt.

[MAJOR] prior-concern-not-closed: Yandex setup всё ещё неполный. В R2 есть договор/включить платежи/moderation, но нет явного письма-запроса на `games-partners@yandex-team.ru`, которое указано в docs как prerequisite. Fix: добавить этот шаг в runbook до QA.

[MAJOR] prior-concern-not-closed: `await save.flush()` добавлен, но если flush reject’нется после успешной платформенной покупки, код не дойдёт до `ads.markPatron()`, achievements, listeners и success analytics. Игрок оплатил, но текущая сессия может остаться с рекламой/без thank-you. Fix: разделить local activation и cloud sync: локально включить patron/ads-off всегда, `flush` await/catch с retry/status warning.

[MAJOR] prior-concern-not-closed: `patronBonusGranted` не гарантирует “once-per-account” в client-only модели при stale/concurrent cloud saves. Это once-per-save-state, не строгий account entitlement marker. Fix: либо backend/platform-validated processed marker, либо формулировка “один раз в сохранении”, либо merge policy/test на конфликт двух устройств.

[MINOR] prior-concern-not-closed: analytics timing всё ещё противоречив. `purchasePatron()` при `!canPurchasePatron()` трекает `patron_purchase_open`, хотя R2 говорит open только на mount dialog и тест ждёт no analytics при unavailable. Fix: убрать `open` из service early return; использовать `attempt/unavailable` отдельно, если нужно.

[MAJOR] new-concern-introduced: GP adapter всё ещё неверно мапит catalog/restore. GamePush docs различают `products: Product[]` и `purchases: PlayerPurchase[]`; план ищет цену в `payments.purchases` и возвращает `purchases.map(p => ({ tag: p.tag }))`. Это может сломать price и restore. Fix: price брать из `payments.products`/`getProduct(tag)`, entitlement проверять через `payments.has(tag)` после `fetchProducts()` или по verified `purchase.product.tag`.

[MAJOR] new-concern-introduced: SDK factory может race’нуться с загрузкой внешнего SDK. Если `window.__gp`/`YaGames` ещё не выставлены в момент BootScene, production silently уйдёт в `DevStubSdkService`. Fix: использовать build/distribution flag как primary или await bounded `waitForGamePush()/waitForYaGames()` перед fallback.

[MAJOR] new-concern-introduced: speaker `author` добавляется только в `ru/global/tr`, а archive insert требует `entry && speaker`. Если `getNarrativeSpeakerProfile()` не fallback’ит на global для `es/pt/de/fr`, запись “От автора” исчезнет в 4 локалях. Fix: добавить speaker во все 7 locale maps или тестировать fallback для всех 7.

[MINOR] new-concern-introduced: `openPatronPush()` ставит `patronPushShown` и вызывает `save.flush()` без await/catch, хотя план обещает guard от refresh. Fix: await перед/после mount либо дополнительно писать local one-shot flag.

[MINOR] new-concern-introduced: `getPatronPrice()` не ловит ошибки catalog/fetch. Dialog обещает открываться без price, но rejection может сорвать flow. Fix: catch внутри service и return `null`.

[MINOR] new-concern-introduced: post-win push может дважды трекать `patron_purchase_open`: `openPatronPush()` трекает сам, и shared dialog по R2 тоже трекает open на mount. Fix: один владелец события.

[MINOR] new-concern-introduced: `before = save.load().progress` для 2→3 crossing зависит от immutability текущей логики. Если existing completion мутирует progress, `before.completedNodes.length` изменится вместе с `after`. Fix: сохранить scalar `beforeCompletedCount`.

[MINOR] new-concern-introduced: Yandex env types неполные относительно docs: `IPurchase` без `purchaseToken`, `IProduct` без `imageURI/getPriceCurrencyImage`. Сейчас не блокирует permanent product, но создаёт type drift. Fix: описать реальные shapes ближе к SDK.

Источники: Yandex IAP docs подтверждают `signed:false/true`, `purchase/getPurchases/getCatalog`, permanent purchases и prerequisites; GamePush typed docs подтверждают `isAvailable`, `products`, `purchases`, `fetchProducts`, `has`, `purchase`.

CONCERNS REMAIN