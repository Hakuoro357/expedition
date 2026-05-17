## Prior Concerns — Closure Status

Both R4 MINOR concerns are closed:

| # | R4 Concern | R5 Resolution |
|---|---|---|
| 1 | `handleRestoreClick` unbounded recursion | **Z3:** `retried` parameter caps at 1 retry; second `unauthorized` shows toast and exits ✓ |
| 2 | `unmarkPatron()` sticky stays hidden | **Z2:** Split into `setPatronOptimistic` (sticky untouched) / `markPatronConfirmed` (closes sticky). Optimistic path fully revocable. ✓ |

## New Concerns Introduced by R5

### [MINOR] `processRestoreResult` — `!platformPatron && ctx.localPatron` doesn't clean up stale localStorage hint

**(1)** When boot restore finds platform says NOT patron but local save says yes, the code logs a warning and returns. But if there was also a localStorage hint (`localHint=true`), that hint is never removed. Subsequent boots will re-enter the optimistic path even though the save already has `patronSupport=true`.

**(2)** Why it matters: Practically zero behavioral impact — the optimistic gate is `localHint && !this.save.load().progress.patronSupport`, and since `patronSupport` is already `true`, `setPatronOptimistic` is never called again. The stale hint is dead weight but causes no bug.

**(3)** Suggested fix: In that branch, add `if (ctx.localHint) { try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch {} }` for hygiene. Alternatively, add a one-line comment: `// hint left stale — harmless; save.patronSupport=true gates re-entry`. Either approach prevents future confusion.

---

No other concerns. The Z1 `Extract<>` type fix is correct. The Z2 optimistic/confirmed split cleanly separates revocable vs. permanent ad suppression. Z4's async `.catch()` chain with `pendingLateRestore` is well-structured. Z5's mismatch flag with dedicated toast gives the user transparency on the rare local-vs-platform divergence. Test additions cover each fix's hot path. The 20-key × 7-locale i18n count is consistent (19 prior + 1 new `patronRestoreDisputed`).

## Alternative Approaches

None. R5's fixes are surgical and proportional. Plan is converging well.

---

NO SIGNIFICANT CONCERNS
