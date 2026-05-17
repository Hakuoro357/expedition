R2's 8 concerns are all addressed in R3. I'll focus on new gaps introduced by R3.

---

## Prior Concerns — Closure Status

All 8 R2 concerns are closed:

| # | R2 Concern | R3 Resolution |
|---|---|---|
| 1 | `closeSticky()` absent from interface | Added `closeSticky?(): void` to `SdkService` ✓ |
| 2 | Narrative entry file changes contradict fallback | Locked to 3 files (ru/global/tr) + pre-exec verification step ✓ |
| 3 | `completedNodes` composition unverified | Verification step documented; fallback to `winsCount` if mixed ✓ |
| 4 | `restorePatronManual()` no in-flight lock | Unified `inFlight` lock across purchase + restore ✓ |
| 5 | `fetchProducts()` called every time | `productsFetched` flag caches permanently ✓ |
| 6 | `patron_purchase_open` guard semantics | Renamed to `patron_purchase_blocked` ✓ |
| 7 | DetailScene `authorThanksEntry` underspecified | Concrete `renderAuthorThanksLayout()` path added ✓ |
| 8 | GP `getPurchases()` vs `has()` mismatch | `has(tag)` canonical; `getPurchases()` constructs synthetic result ✓ |

Alternative D (unify `getPurchases`/`has`) is also adopted. ✓

---

## New Concerns Introduced by R3

### [MAJOR] `restoreOnBoot` timeout discards late-successful fetch — patron never restored on slow connections

**(1)** `restoreOnBoot()` uses `Promise.race` with a 1.5s timeout. When the timeout wins, the code returns early. The original `fetchPromise` continues running in the background but its resolution is discarded — nobody handles it. If the SDK takes 2–3 seconds (common on slow mobile networks), the patron entitlement check succeeds silently, but `activatePatron()` is never called. The player sees ads that session. On the next boot, the same cycle repeats. If the player's connection is *consistently* slow (e.g., rural mobile), patron status is never auto-restored — only manual "Восстановить" works.

**(2)** Why it matters: The whole point of boot-time restore is to suppress ads before the game renders. A patron on a slow connection pays money but sees ads every session. They'd need to know to go to Settings → Restore. This is a real revenue-UX regression — the worst-case user (slow connection, already paid) gets the worst experience.

**(3)** Suggested fix: Chain a `.then()` on the fetchPromise for late-successful results:

```ts
const fetchPromise = this.sdk.getPurchases()
  .catch(err => { /* ... */ })
  .then(result => {
    if (result && result.ok && result.purchases.some(p => p.tag === PATRON_TAG)) {
      const stillNotPatron = !this.save.load().progress.patronSupport;
      if (stillNotPatron) {
        console.info("[payments] late restore success — activating patron post-timeout");
        this.activatePatron("restore");
      }
    }
  });
```

`activatePatron()` is already idempotent (early return if `patronSupport && patronBonusGranted`), so a late call after a successful boot-time verify is safe. The only side-effect is a brief ad flash before `markPatron()` suppresses them — acceptable trade-off.

---

### [MINOR] Build scripts use Unix env-prefix syntax — fails on Windows

**(1)** `"build:gp": "PLATFORM=gamepush npm run build"` — the `VAR=value cmd` syntax is bash-only. On Windows `cmd.exe` (the user's OS), this either errors or sets no variable, defaulting to `"gamepush"` via the vite.config fallback — but the intent to build for Yandex would silently produce a GamePush build.

**(2)** Why it matters: Silent wrong-platform build. Developer runs `npm run build:yandex` on Windows, gets a GamePush binary, deploys it, IAP doesn't work. Only caught if they check the console log or test the actual binary.

**(3)** Suggested fix: Add `cross-env` as a dev dependency:
```json
"build:gp": "cross-env PLATFORM=gamepush npm run build",
"build:yandex": "cross-env PLATFORM=yandex npm run build"
```
Or use `.env` files (`VITE_PLATFORM=gamepush`) which Vite reads natively on all platforms.

---

### [MINOR] Optimistic `markPatron()` in `restoreOnBoot` doesn't set `progress.patronSupport` — `canPurchasePatron()` returns true during optimistic window

**(1)** When `localHint` is true but `progress.patronSupport` is false, the optimistic path calls `this.ads.markPatron()` to suppress ads. But it doesn't call `this.save.updateProgress()` to set `patronSupport: true`. So `canPurchasePatron()` returns `true` during the window between optimistic mark and background verify completion. If the player opens Settings in that window, they see the "Поддержать" button despite already being a patron (and seeing no ads).

**(2)** Why it matters: Minor UX inconsistency. The player clicks "Поддержать", the purchase flow starts, then the SDK reports they already own it (or it fails). Not a crash, but confusing.

**(3)** Suggested fix: After the optimistic `this.ads.markPatron()`, also set the progress flag:
```ts
this.save.updateProgress((p) => ({ ...p, patronSupport: true }));
```
This is safe because: (a) if the background check confirms patron, `activatePatron` early-returns (idempotent), and (b) if the background check finds NOT patron (refund case), the v0.3.60 policy is "log only, don't revoke" — so the flag stays true, matching the optimistic assumption.

---

### [MINOR] `patron_purchase_open` analytics event has two distinct fire points — Settings dialog mount and post-win push dialog mount — but the plan doesn't specify where in the code each fires

**(1)** The analytics table says `patron_purchase_open` fires "только на dialog mount." There are two dialog mount points: Settings UI and MapScene post-win push. The plan shows `MapScene.openPatronPush()` explicitly calling `mountPatronDialog({ source: "post_win_push" })` and notes that "mountPatronDialog fires analytics.track on mount." But for Settings, it just says "dialog mount tracks `patron_purchase_open` единственным владельцем." Where exactly — in `mountPatronDialog` (shared code) or in Settings-specific mount logic? If it's in shared `mountPatronDialog`, the implementation is clean. If it's in each caller separately, there's duplication risk.

**(2)** Why it matters: Minor implementation clarity. If the tracking is in shared code, it's DRY. If it's in separate callers, one might be forgotten.

**(3)** Suggested fix: Add one line to the plan: "`mountPatronDialog()` fires `patron_purchase_open` internally with `source` passed as argument — single ownership point, no caller-side tracking."

---

### [MINOR] `activatePatron` calls `achievements.markPatronJustActivated()` on restore — may show "achievement unlocked" toast for a patron who already saw it

**(1)** `activatePatron()` is called for both `"purchase"` and `"restore"` origins. It calls `this.achievements.markPatronJustActivated()` unconditionally. On a fresh purchase, showing the achievement toast is correct. On a restore (boot-time or manual), the patron already had the achievement — showing "Достижение разблокировано: Покровитель" on every boot where the cloud confirms patron but local state was lost feels spammy.

**(2)** Why it matters: A returning patron on a new device (or cleared localStorage) sees the achievement toast on every boot until `patronBonusGranted` is persisted to cloud. If cloud sync is delayed, they see it multiple times.

**(3)** Suggested fix:** Gate the toast on origin:
```ts
if (origin === "purchase") {
  this.achievements.markPatronJustActivated();
}
this.achievements.reconcile(this.save.load().progress);
```
The `reconcile()` call handles the actual achievement state silently (without toast delay). Only a fresh purchase triggers the celebratory toast.

---

## Alternative Approaches

None this round — R3's architecture is well-structured and the shifts (unified `inFlight`, `has()` canonical, build-flag, split local/cloud) are all improvements. The plan is converging well.

---

## Verdict

CONCERNS REMAIN
