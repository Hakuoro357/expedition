## Prior concerns check

All **8 R3 concerns** are addressed:

| # | Verdict | Notes |
|---|---------|-------|
| codex-M1 (TitleScene gate) | ✅ Closed | Both sections now consistently use `sdk.canUseAchievements() && state.progress.prologueShown` |
| codex-M2 (top-bar CSS) | ✅ Closed | Concrete CSS with `env(safe-area-inset-*)`, shared `:root` vars, `z-index: 100`, `--has-community` toggle, mobile QA noted |
| codex-MIN1 (overview `currentPage` wording) | ✅ Closed | Solution overview #5 now says "автоматически через Phaser pause/resume — без явной передачи" |
| codex-M3 (async lifecycle guard) | ✅ Closed | `isClosed` flag on SHUTDOWN, checked before both re-render points |
| codex-M4 (clamp for one-shot) | ✅ Closed | `typeof meta.max === "number"` branch; one-shot → `displayProgress: undefined` |
| codex-M5 (parity test) | ✅ Closed | Unit test asserts exact 1:1 tag match between `ACHIEVEMENT_UI_META` and `ACHIEVEMENTS` |
| codex-M6 (PNG filesystem test) | ✅ Closed | `achievementIconsExist.test.ts` checks all 21 files via Node `fs` |
| xiaomi-MIN (non-hidden locked) | ✅ Closed | `<tag>.png` + `opacity: 0.5` + 14×14 bronze lock badge bottom-right |
| xiaomi-MIN (scroll preservation) | ✅ Closed | `scrollTop` saved before `renderFromVm`, restored after |

## New concerns

At R4, remaining items are implementation-level polish. No new MAJOR/CRITICAL gaps found.

## Verdict

NO SIGNIFICANT CONCERNS