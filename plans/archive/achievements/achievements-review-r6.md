Prior concerns: closed. The R5 issue is addressed: SDK-sourced unlocked/progress state is now persisted locally during bootstrap, and the proposed test covers the next-session empty-SDK-list case.

[MAJOR] new-concern-introduced: SDK progress at/above local max but `unlocked=false` can become a durable suppressor.
1. In bootstrap merge, `unlocked` is handled first, but non-unlocked SDK progress is persisted as progress only. If SDK returns `{ tag: "coins_500", progress: 500, unlocked: false }` or progress above max, local `lastProgress` becomes `500`, but `unlockedCache` / `achievementUnlocked` are not updated.
2. This can permanently block the local reconciler from sending the final write: future `reconcile()` computes capped `500`, sees `lastProgress=500`, and skips. If the SDK `unlocked` flag was stale or inconsistent, the achievement may remain locked.
3. During SDK merge, normalize known progress achievements against metadata:
   - clamp SDK progress to `meta.max`;
   - if clamped progress `>= meta.max`, treat it as completed locally: add `unlockedCache`, `persistUnlocked(tag)`, optionally persist progress at max;
   - otherwise persist progress only when greater than local.
   Add a test for SDK list `{ progress: max, unlocked: false }` ensuring bootstrap persists unlocked and later empty SDK list does not stall or resend incorrectly.

CONCERNS REMAIN