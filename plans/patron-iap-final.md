# Patron IAP — «Поддержать автора + ad-free» (v0.3.60) — FINAL

## Status

**Plan-review-loop:** R1 → R7 через codex + qwen.
- Qwen: **NSC** в R4-R7 (4 раунда подряд)
- Codex: dropped repeated concerns в R5; R7 (hard ceiling) выявил 4 surgical bug'а

**R7-ceiling fixes (U1-U4) applied here unreviewed по user-approved Option A.** Все surgical (3-10 строк каждый), real bugs (не taste). Code-review during execution + test coverage compensates absence of R8 reviewer pass.

## Context

В v0.3.59 ачивки + UI закатили. Single IAP «Поддержать автора + ad-free» с
positive emotional framing для narrative-проекта. ~199 RUB, полное ad-free
(incl rewarded), +300 coins bonus, achievement `patron`, archive entry от автора.

**User-locked decisions:**
1. Кнопка в Settings + одноразовая плашка после 3-х побед (RewardScene trigger)
2. Полное ad-free incl rewarded; +300 coins compensation
3. Placeholder art (locked-generic-style + initials-portrait), custom v0.3.61
4. Speaker «Автор экспедиции», EN «Author of the expedition»

## Scope

- SDK extension (`canUsePayments` / `getProductInfo` / `purchase` / `getPurchases` / `closeSticky` / `triggerLogin`)
- 3 adapters (GamePush / Yandex / DevStub) + factory с build-flag primary + DEV-only URL override
- `env.d.ts` shapes для gp.payments + Yandex Payments
- `vite.config.ts` + `package.json` build-flag (`__PLATFORM__` define + cross-env scripts)
- PaymentsService (analog AdsService) с inFlight lock, late-restore chain, manual + boot restore
- AdsService gate на 4 ad types + reactive markPatronConfirmed/setPatronOptimistic/clearPatronOptimistic
- ProgressState fields: `patronSupport`, `patronBonusGranted`, `patronGrantedAt`, `patronPushShown`
- Achievement `patron` (community / order=3 / non-hidden) + `markPatronJustActivated` delayed-toast
- Archive entry `author_thanks` + speaker `author` (ru/global/tr; fallback covers all 7 locales)
- DetailScene `authorThanksEntry` mode (node-less render)
- Settings UI: «Поддержать» button + dialog + «Восстановить покупку» button с Yandex login flow
- Post-3-wins push triggered in RewardScene.continue, mounted в MapScene.create
- 21 i18n keys × 7 locales (~147 strings)
- 7 analytics events (open / blocked / attempt / success / cancelled / error / restore)
- `scripts/uploadPatronProduct.mjs` (GP) + manual Yandex setup runbook
- Centralized `confirmPatronEntitlement(origin)` helper (ad + ach + reconcile в одном месте)

## Architecture

### Layer 1 — SDK extension + env + factory + build flag

#### `env.d.ts` types

```ts
declare global {
  interface Window {
    __gp?: {
      // ... existing
      payments?: {
        isAvailable: boolean;
        fetchProducts(): Promise<void>;
        products?: Array<{ tag: string; price: string; priceValue?: number; currency?: string; title?: string }>;
        purchases: Array<{ tag: string; price: string; currency?: string }>;  // catalog! НЕ entitlement
        has(tag: string): boolean;  // canonical entitlement
        purchase(args: { tag: string }): Promise<{ tag: string }>;
        consume(args: { tag: string }): Promise<void>;
      };
    };
    YaGames?: { init(options?: unknown): Promise<YaSdk> };
  }
}

type YaSdk = {
  getPayments(options?: { signed?: boolean }): Promise<YaPayments>;
  auth?: { openAuthDialog(): Promise<void> };
  isAuthorized?(): Promise<boolean>;
};
type YaPayments = {
  purchase(args: { id: string; developerPayload?: string }): Promise<YaPurchase>;
  getPurchases(): Promise<YaPurchase[]>;
  getCatalog(): Promise<YaProduct[]>;
  consumePurchase(token: string): Promise<void>;
};
type YaPurchase = { productID: string; purchaseToken?: string; developerPayload?: string; purchaseTime?: number };
type YaProduct = { id: string; title: string; description: string; price: string; priceValue: string; priceCurrencyCode: string; imageURI?: string };

declare const __PLATFORM__: "gamepush" | "yandex" | "dev";
```

#### `vite.config.ts`

```ts
define: {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  __PLATFORM__: JSON.stringify(process.env.PLATFORM ?? "gamepush"),
}
```

#### `package.json`

```json
"scripts": {
  "build": "tsc --noEmit && vite build",
  "build:gp": "cross-env PLATFORM=gamepush npm run build",
  "build:yandex": "cross-env PLATFORM=yandex npm run build",
  "preview": "vite preview",
  "test": "vitest run"
},
"devDependencies": { "cross-env": "^7.0.3", /* ... */ }
```

#### `SdkService` interface

```ts
type ProductInfo = { tag: string; title: string; price: string };
type PurchaseResult = { ok: true } | { ok: false; reason: "cancelled" | "error" | "unavailable" | "unauthorized" };
type PurchasesResult = { ok: true; purchases: Array<{ tag: string }> } | { ok: false; reason: "timeout" | "error" | "unauthorized" | "unavailable" };
type PurchaseFailureReason = Extract<PurchasesResult, { ok: false }>["reason"];

interface SdkService {
  // ... existing methods
  canUsePayments(): boolean;
  getProductInfo(tag: string): Promise<ProductInfo | null>;
  purchase(tag: string): Promise<PurchaseResult>;
  getPurchases(): Promise<PurchasesResult>;
  /** Hide active sticky banner. Required (no-op default в unsupported adapters). */
  closeSticky(): void;
  /** Trigger native login dialog. Required (no-op default где не applicable). */
  triggerLogin(): Promise<void>;
}
```

#### Factory с DEV-only URL override

```ts
export function createSdkService(): SdkService {
  const forced = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("platform")
    : null;
  if (forced === "yandex") return new YandexSdkService();
  if (forced === "gamepush") return new GamePushSdkService();
  if (forced === "dev") return new DevStubSdkService();
  if (__PLATFORM__ === "gamepush") return new GamePushSdkService();
  if (__PLATFORM__ === "yandex") return new YandexSdkService();
  return new DevStubSdkService();
}
```

#### GamePush adapter — entitlement via `has(tag)`

```ts
private productsFetched = false;

async getProductInfo(tag: string): Promise<ProductInfo | null> {
  if (!this.gp?.payments) return null;
  try {
    if (!this.productsFetched) {
      await this.gp.payments.fetchProducts();
      this.productsFetched = true;
    }
  } catch (err) { console.warn("[gp.fetchProducts]", err); return null; }
  const catalog = this.gp.payments.products ?? this.gp.payments.purchases;
  const p = catalog.find(x => x.tag === tag);
  return p ? { tag, title: p.title ?? tag, price: p.price } : null;
}

async getPurchases(): Promise<PurchasesResult> {
  if (!this.gp?.payments) return { ok: false, reason: "unavailable" };
  try {
    if (!this.productsFetched) {
      await this.gp.payments.fetchProducts();
      this.productsFetched = true;
    }
  } catch (err) { console.warn("[gp.fetchProducts]", err); return { ok: false, reason: "error" }; }
  // CRITICAL: `has(tag)` это canonical entitlement check, не iterate `purchases`
  const tags = [PATRON_TAG];
  const userPurchases = tags.filter(t => this.gp!.payments!.has(t));
  return { ok: true, purchases: userPurchases.map(tag => ({ tag })) };
}

async purchase(tag: string): Promise<PurchaseResult> {
  if (!this.gp?.payments) return { ok: false, reason: "unavailable" };
  try {
    await this.gp.payments.purchase({ tag });
    return { ok: true };
  } catch (err) {
    console.error("[gp.payments.purchase] raw", err);
    return { ok: false, reason: this.classifyGpError(err) };
  }
}

closeSticky(): void {
  try { (this.gp?.ads as { closeStickyBanner?: () => void } | undefined)?.closeStickyBanner?.(); }
  catch (err) { console.warn("[gp.closeStickyBanner]", err); }
}

triggerLogin(): Promise<void> {
  return Promise.resolve();  // GP handles player auth in host
}
```

#### Yandex adapter

```ts
async getPurchases(): Promise<PurchasesResult> {
  if (!this.payments) return { ok: false, reason: "unavailable" };
  try {
    const list = await this.payments.getPurchases();
    return { ok: true, purchases: list.map(p => ({ tag: p.productID })) };
  } catch (err) {
    console.error("[yandex.getPurchases] raw", err);
    if (this.isUnauthorized(err)) return { ok: false, reason: "unauthorized" };
    return { ok: false, reason: "error" };
  }
}

async triggerLogin(): Promise<void> {
  try { await this.sdk?.auth?.openAuthDialog(); }
  catch (err) { console.warn("[yandex.auth]", err); }
}

closeSticky(): void { /* no-op — Yandex sticky controlled externally */ }
```

### Layer 2 — PaymentsService

```ts
export const PATRON_TAG = "patron_support";
export const PATRON_BONUS_COINS = 300;
const PATRON_LOCAL_KEY = "isPatron";
const RESTORE_BOOT_TIMEOUT_MS = 1500;
const RESTORE_MANUAL_TIMEOUT_MS = 10000;  // U3

export type RestoreManualResult =
  | { ok: true; alreadyActive: boolean; mismatch?: boolean }
  | { ok: false; alreadyActive: boolean; reason: PurchaseFailureReason | "not_found" };

export class PaymentsService {
  private inFlight = false;
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

  async getPatronPrice(): Promise<string | null> {
    try {
      const info = await this.sdk.getProductInfo(PATRON_TAG);
      return info?.price ?? null;
    } catch (err) { console.warn("[payments.getPatronPrice]", err); return null; }
  }

  onChange(listener: (isPatron: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * **U1 (R7-ceiling fix):** local entitlement confirmation BEFORE early return
   * на unavailable payments. Existing patron на Crazy/Poki / temporary SDK failure
   * не должен видеть ads.
   *
   * **U4 (R7-ceiling fix):** helper включает `achievements.reconcile()` чтобы
   * preserved-path repair'ил ачивки если save имеет patronSupport=true но ach
   * не unlocked (post-crash / migration edge).
   */
  private confirmPatronEntitlement(origin: "purchase" | "restore" | "preserved"): void {
    this.ads.markPatronConfirmed();
    if (origin === "purchase") {
      this.achievements.markPatronJustActivated();
    }
    this.achievements.reconcile(this.save.load().progress);  // U4: idempotent repair
  }

  async purchasePatron(source: "settings" | "post_win_push"): Promise<{ ok: boolean }> {
    if (this.inFlight) {
      this.analytics.track("patron_purchase_blocked", { source, reason: "in_flight" });
      return { ok: false };
    }
    if (!this.canPurchasePatron()) {
      this.analytics.track("patron_purchase_blocked", { source, reason: "not_eligible" });
      return { ok: false };
    }
    this.inFlight = true;
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
      this.inFlight = false;
    }
  }

  /**
   * U3 (R7-ceiling fix): wrap getPurchases in timeout. SDK hang НЕ должен
   * lock'ать inFlight permanent.
   */
  async restorePatronManual(): Promise<RestoreManualResult> {
    if (this.inFlight) {
      this.analytics.track("patron_purchase_blocked", { source: "restore", reason: "in_flight" });
      return { ok: false, alreadyActive: false, reason: "error" };
    }
    this.inFlight = true;
    try {
      const localPatron = this.save.load().progress.patronSupport === true;
      // U3: bounded
      const result = await withTimeout(
        this.sdk.getPurchases(),
        RESTORE_MANUAL_TIMEOUT_MS,
        { ok: false, reason: "timeout" as const } as PurchasesResult,
      );

      if (!result.ok) {
        this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: "manual" });
        if (localPatron) this.confirmPatronEntitlement("preserved");  // V1
        return { ok: false, alreadyActive: localPatron, reason: result.reason };
      }
      const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

      if (!platformPatron && localPatron) {
        console.warn("[payments] manual restore: platform NOT patron, local says yes");
        this.analytics.track("patron_purchase_restore", { found: false, source: "manual", note: "local_only" });
        this.confirmPatronEntitlement("preserved");
        return { ok: true, alreadyActive: true, mismatch: true };
      }
      if (platformPatron && !localPatron) {
        await this.activatePatron("restore");
        this.analytics.track("patron_purchase_restore", { found: true, source: "manual" });
        return { ok: true, alreadyActive: false };
      }
      if (platformPatron && localPatron) {
        this.confirmPatronEntitlement("preserved");
        return { ok: true, alreadyActive: true };
      }
      this.analytics.track("patron_purchase_restore", { found: false, source: "manual" });
      return { ok: false, alreadyActive: false, reason: "not_found" };
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * U1 (R7-ceiling fix): confirm local entitlement BEFORE early return on
   * `!canUsePayments`. Existing patrons на Crazy/Poki/etc all paths get sticky-close.
   *
   * U2 (R7-ceiling fix): timeout does NOT consume SDK result. Late positive SDK
   * response может ещё activate. Only optimistic-clear is timeout-bound.
   */
  async restoreOnBoot(): Promise<void> {
    // U1: confirm local entitlement first, regardless of payments availability
    const localPatron = this.save.load().progress.patronSupport === true;
    if (localPatron) {
      this.confirmPatronEntitlement("preserved");
    }

    if (!this.canUsePayments()) {
      // U1: ads уже confirmed выше для local-patron case
      return;
    }

    let localHint = false;
    try {
      if (typeof localStorage !== "undefined") {
        localHint = localStorage.getItem(PATRON_LOCAL_KEY) === "true";
      }
    } catch { /* private mode */ }

    if (localHint && !localPatron) {
      console.info("[payments] local hint optimistic ad-suppression");
      this.ads.setPatronOptimistic();
    }

    const ctx = { localHint, localPatron, source: "boot" as const };

    // U2: separate timeout-for-optimistic-clear от SDK-result-processing.
    // SDK promise обрабатывается через .then() ВСЕГДА, даже если timeout уже
    // прошёл. Optimistic-clear at timeout — best-effort cleanup только.
    let sdkResolved = false;

    this.sdk.getPurchases()
      .then(result => {
        sdkResolved = true;
        return this.processRestoreResult(result, ctx);
      })
      .catch(err => {
        console.warn("[payments] getPurchases threw", err);
        sdkResolved = true;
        return this.processRestoreResult({ ok: false, reason: "error" }, ctx);
      });

    // Bounded boot — return control after timeout regardless
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!sdkResolved && ctx.localHint && !ctx.localPatron) {
          // U2: only clear optimistic if SDK hasn't responded yet AND no local entitlement
          // Late SDK response может still activate если patron — это OK
          console.info("[payments] boot timeout — clearing optimistic suppression while SDK still pending");
          try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch {}
          this.ads.clearPatronOptimistic();
        }
        resolve();
      }, RESTORE_BOOT_TIMEOUT_MS);
    });
  }

  private async processRestoreResult(
    result: PurchasesResult,
    ctx: { localHint: boolean; localPatron: boolean; source: "boot" | "manual" },
  ): Promise<void> {
    if (!result.ok) {
      this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: ctx.source });
      if (ctx.localPatron) {
        this.confirmPatronEntitlement("preserved");
      } else if (ctx.localHint) {
        console.info("[payments] SDK failed, local hint unverified — clearing optimistic");
        try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch {}
        this.ads.clearPatronOptimistic();
      }
      return;
    }
    const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

    if (platformPatron && !ctx.localPatron) {
      await this.activatePatron("restore");
      this.analytics.track("patron_purchase_restore", { found: true, source: ctx.source });
      return;
    }
    if (!platformPatron && ctx.localPatron) {
      console.warn("[payments] platform NOT patron, local says yes — possible refund (observability)");
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "local_only" });
      this.confirmPatronEntitlement("preserved");
      return;
    }
    if (!platformPatron && ctx.localHint && !ctx.localPatron) {
      console.info("[payments] local hint disproven — clearing optimistic");
      try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch {}
      this.ads.clearPatronOptimistic();
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "hint_disproven" });
      return;
    }
    if (platformPatron && ctx.localPatron) {
      this.confirmPatronEntitlement("preserved");
      return;
    }
  }

  private async activatePatron(origin: "purchase" | "restore"): Promise<void> {
    const before = this.save.load().progress;
    if (before.patronSupport && before.patronBonusGranted) {
      this.confirmPatronEntitlement(origin === "purchase" ? "purchase" : "preserved");
      return;
    }

    this.save.updateProgress((p) => ({
      ...p,
      patronSupport: true,
      patronBonusGranted: true,
      patronGrantedAt: p.patronGrantedAt ?? Date.now(),
      coins: p.patronBonusGranted ? p.coins : (p.coins ?? 0) + PATRON_BONUS_COINS,
    }));

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PATRON_LOCAL_KEY, "true");
      }
    } catch { /* ignore */ }

    this.confirmPatronEntitlement(origin);
    this.listeners.forEach((fn) => fn(true));

    try { await this.save.flush(); }
    catch (err) { console.error("[payments] activate flush failed; local state holds", err); }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
  ]);
}
```

### Layer 3 — AdsService

```ts
class AdsService {
  private patronCached?: boolean;

  setPatronOptimistic(): void { this.patronCached = true; /* sticky НЕ trogue */ }
  clearPatronOptimistic(): void { this.patronCached = undefined; }
  markPatronConfirmed(): void {
    this.patronCached = true;
    try { this.sdk.closeSticky(); } catch { /* safe */ }
  }

  private isPatron(): boolean {
    if (this.patronCached !== undefined) return this.patronCached;
    return Boolean(this.save.load().progress.patronSupport);
  }

  async showPreloader(): Promise<boolean> {
    if (this.isPatron()) return false;
    // existing
  }
  async showInterstitial(p: string): Promise<void> {
    if (this.isPatron()) return;
    // existing
  }
  showStickyBanner(p: string): void {
    if (this.isPatron()) return;
    // existing
  }
  async showRewardedVideo(p: string): Promise<boolean> {
    if (this.isPatron()) {
      this.analytics.track("rewarded_offer_skipped", { placement: p, reason: "patron" });
      return false;
    }
    // existing
  }
}
```

### Layer 4 — ProgressState

```ts
type ProgressState = {
  // ... existing
  patronSupport?: boolean;
  patronBonusGranted?: boolean;
  patronGrantedAt?: number;
  patronPushShown?: boolean;
};
```

`isValidSaveState` — optional boolean + number validation. `createInitialProgressState` — defaults `undefined`.

### Layer 5 — AchievementsReconciler

```ts
private patronJustActivated = false;
private patronJustActivatedTimer?: number;

markPatronJustActivated(): void {
  this.patronJustActivated = true;
  if (this.patronJustActivatedTimer) clearTimeout(this.patronJustActivatedTimer);
  this.patronJustActivatedTimer = window.setTimeout(() => {
    this.patronJustActivated = false;
  }, 1800);
}

// в onNewUnlock-trigger logic: если tag === "patron" && this.patronJustActivated → setTimeout 1.8s; иначе immediate
```

### Layer 6 — Achievement `patron`

```ts
// achievements.ts
{ tag: "patron", compute: (s) => Boolean(s.progress.patronSupport) }

// achievementUiMeta.ts
{ tag: "patron", groupTag: "community", order: 3,
  titleKey: "ach_patron_title", descriptionKey: "ach_patron_description" }
```

**`patron.png`** placeholder: копия `first_win.png` (brass-star) ИЛИ inline SVG. **НЕ** `locked-generic.png`. Custom v0.3.61.

### Layer 7 — Archive entry + speaker

**Speakers** — `resolveProfilePack(locale)` dispatches:
- ru → ru, tr → tr, остальное → global

Adding `author` profile в **3 packs только** (ru/global/tr) — auto covers 7 локалей.

**Entries** — `entries.{ru,global,tr}.ts` modify. es/pt/de/fr fallback через `getNarrativeEntry` resolver. **Pre-execution verification step:** read resolver, confirm fallback behavior. Если нет — extend resolver (one line).

**DiaryScene.buildArchiveEntries:**
```ts
if (progress.patronSupport) {
  const entry = getNarrativeEntry("author_thanks", locale);
  const speaker = getNarrativeSpeakerProfile("author", locale);
  if (entry && speaker) {
    entries.unshift({
      entryId: "author_thanks",
      pointLabel: i18n.t("authorThanksPointLabel"),
      author: speaker.fullName,
      excerpt: entry.excerpt ?? "",
      body: entry.body,
      portraitUrl: undefined,
      initials: speaker.initials,
      accent: speaker.accent,
      speakerEntityId: "author",
      isAuthorThanks: true,
    });
  }
}
```

**DetailScene.authorThanksEntry mode:**
```ts
init(data) {
  this.authorThanksMode = Boolean(data?.authorThanksEntry);
  this.returnTo = data?.returnTo ?? "map";
}
create() {
  if (this.authorThanksMode) {
    this.renderAuthorThanksLayout();
    return;
  }
  // existing
}
// renderAuthorThanksLayout: reuse entry-body renderer, skip node lookup,
// skip related-artifacts panel, back-button → scene.start(returnTo),
// portrait initials-кружок (resolvePortraitUrl returns undefined)
```

### Layer 8 — Settings UI

```html
<section class="settings-page__patron" data-show="canPurchasePatron">
  <button class="settings-page__patron-button" data-settings-action="open-patron">
    <span class="settings-page__patron-title">{i18n.supportAuthor}</span>
    <span class="settings-page__patron-subtitle">{i18n.supportAuthorSubtitle}</span>
  </button>
</section>
<button class="settings-page__patron-restore" data-settings-action="restore-patron"
        data-show="canRestore">{i18n.restorePurchase}</button>
```

**`mountPatronDialog(source)`** — single owner `patron_purchase_open`:
```ts
function mountPatronDialog(source: "settings" | "post_win_push"): void {
  getAppContext().analytics.track("patron_purchase_open", { source });
  // render HTML, attach handlers
}
```

**Dialog HTML:**
```
┌─ Поддержать автора ─────────────────┐
│  Игра — мой одиночный проект.       │
│  Если экспедиция нашла отклик —     │
│  спасибо.                           │
│                                     │
│  ✓ Реклама исчезает полностью       │
│  ✓ +300 монет в благодарность       │
│  ✓ Записка от автора в архиве       │
│  ✓ Ачивка «Меценат экспедиции»      │
│                                     │
│  Цена: ${nativePrice}               │
│                                     │
│  [ Поддержать ] [ Не сейчас ]       │
└─────────────────────────────────────┘
```

**Restore handler с bounded retry + Yandex login:**
```ts
private async handleRestoreClick(retried = false): Promise<void> {
  const { payments, sdk } = getAppContext();
  const result = await payments.restorePatronManual();

  if (result.ok) {
    if (result.mismatch) {
      this.showToast(i18n.t("patronRestoreDisputed"));
    } else if (result.alreadyActive) {
      this.showToast(i18n.t("patronAlreadyActive"));
    } else {
      this.showToast(i18n.t("patronRestoreSuccess"));
      this.render();
    }
    return;
  }

  if (result.reason === "unauthorized") {
    if (retried) {
      this.showToast(i18n.t("patronRestoreUnauthorized"));
      return;
    }
    const wantsLogin = await this.confirmDialog(i18n.t("patronUnauthorizedLogin"));
    if (!wantsLogin) return;
    await sdk.triggerLogin();
    return this.handleRestoreClick(true);  // bounded — no infinite recursion
  }
  if (result.reason === "not_found") {
    this.showToast(i18n.t("patronRestoreNotFound"));
    return;
  }
  if (result.reason === "unavailable") {
    this.showToast(i18n.t("patronRestoreUnavailable"));
    return;
  }
  this.showToast(i18n.t("patronRestoreError"));
}
```

### Layer 9 — Post-3-wins push (RewardScene-triggered)

```ts
// RewardScene.handleContinue()
const { save, payments } = getAppContext();
const beforeCount = save.load().progress.completedNodes.length;
// ... existing logic (increment completedNodes etc)
const afterCount = save.load().progress.completedNodes.length;
const justCrossed3 = afterCount === 3 && beforeCount < 3;
const showPush = payments.canPurchasePatron() && justCrossed3 && !save.load().progress.patronPushShown;
this.scene.start(SCENES.map, { showPatronPush: showPush });
```

**`completedNodes` composition assumption — pre-execution verification step:** confirm `completedNodes` mutates только в RewardScene continue-handler (= per-win). Если mixed source найдём — switch на `winsCount` field.

```ts
// MapScene.openPatronPush — on-impression flag + await flush
private async openPatronPush(): Promise<void> {
  const { save } = getAppContext();
  save.updateProgress((p) => ({ ...p, patronPushShown: true }));
  try { await save.flush(); }
  catch (err) { console.warn("[payments] post-win push flush failed", err); }
  mountPatronDialog("post_win_push");  // fires `patron_purchase_open` internally
}

// init / create
init(data: MapSceneData & { showPatronPush?: boolean }) {
  this.pendingPatronPush = Boolean(data?.showPatronPush);
}
create() {
  // ... existing
  if (this.pendingPatronPush) {
    this.pendingPatronPush = false;
    const timer = this.time.delayedCall(600, () => {
      if (!this.scene.isActive() || !getAppContext().payments.canPurchasePatron()) return;
      this.openPatronPush();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove());
  }
}
```

### Layer 10 — Boot integration

```ts
// BootScene.create()
const sdk = createSdkService();
await sdk.init();
// ... existing services
await save.init(sdk);
const achievements = new AchievementsReconciler(sdk, save, /* onNewUnlock */);
const ads = new AdsService(sdk, analytics, save);
const payments = new PaymentsService(sdk, analytics, save, achievements, ads);
setAppContext({ analytics, ads, i18n, save, sound, sdk, achievements, payments });

// Bounded await BEFORE preloader
await payments.restoreOnBoot();  // internal 1.5s timeout
```

### Layer 11 — Analytics (7 events)

| event | payload |
|---|---|
| `patron_purchase_open` | `{ source: "settings" \| "post_win_push" }` |
| `patron_purchase_blocked` | `{ source, reason: "in_flight" \| "not_eligible" }` |
| `patron_purchase_attempt` | `{ source }` |
| `patron_purchase_success` | `{ source }` |
| `patron_purchase_cancelled` | `{ source, reason }` |
| `patron_purchase_error` | `{ source, reason }` |
| `patron_purchase_restore` | `{ found: boolean, source: "boot" \| "manual", reason?, note? }` |

### Layer 12 — i18n (21 keys × 7 locales = 147 strings)

```
supportAuthor / supportAuthorSubtitle
patronDialogTitle / patronDialogBody
patronBenefitAds / patronBenefitCoins / patronBenefitArchive / patronBenefitAchievement
patronConfirmButton / patronCancelButton
patronThankYouToast / patronError
restorePurchase
patronAlreadyActive / patronRestoreSuccess / patronRestoreUnavailable / patronRestoreUnauthorized
patronUnauthorizedLogin
patronRestoreDisputed
patronRestoreNotFound
authorThanksPointLabel
ach_patron_title / ach_patron_description
```

ru + en — ручные; tr/es/pt/de/fr — EN fallback. Regression-test: все 21 ключ в ru + en.

### Layer 13 — GP / Yandex setup

**GP:**
- `scripts/uploadPatronProduct.mjs` (новый) — idempotent GraphQL CreatePayment/UpdatePayment
- Tag: `patron_support`, type **non-consumable**, price 199 RUB

**Yandex (manual):**
- Yandex Console → Project → Goods → Create. ID `patron_support`, **permanent**, 199 ₽
- **Договор** с Yandex Games обязателен
- Включить «Платежи» в проекте
- **Отправить запрос на `games-partners@yandex-team.ru`** с просьбой включить платежи (явный requirement из docs)
- Moderation 1-3 дня
- Документировано в `docs/specs/2026-05-16-patron-iap-setup.md`

## File-level changes

### Files to modify

| Path | Change |
|---|---|
| `vite.config.ts` | + `__PLATFORM__` define |
| `package.json` | 0.3.59 → 0.3.60 + cross-env devDep + build:gp/yandex scripts |
| `env.d.ts` | + gp.payments + Yandex Payments shapes + __PLATFORM__ |
| `src/services/sdk/SdkService.ts` | + 5 payment methods + types |
| `src/services/sdk/GamePushSdkService.ts` | + payments impl (has() canonical) + closeSticky + triggerLogin (no-op) |
| `src/services/sdk/YandexSdkService.ts` | + payments impl + triggerLogin + closeSticky (no-op) |
| `src/services/sdk/DevStubSdkService.ts` | + payments + closeSticky/triggerLogin (no-op) |
| `src/services/ads/AdsService.ts` | + setPatronOptimistic / clearPatronOptimistic / markPatronConfirmed + gate 4 ad methods |
| `src/services/save/SaveService.ts` | validate new fields в isValidSaveState |
| `src/services/achievements/AchievementsReconciler.ts` | + markPatronJustActivated + delayed toast for patron tag |
| `src/core/game-state/types.ts` | + patronSupport, patronBonusGranted, patronGrantedAt, patronPushShown |
| `src/app/config/appContext.ts` | + payments: PaymentsService |
| `src/scenes/BootScene.ts` | createSdkService factory + PaymentsService init + bounded restoreOnBoot |
| `src/scenes/SettingsScene.ts` | + patron button + restore button + handleRestoreClick bounded retry + login flow |
| `src/scenes/settingsSceneOverlay.ts` | + 2 buttons HTML |
| `src/scenes/RewardScene.ts` | + scalar count capture + push-eligibility detection + hide rewarded UI для patron |
| `src/scenes/MapScene.ts` | + receive showPatronPush flag + delayed dialog mount + flush before mount |
| `src/scenes/DiaryScene.ts` | + author_thanks append + special openEntryDetail path |
| `src/scenes/DetailScene.ts` | + authorThanksEntry mode + renderAuthorThanksLayout |
| `src/data/achievements.ts` | + patron compute |
| `src/data/achievements.test.ts` | count 20 → 21 |
| `src/data/achievementUiMeta.ts` | + patron UI meta |
| `src/data/narrative/speakers.ts` | + author profile в ru/global/tr packs |
| `src/data/narrative/entries.ru.ts` | + author_thanks |
| `src/data/narrative/entries.global.ts` | + author_thanks (EN fallback) |
| `src/data/narrative/entries.tr.ts` | + author_thanks |
| `src/services/i18n/locales.ts` | + 21 ключей × 7 локалей (~147 strings) |
| `src/styles.css` | + .settings-page__patron-* / .patron-dialog__* / .settings-page__patron-restore |
| `public/assets/achievements/patron.png` | placeholder (copy of first_win.png) |

### New files

| Path | Purpose |
|---|---|
| `src/services/sdk/createSdkService.ts` | factory с build-flag primary + DEV URL override |
| `src/services/payments/PaymentsService.ts` | core service |
| `src/services/payments/PaymentsService.test.ts` | 15+ unit tests |
| `src/services/payments/withTimeout.ts` | Promise-race helper |
| `src/ui/patronDialog.ts` | HTML builder (canvasAnchoredOverlay) + mountPatronDialog owner |
| `src/ui/patronDialog.test.ts` | snapshot tests |
| `scripts/uploadPatronProduct.mjs` | GP product registration |
| `docs/specs/2026-05-16-patron-iap-setup.md` | Yandex + GP setup runbook |

## Tests

15+ новых тестов:

1. **`PaymentsService.test.ts`** — happy-path purchase / canUsePayments=false early return / cancelled / error / in-flight lock / restore alreadyActive / manual restore not_found / manual restore mismatch / manual restore unauthorized / **manual restore timeout** (U3)

2. **`PaymentsService.lateRestore.test.ts`** — fire-and-forget late SDK resolve activates / localStorage hint disproved clears optimistic / **SDK never resolves → timeout fires optimistic-clear (U2)** / **late SDK success after timeout activates patron (U2)**

3. **`PaymentsService.localPatron.test.ts`** — **canUsePayments=false + localPatron=true → confirmPatronEntitlement called (U1)**

4. **`AdsService.test.ts`** — 4 ad methods gated / setPatronOptimistic не closes sticky / markPatronConfirmed closes sticky / clearPatronOptimistic reverts cache

5. **`AchievementsReconciler.test.ts`** — markPatronJustActivated triggers 1.8s delayed toast / **preserved-path reconcile() repairs missing ach (U4)**

6. **`patronDialog.test.ts`** — HTML structure + ARIA + price conditional render

7. **`achievements.test.ts`** — count 20 → 21 + patron compute

8. **`achievementIconsExist.test.ts`** — auto-checks patron.png

9. **`DiaryScene.integration.test.ts`** — author_thanks gated on patronSupport / initials-кружок fallback / openEntryDetail special path

10. **`DetailScene.test.ts`** — authorThanksEntry mode renders sans node-specific UI

11. **`SaveService.test.ts`** — validate new boolean/number fields

12. **`I18nService.test.ts`** — все 21 ключ в ru + en

13. **`BootScene.test.ts`** — factory выбирает correct adapter

14. **`createSdkService.test.ts`** — URL override DEV-only / build-flag primary

15. **`SettingsScene.restoreFlow.test.ts`** — bounded retry (no infinite recursion) / mismatch toast / login flow

`npm test` — 210 → ~240 (+30 tests).

## Verification

`npm run build:gp` + `npm run build:yandex` — both typecheck clean.

**Manual QA — 22 steps:**
1-17. As in R5/R6 (basic flow, post-win-push, refresh, archive, achievement, coins +300, cross-device restore, Yandex sandbox, Crazy/Poki block)
18. Slow SDK (`getPurchases()` artificially delays 3s) → after 1.5s optimistic clears, late success activates patron via .then() path (U2)
19. localStorage manipulation (`isPatron=true` без real purchase) → boot suppresses ads optimistically → SDK NOT-confirm → ads return после ~1.5s
20. Yandex unauthorized → Settings restore → login dialog → success → retry → patron restored
21. Yandex authorized but no purchase → Settings restore → toast «Покупка не найдена»
22. **U1 verification:** mock `canUsePayments()=false` + local save has `patronSupport=true` → boot calls `confirmPatronEntitlement("preserved")` (sticky closed)

## Phases (28h total)

1. env.d.ts + SDK foundation + build-flag (~3.5h)
2. Save / ProgressState / validation (~1.5h)
3. AchievementsReconciler delays (~1h)
4. PaymentsService с inFlight / activatePatron / restoreOnBoot / U1-U4 fixes (~4.5h)
5. AdsService gate (~1.5h)
6. Achievement patron registration (~1h)
7. Speaker + archive entry + DetailScene branch (~2.5h)
8. i18n keys (~1.5h)
9. Settings UI + dialog + restore button + login flow (~3.5h)
10. RewardScene push trigger + MapScene receiver (~1.5h)
11. BootScene factory + restoreOnBoot wiring (~1h)
12. GP product setup (~2h)
13. Yandex product setup + games-partners@ email (~1.5h)
14. End-to-end QA GP/Yandex (~3h)

## Risks (closure status)

| Risk | Status |
|---|---|
| Refund/revocation = false-positive entitlement forever | **Accepted v0.3.60 product risk** (telemetry foundation; v0.3.61 spec) |
| Strict once-per-account not enforced | **Accepted v0.3.60 product risk** (player-facing «один раз»; backend marker v0.3.61) |
| Existing-patron sticky not closed (any unavailable path) | **Closed (U1)** |
| Late SDK success после timeout discarded | **Closed (U2)** |
| Manual restore hang permanent inFlight lock | **Closed (U3)** |
| Preserved path doesn't repair missing achievements | **Closed (U4)** |
| SDK-hang allows infinite optimistic | **Closed (R6 V2 + U2)** |
| Optimistic suppression infinite on SDK fail | **Closed (R6 W2)** |
| Existing-patron sticky on local-only branches | **Closed (R6 V1)** |
| Empty manual restore = generic error | **Closed (R6 W3)** |
| localStorage hint suppresses sticky | **Closed (R5 Z2)** |
| Late-restore async errors lost | **Closed (R5 Z4)** |
| TS type uninferred | **Closed (R5 Z1)** |
| Login retry infinite recursion | **Closed (R5 Z3)** |
| Local-vs-platform mismatch hidden | **Closed (R5 Z5)** |

## Open questions (v0.3.61+)

- Refund/revocation policy на основе v0.3.60 telemetry
- Strict once-per-account через server-validated marker
- Custom art (patron.png + author portrait)
- Multi-tier IAP
- Anti-cracked-save periodic re-verification
