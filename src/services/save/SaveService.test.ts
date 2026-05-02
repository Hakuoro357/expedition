import { beforeEach, describe, expect, it } from "vitest";
import { createInitialDeal } from "@/core/klondike/createInitialDeal";
import { createDefaultSaveState, SaveService } from "@/services/save/SaveService";
import type { SdkService } from "@/services/sdk/SdkService";

/**
 * In-memory stub для SdkService. Имитирует gp.player.get('save') /
 * gp.player.set('save', ...): хранит последний записанный JSON в поле
 * `cloud` и отдаёт его обратно из getCloudSave().
 */
function createSdkStub(initialCloud: string | null = null): SdkService & {
  cloud: string | null;
} {
  const stub = {
    cloud: initialCloud,
    async init() {},
    isAvailable: () => true,
    signalReady() {},
    gameplayStart() {},
    gameplayStop() {},
    onPause() {},
    onResume() {},
    onMuteChange() {},
    isMuted: () => false,
    muteSounds() {},
    unmuteSounds() {},
    setSfxMuted() {},
    setMusicMuted() {},
    detectLocale: () => null,
    changeLanguage() {},
    onLanguageChange() {},
    async getCloudSave() {
      return this.cloud;
    },
    async setCloudSave(json: string) {
      this.cloud = json;
    },
    async showRewardedVideo() {
      return false;
    },
    async showInterstitial() {},
    showSticky() {},
    closeSticky() {},
    refreshSticky() {},
    async showPreloader() {
      return false;
    },
  };
  return stub as unknown as SdkService & { cloud: string | null };
}

describe("SaveService", () => {
  let sdk: ReturnType<typeof createSdkStub>;
  let service: SaveService;

  beforeEach(async () => {
    sdk = createSdkStub(null);
    service = new SaveService();
    await service.init(sdk);
  });

  it("returns default state when cloud save is empty", () => {
    expect(service.load()).toEqual(createDefaultSaveState());
  });

  it("hydrates state from cloud save on init", async () => {
    const seeded = createDefaultSaveState();
    seeded.progress.coins = 777;
    const sdkWithCloud = createSdkStub(JSON.stringify(seeded));
    const svc = new SaveService();
    await svc.init(sdkWithCloud);

    expect(svc.load().progress.coins).toBe(777);
  });

  it("stores current game through updateCurrentGame and pushes to cloud on flush", async () => {
    const currentGame = createInitialDeal("adventure", "resume-me", 123);

    const nextState = service.updateCurrentGame(currentGame);

    expect(nextState.currentGame?.dealId).toBe("resume-me");
    // persist() дебаунсится (800 мс) — на cloud изменения попадают
    // синхронно только после flush(). Это защищает gp.player.sync()
    // от «слишком частых сохранений» при burst-апдейтах во время партии.
    await service.flush();
    expect(sdk.cloud).toBeTruthy();
    const cloudParsed = JSON.parse(sdk.cloud as string);
    expect(cloudParsed.currentGame.dealId).toBe("resume-me");
  });

  it("clears current game", () => {
    service.updateCurrentGame(createInitialDeal("daily", "daily-1", 5));

    const nextState = service.clearCurrentGame();

    expect(nextState.currentGame).toBeNull();
  });

  it("returns reward id when completing a node", () => {
    const result = service.completeNode("c1n1");

    expect(result.rewardId).toBe("reward_diary_page_01");
  });

  it("flush awaits setCloudSave", async () => {
    service.addCoins(10);
    await service.flush();
    const cloudParsed = JSON.parse(sdk.cloud as string);
    expect(cloudParsed.progress.coins).toBe(createDefaultSaveState().progress.coins + 10);
  });

  it("updateCurrentGame does not auto-sync to cloud (avoids gp.player.sync quota burn)", async () => {
    // Симулируем burst мутаций currentGame во время партии: 50 ходов,
    // но без явного flush. Облако обновляться НЕ должно.
    for (let i = 0; i < 50; i++) {
      service.updateCurrentGame(createInitialDeal("adventure", "burst-test", i));
    }
    // Микро-пауза, чтобы любой потенциальный setTimeout успел выстрелить.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sdk.cloud).toBeNull();
    // Только flush() выливает накопленное состояние в облако.
    await service.flush();
    expect(sdk.cloud).toBeTruthy();
    const cloudParsed = JSON.parse(sdk.cloud as string);
    expect(cloudParsed.currentGame.dealId).toBe("burst-test");
  });

  it("hydrates state from cloud save with new european locales (es/pt/de/fr)", async () => {
    // Регрессия v0.3.42: до этого фикса валидатор isValidSaveState
    // отклонял любую локаль кроме ru/en/tr — для es/pt/de/fr cloud-save
    // тихо сбрасывался к дефолтам, и игрок терял прогресс.
    for (const locale of ["es", "pt", "de", "fr"] as const) {
      const seeded = createDefaultSaveState();
      seeded.progress.coins = 123;
      seeded.progress.locale = locale;
      const sdkWithCloud = createSdkStub(JSON.stringify(seeded));
      const svc = new SaveService();
      await svc.init(sdkWithCloud);
      expect(svc.load().progress.locale).toBe(locale);
      expect(svc.load().progress.coins).toBe(123);
    }
  });

  it("hydrates state with currentGame that has a daily dealId", async () => {
    // Регрессия v0.3.42: DEAL_ID_RE раньше был /^c\d{1,3}n\d{1,3}$/ и не
    // пропускал формат daily-YYYY-MM-DD. Сохранённая daily-партия в облаке
    // при загрузке проваливала isValidGameState и обнулялась — игрок,
    // открывший daily, закрывший вкладку и вернувшийся, терял партию.
    const seeded = createDefaultSaveState();
    seeded.currentGame = createInitialDeal("daily", "daily-2026-05-02", 7);
    const sdkWithCloud = createSdkStub(JSON.stringify(seeded));
    const svc = new SaveService();
    await svc.init(sdkWithCloud);
    expect(svc.load().currentGame?.dealId).toBe("daily-2026-05-02");
    expect(svc.load().currentGame?.mode).toBe("daily");
  });

  it("flush is idempotent: identical state does not re-sync", async () => {
    service.addCoins(5);
    await service.flush();
    const firstWrite = sdk.cloud;
    // Сбрасываем cloud, чтобы поймать повторную запись если она случится.
    sdk.cloud = null;
    // flush без новых мутаций — не должен ничего писать.
    await service.flush();
    expect(sdk.cloud).toBeNull();
    // А вот после реальной мутации — снова пишет.
    service.addCoins(1);
    await service.flush();
    expect(sdk.cloud).toBeTruthy();
    expect(sdk.cloud).not.toBe(firstWrite);
  });
});
