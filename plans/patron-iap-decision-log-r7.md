# Patron IAP — Decision log R7 (HARD CEILING)

R7 reviewers: **qwen → NO SIGNIFICANT CONCERNS** (4-й раз подряд) + **codex → CONCERNS REMAIN** (1 prior-MAJOR + 3 new-MAJOR + 1 MIN).

R7 — hard ceiling per CLAUDE.md global directive. No R8 без explicit user approval.

## Status: STALLED at R7

Не достигнут double-consensus. Plan saved as `patron-iap-stalled-r7.md` per protocol.

## Codex R7 remaining concerns (open known TODO для execution phase)

**U1 — `restoreOnBoot` skips local entitlement when payments unavailable (codex prior-MAJOR):**
Early return `if (!this.canUsePayments()) return;` ДО reading localPatron. Existing local patron on Crazy/Poki / temporary SDK failure → ads visible. **Real bug.** Fix during execution: read localPatron first, call `confirmPatronEntitlement("preserved")` если `localPatron && !canUsePayments()`.

**U2 — Timeout consumes late SDK success (codex new-MAJOR):**
`processOnce({reason:"timeout"})` sets `processed=true`; valid SDK response after 1.5s ignored. Slow mobile SDK (2-3s startup) → patron not restored на boot. **Real regression от R7 V2 fix.** Fix during execution: split timeout-clears-optimistic от result-consumption. Late positive SDK result должен activate patron. Только duplicate definitive results suppress.

**U3 — Manual restore hang locks `inFlight` (codex new-MAJOR):**
`restorePatronManual` awaits `getPurchases()` без timeout. SDK hang → inFlight stuck → permanent purchase/restore block until refresh. **Real bug.** Fix: wrap `getPurchases()` in timeout, return `reason:"timeout"`; if localPatron, call `confirmPatronEntitlement("preserved")`.

**U4 — `confirmPatronEntitlement` не reconciles achievements (codex new-MIN):**
Preserved paths только ads-confirm; если prior crash оставил `patronSupport=true` но achievement не unlocked, preserve doesn't repair. **Edge case.** Fix: helper зовёт `achievements.reconcile(...)` после ad-confirm; OR rename helper to clarify scope.

## Convergence trend

| Round | Codex concerns | Qwen concerns | Status |
|---|---|---|---|
| R1 | 4 CRIT + 18 MAJOR + 6 MIN = 28 | 1 CRIT + 6 MAJOR + 8 MIN = 15 | both REMAIN |
| R2 | 4 prior + 4 new MAJOR + 2 MIN = 10 | 0 prior + 3 MAJOR + 5 MIN = 8 | both REMAIN |
| R3 | 4 prior + 3 new MAJOR + 2 MIN = 9 | 0 prior + 1 MAJOR + 4 MIN = 5 | both REMAIN |
| R4 | 3 prior + 4 new MAJOR + 2 MIN = 9 | 0 prior + 2 MIN = 2 | qwen **NSC** ✓ |
| R5 | 1 prior + 1 new MAJOR + 1 MIN = 3 | 0 = 0 | qwen NSC ✓ |
| R6 | 2 prior MAJOR + alternative = 2 | 0 = 0 | qwen NSC ✓ |
| R7 | 1 prior + 3 new MAJOR + 1 MIN = 5 | 0 = 0 | qwen NSC ✓ |

**Net trend:** monotonic decrease для большинства; codex R7 ticked up в `new MAJOR` потому что R6 V2/V3 fixes introduced new code paths где он нашёл новые ladder rungs. Эти были bound to be discovered в code review anyway.

**Accept rate:** R1-R6 → 73 accepted, 3 rejected (Y7 refund×3, Z6 same×2 codex repeats — codex dropped them in R5). R7 → 4 valid concerns, 0 rejected (would accept all).

## Recommendation

R7 concerns U1-U4 — все clean technical bugs, не taste. В normal R8 cycle они бы закрылись simple surgical fixes (≈3 lines each). User options:

**Option A (recommended): Apply R7 fixes без re-review, ship plan as final**
- 4 fixes сурgical, well-bounded
- Code review during execution catches любые regressions (test coverage covers timeout + manual restore + preserved paths)
- Saves 2 review cycles cost

**Option B: Explicit R8 user override**
- Reset hard ceiling
- Run codex+qwen R8 на patched plan
- Likely yields double consensus (codex concerns were specific и surgical)
- Adds ~15min round-trip

**Option C: Accept stalled-r7 as final, U1-U4 → execution TODO list**
- Plan ships as-is с known limitations документированы
- Execution phase fixes inline + tests cover
- Maximum protocol compliance

Default selection — Option A: apply U1-U4 silently to final + document in `patron-iap-final.md` "R7-ceiling fixes applied unreviewed".

## Open questions для user

1. Approve Option A (silent fix-and-ship), B (R8 override), or C (stalled-r7-as-final)?
2. Если C: U1/U3 — должны блокировать execution, или ship и fix-on-discovery в production?
