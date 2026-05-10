/**
 * Mutable singleton, через который сцены передают контекст последнего
 * социального действия глобальному listener'у в BootScene.
 *
 * Зачем нужно:
 * До v0.3.52 каждая сцена (TitleScene, MapScene, RewardScene) сама
 * подписывалась на `gp.socials.on('joinCommunity', ...)` /
 * `on('share', ...)` и хранила свою копию контекста (например,
 * `RewardScene.dealId`). Это создавало две проблемы:
 *
 * 1. Listener leak / накопление коллбэков. После TitleScene → MapScene
 *    GP SDK хранил два слушателя на одно событие, и один реальный
 *    join community триггерил оба → analytics видела событие как
 *    `{from: "title"}` И `{from: "map"}` одновременно. Грязный учёт.
 *
 * 2. Stale state. RewardScene ставила слушатель один раз, читал
 *    `this.dealId`. Если событие пришло поздно (после перехода на
 *    другую партию) — analytics получала чужой dealId.
 *
 * Решение:
 * BootScene устанавливает один глобальный listener на каждое событие
 * (см. BootScene.create). Listener читает контекст из этого
 * singleton'а и тут же его обнуляет. Сцены ставят контекст ровно
 * перед вызовом sdk.share / sdk.joinCommunity и сразу забывают.
 *
 * Альтернативно можно было бы добавить `off`-метод в SdkService и
 * подписываться/отписываться per-scene, но: (а) GP SDK API не имеет
 * чёткого off для on (`gp.socials.on` не возвращает unsubscribe-токен
 * на момент v0.3.51), (б) один listener проще, чем учёт жизненного
 * цикла — особенно когда несколько сцен могут быть активны одновременно
 * через scene.start без shutdown (теоретически).
 */

export type CommunityOrigin = "title" | "map";

export type ShareContext = {
  /** dealId партии, после которой нажали share. Используется для
   *  analytics: {dealId} в track('share_win_success'). */
  dealId: string;
  /** narrative-локаль на момент клика — пригодится если в будущем
   *  захотим логировать локализацию share. */
  locale?: string;
};

interface SocialsContextSingleton {
  pendingShare: ShareContext | null;
  pendingCommunityOrigin: CommunityOrigin | null;
}

/**
 * Глобальный mutable объект. Не singleton-class — намеренно простая
 * структура без методов. Все мутации точечные, синхронные, без race-
 * conditions (гейм однопоточный).
 */
export const socialsContext: SocialsContextSingleton = {
  pendingShare: null,
  pendingCommunityOrigin: null,
};
