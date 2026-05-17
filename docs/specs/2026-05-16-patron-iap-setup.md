# Patron IAP Setup Runbook — «Поддержать автора + ad-free»

**Version:** v0.3.60  
**Date:** 2026-05-16  
**Product tag:** `patron_support` (single source of truth across GP and Yandex)

---

## Part 1: GamePush setup

### Prerequisites

- `GP_API_SECRET` env var — obtain from GamePush dashboard → Project → API.
- `public/assets/achievements/patron.png` must exist (placeholder art, v0.3.60).
- Node.js 18+ (native `fetch` + `FormData`).

### Step 1 — Dry-run (verify before live)

```bash
GP_API_SECRET=xxx node scripts/uploadPatronProduct.mjs --dry-run
```

Expected output:

```
Project 27547 — DRY RUN (no network calls)

[1] Fetching existing payments...
  [dry] would query FetchPayments for existing patron_support product

[2] Uploading patron.png...
  [dry] would upload public/assets/achievements/patron.png

[3] Upserting patron_support product...
  [dry] would CreatePayment (product does not exist yet)
  [dry] input: { "projectId": 27547, "tag": "patron_support", "type": "PERMANENT", ... }

DONE.
```

### Step 2 — Live run

```bash
GP_API_SECRET=xxx node scripts/uploadPatronProduct.mjs
```

Script is idempotent — safe to re-run. On second run it will call `UpdatePayment` instead of `CreatePayment`.

### Step 3 — Verify in GP dashboard

1. Open GamePush dashboard → Project 27547 → **Payments**.
2. Confirm product `patron_support` is listed.
3. Check: `isPublished = true`, price = **199 RUB**, type = **PERMANENT**.
4. Confirm icon is visible (patron.png thumbnail).

### Step 4 — Sandbox QA в GP dev panel

1. Open game via GP dev panel (devtools mode).
2. Click **«Поддержать автора»** in Settings.
3. Verify native GP purchase dialog opens.
4. Complete purchase in sandbox → verify:
   - Ad-free mode activates (no ads on next deal start).
   - Archive entry «Письмо автора» unlocked.
   - Achievement `patron` unlocked.
   - +300 coins added.
5. Reload game → verify state persists (non-consumable restore).

---

## Part 2: Yandex setup (manual — no API)

Yandex Games does not expose a products API. All steps are manual in Yandex Console.

### Prerequisites that may block — check first

| Blocker | Action |
|---|---|
| **Договор** with Yandex Games not signed | Sign via Yandex Console → Profile → Documents |
| **«Платежи»** feature not enabled in project settings | Enable via Project Settings → Features, or request via email (see below) |
| **games-partners@ approval** not received | Send email (template below) — 1-5 business days |

### Email to enable in-game payments

Send to `games-partners@yandex-team.ru` before or alongside dashboard setup:

```
Здравствуйте,

Прошу включить функционал внутриигровых покупок для нашего проекта в Яндекс.Играх.

App ID: <yandex-app-id>
Игра: «Solitaire: Expedition»

Готовы предоставить любые дополнительные данные.

Спасибо.
```

Replace `<yandex-app-id>` with the actual App ID from Yandex Console → Project.

### Step 1 — Create product

1. Yandex Console → Project → **Товары** (Goods/Products) → **Создать**.
2. Fill fields:

| Field | Value |
|---|---|
| **ID** | `patron_support` |
| **Тип** | **Постоянный** (permanent / non-consumable) |
| **Цена** | `199` ₽ |
| **Название (RU)** | `Поддержать автора` |
| **Описание (RU)** | `Спасибо за поддержку проекта. Игра становится без рекламы + 300 монет в благодарность.` |
| **Иконка** | Upload `public/assets/achievements/patron.png` via Yandex Console upload widget |

3. Click **Опубликовать** (Publish).

> **Critical:** The product ID `patron_support` must match the GP product tag exactly. Client code uses this as the single identifier across both platforms.

### Step 2 — Moderation

After publishing, Yandex moderates the product. Typical timeline: **1–3 business days**.  
Monitor status in Yandex Console → Товары.

### Step 3 — Verify live

1. Open game via Yandex Games test link.
2. Click **«Поддержать автора»** in Settings.
3. Verify Yandex native purchase dialog opens with correct price (199 ₽) and title.
4. Complete test purchase → verify same entitlement flow as GP sandbox.

---

## Part 3: Cross-platform validation checklist

Run after both GP and Yandex products are live.

### Build flags

```bash
npm run build:gp      # GP build — uses GamePushPaymentsAdapter
npm run build:yandex  # Yandex build — uses YandexPaymentsAdapter
```

### Validation steps

- [ ] Product tag identical on GP + Yandex: `patron_support`
- [ ] `sdk.canUsePayments()` returns `true` on both platforms
  - DevStub returns DEV-only — test only on real platform URLs
- [ ] Purchase flow: click «Поддержать» → native dialog opens → confirm → entitlement activates
- [ ] Ad-free gate: after purchase, rewarded/interstitial/sticky ads all suppressed
- [ ] Archive entry `author_thanks` visible in Archive after purchase
- [ ] Achievement `patron` unlocked after purchase (toast appears)
- [ ] +300 coins credited after purchase
- [ ] **Cross-device restore:** purchase on device A → open on device B → Settings → click «Восстановить покупку» → expect `alreadyActive` or `success`
- [ ] **Boot restore:** close + reopen game without explicit restore click — `patronSupport` still `true`

---

## Part 4: Known limitations (v0.3.60 scope)

### Refund / revocation

Out of scope for v0.3.60. Telemetry only: `patron_purchase_restore` events include `note: "local_only"`. Decision on v0.3.61 refund handling will be based on production data.

### Cross-device concurrent first-activation

v0.3.60 ships once-per-save-state semantics. In the rare case of concurrent first-activation on two devices simultaneously, one device's +300 coins bonus may merge away. Non-blocking; expected frequency is negligible.

### Custom art

`patron.png` is currently a copy of `first_win.png` (placeholder). Custom patron artwork is planned for v0.3.61.

### Yandex locale coverage

Yandex Console form currently filled with RU only. EN description can be added later via console edit — does not require re-moderation.
