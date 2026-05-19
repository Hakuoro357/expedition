# Patron IAP Setup Runbook — «Поддержать автора + ad-free»

**Version:** v0.3.60  
**Date:** 2026-05-16  
**Product tag:** `patron_support` (GP only — Yandex distribution deprecated v0.3.60)

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

## Part 2: Yandex setup — DEPRECATED v0.3.60

Yandex Games distribution **dropped** для v0.3.60. Рассматривать только если решим вернуться.

**Причина:** 37 MB hard cap у Yandex validator — v0.3.60 ZIP = 37.40 MB (+ patron IAP layer ~200 KB поверх v0.3.59). Требует ~500 KB compression work (аудио 320→128 kbps + WebP optimization). Не приоритет.

**Если возвращаемся в v0.3.61+:**
- `YandexSdkService` + factory branch + `__PLATFORM__="yandex"` — всё ещё в коде (dead branch). Soft-drop, не hard-remove.
- `build:yandex` script в package.json — работает, генерит ZIP в `builds/yandex/`.
- Шаги setup'а manual (договор, games-partners@yandex-team.ru email, Console product create) сохранены в git history этого файла — git show `HEAD~1` если нужно вернуть.

---

## Part 3: GP validation checklist

Run after GP product is live.

### Build flag

```bash
npm run build:gp      # Production build — uses createSdkService() factory → GamePushSdkService
```

### Validation steps

- [ ] GP product tag = `patron_support` (matches client code constant `PATRON_TAG`)
- [ ] `sdk.canUsePayments()` returns `true` on GP production URL
  - DevStub returns DEV-only — test on real GP build, not localhost
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

### Yandex distribution

Dropped в v0.3.60 — см. Part 2.
