R5 concern is closed cleanly: VM now accepts `sdkProgressByTag` + `persistedProgress`, uses `Math.max(compute, sdk, persisted)` for effectiveProgress, display clamps to max when unlocked. Coin regression case explicitly covered in test list. First render is compute-only (offline-first), async re-render enriches with SDK data.

No new gaps identified. Plan is implementation-ready.

**NO SIGNIFICANT CONCERNS**