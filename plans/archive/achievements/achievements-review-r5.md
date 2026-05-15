[MAJOR] new-concern-introduced: SDK bootstrap merge is not persisted locally.
1. `bootstrap()` merges `playerAchievementsList` into `unlockedCache` / `lastProgress`, but does not call `persistUnlocked(tag)` or `persistProgress(tag, progress)` for SDK-sourced values.
2. This weakens the R3/R4 quota-burn protection for cross-device/cloud cases. Example: achievement unlocked on device A, device B fetches SDK list and caches it in memory, but local save is not updated. On the next launch, if `playerAchievementsList` is empty due to a network glitch, device B can re-send unlock/progress that it already learned from SDK previously.
3. During bootstrap merge, backfill local persisted state from SDK truth:
   - if `unlocked`, add cache and `persistUnlocked(tag)` if not already persisted.
   - if SDK `progress` is greater than local persisted/last progress, update cache and `persistProgress(tag, progress)`.
   Add a test: SDK list returns unlocked/progress not present in save, bootstrap persists it, next session with empty SDK list skips duplicate writes.

Prior concerns:
- `pendingDesired` drain issue appears closed: direct `writeProgress` drain, delete before recursive call, no stale `reconcile(state)` path.
- bootstrap persisted seed race appears closed: persisted unlocked/progress are seeded synchronously before `await fetchAchievements()`.

## Alternative approaches

No better architecture needed at this point. The current reconciler design is converging; just make SDK-sourced bootstrap knowledge durable, not memory-only.

CONCERNS REMAIN