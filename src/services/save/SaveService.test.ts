import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialDeal } from "@/core/klondike/createInitialDeal";
import { createDefaultSaveState, SaveService } from "@/services/save/SaveService";

type StorageMock = {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
};

describe("SaveService", () => {
  let storage: StorageMock;
  let service: SaveService;

  beforeEach(() => {
    storage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    };

    vi.stubGlobal("window", {
      localStorage: storage
    });

    service = new SaveService();
  });

  it("returns default state when storage is empty", () => {
    storage.getItem.mockReturnValue(null);

    expect(service.load()).toEqual(createDefaultSaveState());
  });

  it("stores current game through updateCurrentGame", () => {
    storage.getItem.mockReturnValue(JSON.stringify(createDefaultSaveState()));
    const currentGame = createInitialDeal("adventure", "resume-me", 123);

    const nextState = service.updateCurrentGame(currentGame);

    expect(nextState.currentGame?.dealId).toBe("resume-me");
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("clears current game", () => {
    const state = createDefaultSaveState();
    state.currentGame = createInitialDeal("daily", "daily-1", 5);
    storage.getItem.mockReturnValue(JSON.stringify(state));

    const nextState = service.clearCurrentGame();

    expect(nextState.currentGame).toBeNull();
  });

  it("returns reward id when completing a node", () => {
    storage.getItem.mockReturnValue(JSON.stringify(createDefaultSaveState()));

    const result = service.completeNode("c1n1");

    expect(result.rewardId).toBe("reward_diary_page_01");
  });
});
