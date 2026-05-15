Prior concerns: closed. R7 now normalizes SDK-sourced progress through metadata, clamps over-max values, treats `progress >= max` as locally unlocked, persists that unlocked state, and ignores orphan SDK tags. That closes the durable suppressor path from inconsistent GP state.

New significant gaps introduced: none found.

## Alternative approaches

No better alternative needed at this point. The current fix is small, local, and matches the reconciler design.

NO SIGNIFICANT CONCERNS