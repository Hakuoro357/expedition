You are reviewing Phase 10 + Phase 11 of patron-iap plan (Layer 9: RewardScene push trigger + MapScene receiver + Layer 10: Boot integration).

Round: 1 of max 3 (R3 hard ceiling per phase).

Domain context: Phaser 3 + TypeScript solitaire game с GamePush+Yandex SDK. Phases 1-9 done & committed:
- SDK foundation + factory, ProgressState fields, Reconciler delays, PaymentsService + AdsService gate (codex NSC), achievement registration, archive entry + speakers + i18n, Settings UI + dialog (codex 3 accepts) — all v0.3.60 layer-by-layer

Phase 10+11 scope:
- **RewardScene.ts**: scalar count capture BEFORE save.completeNode mutation, justCrossed3 detection, hide rewarded UI для patron (canShowRewarded → adLabel undefined)
- **MapScene.ts**: receive showPatronPush flag via init(), pendingPatronPush field, 600ms delayedCall с active-scene + eligibility guards, SHUTDOWN cleanup для timer, openPatronPush() async: updateProgress(patronPushShown:true) + await flush + mountPatronDialog("post_win_push")
- **AppContext.ts**: payments?: PaymentsService → payments: PaymentsService (REQUIRED)
- **BootScene.ts**: replace `new GamePushSdkService()` с createSdkService() factory; instantiate PaymentsService с (sdk, analytics, save, achievements, ads) — order matters (achievements before payments); add `await payments.restoreOnBoot()` BEFORE ads.showPreloader, после всех services constructed

## Critical invariants to verify

1. **Scalar count capture (R2 X17):** RewardScene captures `completedCountBeforeWin` BEFORE `save.completeNode()` mutates. Если interleaved — beforeCount would equal afterCount (no detection)
2. **One-shot push:** `patronPushShown=true` set IN openPatronPush (on-impression), NOT в RewardScene (on-eligibility). Plan: if scene closes до delayedCall — push не shown, flag still false, может появится на next session. Codex's earlier eligibility-vs-impression concern.
3. **Eligibility re-check INSIDE delayedCall:** if user purchased patron in 600ms gap (impossible in practice but defensive) — `canPurchasePatron()` returns false → early-return, не показывать push
4. **SHUTDOWN cleanup:** delayedCall timer must be removed on scene shutdown — иначе зомби-timer fires в next scene context
5. **Boot order:** sdk → save.init() → achievements (Reconciler) → ads (AdsService) → payments (PaymentsService с achievements + ads deps) → setAppContext → restoreOnBoot. Если порядок неверный — undefined dep ошибка
6. **createSdkService factory:** replaced direct `new GamePushSdkService()`. Builds (build:gp + build:yandex) должны routing'ить correct adapter
7. **`payments?` optional chain в Phase 9 → теперь payments required.** Code в SettingsScene/MapScene использовал `payments?.method()` — после Phase 11 эти `?.` теперь tautology, не баг (TypeScript will allow). Не critical, но лишний noise.
8. **`canShowRewarded` patron hide:** `adLabel: undefined` → existing createRewardOverlayHtml `adLabel?: string` path — button не рендерится. No DOM noise.
9. **Phase 10+11 must NOT touch:** PaymentsService/AdsService logic (Phase 4+5 done), patronDialog (Phase 9 done), achievement/entry data (Phase 6+7+8 done). Только wiring + push trigger + boot.

Verification: 266 → 266 tests (no new tests; existing coverage). build:gp + build:yandex clean.

Plan contract: `plans/patron-iap-final.md` (Layer 9, Layer 10).

Output format:
- [CRITICAL] / [MAJOR] / [MINOR] tag + (1) what's wrong (2) why matters (3) suggested fix
- Flag особенно: boot order issues, missed SHUTDOWN cleanup, race в delayedCall guards
- At R3 — last round; remaining concerns = known TODO
- End with verdict (LAST non-empty line): NO SIGNIFICANT CONCERNS or CONCERNS REMAIN

=== IMPLEMENTATION DIFF ===
