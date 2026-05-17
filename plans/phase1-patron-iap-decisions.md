# Phase 1 — SDK foundation — decisions

**Status:** ✅ Clean (215/215 tests passing, TS+build clean)

## R1 (Claude orchestrator) review
9 хорошо, 5 minor concerns, 0 блокеров. Notable:
- GP `getPurchases()` correctly uses `has(tag)` canonical
- Yandex `signed: false` per plan
- Factory `import.meta.env.DEV` gated URL override
- `closeSticky` already existed pre-Phase 1, preserved
- DevStub localStorage-backed dev payments

## R2 (codex) findings
3 concerns: 2 MAJOR + 1 MIN.

| Concern | Severity | Decision | Rationale |
|---|---|---|---|
| GP `getPurchases()` blocked если fetchProducts throws | MAJOR | **ACCEPT** | Real bug. Fixed: fetchProducts wrapped в try/catch без return, has() proceeds regardless. Restore не должен зависеть от catalog network |
| `package.json` отсутствует в diff | MAJOR | **REJECT (false positive)** | package.json IS modified (cross-env + scripts confirmed via system-reminder + git status). Codex saw incomplete diff — мой пакетинг artifact, not Sonnet's miss |
| `PurchaseFailureReason` имя misleading | MIN | **ACCEPT** | Renamed: `PurchaseFailureReason` теперь правильно derived from `PurchaseResult` (single attempt: cancelled/error/unavailable/unauthorized). Added separate `PurchasesFailureReason` from `PurchasesResult` (restore lookup: timeout/error/unauthorized/unavailable) |

## Files touched (R2 fixes)
- `src/services/sdk/SdkService.ts` — split into 2 typed reasons
- `src/services/sdk/GamePushSdkService.ts` — fetchProducts non-blocking

## Net result
2 accepts + 1 rejected (false positive) → Phase 1 R3 ceiling NOT needed. Plan-converged at R2. Ready for Phase 2.
