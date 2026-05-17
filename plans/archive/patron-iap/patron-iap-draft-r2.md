# Patron IAP — «Поддержать автора + ad-free» (v0.3.60) — draft-r2

## R1 → R2 summary

Reviewed codex + qwen. 35 concerns accepted, 1 rejected (user-locked decision на rewarded coverage).

**Major shifts vs R1:**
1. **SDK factory** в BootScene (runtime detection вместо hardcoded GP)
2. **`env.d.ts` shapes** для `gp.payments` + Yandex Payments (без них build ломается)
3. **GP API исправлен** по typed docs: `fetchProducts/purchases/has/purchase`, не `fetchPlayerPayments`
4. **Yandex `signed:false`** (никакой server-validation, client-only entitlement)
5. **`save.updateProgress` returns new state** (не mutate)
6. **`patronBonusGranted` flag** — idempotent +300 coins на любой первой активации (purchase или restore), cross-device safe
7. **Fire-and-forget restore** + `localStorage.getItem("isPatron")` fast-path — boot не блокируется
8. **Post-3-wins push triggered in RewardScene** continue-handler, не MapScene.create()
9. **`patronPushShown` ставится on-impression**, не on-eligibility
10. **In-flight purchase lock** + AdsService reactive `markPatron()` + immediate sticky-banner hide
11. **DiaryScene special-case** для node-less `author_thanks` entry detail
12. **Restore button** в Settings dialog (independent от purchase button)
13. **GP purchase Promise vs event verification** — двойная стратегия: primary `await sdk.purchase()`, fallback event-based singleton listener (как gp-013 для socials)

## Context

В v0.3.59 ачивки + UI закатили, монетизация только через рекламу. Хотим single
IAP с эмоциональным framing'ом «Поддержать автора» где скрытие рекламы — bullet,
не main pitch.

**User decisions (locked):**
1. Кнопка в Settings + одноразовая плашка после **3-х побед** (trigger в RewardScene)
2. Полное ad-free после покупки (preloader + interstitial + sticky + rewarded). Компенсация — **+300 монет** через `patronBonusGranted` (idempotent across devices)
3. `patron.png` placeholder = brass-star или копия `first_win.png` (НЕ замок). Portrait автора — initials-кружок (нет webp). Custom art в v0.3.61
4. Speaker `author` / fullName=«Автор экспедиции», EN=«Author of the expedition»

## Scope

**В scope:** SDK factory + payments interface + 3 adapters + env.d.ts types,
PaymentsService с in-flight lock + reactive AdsService.markPatron, restore-on-boot
(fire-and-forget + localStorage fast-path), ProgressState `patronSupport` +
`patronPushShown` + `patronBonusGranted`, AdsService gate на 4 ad-type + reactive
sticky-hide, achievement `patron` (community/order=3, non-hidden), entry
`author_thanks` purchase-gated + speaker `author`, Settings UI button + dialog
+ Restore button, RewardScene-triggered post-3-wins push, 15 i18n keys × 7 locales
+ global file, 6 analytics events, `scripts/uploadPatronProduct.mjs` GP-side.

**НЕ в scope:** multi-tier цены, cosmetics, bonus chapters, custom art, energy/
lives, Yandex IAP dashboard automation, refund/revocation detection (если platform
отзовёт purchase — обнаружим в следующем restore-cycle, но логику не пишем).

## Architecture

### Layer 1 — SDK extension + env types + factory

#### `env.d.ts` — typed GP/Yandex Payments

```ts
declare global {
  interface Window {
    __gp?: {
      // ... existing fields
      payments?: {
        isAvailable: boolean;
        fetchProducts(): Promise<void>;
        purchases: Array<{ tag: string; price: string; currency?: string }>;
        has(tag: string): boolean;
        purchase(args: { tag: string }): Promise<{ tag: string }>;
        consume(args: { tag: string }): Promise<void>;
      };
    };
    YaGames?: {
      init(options?: unknown): Promise<YaSdk>;
    };
  }
}

type YaSdk = {
  getPayments(options?: { signed?: boolean }): Promise<YaPayments>;
  // ... other methods
};
type YaPayments = {
  purchase(args: { id: string; developerPayload?: string }): Promise<{ productID: string }>;
  getPurchases(): Promise<Array<{ productID: string }>>;
  getCatalog(): Promise<Array<{ id: string; title: string; description: string; price: string; priceValue: string; priceCurrencyCode: string }>>;
  consumePurchase(token: string): Promise<void>;
};
```

#### `SdkService` interface

```ts
type ProductInfo = { tag: string; title: string; price: string };
type PurchaseResult = { ok: true } | { ok: false; reason: "cancelled" | "error" | "unavailable" | "unauthorized" };
type PurchasesResult = { ok: true; purchases: Array<{ tag: string }> } | { ok: false; reason: "timeout" | "error" | "unauthorized" | "unavailable" };

interface SdkService {
  // ... existing methods
  canUsePayments(): boolean;
  getProductInfo(tag: string): Promise<ProductInfo | null>;
  purchase(tag: string): Promise<PurchaseResult>;
  getPurchases(): Promise<PurchasesResult>;
  /** Optional native restore-trigger if platform exposes one (e.g. iOS restore). */
  triggerNativeRestore?(): Promise<void>;
}
```

`canUsePayments()` impl:
- **GP:** `Boolean(this.gp?.payments?.isAvailable)` — `isAvailable` flag покрывает CrazyGames/Poki block (false там)
- **Yandex:** `Boolean(this.payments)` где `this.payments` устанавливается в `init()` после `await ysdk.getPayments({ signed: false })`. Если getPayments reject (auth/availability) — `this.payments = null`
- **DevStub:** `import.meta.env.DEV` true в dev, false в prod

#### GamePush adapter — verified GP API names

**Promise verification:** проверить в sandbox `gp.payments.purchase({tag})` shape (Promise vs event). Если Promise — straight `await`. Если event-based (как `gp.socials.share`) — fallback wrapper:

```ts
// Primary path (assumed Promise — per current GP typed docs)
async purchase(tag: string): Promise<PurchaseResult> {
  if (!this.gp?.payments) return { ok: false, reason: "unavailable" };
  try {
    await this.gp.payments.purchase({ tag });
    return { ok: true };
  } catch (err) {
    console.error("[gp.payments.purchase] raw", err);
    const reason = this.classifyGpError(err);  // 'cancelled' | 'error'
    return { ok: false, reason };
  }
}

// Fallback if sandbox shows event-based shape — wrap as Promise
// with singleton listener pattern (gp-013 from plan-mistakes registry):
// gp.payments.on('purchase', handler) installed once в init(), reads pendingTag
// из socialsContext-like singleton.
```

`classifyGpError(err)` — пытается прочитать `err.code` / `err.name` / `err.message.includes("cancel")`. **Default to `"error"`**. Initial impl логирует raw error в console.error для sandbox-refinement.

```ts
async getPurchases(): Promise<PurchasesResult> {
  if (!this.gp?.payments) return { ok: false, reason: "unavailable" };
  try {
    await this.gp.payments.fetchProducts();
    return { ok: true, purchases: this.gp.payments.purchases.map(p => ({ tag: p.tag })) };
  } catch (err) {
    console.warn("[gp.payments.getPurchases]", err);
    return { ok: false, reason: "error" };
  }
}

async getProductInfo(tag: string): Promise<ProductInfo | null> {
  if (!this.gp?.payments) return null;
  await this.gp.payments.fetchProducts();
  const p = this.gp.payments.purchases.find(x => x.tag === tag);
  return p ? { tag, title: tag, price: p.price } : null;
}
```

`gp.payments.has(tag)` — boolean local check после fetchProducts. Используется ВМЕСТО getPurchases внутри `restoreOnBoot` для скорости.

#### Yandex adapter

```ts
async init(): Promise<void> {
  this.sdk = await YaGames.init();
  try {
    this.payments = await this.sdk.getPayments({ signed: false });
  } catch (err) {
    console.warn("[yandex] getPayments unavailable", err);
    this.payments = null;
  }
  // ...
}

async purchase(tag: string): Promise<PurchaseResult> {
  if (!this.payments) return { ok: false, reason: "unavailable" };
  try {
    await this.payments.purchase({ id: tag });
    return { ok: true };
  } catch (err) {
    console.error("[yandex.purchase] raw", err);
    // Yandex rejection forms: { code: 'INTERNAL_ERROR' | 'NETWORK_ERROR' | ... }
    // Cancellation often surfaces as user-rejected with specific code.
    // Initial impl: any reject → 'error'; refine after sandbox.
    return { ok: false, reason: "error" };
  }
}

async getPurchases(): Promise<PurchasesResult> {
  if (!this.payments) return { ok: false, reason: "unavailable" };
  try {
    const list = await this.payments.getPurchases();
    return { ok: true, purchases: list.map(p => ({ tag: p.productID })) };
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes("not authorized") || msg.includes("unauthorized")) {
      return { ok: false, reason: "unauthorized" };
    }
    return { ok: false, reason: "error" };
  }
}
```

#### DevStub adapter

```ts
canUsePayments(): boolean { return import.meta.env.DEV; }
async purchase(tag: string): Promise<PurchaseResult> {
  if (!import.meta.env.DEV) return { ok: false, reason: "unavailable" };
  const ok = window.confirm(`[DEV] Buy ${tag} for 199 RUB?`);
  if (!ok) return { ok: false, reason: "cancelled" };
  const stored = JSON.parse(localStorage.getItem("dev_purchases") ?? "[]");
  if (!stored.includes(tag)) {
    stored.push(tag);
    localStorage.setItem("dev_purchases", JSON.stringify(stored));
  }
  return { ok: true };
}
async getPurchases(): Promise<PurchasesResult> {
  const stored: string[] = JSON.parse(localStorage.getItem("dev_purchases") ?? "[]");
  return { ok: true, purchases: stored.map(tag => ({ tag })) };
}
```

#### SDK factory

`src/services/sdk/createSdkService.ts`:

```ts
export function createSdkService(): SdkService {
  // Priority: ?platform=X URL param → SDK presence → fallback dev stub.
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("platform");
  if (forced === "yandex") return new YandexSdkService();
  if (forced === "gamepush") return new GamePushSdkService();
  if (forced === "dev") return new DevStubSdkService();
  // Auto-detect by SDK script presence.
  if (typeof window !== "undefined" && (window as any).__gp !== undefined) {
    return new GamePushSdkService();
  }
  if (typeof window !== "undefined" && (window as any).YaGames) {
    return new YandexSdkService();
  }
  return new DevStubSdkService();
}
```

`BootScene.create()`: `const sdk = createSdkService(); await sdk.init();` вместо hardcoded `new GamePushSdkService()`.

### Layer 2 — PaymentsService

`src/services/payments/PaymentsService.ts`:

```ts
export const PATRON_TAG = "patron_support";
export const PATRON_BONUS_COINS = 300;
const PATRON_LOCAL_KEY = "isPatron";

type ActivationOrigin = "purchase" | "restore";

export class PaymentsService {
  private purchasing = false;
  private listeners = new Set<(isPatron: boolean) => void>();

  constructor(
    private readonly sdk: SdkService,
    private readonly analytics: AnalyticsService,
    private readonly save: SaveService,
    private readonly achievements: AchievementsReconciler,
    private readonly ads: AdsService,
  ) {}

  canUsePayments(): boolean { return this.sdk.canUsePayments(); }

  canPurchasePatron(): boolean {
    return this.canUsePayments() && !this.save.load().progress.patronSupport;
  }

  /** Returns localized native-price string, or null if unavailable. */
  async getPatronPrice(): Promise<string | null> {
    const info = await this.sdk.getProductInfo(PATRON_TAG);
    return info?.price ?? null;
  }

  onChange(listener: (isPatron: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async purchasePatron(source: "settings" | "post_win_push"): Promise<{ ok: boolean }> {
    if (this.purchasing) return { ok: false };
    if (!this.canPurchasePatron()) {
      this.analytics.track("patron_purchase_open", { source, blocked: "not_eligible" });
      return { ok: false };
    }
    this.purchasing = true;
    try {
      this.analytics.track("patron_purchase_attempt", { source });
      const result = await this.sdk.purchase(PATRON_TAG);
      if (!result.ok) {
        const event = result.reason === "cancelled"
          ? "patron_purchase_cancelled" : "patron_purchase_error";
        this.analytics.track(event, { source, reason: result.reason ?? "unknown" });
        return { ok: false };
      }
      await this.activatePatron("purchase");
      this.analytics.track("patron_purchase_success", { source });
      return { ok: true };
    } finally {
      this.purchasing = false;
    }
  }

  /** Manual restore from Settings UI. */
  async restorePatronManual(): Promise<{ ok: boolean; alreadyActive: boolean }> {
    if (this.save.load().progress.patronSupport) {
      return { ok: true, alreadyActive: true };
    }
    const result = await this.sdk.getPurchases();
    if (!result.ok) {
      this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason });
      return { ok: false, alreadyActive: false };
    }
    const hasPatron = result.purchases.some(p => p.tag === PATRON_TAG);
    if (hasPatron) {
      await this.activatePatron("restore");
      this.analytics.track("patron_purchase_restore", { found: true });
      return { ok: true, alreadyActive: false };
    }
    this.analytics.track("patron_purchase_restore", { found: false });
    return { ok: false, alreadyActive: false };
  }

  /** Fire-and-forget boot restore. NO await in BootScene. */
  async restoreOnBoot(): Promise<void> {
    if (!this.canUsePayments()) return;
    if (this.save.load().progress.patronSupport) return;
    const localHint = typeof localStorage !== "undefined"
      ? localStorage.getItem(PATRON_LOCAL_KEY) === "true"
      : false;
    // Fast-path: localStorage cache не подтверждает purchase сама по себе,
    // но если она true — это сильный сигнал чтобы сразу попробовать SDK.
    // Если false — всё равно пробуем (cross-device first-launch case).
    try {
      const result = await withTimeout(
        this.sdk.getPurchases(), 5000,
        { ok: false, reason: "timeout" } as PurchasesResult,
      );
      if (!result.ok) {
        if (localHint) console.warn("[payments] local hint says patron, SDK restore failed:", result.reason);
        return;
      }
      const hasPatron = result.purchases.some(p => p.tag === PATRON_TAG);
      if (hasPatron) {
        await this.activatePatron("restore");
        this.analytics.track("patron_purchase_restore", { found: true, source: "boot" });
      }
    } catch (err) {
      console.warn("[payments] restoreOnBoot failed", err);
    }
  }

  /** Idempotent activation. patronBonusGranted ensures +300 happens once cross-device. */
  private async activatePatron(origin: ActivationOrigin): Promise<void> {
    const before = this.save.load().progress;
    if (before.patronSupport && before.patronBonusGranted) {
      return;  // truly idempotent — both flags set, nothing to do
    }
    this.save.updateProgress((p) => ({
      ...p,
      patronSupport: true,
      patronBonusGranted: true,
      coins: p.patronBonusGranted ? p.coins : (p.coins ?? 0) + PATRON_BONUS_COINS,
    }));
    // Persist local hint synchronously for next-boot fast-path.
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PATRON_LOCAL_KEY, "true");
      }
    } catch { /* private mode / quota: ignore */ }

    await this.save.flush();  // await — cloud-sync должен пережить refresh

    // Reactive: ads теряет sticky банер немедленно.
    this.ads.markPatron();

    // Trigger ach immediately, with delay для разнесения toast'ов.
    // Reconciler.reconcile() обновит ach state; onNewUnlock toast будет
    // отложен через "patronJustActivated" flag в reconciler.
    this.achievements.markPatronJustActivated();  // 1.8s grace period
    this.achievements.reconcile(this.save.load().progress);

    this.listeners.forEach((fn) => fn(true));
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
  ]);
}
```

### Layer 3 — AdsService reactive gate

```ts
class AdsService {
  private patronCached?: boolean;

  /** Called from PaymentsService.activatePatron — immediate sticky-hide. */
  markPatron(): void {
    this.patronCached = true;
    try { this.sdk.closeSticky?.(); } catch { /* ignore */ }
  }

  private isPatron(): boolean {
    if (this.patronCached !== undefined) return this.patronCached;
    return Boolean(this.save.load().progress.patronSupport);
  }

  async showPreloader(): Promise<boolean> {
    if (this.isPatron()) return false;
    // ... existing
  }

  async showInterstitial(p: string): Promise<void> {
    if (this.isPatron()) return;
    // ... existing
  }

  showStickyBanner(p: string): void {
    if (this.isPatron()) return;
    // ... existing
  }

  async showRewardedVideo(p: string): Promise<boolean> {
    if (this.isPatron()) {
      this.analytics.track("rewarded_offer_skipped", { placement: p, reason: "patron" });
      return false;
    }
    // ... existing
  }
}
```

**Rewarded UI gate** (call-sites — `RewardScene` основной + потенциально `GameScene`):
```ts
const canShowRewarded = !save.load().progress.patronSupport;
```
Simplified per qwen MIN feedback — `canUsePayments` clause был избыточен.

### Layer 4 — ProgressState

```ts
type ProgressState = {
  // ... existing
  patronSupport?: boolean;
  patronBonusGranted?: boolean;  // +300 coins guard — true after first activate ANY device
  patronPushShown?: boolean;
};
```

`SaveService.isValidSaveState` — добавить optional boolean validation:
```ts
if (state.progress.patronSupport !== undefined && typeof state.progress.patronSupport !== "boolean") return false;
// аналогично для patronBonusGranted, patronPushShown
```

`createInitialProgressState` — defaults `undefined` (treated as falsy). Никаких migration steps — optional fields.

**`save.updateProgress` contract:** возвращает new state, не mutate. Все примеры в plan'е используют spread:
```ts
this.save.updateProgress((p) => ({ ...p, patronSupport: true }));
```

### Layer 5 — AchievementsReconciler

Добавить два метода:
```ts
class AchievementsReconciler {
  private patronJustActivated = false;
  private patronJustActivatedTimer?: number;

  markPatronJustActivated(): void {
    this.patronJustActivated = true;
    if (this.patronJustActivatedTimer) clearTimeout(this.patronJustActivatedTimer);
    this.patronJustActivatedTimer = window.setTimeout(() => {
      this.patronJustActivated = false;
    }, 1800);
  }

  // existing reconcile() — internal, при detection нового unlock'а
  // для tag="patron" с patronJustActivated=true — задержать onNewUnlock на 1.8s
  // чтобы patron thank-you toast успел показаться первым
}
```

В onNewUnlock-trigger: если `tag === "patron" && patronJustActivated`:
```ts
setTimeout(() => this.onNewUnlock?.(tag), 1800);
```
Иначе — immediate.

### Layer 6 — Achievement `patron`

`src/data/achievements.ts`:
```ts
{ tag: "patron", compute: (s) => Boolean(s.progress.patronSupport) }
```

`src/data/achievementUiMeta.ts`:
```ts
{ tag: "patron", groupTag: "community", order: 3, titleKey: "ach_patron_title", descriptionKey: "ach_patron_description" }
```

**`patron.png` placeholder:** не `locked-generic.png` (выглядит как замок). Использую копию `first_win.png` (brass-star pattern) или inline SVG `★`. Custom art v0.3.61. TODO в файле.

**GP upload:** `scripts/uploadAchievements.mjs` — идемпотентный, перезапуск создаст 21-ю запись + добавит в группу community.

**Tests:**
- `achievements.test.ts:14` count 20 → 21
- `achievementIconsExist.test.ts` — авто-проверит patron.png
- `buildAchievementsViewModel.test.ts` — parity-test

### Layer 7 — Archive entry `author_thanks`

**Гейтирование (новый паттерн):** entry не привязан к route node, нужно отдельный path.

`src/scenes/DiaryScene.ts:buildArchiveEntries()` — append-after-completion:
```ts
const entries = ... existing logic ...;
if (progress.patronSupport) {
  const entry = getNarrativeEntry("author_thanks", locale);
  const speaker = getNarrativeSpeakerProfile("author", locale);
  if (entry && speaker) {
    entries.unshift({  // на верху списка
      entryId: "author_thanks",
      pointLabel: i18n.t("authorThanksPointLabel"),
      author: speaker.fullName,
      excerpt: entry.excerpt ?? "",
      body: entry.body,
      portraitUrl: undefined,  // initials-кружок fallback
      initials: speaker.initials,
      accent: speaker.accent,
      speakerEntityId: "author",
      // marker для openEntryDetail special-case
      isAuthorThanks: true,
    });
  }
}
```

**Detail navigation:** `openEntryDetail(entry)` обычно делает `getNodeByEntryId(entryId)` → переход в DetailScene с node. Для `author_thanks` нет node:

```ts
private openEntryDetail(entry: ArchiveEntryVm): void {
  if (entry.isAuthorThanks) {
    // Special path — открыть в отдельном detail overlay по entryId, без node
    this.scene.start(SCENES.detail, { authorThanksEntry: true, returnTo: "diary" });
    return;
  }
  const node = getNodeByEntryId(entry.entryId);
  // ... existing
}
```

`DetailScene` — добавить `init({authorThanksEntry, returnTo})` branch, рендерить entry без node-specific UI (no related artifacts panel, no chapter progression).

**Speaker `author`** в `src/data/narrative/speakers.ts`:
```ts
ru.author: { fullName: "Автор экспедиции", shortName: "Автор", initials: "АЭ", accent: "#c9a76a", portraitKey: "author" },
global.author: { fullName: "Author of the expedition", shortName: "Author", initials: "AE", accent: "#c9a76a", portraitKey: "author" },
tr.author: same as global,
```

`resolvePortraitUrl("author")` → undefined (webp нет) → initials-кружок (существующий code path).

**Entry text — file pattern:** `entries.{ru,global,tr,es,pt,de,fr}.ts` (НЕТ `entries.en.ts` — `global` это EN-fallback alias).

```ts
// entries.ru.ts
author_thanks: {
  speakerEntityId: "author",
  excerpt: "Если экспедиция отозвалась — спасибо.",
  body: "Я делал эту игру один — текст, музыку, иллюстрации. Если экспедиция отозвалась — спасибо. Реклама теперь не будет вас отвлекать.\n\nДорога открыта.",
}
// entries.global.ts (EN fallback for en/es/pt/de/fr)
author_thanks: {
  speakerEntityId: "author",
  excerpt: "If the expedition resonated — thank you.",
  body: "I made this game alone — text, music, illustrations. If the expedition resonated — thank you. Ads will no longer distract you.\n\nThe road is open.",
}
// entries.tr.ts — turkish translation
// остальные локали fallback через global
```

### Layer 8 — Settings UI

`settingsSceneOverlay.ts` — section между sound и version, conditional:

```html
<section class="settings-page__patron" data-show="canPurchasePatron">
  <button class="settings-page__patron-button" data-settings-action="open-patron">
    <span class="settings-page__patron-title">{i18n.supportAuthor}</span>
    <span class="settings-page__patron-subtitle">{i18n.supportAuthorSubtitle}</span>
  </button>
</section>
<!-- Restore — independent, видна если payments available даже если уже patron -->
<button class="settings-page__patron-restore" data-settings-action="restore-patron"
        data-show="canRestore">
  {i18n.restorePurchase}
</button>
```

Compute flags в SettingsScene:
```ts
const canPurchasePatron = payments.canPurchasePatron();
const canRestore = payments.canUsePayments() && !save.load().progress.patronSupport;
```

**Patron dialog** — отдельный module `src/ui/patronDialog.ts`. Использует
`createCanvasAnchoredOverlay` для modal + `lockClicksFor(350)` на open/close
(существующий ghost-click pattern). HTML:

```
┌─ Поддержать автора ─────────────────┐
│                                      │
│  Игра — мой одиночный проект.        │
│  Если экспедиция нашла отклик —      │
│  спасибо.                            │
│                                      │
│  ✓ Реклама исчезает полностью        │
│  ✓ +300 монет в благодарность        │
│  ✓ Записка от автора в архиве        │
│  ✓ Ачивка «Меценат экспедиции»       │
│                                      │
│  Цена: ${nativePrice}                │
│                                      │
│  [ Поддержать ] [ Не сейчас ]        │
└──────────────────────────────────────┘
```

`{nativePrice}` — из `payments.getPatronPrice()`. Если null (oфлайн / catalog
не загружен) — скрыть price-строку, native purchase-flow всё равно покажет.

**Кнопка «Поддержать»:**
1. `disabled` + `is-loading` class пока promise в air
2. `await payments.purchasePatron("settings")`
3. На `ok=true`:
   - toast «Спасибо за поддержку!» (key `patronThankYouToast`)
   - close dialog
   - re-render Settings (кнопка исчезнет)
   - `achievements.reconcile` уже вызван в activatePatron → `patron` ачивка-toast выстрелит с +1.8s delay
4. На `ok=false`: toast «Не удалось завершить покупку. Попробуйте ещё раз.» (key `patronError`), dialog остаётся

**Analytics event timing:**
- `patron_purchase_open` — на mount dialog'а (НЕ внутри purchasePatron)
- `patron_purchase_attempt` — на click "Поддержать"

**Restore button** → confirmation toast:
- `alreadyActive=true` → «Вы уже поддержали проект»
- `ok=true` (restored) → «Покупка восстановлена. Спасибо!»
- `ok=false, alreadyActive=false` → «Покупка не найдена. Если оплачивали — попробуйте позже»

### Layer 9 — Post-3-wins push (RewardScene-triggered)

**Trigger в `RewardScene.continue-handler`** (на пути из Reward → Map):

```ts
private handleContinue(): void {
  const { save, payments } = getAppContext();
  const before = save.load().progress;

  // existing logic — increment completedNodes, persist, etc.

  const after = save.load().progress;
  const justCrossed3 = after.completedNodes.length === 3 && before.completedNodes.length < 3;
  const showPush =
    payments.canPurchasePatron() &&
    justCrossed3 &&
    !after.patronPushShown;

  this.scene.start(SCENES.map, { showPatronPush: showPush });
}
```

**MapScene.create({showPatronPush})** — если `true`, mount dialog с delay 600ms:

```ts
init(data: MapSceneData & { showPatronPush?: boolean }) {
  this.pendingPatronPush = Boolean(data?.showPatronPush);
}

create() {
  // ... existing
  if (this.pendingPatronPush) {
    this.pendingPatronPush = false;
    const timer = this.time.delayedCall(600, () => {
      // Only show if scene still active and player still eligible
      if (!this.scene.isActive() || !getAppContext().payments.canPurchasePatron()) return;
      this.openPatronPush();  // shared с Settings dialog
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove());
  }
}

private openPatronPush(): void {
  const { save, payments, analytics } = getAppContext();
  // patronPushShown ставим ВНУТРИ — на impression, не на eligibility
  save.updateProgress((p) => ({ ...p, patronPushShown: true }));
  save.flush();  // immediate — guard от повторного показа на refresh
  analytics.track("patron_purchase_open", { source: "post_win_push" });
  // ... render dialog (same as Settings dialog, минус «Восстановить»)
}
```

**Dialog в post-win-push контексте:** только две кнопки — `[ Поддержать ]` и
`[ Не сейчас ]`. Без «Не показывать снова» (флаг patronPushShown уже не даст
повтор).

### Layer 10 — Boot integration

`src/scenes/BootScene.ts:create()`:

```ts
// 1. Init SDK через factory
const sdk = createSdkService();
await sdk.init();

// 2. ... existing services (analytics, sound, save, i18n)
await save.init(sdk);

// 3. AchievementsReconciler (existing)
const achievements = new AchievementsReconciler(sdk, save, (tag) => {
  // ... existing toast logic
});

// 4. AdsService (existing)
const ads = new AdsService(sdk, analytics, save);

// 5. NEW: PaymentsService
const payments = new PaymentsService(sdk, analytics, save, achievements, ads);

// 6. Set context
setAppContext({ analytics, ads, i18n, save, sound, sdk, achievements, payments });

// 7. Fire-and-forget restore — НЕ AWAIT
payments.restoreOnBoot();  // returns Promise but we don't await
// На первом cross-device запуске patron может увидеть 1 ad в течение ~5s,
// AdsService.isPatron() переключится после activatePatron() → markPatron().

// 8. ... existing flow (preloader, signalReady, etc.)
```

`AppContext` += `payments: PaymentsService`.

### Layer 11 — Analytics (6 events)

| event | payload |
|---|---|
| `patron_purchase_open` | `{ source: "settings" \| "post_win_push", blocked?: "not_eligible" }` |
| `patron_purchase_attempt` | `{ source }` |
| `patron_purchase_success` | `{ source }` |
| `patron_purchase_cancelled` | `{ source, reason }` |
| `patron_purchase_error` | `{ source, reason }` |
| `patron_purchase_restore` | `{ found: boolean, source?: "boot" \| "manual", reason? }` |

Лог-only через `analytics.track()`.

### Layer 12 — i18n (15 keys × 7 locales)

`src/services/i18n/locales.ts`:
```
supportAuthor                 # «Поддержать автора»
supportAuthorSubtitle         # «Спасибо, если игра отозвалась»
patronDialogTitle             # «Поддержать автора»
patronDialogBody              # параграф-описание (одиночный проект, спасибо)
patronBenefitAds              # «Реклама исчезает полностью»
patronBenefitCoins            # «+300 монет в благодарность»
patronBenefitArchive          # «Записка от автора в архиве»
patronBenefitAchievement      # «Ачивка «Меценат экспедиции»»
patronConfirmButton           # «Поддержать»
patronCancelButton            # «Не сейчас»
patronThankYouToast           # «Спасибо за поддержку!»
patronError                   # «Не удалось завершить покупку.»
restorePurchase               # «Восстановить покупку»
authorThanksPointLabel        # «От автора»
ach_patron_title              # «Меценат экспедиции»
ach_patron_description        # «Поддержали автора и помогли продолжить экспедицию.»
```

Это **16 ключей** (R1 plan был 15 — R2 добавил `patronError`). × 7 локалей = **112 строк**.

**Качество:** ru + en — ручные. tr/es/pt/de/fr — EN fallback через
`locales[locale][key] ?? locales.en[key]`. Regression-test проверяет наличие
всех 16 ключей в ru и en.

### Layer 13 — GP / Yandex product setup

**GP:**
- `scripts/uploadPatronProduct.mjs` — GraphQL `CreatePayment`/`UpdatePayment` mutation
- Tag: `patron_support`, **type: non-consumable** (permanent purchase, должен сохраняться через restore)
- Price: 199 ₽ (с авто-конверсией платформы для других регионов)
- Multi-locale names/descriptions
- Icon: upload via `UploadImage` mutation

**Yandex (MANUAL):**
- Yandex Console → Project → Goods → Create
- ID: `patron_support` (совпадает с GP tag)
- Type: **permanent** (non-consumable) — Yandex терминология
- Price: 199 ₽
- Title/description ru
- Icon
- **Дополнительные prerequisites (codex M-15):**
  - Договор с Yandex Games обязателен
  - Включить «Платежи» в проекте
  - Дождаться moderation review (1-3 дня)
- Документировано в `docs/specs/2026-05-16-patron-iap-setup.md`

## File-level changes

### Files to modify

| Path | Change |
|---|---|
| `src/services/sdk/SdkService.ts` | + 3 payment methods + types |
| `src/services/sdk/GamePushSdkService.ts` | + payments impl (по typed docs) |
| `src/services/sdk/YandexSdkService.ts` | + payments impl + getPayments в init |
| `src/services/sdk/DevStubSdkService.ts` | + payments stub (localStorage-backed) |
| `src/services/ads/AdsService.ts` | gate 4 methods + `markPatron()` reactive |
| `src/services/save/SaveService.ts` | validate новые поля в isValidSaveState |
| `src/services/achievements/AchievementsReconciler.ts` | + markPatronJustActivated + delayed toast |
| `src/core/game-state/types.ts` | + patronSupport, patronBonusGranted, patronPushShown |
| `src/app/config/appContext.ts` | + payments: PaymentsService |
| `src/scenes/BootScene.ts` | factory + PaymentsService + fire-and-forget restore |
| `src/scenes/SettingsScene.ts` | patron section + dialog handlers + restore |
| `src/scenes/settingsSceneOverlay.ts` | + 2 buttons HTML |
| `src/scenes/RewardScene.ts` | + post-3-wins push trigger; hide rewarded UI для patron |
| `src/scenes/MapScene.ts` | + receive showPatronPush flag + delayed dialog |
| `src/scenes/DiaryScene.ts` | + author_thanks append + special openEntryDetail path |
| `src/scenes/DetailScene.ts` | + authorThanksEntry mode |
| `src/data/achievements.ts` | + patron compute |
| `src/data/achievements.test.ts` | count 20 → 21 |
| `src/data/achievementUiMeta.ts` | + patron UI meta |
| `src/data/narrative/speakers.ts` | + author profile (ru/global/tr) |
| `src/data/narrative/entries.ru.ts` | + author_thanks |
| `src/data/narrative/entries.global.ts` | + author_thanks (EN fallback) |
| `src/data/narrative/entries.tr.ts` | + author_thanks |
| `src/data/narrative/entries.{es,pt,de,fr}.ts` | + author_thanks (стартово EN-fallback, можно перевести позже) |
| `src/services/i18n/locales.ts` | + 16 ключей × 7 локалей |
| `src/styles.css` | + .settings-page__patron, .patron-dialog__*, .settings-page__patron-restore |
| `public/assets/achievements/patron.png` | brass-star placeholder (copy of first_win.png) |
| `env.d.ts` (или main env types file) | + gp.payments + Yandex Payments shapes |
| `package.json` | 0.3.59 → 0.3.60 |

### New files

| Path | Purpose |
|---|---|
| `src/services/sdk/createSdkService.ts` | factory с runtime detection |
| `src/services/payments/PaymentsService.ts` | core service |
| `src/services/payments/PaymentsService.test.ts` | unit tests (10+) |
| `src/services/payments/withTimeout.ts` | Promise-race helper (или re-use если уже есть) |
| `src/ui/patronDialog.ts` | HTML builder (canvasAnchoredOverlay) |
| `src/ui/patronDialog.test.ts` | snapshot test |
| `scripts/uploadPatronProduct.mjs` | GP-side product registration |
| `docs/specs/2026-05-16-patron-iap-setup.md` | Yandex + GP setup runbook |

## Tests

1. **`PaymentsService.test.ts`** (new):
   - happy-path purchase: save flags set, +300 coins, analytics events, markPatron called, reconcile called
   - `canUsePayments=false` → early return without analytics
   - cancelled → `patron_purchase_cancelled`, no save mutation
   - error → `patron_purchase_error`
   - **in-flight lock:** second purchase call while first pending → returns `{ok:false}` без duplicate
   - **restoreOnBoot fire-and-forget:** returns Promise immediately; activates async
   - **restoreOnBoot timeout 5s:** fail-soft, no exception bubbled
   - **restore: bonus granted only once:** purchase first → +300; restore on second device → no extra coins (patronBonusGranted protects)
   - **restore: alreadyActive case:** save flag already true → skip, no analytics duplicate
   - **manual restore success/failure paths**

2. **`AdsService.test.ts`** (extend):
   - patron flag → 4 ad-types skipped
   - `markPatron()` → immediate sticky-hide + flag cached
   - sticky hidden also closes existing banner via `sdk.closeSticky()`

3. **`patronDialog.test.ts`** (new):
   - HTML renders title, body, 4 benefits, 2 buttons + price если provided
   - data-action attrs, aria-labels
   - price hidden when null

4. **`achievements.test.ts`** (update count 20→21 + patron compute test)

5. **`achievementIconsExist.test.ts`** — auto-checks patron.png

6. **`DiaryScene.integration.test.ts`** (new или extend):
   - patron=false → no author_thanks entry
   - patron=true → entry at top, initials-кружок fallback
   - click on author_thanks → DetailScene receives `authorThanksEntry:true`

7. **`DetailScene.test.ts`** — authorThanksEntry branch renders без node-specific UI

8. **`SaveService.test.ts`** — validate новые boolean поля accept/reject malformed

9. **`Locale parity`** — все 16 ключей в ru + en

10. **`BootScene.test.ts`** — factory выбирает correct adapter on platform=X URL param

## Verification

`npm test` — 210 → ~230 (+20 тестов).

`npm run build` — typecheck чистый (env.d.ts types ключевые).

**Manual QA (GP sandbox):**
1. Fresh save: кнопки «Поддержать» нет в Settings (DevStub в prod = canUsePayments=false)
2. На GP-sandbox: кнопка появляется
3. Сыграть 2 победы — после Reward → Map плашки нет
4. Сыграть 3-ю победу — плашка появляется в MapScene с delay 600ms
5. Закрыть «Не сейчас» → больше не появляется
6. Refresh → плашки нет (patronPushShown сохранён, flush сработал)
7. Открыть Settings → click «Поддержать» → dialog с цена-строкой
8. Двойной клик «Поддержать» → второй не открывает duplicate purchase
9. Покупка success → toast «Спасибо!» + через 1.8s toast «Ачивка Меценат»
10. Sticky banner был → исчез сразу
11. Refresh → patron сохранился, ads полностью скрыты
12. Открыть Архив → запись «От автора» в начале, click → DetailScene
13. AchievementsScene → patron unlocked в community-group
14. Coins: было N → теперь N+300
15. Clear localStorage + relogin → restoreOnBoot восстанавливает; **бонус НЕ дублируется** (patronBonusGranted)
16. Yandex sandbox: same flow + login flow для restore unauthorized case
17. **Crazy/Poki через GP-distribution:** `canUsePayments=false` (через `gp.payments.isAvailable`) → кнопки не появляются

**Diagnostic logging:**
- `[gp.payments.purchase] raw <err>` при первом error для discovery shape
- `[yandex.purchase] raw <err>` аналогично
- `[payments]` для всех мутаций save

## Phases (для execution)

1. **env.d.ts + SDK foundation** (~3h): types + interface + 3 adapters + factory + tests
2. **Save / ProgressState / validation** (~1.5h): 3 fields + isValidSaveState + tests
3. **AchievementsReconciler delays** (~1h): markPatronJustActivated + delayed toast
4. **PaymentsService** (~4h): сервис + in-flight lock + activatePatron + restoreOnBoot + manual restore + 10+ tests
5. **AdsService gate** (~1.5h): 4 methods + markPatron + sticky-close + tests
6. **Achievement patron registration** (~1h): compute + UI meta + PNG placeholder + count test update
7. **Speaker + archive entry** (~2.5h): speakers.ts + 7 entries files + DiaryScene append + DetailScene branch + tests
8. **i18n keys** (~1.5h): 16 × 7 (ru/en hand, rest fallback)
9. **Settings UI + dialog** (~3.5h): overlay + dialog module + restore button + click handlers + styles
10. **RewardScene push trigger + MapScene receiver** (~1.5h): justCrossed3 logic + delayed dialog + impression flag
11. **BootScene factory + restoreOnBoot wiring** (~1h)
12. **GP product setup** (~2h): uploadPatronProduct.mjs + dashboard validation
13. **Yandex product setup** (~1.5h): manual через console + runbook docs + договор check
14. **End-to-end QA GP/Yandex** (~3h)

**Total estimate:** ~28h. Полтора-два дня sprint.

## Risks

| Risk | Mitigation |
|---|---|
| GP `gp.payments.purchase()` event-based, не Promise | Sandbox verification до code freeze. Fallback wrapper с singleton listener (gp-013 pattern) ready to switch on. |
| Yandex IAP отвергнут как «донат» | Visible benefit (no-ads + coins + archive + achievement) делает это commerce. Если отвергнут — fallback title «Pack без рекламы», subtitle «Поддержать автора» |
| Crazy/Poki GP-distribution блокирует IAP | `gp.payments.isAvailable=false` корректно вернёт `canUsePayments=false`, button скрыта |
| Cross-device coin loss (purchase device A, restore device B без +300) | `patronBonusGranted` flag — idempotent грант на первой активации в save state. Если на device A произошло flush — device B загрузит флаги вместе. Если flush не успел — restore на device B активирует patronSupport+patronBonusGranted+coins |
| App crash после purchase, до save.flush | save.flush awaited; покупка отражена в платформе → next boot restoreOnBoot восстановит. Coins gate через patronBonusGranted всё равно сработает один раз |
| Refund / revocation от platform | Out-of-scope v0.3.60. Если platform отзовёт — клиент продолжит верить save (false-patron). Будущая фича: periodic re-check через restoreOnBoot и downgrade. |
| Player buys offline (cached purchase token, sync later) | GP/Yandex SDK обрабатывают; sync через `gp.player.sync()` дёргается на flush |
| Локализация tr/es/pt/de/fr плохая | EN fallback. Качество в v0.3.61 |
| Achievement `patron` toast пересекается с thank-you toast | 1.8s delay в reconciler для post-purchase context |
| `patronPushShown` повторный показ если scene уйдёт до setTimeout | Flag ставится ВНУТРИ openPatronPush, не на eligibility |
| `getProductInfo` блокирует UI | dialog рендерит без price, async fetch обновляет price field когда вернётся. Никаких await перед mount |
| `localStorage` quota / private mode | try/catch вокруг setItem; fast-path просто не работает, restoreOnBoot всё равно срабатывает |

## Open questions (parked для v0.3.61+)

- Custom art: patron.png + portrait автора
- Refund/revocation detection
- Multi-tier IAP
- «Подарить другу» gift-purchase
- Periodic entitlement re-check (защита от cracked saves)
- Custom rewarded compensation вместо +300 flat (например, 5× free post-win bonuses)
