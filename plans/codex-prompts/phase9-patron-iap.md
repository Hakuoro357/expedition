You are reviewing Phase 9 of patron-iap plan (Layer 8: Settings UI + patron dialog + Layer 7: DiaryScene/DetailScene author_thanks rendering).

Round: 1 of max 3 (R3 hard ceiling per phase).

Domain context: Phaser 3 + TypeScript solitaire game с GamePush+Yandex SDK. Phases 1-8 done & committed:
- SDK foundation, ProgressState, Reconciler delays, PaymentsService + AdsService gate (codex NSC at Phase 4+5), achievement registration, archive entry data + speakers, 23 i18n keys × 7 locales

Phase 9 user-facing UI scope:
- `src/ui/patronDialog.ts` (NEW) — `mountPatronDialog(source)` single-owner модуль с analytics open event
- `src/ui/patronDialog.test.ts` (NEW) — 13 jsdom tests
- `src/scenes/settingsSceneOverlay.ts` — Settings overlay extended c patron button + restore button
- `src/scenes/SettingsScene.ts` — wire handlers: open-patron → mountPatronDialog, restore-patron → handleRestoreClick (bounded retry + Yandex login flow)
- `src/scenes/DiaryScene.ts` — buildArchiveEntries prepends author_thanks entry when patronSupport=true; openEntryDetail special-case → DetailScene с authorThanksEntry flag
- `src/scenes/DetailScene.ts` — authorThanksMode renders minimal layout (no node-specific UI, returnTo navigation)
- `src/app/config/appContext.ts` — `payments?: PaymentsService` optional field (Phase 11 will make required)
- `src/styles.css` — ~130 lines patron UI styles

## Critical invariants to verify

1. **Single owner for `patron_purchase_open` event:** `mountPatronDialog(source)` fires analytics ОДИН раз on mount. SettingsScene/MapScene callers MUST NOT track open event separately (would double-count).
2. **Bounded restore retry:** `handleRestoreClick(retried=false)` recurses ONCE on unauthorized → triggerLogin → `handleRestoreClick(true)`. Second unauthorized → final toast, no further recursion.
3. **Restore reason switch:** handles `unauthorized` (login + retry), `not_found` (specific copy), `unavailable` (platform-not-supported copy), default error
4. **Mismatch flag:** when manualRestore returns `{ok:true, alreadyActive:true, mismatch:true}` → distinct `patronRestoreDisputed` toast (платформа не подтверждает local-only patron)
5. **DiaryScene `author_thanks`:** prepended (`unshift`) only when `progress.patronSupport === true`. `isAuthorThanks: true` marker. `portraitUrl: undefined` → initials-кружок fallback (existing code path)
6. **DetailScene authorThanksMode:** early-return в create() → renderAuthorThanksLayout. No node lookup. Back button → `scene.start(returnTo)`. Reuses existing detail-page CSS
7. **`canPurchasePatron` / `canRestore` flags:** computed в SettingsScene, passed to overlay. `canPurchasePatron = payments.canPurchasePatron()` (false when патрон уже active). `canRestore = canUsePayments() && !save.load().progress.patronSupport`
8. **Dialog cancel paths:** «Не сейчас», backdrop click, both close dialog. No analytics noise on cancel (open already fired).
9. **lockClicksFor(350)** on dialog mount + close — prevents ghost-clicks через canvas transitions
10. **Confirm dialog (Yandex login prompt):** uses existing `showConfirmDialog` from `src/ui/confirmDialog.ts` (Sonnet found existing) — verify это правильный API
11. **`payments?: PaymentsService` optional gate:** Settings code uses payments with appropriate null-check (Phase 11 will make required)
12. **Phase 9 must NOT touch:** PaymentsService/AdsService logic (Phase 4+5 done), achievement/entry data (Phase 6+7+8 done), BootScene wiring (Phase 11), RewardScene push trigger (Phase 10)

Verification: 253 → 266 tests (+13). Build:gp clean.

Plan contract: `plans/patron-iap-final.md` (Layer 7 second half + Layer 8).

Output format:
- [CRITICAL] / [MAJOR] / [MINOR] tag + (1) what's wrong (2) why matters (3) suggested fix
- Flag specifically any double-tracking of patron_purchase_open as MAJOR
- Flag any infinite recursion in restore flow as MAJOR
- At R3 — last round; remaining concerns = known TODO
- End with verdict (LAST non-empty line): NO SIGNIFICANT CONCERNS or CONCERNS REMAIN

=== IMPLEMENTATION DIFF ===
