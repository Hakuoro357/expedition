R1 в целом закрыт, но остаются реальные риски.

[MAJOR] prior-concern-not-closed: character entry `Max` не совпадают с данными.
1. В таблице `entries_*` max дают 10+6+5+4+3 = 28, а записей 30. По `entries.global.ts/ru.ts` видно, что `leader` встречается больше 10 раз, `cartographer` не 5.
2. Часть character achievements либо завершится раньше нужного, либо останется недостижимой в dashboard/code mismatch.
3. Сгенерировать counts из `CHAPTERS -> entryId -> speakerEntityId` и использовать их как source of truth для `max`; тест должен проверять не только сумму 30, но и `meta.max === actualCount`.

[MAJOR] new-concern-introduced: transient SDK failure still loses ephemeral one-shot facts.
1. `shareJustSucceeded`, `communityJustJoined`, `lastWin` exist only for one reconcile call.
2. If `unlockAchievement()` returns false for `first_share`, `first_community_join`, `no_undo_win`, `no_hint_win`, there may be no future event to retry, especially community join.
3. Persist durable facts or pending intents in save, e.g. `achievementFacts: { sharedEver, communityJoinedEver, noUndoWinEver, noHintWinEver }`, then reconcile from facts until SDK success.

[MAJOR] new-concern-introduced: `pending` can drop newer progress while an older call is in flight.
1. If `coins_2000` sends 1900 and, before it resolves, ad bonus raises balance to 2050, second reconcile skips because tag is pending.
2. After success, cache commits 1900; without another event, the max progress may never be sent.
3. Track `pendingDesiredProgress` per tag. When pending resolves, compare latest desired vs committed and immediately send the newer capped value if higher.

[MAJOR] prior-concern-not-closed: RewardScene gating still does not explicitly use `actualWinApplied`.
1. The plan says gate by `!preview && !returnFromDetail`, but R1 asked for `actualWinApplied` because RewardScene has replay/return paths that do not mutate save.
2. A future or existing navigation path that re-enters RewardScene without `returnFromDetail` can run reconcile as if a new reward/win happened.
3. Set explicit booleans in RewardScene: `nodeJustCompleted`, `dailyJustClaimed`, `quickPlayCoinsJustAwarded`, `actualWinContextAccepted`; call win reconciliation only from those branches.

[MAJOR] prior-concern-not-closed: `getAchievementProgress` fallback is unsafe.
1. Plan says if `getProgress` is not truly sync, assume 0.
2. That can resend already-known progress every bootstrap, burning quota and making backfill noisy.
3. Verify GP API before implementation. If reliable free progress read is unavailable, persist `lastProgress`/pending achievement sync state in save or derive from a confirmed achievement list API.

[MINOR] new-concern-introduced: `LastWinContext` has unused event fields.
1. `artifactJustAwarded` and `entryJustOpened` are defined but unused by metadata.
2. They suggest event semantics that the Reconciler intentionally moved away from, and can confuse later edits.
3. Remove them until a concrete achievement needs them.

CONCERNS REMAIN