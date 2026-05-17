# Patron IAP — «Поддержать автора + ad-free» (v0.3.60) — draft-r1

## Context

В v0.3.59 ачивки + UI закатили, монетизация только через рекламу (preloader/
interstitial/sticky/rewarded). Хотим **single** IAP с эмоциональным framing'ом
«Поддержать автора» где скрытие рекламы — bullet-point, а не main pitch.

**Зачем именно так:**
- Narrative-проект, эмоциональная связь с игроком — patron-фрейминг конвертит
  лучше чем «remove ads» для нашего жанра
- Один товар = минимум поддержки (нет multi-tier price ladder, нет cosmetic
  catalog, нет восстановления отдельных позиций)
- Архитектура (`SdkService`, `AdsService`, `Reconciler`, `AppContext`) готова —
  IAP ложится сверху без рефакторинга

**User decisions (locked):**
1. Кнопка — в Settings + одноразовая плашка после **3 wins** (`progress.completedNodes.length >= 3` && `!patronSupport`)
2. После покупки **полное ad-free**: preloader / interstitial / sticky / rewarded — все скрыты. Компенсация: **+300 монет** при покупке (≈эквивалент 6 rewarded-просмотров)
3. Иконка `patron.png` сейчас = `locked-generic.png` placeholder. Portrait в Архиве = initials-кружок (нет webp). Custom art позже
4. Speaker = «Автор» / «Автор экспедиции», `speakerEntityId: "author"`. На английском «Author of the expedition» (single profile pack)

## Scope

**В scope:**
- `SdkService.canUsePayments() / purchase() / getPurchases()` — расширение интерфейса
- GamePush + Yandex + DevStub адаптеры
- `PaymentsService` (новый сервис, аналог `AdsService`)
- `ProgressState.patronSupport: true` boolean
- `AdsService` — gate всех 4 типов рекламы на флаг
- Achievement `patron` (group=community, order=3, COMMON, non-hidden)
- Narrative entry `author_thanks` с unconditional unlock на `patronSupport===true`
- Speaker `author` в `narrative/speakers.ts` (3 локали: ru / global / tr)
- Settings UI: новая кнопка + dialog
- Post-win-3 push (одноразовый, на MapScene после возврата из RewardScene)
- Restore-on-boot в `BootScene`
- Analytics: 5 новых events
- i18n: ~14 ключей × 7 локалей (~98 строк)
- Скрипт `scripts/uploadPatronProduct.mjs` — GP-side product registration через GraphQL

**НЕ в scope (v0.3.61+):**
- Multi-tier цены
- Cosmetic-награды (рубашки карт, фетры)
- Bonus chapters / story add-ons
- Custom art для `patron.png` + portrait автора
- Энергия / lives / paid skip
- Yandex IAP dashboard setup (manual через console, не автоматизируем)

## Архитектура

### Layer 1 — SDK extension

`SdkService` interface (`src/services/sdk/SdkService.ts`):

```ts
canUsePayments(): boolean;
purchase(tag: string): Promise<{ ok: boolean; reason?: "cancelled" | "error" | "unavailable" }>;
getPurchases(): Promise<Array<{ tag: string }>>;
```

**GamePushSdkService:**
- `canUsePayments()` = `Boolean(this.gp?.payments)`
- `purchase(tag)` → `await gp.payments.purchase({ tag })` → return `{ok: true}`. Catch → discriminate `cancelled` vs `error` через GP error code (`'CANCELLED' | 'NOT_FOUND' | 'UNKNOWN'`)
- `getPurchases()` → `await gp.payments.fetchPlayerPayments()` → `gp.payments.getPlayerPayments() → Array<{tag}>`. Timeout-wrap (5s)

**YandexSdkService:**
- `canUsePayments()` = `Boolean(this.payments)` (после `await ysdk.getPayments({signed:true})` в `init()`)
- `purchase(tag)` → `await payments.purchase({ id: tag })` → resolve / reject. Map reject → `'cancelled'`/`'error'`
- `getPurchases()` → `await payments.getPurchases()` → `Array<{productID}>` → `.map(p => ({tag: p.productID}))`

**DevStubSdkService:**
- `canUsePayments()` = `import.meta.env.DEV` (только в dev), `false` в prod
- `purchase(tag)` → `confirm('Buy ${tag}?')` → `{ok:true}` или `{ok:false, reason:'cancelled'}`
- `getPurchases()` → читает localStorage `dev_purchases` (помогает тестировать restore-flow в dev)

### Layer 2 — PaymentsService

Новый файл `src/services/payments/PaymentsService.ts`. Аналог `AdsService`:

```ts
export const PATRON_TAG = "patron_support";
export const PATRON_BONUS_COINS = 300;

export class PaymentsService {
  constructor(
    private readonly sdk: SdkService,
    private readonly analytics: AnalyticsService,
    private readonly save: SaveService,
  ) {}

  canPurchasePatron(): boolean {
    return this.sdk.canUsePayments() && !this.save.load().progress.patronSupport;
  }

  async purchasePatron(source: "settings" | "post_win_push"): Promise<{ ok: boolean }> {
    this.analytics.track("patron_purchase_open", { source });
    if (!this.canPurchasePatron()) return { ok: false };
    this.analytics.track("patron_purchase_attempt", { source });

    const result = await this.sdk.purchase(PATRON_TAG);
    if (!result.ok) {
      this.analytics.track(
        result.reason === "cancelled" ? "patron_purchase_cancelled" : "patron_purchase_error",
        { source, reason: result.reason ?? "unknown" },
      );
      return { ok: false };
    }

    this.activatePatron("purchase");
    this.analytics.track("patron_purchase_success", { source });
    return { ok: true };
  }

  /** Boot-time restore: проверяет cloud-purchases, активирует флаг если есть. */
  async restoreOnBoot(): Promise<void> {
    if (!this.sdk.canUsePayments()) return;
    if (this.save.load().progress.patronSupport) return;  // already set, skip
    try {
      const purchases = await withTimeout(this.sdk.getPurchases(), 5000, []);
      if (purchases.some((p) => p.tag === PATRON_TAG)) {
        this.activatePatron("restore");
        this.analytics.track("patron_purchase_restore", { found: true });
      }
    } catch (err) {
      console.warn("[payments] restore failed", err);
    }
  }

  private activatePatron(origin: "purchase" | "restore"): void {
    this.save.updateProgress((p) => {
      p.patronSupport = true;
      // Бонус монет только при свежей покупке. Restore-сценарий = монеты уже
      // были начислены в первичной сессии (cross-device duplicate-credit guard).
      if (origin === "purchase") {
        p.coins = (p.coins ?? 0) + PATRON_BONUS_COINS;
      }
    });
    // Reconciler пересчитает на следующем тике; ачивка `patron` зажжётся,
    // toast выстрелит через onNewUnlock callback.
    this.save.flush();  // forces immediate cloud sync — patron должен пережить refresh
  }
}
```

`withTimeout` — мелкий хелпер в том же файле или в `src/utils/promise.ts`:
```ts
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
  ]);
}
```

### Layer 3 — AdsService gate

`src/services/ads/AdsService.ts`:

```ts
private isPatron(): boolean {
  return Boolean(this.save.load().progress.patronSupport);
}

async showPreloader(): Promise<boolean> {
  if (this.isPatron()) return false;       // ← gate
  // ... existing logic
}

async showInterstitial(placement: string): Promise<void> {
  if (this.isPatron()) return;             // ← gate
  // ...
}

showStickyBanner(placement: string): void {
  if (this.isPatron()) return;             // ← gate
  // ...
}

async showRewardedVideo(placement: string): Promise<boolean> {
  if (this.isPatron()) {
    this.analytics.track("rewarded_offer_skipped", { placement, reason: "patron" });
    return false;
  }
  // ...
}
```

**Side-effect для rewarded:** в местах вызова `ads.showRewardedVideo()` UI-кнопка
«Удвоить награду / Посмотреть рекламу» должна **скрываться** для patron'ов.
Проверить call-sites — `RewardScene` основной потребитель. Прячем через
`canShowRewarded = !sdk.canUsePayments() || !save.load().progress.patronSupport`.
(Если есть другие call-sites — закроем все аналогично.)

### Layer 4 — ProgressState + AchievementFacts

`src/core/game-state/types.ts`:
```ts
export type ProgressState = {
  // ... existing fields
  patronSupport?: boolean;
};
```

`SaveService.init()` migration: если save без `patronSupport` — `false` (по умолчанию). Никакой migration-логики не надо, optional field.

### Layer 5 — Achievement `patron`

**`src/data/achievements.ts`** — добавить запись:
```ts
{ tag: "patron", compute: (s) => Boolean(s.progress.patronSupport) }
```
Pattern такой же как `first_artifact` (boolean флаг в progress, без `max`,
без `achievementFacts`). One-shot, non-hidden.

**`src/data/achievementUiMeta.ts`** — добавить:
```ts
{ tag: "patron", groupTag: "community", order: 3,
  titleKey: "ach_patron_title", descriptionKey: "ach_patron_description" }
```

**Iconfile:** `public/assets/achievements/patron.png` — копия `locked-generic.png`
(brass-замок), помечен TODO в файле + в plan'е. Custom art в v0.3.61.

**GP-side:** добавить ачивку через `scripts/uploadAchievements.mjs`. Скрипт
идемпотентный — просто прогоняется ещё раз, создаст 21-ю запись + добавит в
группу `community`.

**Tests:**
- `src/data/achievements.test.ts:14` — обновить count `20` → `21`
- `buildAchievementsViewModel.test.ts` — parity-test возьмёт сам
- `achievementIconsExist.test.ts` — проверит `patron.png` (нужно положить файл, иначе fail)

### Layer 6 — Archive entry `author_thanks`

**Гейтирование (новый паттерн в проекте):** существующие 30 записей привязаны
к `chapterNode.entryId` и появляются по `completedNodes`. Запись `author_thanks`
**не** привязана к узлу — это purchase-gated post-render append.

`src/scenes/DiaryScene.ts:buildArchiveEntries()` — в конце функции:
```ts
if (progress.patronSupport) {
  const entry = getNarrativeEntry("author_thanks", locale);
  const speaker = getNarrativeSpeakerProfile("author", locale);
  if (entry && speaker) {
    archiveEntries.unshift({  // в начало списка — patron'ы видят сразу
      entryId: "author_thanks",
      pointLabel: i18n.t("authorThanksPointLabel"),  // "От автора"
      author: speaker.fullName,
      excerpt: entry.excerpt ?? "",
      body: entry.body,
      portraitUrl: undefined,  // initials-кружок fallback
      initials: speaker.initials,
      accent: speaker.accent,
      speakerEntityId: "author",
    });
  }
}
```

**Speaker profile** — `src/data/narrative/speakers.ts:SPEAKER_PROFILES`:
- `ru.author`: fullName="Автор экспедиции", shortName="Автор", initials="АЭ", accent="#c9a76a" (brass), portraitKey="author"
- `global.author`: fullName="Author of the expedition", shortName="Author", initials="AE", accent="#c9a76a", portraitKey="author"
- `tr.author`: same as global

`portraitKey="author"` — но webp нет, `resolvePortraitUrl("author")` вернёт
`undefined` → `archiveEntryCard` рендерит initials-кружок (это уже работает,
проверено в коде).

**Entry text** — `src/data/narrative/entries.ru.ts` (+ остальные 7 локалей):
```ts
author_thanks: {
  speakerEntityId: "author",
  excerpt: "Если экспедиция отозвалась — спасибо.",
  body: "Я делал эту игру один — текст, музыку, иллюстрации. Если экспедиция отозвалась — спасибо. Реклама теперь не будет вас отвлекать.\n\nДорога открыта.",
},
```
Для en/tr/es/pt/de/fr — переводы (или EN fallback). Качественные переводы можно
отложить, в инфраструктуре fallback уже работает.

### Layer 7 — Settings UI

`src/scenes/settingsSceneOverlay.ts` — добавить **secondary section** между
sound section и version label:

```html
<section class="settings-page__patron" data-condition="canPurchasePatron">
  <button class="settings-page__patron-button" data-settings-action="open-patron">
    <span class="settings-page__patron-title">{i18n.supportAuthor}</span>
    <span class="settings-page__patron-subtitle">{i18n.supportAuthorSubtitle}</span>
  </button>
</section>
```

**Только если** `canPurchasePatron() === true` — для уже-patron-ов или
не-payment-платформ кнопка отсутствует.

`SettingsScene.ts:setupHandlers()` — handler:
```ts
case "open-patron":
  this.openPatronDialog();
  break;
```

**Patron dialog** — новый overlay (отдельный модуль или inline DOM в SettingsScene).
HTML структура:
```
┌─ Поддержать автора ─────────────────┐
│                                      │
│  Игра — мой одиночный проект.        │
│  Если экспедиция нашла отклик —      │
│  спасибо.                            │
│                                      │
│  В благодарность:                    │
│  ✓ Реклама исчезает полностью        │
│  ✓ +300 монет в благодарность        │
│  ✓ Записка от автора в архиве        │
│  ✓ Ачивка «Меценат экспедиции»       │
│                                      │
│  [ Поддержать ] [ Не сейчас ]        │
└──────────────────────────────────────┘
```

Цена **не пишется в UI** — GP/Yandex показывает её в нативном purchase-flow
(избавляемся от headache с конвертацией валют, региональным pricing'ом, налогами).

**Кнопка `Поддержать`** → `await payments.purchasePatron("settings")` →
если `ok===true`:
- toast «Спасибо за поддержку!» (через существующий toast-механизм, новый key
  `patronThankYouToast` + 6s duration)
- закрыть dialog
- re-render Settings (кнопка исчезнет, т.к. `canPurchasePatron()===false`)
- AchievementsReconciler автоматически зажжёт `patron` ачивку → её toast тоже выстрелит

### Layer 8 — Post-win-3 push

**Trigger:** в `MapScene.create()` или в `RewardScene.continue-handler`. Удобнее
в `MapScene.create()` — это место куда игрок попадает после Reward и где
рендерится overlay.

```ts
// MapScene.create() добавить:
const { save, payments } = getAppContext();
const p = save.load().progress;
const eligible =
  payments.canPurchasePatron() &&
  p.completedNodes.length >= 3 &&
  !p.patronPushShown;

if (eligible) {
  save.updateProgress((s) => { s.patronPushShown = true; });
  // Показать одноразовую плашку (delay 600ms чтобы дать MapScene нарисоваться)
  setTimeout(() => this.showPatronPush(), 600);
}
```

**Новое поле в ProgressState:** `patronPushShown?: boolean` — guard от повторного показа.

**Плашка** — переиспользует patron dialog Layer 7. С одним отличием — в нижней
панели есть кнопка «Не показывать снова» (= просто закрыть, флаг уже set).

### Layer 9 — Boot integration

`src/scenes/BootScene.ts:create()` — после `await save.init(sdk)` (l.119) и до
`sdk.signalReady()` (l.284):

```ts
const payments = new PaymentsService(sdk, analytics, save);
await payments.restoreOnBoot();  // 5s timeout, fail-soft
```

`setAppContext` — добавить `payments`:
```ts
setAppContext({ analytics, ads, i18n, save, sound, sdk, achievements, payments });
```

`src/app/config/appContext.ts:AppContext` += `payments: PaymentsService`.

### Layer 10 — Analytics events (5 новых)

| event | payload |
|---|---|
| `patron_purchase_open` | `{ source: "settings" \| "post_win_push" }` |
| `patron_purchase_attempt` | `{ source }` |
| `patron_purchase_success` | `{ source }` |
| `patron_purchase_cancelled` | `{ source, reason }` |
| `patron_purchase_error` | `{ source, reason }` |
| `patron_purchase_restore` | `{ found: boolean }` |

Лог-only (текущий `AnalyticsService.track` пишет в console.info).

### Layer 11 — i18n

`src/services/i18n/locales.ts` — добавить **в каждую из 7 локалей**:

```
supportAuthor               # button label
supportAuthorSubtitle       # «Спасибо, если игра отозвалась» / "Thank you if the game resonated"
patronDialogTitle           # «Поддержать автора»
patronDialogBody            # параграф-описание
patronBenefitAds            # «Реклама исчезает полностью»
patronBenefitCoins          # «+300 монет в благодарность»
patronBenefitArchive        # «Записка от автора в архиве»
patronBenefitAchievement    # «Ачивка «Меценат экспедиции»»
patronConfirmButton         # «Поддержать»
patronCancelButton          # «Не сейчас»
patronDontShowAgain         # «Не показывать снова» (для post-win push)
patronThankYouToast         # «Спасибо за поддержку!»
authorThanksPointLabel      # «От автора»
ach_patron_title            # «Меценат экспедиции»
ach_patron_description      # «Поддержали автора и помогли продолжить экспедицию.»
```

= **15 ключей × 7 локалей = 105 строк**.

**Качество переводов:**
- ru + en — финальные, ручные
- tr / es / pt / de / fr — fallback на en через существующий механизм
  (`locales[locale][key] ?? locales.en[key]`)
- Regression-test проверяет что все 15 ключей в `locales.ru` и `locales.en`

### Layer 12 — GP / Yandex product setup

**GP-сторона:**
- Создать payment-product через GraphQL `CreatePayment` mutation
- Скрипт `scripts/uploadPatronProduct.mjs` (новый, ~80 строк, по образцу `uploadAchievements.mjs`)
- Поля: `tag: "patron_support"`, `price: 199` (RUB), `currency: "RUB"`, `names` (ru/en), `description` (ru/en), `icon` (upload `patron.png` отдельно через `UploadImage`)
- Идемпотентный (matches existing by `tag` → update vs create)

**Yandex-сторона (MANUAL):**
- Yandex Console → Project → Products → Create
- ID: `patron_support` (должен совпадать с GP `tag` для cross-platform консистенции)
- Price: 199 ₽
- Title/description ru
- Icon upload
- Publish

Это **manual one-time** — не автоматизируем (нет публичного Yandex Admin API
для products). Документируем шаги в `docs/specs/2026-05-16-patron-iap-setup.md`.

## File-level changes

### Files to modify

| Path | Change |
|---|---|
| `src/services/sdk/SdkService.ts` | + 3 method signatures |
| `src/services/sdk/GamePushSdkService.ts` | + payments impl |
| `src/services/sdk/YandexSdkService.ts` | + payments impl (init payments object in `init()`) |
| `src/services/sdk/DevStubSdkService.ts` | + payments stub |
| `src/services/ads/AdsService.ts` | gate 4 methods на `isPatron()` |
| `src/services/save/SaveService.ts` | потенциально нужен `updateProgress` если ещё нет |
| `src/core/game-state/types.ts` | + `patronSupport?: boolean`, `patronPushShown?: boolean` в ProgressState |
| `src/app/config/appContext.ts` | + `payments: PaymentsService` field |
| `src/scenes/BootScene.ts` | + PaymentsService init, restoreOnBoot, setAppContext |
| `src/scenes/SettingsScene.ts` | + patron section visibility check, click handler, dialog |
| `src/scenes/settingsSceneOverlay.ts` | + patron-section HTML |
| `src/scenes/MapScene.ts` | + post-win-3 push trigger |
| `src/scenes/RewardScene.ts` | hide rewarded UI для patron'ов |
| `src/scenes/DiaryScene.ts` | append `author_thanks` entry если patron |
| `src/data/achievements.ts` | + `patron` compute record |
| `src/data/achievements.test.ts` | count 20 → 21 |
| `src/data/achievementUiMeta.ts` | + `patron` UI meta |
| `src/data/narrative/speakers.ts` | + `author` profile в ru/global/tr packs |
| `src/data/narrative/entries.{ru,global,en,tr,es,pt,de,fr}.ts` | + `author_thanks` entry |
| `src/services/i18n/locales.ts` | + 15 ключей × 7 локалей |
| `src/styles.css` | + `.settings-page__patron-*`, `.patron-dialog__*` |
| `public/assets/achievements/patron.png` | placeholder (copy of locked-generic.png) |
| `package.json` | 0.3.59 → 0.3.60 |

### New files

| Path | Purpose |
|---|---|
| `src/services/payments/PaymentsService.ts` | основной сервис |
| `src/services/payments/PaymentsService.test.ts` | unit tests |
| `src/ui/patronDialog.ts` | HTML builder для dialog (как `archiveEntryDetailOverlay`) |
| `src/ui/patronDialog.test.ts` | snapshot test |
| `src/utils/withTimeout.ts` (если нет аналога) | Promise-timeout хелпер |
| `scripts/uploadPatronProduct.mjs` | GP-side product upload |
| `docs/specs/2026-05-16-patron-iap-setup.md` | Yandex manual setup steps + GP setup runbook |

## Tests

Новые / обновлённые:

1. **`PaymentsService.test.ts`** (new):
   - `purchasePatron("settings")` happy-path → save.patronSupport=true, +300 coins, analytics events
   - `purchasePatron` когда `canUsePayments=false` → early-return, no analytics
   - `purchasePatron` cancelled → `patron_purchase_cancelled` event, no save mutation
   - `purchasePatron` error → `patron_purchase_error` event
   - `restoreOnBoot` — нет patron в getPurchases → no-op
   - `restoreOnBoot` — есть patron, save flag false → activate, restore event, **no coins bonus** (duplicate-credit guard)
   - `restoreOnBoot` — save flag уже true → skip
   - `restoreOnBoot` — timeout 5s → fail-soft

2. **`AdsService.test.ts`** (extend existing):
   - Patron flag → `showPreloader` returns false без вызова sdk
   - Patron flag → `showInterstitial` is no-op
   - Patron flag → `showStickyBanner` is no-op
   - Patron flag → `showRewardedVideo` returns false + analytics skip

3. **`patronDialog.test.ts`** (new):
   - HTML renders title, body, 4 benefits, 2 buttons
   - data-action attrs on buttons
   - aria-labels

4. **`achievements.test.ts`** (update):
   - Count expectations 20 → 21
   - `patron` compute: `progress.patronSupport=true` → true; иначе false

5. **`achievementIconsExist.test.ts`** (auto-update through ACHIEVEMENTS):
   - Проверит `patron.png` сам — нужно положить файл, иначе fail

6. **`DiaryScene.integration.test.ts`** (new или extend):
   - `patronSupport=false` → no `author_thanks` entry
   - `patronSupport=true` → `author_thanks` entry в начале списка
   - portraitUrl undefined → initials-кружок fallback (через existing code path)

7. **Locale parity test** (extend `src/services/i18n/I18nService.test.ts`):
   - Все 15 новых ключей в `locales.ru` и `locales.en` присутствуют

## Verification

`npm test` — 210 → ~225 (+15 тестов).

`npm run build` — typecheck чистый.

**Manual QA (GP sandbox):**
1. Fresh save (clear localStorage): кнопки «Поддержать» нет в Settings (preview-stub `canUsePayments=DEV-only`)
2. На GP-sandbox: кнопка «Поддержать» появляется в Settings после загрузки
3. Сыграть **2 партии** → вернуться на Map → плашки нет
4. Сыграть **3-ю партию** → вернуться на Map → плашка появилась (delay 600ms)
5. Закрыть плашку «Не сейчас» → больше не появляется (флаг `patronPushShown`)
6. Открыть Settings → клик «Поддержать» → dialog
7. GP sandbox даёт тестовую покупку → success → toast «Спасибо!» + toast «Ачивка «Меценат»»
8. Refresh page → patron статус сохранился (cloud-sync), реклама **полностью** скрыта
9. Открыть Архив → запись «От автора» в начале списка, initials-кружок, текст благодарности
10. Открыть AchievementsScene → community-группа: 3 ачивки, `patron` ✓ unlocked
11. Coins: было N → теперь N+300
12. Clear localStorage + relogin → `restoreOnBoot` восстанавливает флаг, **бонус монет НЕ начисляется повторно**
13. Yandex build (canUseAchievements=false): кнопка Yandex IAP должна работать; если ачивки выключены, ачивка не зажигается, остальное норм

**Diagnostic:**
- `[payments]` лог при purchase/restore — checking via console
- `patron_purchase_*` events в analytics output

## Phases (для execution)

1. **SDK foundation** (~3h): SdkService extension + 3 adapter impls + tests
2. **Save / AppContext / Boot** (~2h): ProgressState field, BootScene wiring, restoreOnBoot
3. **PaymentsService** (~3h): сервис + unit tests
4. **AdsService gate** (~1h): 4 methods + tests
5. **Achievement `patron`** (~1h): registration + PNG placeholder + count test update
6. **Archive entry + speaker** (~2h): entries.ts × 7 locales + speakers.ts + DiaryScene append + tests
7. **i18n keys** (~1h): 15 × 7 (ru+en hand, остальные EN fallback)
8. **Settings UI + dialog** (~3h): overlay HTML + click handler + new patronDialog module + styles
9. **Post-win-3 push** (~1h): MapScene trigger + reuse dialog
10. **GP product setup** (~1.5h): `uploadPatronProduct.mjs` script + dashboard validation
11. **Yandex product setup** (~1h): manual через console + runbook docs
12. **End-to-end QA** (~2h): GP sandbox + Yandex sandbox

**Total estimate:** ~21h. Однодневный спринт + полдня на QA и фиксы.

## Risks

| Risk | Mitigation |
|---|---|
| GP `payments` API не полностью документирован | Использовать прямой `gp.payments.purchase` + on('purchase'); проверить в GP-sandbox. Fallback: фиксированный обработчик через MCP запросы к GP-docs |
| Yandex отвергнет «patron» framing как «донат» (не товар) | UI прозрачно показывает «реклама исчезает + бонусы». Это commerce, не donation. Если отвергнут — фолбек на «Pack без рекламы» title, оставляя «Поддержать» как subtitle |
| CrazyGames/Poki через GP-distribution могут блокировать IAP | `canUsePayments()` корректно вернёт `false` на этих платформах. Кнопка не появится. Проверить на одной из них |
| Игрок переустанавливает игру, теряет +300 coins бонус | Бонус начисляется **только при `origin === "purchase"`**. Restore из cloud не даёт coin-bonus (избегаем duplicate credit). Документировано в plan |
| Локализация переводов tr/es/pt/de/fr плохая | Fallback на EN. Качественные переводы — в v0.3.61 |
| `patron.png` placeholder выглядит как замок | Документировано в коде + plan. v0.3.61 = custom art |
| Ачивка `patron` в i18n parity-test упадёт | Тест проверяется CI; обновляем в той же PR |
| Reconciler не подхватит `patron` сразу после `save.patronSupport=true` | `save.flush()` + Reconciler читает progress в каждом tick. Если есть проблема — manual `achievements.reconcile()` сразу после `activatePatron()` |
| Save migration со старой версии без `patronSupport` | Optional field, default undefined → falsy → ad-gate работает |

## Open questions (parked для v0.3.61+)

- **Custom art:** иконка `patron.png` + portrait автора
- **Bonus contents:** добавить рубашку карт «Меценат» (cosmetic) в подарок?
- **Multi-tier:** добавить более высокую цену с extra-бонусом?
- **«Подарить другу»** — gift-purchase механика
- **Annual rotation:** обновлять author_thanks записку раз в полгода с новостями
