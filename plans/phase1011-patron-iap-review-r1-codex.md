[MAJOR] [RewardScene.ts](</c/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/RewardScene.ts:61>) / [RewardScene.ts](</c/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/RewardScene.ts:443>)

1. `completedCountBeforeWin` по умолчанию `0` и обновляется только внутри ветки нового adventure-node. Для daily/quick/replay/preview при `completedNodes.length === 3` `justCrossed3` станет `true` без фактического пересечения порога.
2. Это может показать patron push не на третьей adventure-победе, а на следующем reward-экране, который вообще не мутировал `completedNodes`.
3. Исправление: инициализировать baseline в `create()` до любых мутаций для всех не-`returnFromDetail` входов, например `this.completedCountBeforeWin = save.load().progress.completedNodes.length`, сохранить текущую логику capture перед `completeNode`, и в continue дополнительно гейтить `mode === "adventure" && !preview`.

Без замечаний по проверенным инвариантам: Boot order выглядит корректным, `createSdkService()` используется, `restoreOnBoot()` стоит до `ads.showPreloader()`, `patronPushShown` ставится в `openPatronPush`, delayedCall повторно проверяет `canPurchasePatron()`, SHUTDOWN cleanup таймера есть, rewarded UI для patron скрывается через `adLabel: undefined`.

Тесты/build не запускал, review выполнен по диффу и локальному чтению файлов.

CONCERNS REMAIN