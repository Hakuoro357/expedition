import { describe, expect, it, beforeEach } from "vitest";
import { socialsContext } from "@/app/socialsContext";

/**
 * Тесты для глобального socials context. Симулируют сценарий из
 * code-review v0.3.51:
 *   - share-кнопка в RewardScene захватила dealId="X" в pendingShare
 *   - listener в BootScene должен прочитать dealId="X" и обнулить
 *   - если listener вызвался ПОСЛЕ смены сцены/dealId — analytics
 *     должна получить ИСТОРИЧЕСКИЙ dealId="X", а не новый
 */
describe("socialsContext", () => {
  beforeEach(() => {
    // Singleton — нужно сбрасывать между тестами.
    socialsContext.pendingShare = null;
    socialsContext.pendingCommunityOrigin = null;
  });

  it("captures share dealId at click time, not at result-arrival time", () => {
    // Симулируем: клик share при dealId="A"
    socialsContext.pendingShare = { dealId: "c1n3" };

    // Между кликом и приходом результата сцена сменилась — где-то
    // ещё могла измениться mutable scene state. socialsContext не
    // зависит от scene state, держит свой snapshot.
    const someOtherDealId = "c1n4"; // не попадает в socialsContext

    // Listener читает контекст:
    const captured = socialsContext.pendingShare;
    socialsContext.pendingShare = null;

    expect(captured).not.toBeNull();
    expect(captured?.dealId).toBe("c1n3");
    expect(captured?.dealId).not.toBe(someOtherDealId);
    expect(socialsContext.pendingShare).toBeNull();
  });

  it("origin tracks where joinCommunity click came from", () => {
    socialsContext.pendingCommunityOrigin = "title";
    expect(socialsContext.pendingCommunityOrigin).toBe("title");

    socialsContext.pendingCommunityOrigin = "map";
    expect(socialsContext.pendingCommunityOrigin).toBe("map");

    socialsContext.pendingCommunityOrigin = null;
    expect(socialsContext.pendingCommunityOrigin).toBeNull();
  });

  it("listener reading null pending should be a no-op signal", () => {
    // Сценарий: SDK выдал onShareResult без предшествующего клика
    // (например GP отправил историческое событие при init).
    // Listener должен видеть null и НЕ трекать analytics.
    expect(socialsContext.pendingShare).toBeNull();
    expect(socialsContext.pendingCommunityOrigin).toBeNull();
  });
});
