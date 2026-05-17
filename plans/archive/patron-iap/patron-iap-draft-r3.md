# Patron IAP — «Поддержать автора + ad-free» (v0.3.60) — draft-r3

## R2 → R3 summary

Reviewed codex + qwen. 22 R2 concerns accepted, 0 rejected.

**Critical shifts vs R2:**
1. **GP entitlement через `has(tag)` единообразно** (X1) — `purchases` field в GP API представляет catalog, не purchase-history; mapping `purchases.map(p=>tag)` дал бы false-restore всем игрокам
2. **SDK factory через build-time `__PLATFORM__` flag** (X3) — runtime detection race с async-loaded scripts; build flag надёжнее
3. **Split local activation from cloud flush** (X11) — flush reject не должен blocking-ить UI feedback
4. **LocalStorage pre-restore ad-gate** (X8) — `isPatron=true` cache → markPatron сразу на boot; cold-start → 1.5s bounded await перед preloader
5. **Background refund observation** (X7) — на boot всегда async fetch entitlement, log mismatch; revocation само-by-itself out-of-scope v0.3.61
6. **closeSticky + triggerLogin в SdkService interface** (X2, X9) — full contract, не optional chain
7. **Locale strategy locked** (X4, X5) — 3 entries-files (ru/global/tr) + speaker fallback verified через `resolveProfilePack`
8. **Analytics renamed:** `patron_purchase_blocked` для guard-cases, `_open` только на dialog mount (X13, X16)
9. **inFlight unified lock** для purchase + restore (X19)
10. **fetchProducts cached** forever (products immutable runtime) (X20)

## Context (unchanged)

Single IAP «Поддержать автора + ad-free» (~199 RUB), positive emotional framing,
полное ad-free + 300 coin bonus + archive note + patron achievement. Player-locked
decisions: Settings + post-3-wins push, full ad-free incl rewarded, placeholder
art, speaker = «Автор экспедиции».

## Scope (unchanged structurally, refined per R2)

См. R2 scope + дополнительно:
- `SdkService.closeSticky?()` + `triggerLogin?()` methods
- `gp.payments.has(tag)` как canonical entitlement check
- Build-time `__PLATFORM__` define в vite config
- `patronGrantedAt: number` timestamp в ProgressState для будущей refund logic

## Architecture

### Layer 1 — SDK extension + env + factory

#### `env.d.ts` types

```ts
declare global {
  interface Window {
    __gp?: {
      // ... existing
      payments?: {
        isAvailable: boolean;
        fetchProducts(): Promise<void>;
        /** Catalog (НЕ purchase history). Используем для price display. */
        products?: Array<{ tag: string; price: string; priceValue?: number; currency?: string; title?: string }>;
        /** Может быть тот же catalog (GP terminology неоднозначна) —
         *  НИКОГДА не использовать для entitlement check, только has(). */
        purchases: Array<{ tag: string; price: string; currency?: string }>;
        /** Canonical entitlement check — единственный источник истины. */
        has(tag: string): boolean;
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
  // ... existing
};
type YaPayments = {
  purchase(args: { id: string; developerPayload?: string }): Promise<YaPurchase>;
  getPurchases(): Promise<YaPurchase[]>;
  getCatalog(): Promise<YaProduct[]>;
  consumePurchase(token: string): Promise<void>;
};
type YaPurchase = {
  productID: string;
  purchaseToken?: string;
  developerPayload?: string;
  purchaseTime?: number;
};
type YaProduct = {
  id: string;
  title: string;
  description: string;
  price: string;
  priceValue: string;
  priceCurrencyCode: string;
  imageURI?: string;
};

declare const __PLATFORM__: "gamepush" | "yandex" | "dev";
```

#### `vite.config.ts` build flag

```ts
define: {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  __PLATFORM__: JSON.stringify(process.env.PLATFORM ?? "gamepush"),
}
```

Two separate `package.json` scripts (или env-prefix):
```json
"build:gp": "PLATFORM=gamepush npm run build",
"build:yandex": "PLATFORM=yandex npm run build"
```

#### `SdkService` interface

```ts
type ProductInfo = { tag: string; title: string; price: string };
type PurchaseResult = { ok: true } | { ok: false; reason: "cancelled" | "error" | "unavailable" | "unauthorized" };
type PurchasesResult = { ok: true; purchases: Array<{ tag: string }> } | { ok: false; reason: "timeout" | "error" | "unauthorized" | "unavailable" };

interface SdkService {
  // ... existing
  canUsePayments(): boolean;
  getProductInfo(tag: string): Promise<ProductInfo | null>;
  purchase(tag: string): Promise<PurchaseResult>;
  /** Returns user's actual purchases (entitlements). Uses platform-canonical
   *  source-of-truth (e.g. gp.payments.has() for GP). */
  getPurchases(): Promise<PurchasesResult>;
  /** Hide active sticky banner (called from PaymentsService.activatePatron). */
  closeSticky?(): void;
  /** Trigger platform native login if available. Yandex returns when dialog closes. */
  triggerLogin?(): Promise<void>;
}
```

#### Factory — build-flag primary, runtime fallback

`src/services/sdk/createSdkService.ts`:
```ts
export function createSdkService(): SdkService {
  // URL-override для dev tools
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("platform");
  if (forced === "yandex") return new YandexSdkService();
  if (forced === "gamepush") return new GamePushSdkService();
  if (forced === "dev") return new DevStubSdkService();
  // Build-time flag — primary signal (no race with script-load).
  if (__PLATFORM__ === "gamepush") return new GamePushSdkService();
  if (__PLATFORM__ === "yandex") return new YandexSdkService();
  return new DevStubSdkService();
}
```

Эти classes ждут SDK script inside их `init()` через bounded wait:
```ts
// GamePushSdkService.init()
async init() {
  await this.waitForSdk();  // up to 5s for window.__gp
  if (!this.gp) {
    console.warn("[gp] SDK script did not load — falling back to no-op mode");
    return;
  }
  // ...
}
```

#### GamePush adapter — canonical via `has(tag)`

```ts
private productsFetched = false;

async getProductInfo(tag: string): Promise<ProductInfo | null> {
  if (!this.gp?.payments) return null;
  try {
    if (!this.productsFetched) {
      await this.gp.payments.fetchProducts();
      this.productsFetched = true;
    }
  } catch (err) {
    console.warn("[gp.fetchProducts]", err);
    return null;
  }
  // Use products catalog if present, fall back to purchases array.
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
  } catch (err) {
    console.warn("[gp.fetchProducts]", err);
    return { ok: false, reason: "error" };
  }
  // CRITICAL: `has(tag)` это canonical entitlement check.
  // НЕ итерировать `purchases` field — он может быть catalog (всех products),
  // не purchase-history (codex + qwen R2 flagged).
  // Возвращаем синтетический list для интерфейс-однообразия с Yandex.
  const tags = [PATRON_TAG];  // в будущем — расширить если IAP больше одного
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

// closeSticky no-op (Yandex sticky управляется иначе)
```

### Layer 2 — PaymentsService

```ts
export const PATRON_TAG = "patron_support";
export const PATRON_BONUS_COINS = 300;
const PATRON_LOCAL_KEY = "isPatron";
const RESTORE_BOOT_TIMEOUT_MS = 1500;  // R2 X8: tighter than R2's 5s

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

  /** Try-catch'd — никогда не reject'ит UI flow. */
  async getPatronPrice(): Promise<string | null> {
    try {
      const info = await this.sdk.getProductInfo(PATRON_TAG);
      return info?.price ?? null;
    } catch (err) {
      console.warn("[payments.getPatronPrice]", err);
      return null;
    }
  }

  onChange(listener: (isPatron: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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

  async restorePatronManual(): Promise<{ ok: boolean; alreadyActive: boolean; reason?: string }> {
    if (this.save.load().progress.patronSupport) {
      return { ok: true, alreadyActive: true };
    }
    if (this.inFlight) {
      this.analytics.track("patron_purchase_blocked", { source: "restore", reason: "in_flight" });
      return { ok: false, alreadyActive: false };
    }
    this.inFlight = true;
    try {
      const result = await this.sdk.getPurchases();
      if (!result.ok) {
        this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: "manual" });
        return { ok: false, alreadyActive: false, reason: result.reason };
      }
      const hasPatron = result.purchases.some(p => p.tag === PATRON_TAG);
      if (hasPatron) {
        await this.activatePatron("restore");
        this.analytics.track("patron_purchase_restore", { found: true, source: "manual" });
        return { ok: true, alreadyActive: false };
      }
      this.analytics.track("patron_purchase_restore", { found: false, source: "manual" });
      return { ok: false, alreadyActive: false };
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Boot-time restore. Bounded-await 1.5s ПЕРЕД preloader, потом fire-and-forget.
   * Если localStorage помечен patron — markPatron сразу (нулевая задержка boot
   * для existing patrons), всё равно делать background re-check.
   */
  async restoreOnBoot(): Promise<void> {
    if (!this.canUsePayments()) return;

    // R2 X8: LocalStorage fast-path для existing patron.
    let localHint = false;
    try {
      if (typeof localStorage !== "undefined") {
        localHint = localStorage.getItem(PATRON_LOCAL_KEY) === "true";
      }
    } catch { /* private mode: ignore */ }

    if (localHint && !this.save.load().progress.patronSupport) {
      // Confident enough — flip locally to suppress preloader, BUT verify
      // with SDK async (X7: refund observability).
      console.info("[payments] local hint says patron, optimistic markPatron");
      this.ads.markPatron();
    }

    // R2 X7: всегда background-verify, даже если local-true.
    const localPatron = this.save.load().progress.patronSupport === true;
    const fetchPromise = this.sdk.getPurchases().catch(err => {
      console.warn("[payments] getPurchases threw", err);
      return { ok: false, reason: "error" as const };
    });
    const result = await withTimeout(
      fetchPromise,
      RESTORE_BOOT_TIMEOUT_MS,
      { ok: false, reason: "timeout" as const } as PurchasesResult,
    );

    if (!result.ok) {
      this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: "boot" });
      // НЕ revoke на transient failure
      return;
    }
    const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);
    if (platformPatron && !localPatron) {
      await this.activatePatron("restore");
      this.analytics.track("patron_purchase_restore", { found: true, source: "boot" });
    } else if (!platformPatron && localPatron) {
      // X7: refund/revocation observed — LOG ONLY, не revoke в v0.3.60.
      console.warn("[payments] platform says NOT patron but local says yes — possible refund");
      this.analytics.track("patron_purchase_restore", { found: false, source: "boot", note: "local_only" });
    }
  }

  /** Split local from cloud (R2 X11). Local mutation completes BEFORE flush. */
  private async activatePatron(origin: "purchase" | "restore"): Promise<void> {
    const before = this.save.load().progress;
    if (before.patronSupport && before.patronBonusGranted) return;

    // (1) Local — immediate UI feedback even if flush later fails.
    this.save.updateProgress((p) => ({
      ...p,
      patronSupport: true,
      patronBonusGranted: true,
      patronGrantedAt: p.patronGrantedAt ?? Date.now(),  // for future refund logic
      coins: p.patronBonusGranted ? p.coins : (p.coins ?? 0) + PATRON_BONUS_COINS,
    }));

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PATRON_LOCAL_KEY, "true");
      }
    } catch { /* ignore */ }

    this.ads.markPatron();
    this.achievements.markPatronJustActivated();
    this.achievements.reconcile(this.save.load().progress);
    this.listeners.forEach((fn) => fn(true));

    // (2) Cloud — async, errors logged but don't break flow.
    try {
      await this.save.flush();
    } catch (err) {
      console.error("[payments] activate flush failed; local state holds; next-boot will re-flush via save dirty flag", err);
      // save state mutated in memory → SaveService.flush retries on next dirty trigger
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
  ]);
}
```

**`patronBonusGranted` semantic clarification (R2 X12):** "once per save-state, not strict account marker". Документировано в коде:
```ts
// patronBonusGranted: once per save state.
// In concurrent two-device first-activation, last-write-wins on flush merges
// away one device's +300 — out-of-scope for v0.3.60.
// Strict once-per-account requires server-validated processed-purchase marker.
```

### Layer 3 — AdsService reactive

(Same as R2; closeSticky now formal interface method)

### Layer 4 — ProgressState

```ts
type ProgressState = {
  // ... existing
  patronSupport?: boolean;
  patronBonusGranted?: boolean;
  patronGrantedAt?: number;        // ms timestamp — для будущей refund logic
  patronPushShown?: boolean;
};
```

`isValidSaveState` — optional boolean + number-or-undefined validation.

### Layer 5 — AchievementsReconciler

(Same as R2 — markPatronJustActivated + 1.8s delay for patron-tag toast)

### Layer 6 — Achievement `patron`

(Same as R2)

### Layer 7 — Archive entry `author_thanks`

**Locale strategy locked (R2 X4, X5):**

**Speakers** — `resolveProfilePack(locale)` уже dispatches:
- `ru → SPEAKER_PROFILES.ru`
- `tr → SPEAKER_PROFILES.tr`
- `en/es/pt/de/fr/global → SPEAKER_PROFILES.global`

Добавление `author` profile в **только 3 packs** (`ru/global/tr`) автоматически
покрывает все 7 локалей. Verification: read `src/data/narrative/speakers.ts:resolveProfilePack`.

**Entries** — `getNarrativeEntry(id, locale)` — **verification step required** in execution:
если resolver НЕ fall-back'ит на global для es/pt/de/fr, нужно либо
(a) extend resolver, либо (b) add author_thanks к 7 файлам. **Pre-execution
read step:** open `src/data/narrative/entries.ts` (resolver) → confirm fallback
behavior. Если fallback exists → modify только 3 files (`ru/global/tr`).
Если не — extend resolver as first step (одна строка), потом 3 files.

**DetailScene `authorThanksEntry` mode implementation note (R2 X21):**

```ts
init(data: DetailSceneData & { authorThanksEntry?: boolean }) {
  this.authorThanksMode = Boolean(data?.authorThanksEntry);
  this.returnTo = data?.returnTo ?? "map";
}

create() {
  if (this.authorThanksMode) {
    // Reuse entry-body renderer (existing code path), skip:
    // - getNodeByEntryId() call
    // - related artifacts panel
    // - chapter progression UI
    // - "next entry" navigation
    // Back button → scene.start(this.returnTo)
    // Portrait → initials-кружок (resolvePortraitUrl returns undefined for "author")
    this.renderAuthorThanksLayout();
    return;
  }
  // ... existing path
}
```

`renderAuthorThanksLayout()` — minimal overlay: top eyebrow «От автора» / «From the author», title (author full name), excerpt, body, back button. Reuse archive-entry-detail-overlay CSS classes.

### Layer 8 — Settings UI

(Same as R2; добавлено: dialog mount tracks `patron_purchase_open` единственным владельцем; price fetch handle gracefully)

### Layer 9 — Post-3-wins push (R2 X17 scalar capture)

```ts
// RewardScene.handleContinue()
private handleContinue(): void {
  const { save, payments } = getAppContext();
  // R2 X17: scalar capture BEFORE mutation, avoids aliasing.
  const beforeCount = save.load().progress.completedNodes.length;
  // ... existing logic (increment completedNodes etc)
  const afterCount = save.load().progress.completedNodes.length;
  const justCrossed3 = afterCount === 3 && beforeCount < 3;
  const showPush =
    payments.canPurchasePatron() &&
    justCrossed3 &&
    !save.load().progress.patronPushShown;

  this.scene.start(SCENES.map, { showPatronPush: showPush });
}
```

**`completedNodes` composition (R2 X6) — verification step:** read RewardScene
continue-handler to confirm increment is gated by win (status === "won").
Recon agent ранее подтвердил «only wins», документируем with code citation
в execution. Если найдём mixed source — switch на `winsCount` field.

```ts
// MapScene.openPatronPush() — R2 X14: await flush
private async openPatronPush(): Promise<void> {
  const { save, payments, analytics } = getAppContext();
  // R2 X11/X14: local first, then cloud
  save.updateProgress((p) => ({ ...p, patronPushShown: true }));
  // R2 X16: NO analytics here — dialog mount owns 'open' event.
  try { await save.flush(); }
  catch (err) { console.warn("[payments] post-win push flush failed", err); }
  this.mountPatronDialog({ source: "post_win_push" });
  // mountPatronDialog fires analytics.track("patron_purchase_open", { source }) on mount
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

// R2 X8: bounded await BEFORE preloader so patron не видит preloader.
// 1.5s timeout — если SDK быстрый, восстановим; если slow, fire-and-forget continues.
await payments.restoreOnBoot();  // internal timeout = 1.5s

// ... preloader, signalReady (existing)
```

Note: `restoreOnBoot()` теперь always returns within 1.5s (internal timeout).
localHint optimistic markPatron срабатывает synchronously внутри (zero delay).

### Layer 11 — Analytics (6 events + 1 renamed guard)

| event | payload |
|---|---|
| `patron_purchase_open` | `{ source: "settings" \| "post_win_push" }` — fires только на dialog mount |
| `patron_purchase_blocked` | `{ source, reason: "in_flight" \| "not_eligible" }` — guard rail |
| `patron_purchase_attempt` | `{ source }` |
| `patron_purchase_success` | `{ source }` |
| `patron_purchase_cancelled` | `{ source, reason }` |
| `patron_purchase_error` | `{ source, reason }` |
| `patron_purchase_restore` | `{ found: boolean, source: "boot" \| "manual", reason?, note? }` |

Net **7 events** (renamed 1 from R2's 6).

### Layer 12 — i18n

Same 16 keys × 7 locales as R2.

### Layer 13 — GP / Yandex setup

**GP:** uploadPatronProduct.mjs script (idempotent), non-consumable, ~199 RUB.

**Yandex (MANUAL + R2 X10):**
- Console → Project → Goods → Create
- ID `patron_support`, type **permanent**, ~199 ₽
- **Договор** with Yandex Games
- Включить «Платежи» в проекте
- **R2 X10: Отправить запрос на games-partners@yandex-team.ru** с просьбой включить платежи для проекта (явный requirement из docs)
- Moderation 1-3 дня
- Документировано в `docs/specs/2026-05-16-patron-iap-setup.md`

## File-level changes

(Same modify-list as R2 + следующие adjustments:)

| Path | R3 change |
|---|---|
| `vite.config.ts` | + `__PLATFORM__` define |
| `package.json` | + `build:gp` / `build:yandex` scripts |
| `src/services/sdk/createSdkService.ts` | build-flag primary + URL override |
| `src/services/sdk/GamePushSdkService.ts` | `has(tag)` canonical entitlement + cached fetchProducts + closeSticky |
| `src/services/sdk/YandexSdkService.ts` | + `triggerLogin()` |
| `src/services/payments/PaymentsService.ts` | inFlight unified + split local/cloud + getPatronPrice try/catch |
| `src/core/game-state/types.ts` | + `patronGrantedAt: number` |
| `src/scenes/MapScene.ts` | openPatronPush awaits flush, no analytics duplicate |
| `src/scenes/RewardScene.ts` | scalar capture before mutation |
| `src/scenes/DetailScene.ts` | authorThanksEntry mode с concrete render path |
| `env.d.ts` | expanded Yandex types (`purchaseToken`, `imageURI`, etc) |

### New files (same as R2)

## Tests

(Same as R2 + дополнительно:)

11. **`createSdkService.test.ts`** — verify factory выбирает correct adapter based on `__PLATFORM__` mock and URL params

12. **`PaymentsService.restore.test.ts`** — добавить:
   - bounded await respects 1.5s timeout
   - localStorage hint triggers markPatron immediately, BUT still does background re-check
   - platform-says-NOT-patron + local-says-yes → log warning, don't revoke
   - inFlight guard between purchase and restore

13. **`SdkService.GP.test.ts`** — `getPurchases()` returns empty if `has(PATRON_TAG)=false`, returns `[{tag}]` if true. **No iteration over `purchases` field.**

## Verification

`npm test` — 210 → ~235 (+25 тестов).

`npm run build:gp` + `npm run build:yandex` — both типclock'и чистые.

**Manual QA** — same 17 steps as R2 plus:
18. **Refund simulation:** в GP sandbox revoke purchase → next boot logs warning «possible refund» в console, ads не возвращаются (v0.3.60 not revoking)
19. **localStorage fast-path:** delete cloud save, keep localStorage isPatron=true → next boot markPatron immediately (no preloader for patron), background re-check confirms
20. **Cold-start no patron:** clear localStorage + cloud → 1.5s wait perceived as standard preloader prep, normal flow
21. **Unauthorized restore Yandex:** logged-out player clicks Restore → toast offers login, click → `triggerLogin()` → after dialog, retry restore

## Phases

(Same as R2 + adjusted)

1. **env.d.ts + SDK foundation + build-flag** (~3.5h)
2. **Save / ProgressState / validation** (~1.5h)
3. **AchievementsReconciler delays** (~1h)
4. **PaymentsService** (~4h)
5. **AdsService gate** (~1.5h)
6. **Achievement patron registration** (~1h)
7. **Speaker + archive entry + DetailScene branch** (~2.5h)
8. **i18n keys** (~1.5h)
9. **Settings UI + dialog + restore button** (~3.5h)
10. **RewardScene push trigger + MapScene receiver** (~1.5h)
11. **BootScene factory + restoreOnBoot wiring + bounded await** (~1h)
12. **GP product setup** (~2h)
13. **Yandex product setup + games-partners@ email** (~1.5h)
14. **End-to-end QA GP/Yandex + refund-simulation** (~3.5h)

**Total estimate:** ~28h (no change from R2 — additions absorbed in existing phases).

## Risks (refined)

| Risk | Mitigation |
|---|---|
| GP `has(tag)` API undefined / null after fetchProducts | Sandbox verification step 1: `console.log(typeof gp.payments.has)` после fetchProducts. Если undefined — fallback на `purchases.find(p => p.tag === tag)` |
| Yandex SDK getCatalog reject | getProductInfo catches → returns null → price hidden in dialog (acceptable) |
| Build-time `__PLATFORM__` undefined в dev mode | vite.config define provides default `"gamepush"`. Dev может override через `?platform=dev` URL param |
| `restoreOnBoot` 1.5s timeout slow connections | Optimistic localHint markPatron short-circuits для existing patrons. Cold-start новые игроки в любом случае не patrons — 1.5s preloader-prep незаметен |
| Refund/revocation in v0.3.60 | Observability only — log mismatch, no revoke. Real revocation logic v0.3.61+ |
| Yandex games-partners@ email response slow | Block QA until моderation done. Документировано в runbook. |
| save.flush fails after activate | Local save state mutated — survives session. SaveService.flush auto-retries on next dirty trigger (existing infra) |
| Speaker fallback не работает для es/pt/de/fr | Verification step pre-execution + manual smoke test (load Архив в каждой локали после mock patron purchase) |

## Open questions (v0.3.61+)

- Refund/revocation detection и UI flow
- Custom art (patron.png + author portrait)
- Backend-validated once-per-account marker (eliminates concurrent-save edge case)
- Multi-tier IAP
- Periodic re-verification (anti-cracked-save)
