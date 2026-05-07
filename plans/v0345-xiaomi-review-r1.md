**[MINOR] Docstring/code-comment mismatch: 35% vs 38%**
(1) The method-level JSDoc on `renderBackground()` says "нижние 35%" but the inline comment and the actual constant are `0.38` (38%).
(2) Future maintainers adjusting the overlay height will get contradictory guidance.
(3) Change the JSDoc to say "нижние 38%" (or vice-versa) in `TitleScene.ts` around line 62.

**[MINOR] No defensive guard after `shownHintKeys.clear()` → `getRemainingHints()` recomputation**
(1) After clearing `shownHintKeys`, the code unconditionally proceeds to `save.addCoins(-cost)` and uses `remaining[0]`. The developer's invariant ("после clear там точно есть хотя бы 1 hint, потому что allHintsCount > 0") holds only if `getRemainingHints` filters *solely* by `shownHintKeys`. If any future refactor adds additional filtering (e.g. board-state-dependent pruning), `remaining` could be empty, the player would be charged 30 coins, and `remaining[0]` access would throw a TypeError.
(2) Coins deducted with no hint shown = data-loss/crash.
(3) Add a guard after the recompute: `if (remaining.length === 0) return;` (or show the "no moves" modal as a safe fallback) in `GameScene.ts` after the `remaining = this.getRemainingHints()` reassignment inside the cycle-exhausted branch.

**[MINOR] Missing tests for both behavioral changes**
(1) No new unit/integration tests cover (a) the hint-cycle reset path (`shownHintKeys` cleared, coins still charged, first hint re-shown) or (b) the `isFirstRunFromTitle` → `navItems: undefined` guard.
(2) The hint path has at least three distinct branches (no-moves modal, cycle-exhausted reset, normal hint) and the nav guard has a boolean conjunction — both are easy to regress silently.
(3) Add at minimum: a test that `handleHintAction` with `getAllHints > 0` and `remaining === 0` clears `shownHintKeys` and does NOT show the "no moves" dialog; a test that `SettingsScene.renderOverlay` with `returnTo === "title"` and `prologueShown === false` produces HTML without nav items.

**[MINOR] Future-dated spec reference in BootScene comment**
(1) The new comment references `docs/specs/2026-05-02-gamescene-decomposition.md` — the year 2026 appears to be a typo for 2025.
(2) Misleads anyone trying to locate the referenced spec.
(3) Correct the year in `BootScene.ts` line ~57.

**[MINOR] `shownHintKeys` lifecycle not addressed for board-state changes**
(1) The cycle-exhausted branch clears `shownHintKeys` globally. If the player then makes a move (changing `gameState`), `shownHintKeys` still contains stale keys from the *previous* board state. This is pre-existing behavior, not introduced by this diff, but the new clear-and-replay path makes it more likely a player will accumulate stale keys across state transitions.
(2) Could cause hints from a previous board layout to be silently filtered, leading to premature cycle exhaustion on the new board.
(3) Out of scope for this diff but worth a follow-up: clear `shownHintKeys` on every board-state mutation (move, undo) or key hints by a board-state hash.

---

NO SIGNIFICANT CONCERNS