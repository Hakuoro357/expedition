=== codex R6 ===

R5 concern is closed cleanly. The VM now carries both `sdkProgressByTag` and `persistedProgress`, and max-achievement display uses `max(compute, sdk, persisted)`. The coin regression case is explicitly tested: current coins can fall to 300 while persisted/sdk peak remains 1000, and UI shows 1000/2000. Unlock logic also now treats `effectiveProgress >= meta.max` as unlocked, covering SDK progress-confirmed milestones even if `unlocked=false`.

No new MAJOR or CRITICAL gaps found.

One implementation note, not a blocker: sanitize numeric progress inputs before `Math.max` if the actual code reads SDK/save data directly. A `NaN` or non-finite persisted value would poison `effectiveProgress`/`displayPct`. Best small helper:

```ts
const readProgress = (value: unknown) =>
  Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
```

Then clamp display to `meta.max` as planned.

NO SIGNIFICANT CONCERNS