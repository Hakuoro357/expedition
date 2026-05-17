[MAJOR]  
(1) `canRestore` is wrong in `src/scenes/SettingsScene.ts:173`: it is `payments?.canUsePayments() ?? false`, but invariant requires `canUsePayments() && !save.load().progress.patronSupport`.  
(2) Active patrons still see “Restore purchase”, which breaks the Phase 9 UI contract and can lead to confusing `alreadyActive` / `mismatch` toasts.  
(3) Compute `const isPatron = currentState.progress.patronSupport === true` and pass `canRestore: (payments?.canUsePayments() ?? false) && !isPatron`. Update the overlay comment too.

[MAJOR]  
(1) Settings UI is not refreshed after successful purchase from `mountPatronDialog("settings")`. `patronDialog.ts` closes and shows toast, but `SettingsScene` does not subscribe to `payments.onChange()` and does not pass a success callback.  
(2) After purchase, the Settings overlay can still show the support button until the scene is reopened; the next click hits `purchasePatron()` with `not_eligible` and shows a generic error.  
(3) Add `payments.onChange(() => this.renderOverlay())` in `SettingsScene.create()` with shutdown cleanup, or let `mountPatronDialog` accept `onSuccess` and call `this.renderOverlay()` from Settings.

[MINOR]  
(1) `author_thanks` currently resolves `portraitUrl` through `resolvePortraitUrl(authorSpeaker.portraitKey)` in `DiaryScene.ts:158` and `DetailScene.ts:144`; the phase invariant says `portraitUrl: undefined` to force initials fallback.  
(2) It works today only because `author.webp` is absent. Adding the v0.3.61 portrait asset would silently change Phase 9 rendering.  
(3) Set author-thanks portrait explicitly to `undefined` / render initials explicitly for this mode.

No double-tracking of `patron_purchase_open` found: only `src/ui/patronDialog.ts` tracks it. Restore recursion is bounded to one retry.

CONCERNS REMAIN