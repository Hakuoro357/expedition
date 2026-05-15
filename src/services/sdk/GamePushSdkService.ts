import type { Locale } from "@/services/i18n/locales";
import type { SdkService } from "@/services/sdk/SdkService";

/**
 * Wait for GamePush SDK to be available on `window.__gp`.
 *
 * The inline script in index.html registers `window.onGPInit` BEFORE
 * the GamePush CDN script loads, so by the time this function runs
 * `window.__gp` is usually already set.  We poll as a safety net
 * for slow networks where the CDN script hasn't finished yet.
 */
function waitForGamePush(timeoutMs: number): Promise<GamePushSDK | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    if (window.__gp) {
      resolve(window.__gp);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (window.__gp) {
        window.clearInterval(interval);
        resolve(window.__gp);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        window.clearInterval(interval);
        resolve(null);
      }
    }, 50);
  });
}

const CLOUD_SAVE_FIELD = "save";

export class GamePushSdkService implements SdkService {
  private gp: GamePushSDK | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      this.gp = await waitForGamePush(5000);
      if (this.gp) {
        await this.gp.player.ready;
      }
      this.initialized = true;
    } catch (error) {
      console.warn("[gp] failed to initialize", error);
      this.gp = null;
      this.initialized = true;
    }
  }

  isAvailable(): boolean {
    return this.gp !== null;
  }

  private gameStartCalled = false;
  signalReady(): void {
    // Идемпотентно — gameStart должен прозвучать ровно один раз за сессию.
    // Несколько мест в коде могут позвать signalReady (BootScene как safety
    // net, MapScene как "точно интерактивно"), но GP gamekStart повторно
    // вызывать не надо.
    if (this.gameStartCalled) return;
    this.gameStartCalled = true;
    try {
      this.gp?.gameStart();
    } catch (error) {
      console.warn("[gp] gameStart failed", error);
    }
  }

  gameplayStart(): void {
    try {
      this.gp?.gameplayStart();
    } catch (error) {
      console.warn("[gp] gameplayStart failed", error);
    }
  }

  gameplayStop(): void {
    try {
      this.gp?.gameplayStop();
    } catch (error) {
      console.warn("[gp] gameplayStop failed", error);
    }
  }

  changeLanguage(locale: Locale): void {
    try {
      this.gp?.changeLanguage?.(locale);
    } catch (error) {
      console.warn("[gp] changeLanguage failed", error);
    }
  }

  detectLocale(): Locale | null {
    // GP docs (get-start/common-features#язык): gp.language — основной
    // способ определить язык при запуске. Читаем его отдельным шагом,
    // чтобы GP self-test видел обращение к API. `|| null` даёт корректный
    // fallback на navigator.language даже если gp.language === "".
    const gpLang = (this.gp && this.gp.language) || null;
    const raw = gpLang ??
      (typeof navigator !== "undefined" ? navigator.language : "");
    if (!raw) return null;
    const lang = raw.slice(0, 2).toLowerCase();
    // Поддерживаемые локали v0.3.30: ru / en / tr / es / pt / de / fr.
    // Для pt принимаем и pt-BR, и pt-PT — оба мапятся в единый `pt`.
    if (lang === "ru") return "ru";
    if (lang === "tr") return "tr";
    if (lang === "es") return "es";
    if (lang === "pt") return "pt";
    if (lang === "de") return "de";
    if (lang === "fr") return "fr";
    return "en";
  }

  async showRewardedVideo(): Promise<boolean> {
    if (!this.gp?.ads) return false;
    try {
      const success = await this.gp.ads.showRewardedVideo();
      return !!success;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<void> {
    if (!this.gp?.ads) return;
    try {
      await this.gp.ads.showFullscreen();
    } catch {
      // silently swallow — interstitial is best-effort
    }
  }

  async getCloudSave(): Promise<string | null> {
    if (!this.gp?.player) return null;
    try {
      const value = this.gp.player.get(CLOUD_SAVE_FIELD) as unknown;
      return typeof value === "string" && value.length > 0 ? value : null;
    } catch (error) {
      console.warn("[gp] getCloudSave failed", error);
      return null;
    }
  }

  async setCloudSave(json: string): Promise<void> {
    if (!this.gp?.player) return;
    try {
      this.gp.player.set(CLOUD_SAVE_FIELD, json);
      this.gp.player.sync();
    } catch (error) {
      console.warn("[gp] setCloudSave failed", error);
    }
  }

  onPause(callback: () => void): void {
    this.gp?.on("pause", callback);
  }

  onResume(callback: () => void): void {
    this.gp?.on("resume", callback);
  }

  onLanguageChange(callback: (lang: string) => void): void {
    this.gp?.on("change:language", ((...args: unknown[]) => {
      callback(String(args[0] ?? ""));
    }));
  }

  /**
   * Канонический путь по GP docs (https://docs.gamepush.com/ru/docs/sounds/):
   * подписка на `gp.sounds.on("mute"/"unmute", cb)`. Событие приходит БЕЗ
   * аргумента — состояние определяется именем события.
   *
   * Fallback на legacy top-level события (`toggleMute` / `change:mute`)
   * остаётся для платформ, где `gp.sounds` не экспортирован.
   */
  onMuteChange(callback: (muted: boolean) => void): void {
    // Подписываемся на ВСЕ возможные каналы mute-событий GP.
    // Разные версии SDK и платформы фаерят разные события: gp.sounds.on
    // ("mute"/"unmute") — канон; legacy gp.on("toggleMute"/"change:mute") —
    // для старых сборок. Subscribe на все: повторы идемпотентны
    // (setPlatformMuted с тем же значением = no-op в UI).
    if (this.gp?.sounds) {
      this.gp.sounds.on("mute", () => callback(true));
      this.gp.sounds.on("unmute", () => callback(false));
    }
    const legacyHandler = (...args: unknown[]): void => {
      const arg = args[0];
      const muted = typeof arg === "boolean" ? arg : this.isMuted();
      callback(muted);
    };
    this.gp?.on("toggleMute", legacyHandler);
    this.gp?.on("change:mute", legacyHandler);
  }

  isMuted(): boolean {
    const s = this.gp?.sounds?.isMuted;
    if (typeof s === "boolean") return s;
    const legacy = this.gp?.isMuted;
    if (typeof legacy === "boolean") return legacy;
    return false;
  }

  muteSounds(): void {
    try {
      this.gp?.sounds?.mute();
    } catch (error) {
      console.warn("[gp] sounds.mute failed", error);
    }
  }

  unmuteSounds(): void {
    try {
      this.gp?.sounds?.unmute();
    } catch (error) {
      console.warn("[gp] sounds.unmute failed", error);
    }
  }

  setSfxMuted(muted: boolean): void {
    try {
      if (muted) this.gp?.sounds?.muteSFX();
      else this.gp?.sounds?.unmuteSFX();
    } catch (error) {
      console.warn("[gp] sounds.(un)muteSFX failed", error);
    }
  }

  setMusicMuted(muted: boolean): void {
    try {
      if (muted) this.gp?.sounds?.muteMusic();
      else this.gp?.sounds?.unmuteMusic();
    } catch (error) {
      console.warn("[gp] sounds.(un)muteMusic failed", error);
    }
  }

  showSticky(): void {
    try {
      this.gp?.ads.showSticky();
    } catch (error) {
      console.warn("[gp] showSticky failed", error);
    }
  }

  closeSticky(): void {
    try {
      this.gp?.ads.closeSticky();
    } catch (error) {
      console.warn("[gp] closeSticky failed", error);
    }
  }

  refreshSticky(): void {
    try {
      this.gp?.ads.refreshSticky();
    } catch (error) {
      console.warn("[gp] refreshSticky failed", error);
    }
  }

  // ============================================================
  // Social actions (gp.socials.*) — share / community.
  // Платформенные действия VK/OK/Telegram через GP SDK. Все методы
  // защищены feature-detection: если SDK не загрузился или платформа
  // не поддерживает — UI скрывает кнопки через canShare/canJoinCommunity.
  // ============================================================

  /**
   * DEV-only override: `?dev=socials` форсит canShare/canJoinCommunity
   * = true в локальном dev-сервере, чтобы можно было увидеть кнопки
   * без реального GP SDK + настроенной community. В production-билде
   * (`import.meta.env.DEV === false`) этот метод всегда возвращает
   * false и удаляется tree-shaking'ом — никаких security-рисков.
   * Сами sdk.share/joinCommunity при отсутствии gp.socials остаются
   * no-op (visual-only test).
   */
  private devSocialsOn(): boolean {
    if (!import.meta.env.DEV) return false;
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("dev") === "socials";
  }

  canShare(): boolean {
    return this.devSocialsOn() || this.gp?.socials?.isSupportsShare === true;
  }

  canJoinCommunity(): boolean {
    return this.devSocialsOn() || this.gp?.socials?.canJoinCommunity === true;
  }

  async share(options: { text?: string; url?: string; image?: string }): Promise<void> {
    if (!this.gp?.socials) return;
    try {
      // gp.socials.share возвращает Promise. Sync try/catch не ловит
      // async-rejection — дожидаемся await + ловим в общем catch.
      await this.gp.socials.share(options);
    } catch (error) {
      console.warn("[gp] socials.share failed", error);
    }
  }

  async joinCommunity(): Promise<boolean> {
    if (!this.gp?.socials) return false;
    try {
      const result = await this.gp.socials.joinCommunity();
      return Boolean(result);
    } catch (error) {
      console.warn("[gp] socials.joinCommunity failed", error);
      return false;
    }
  }

  onShareResult(callback: (success: boolean) => void): void {
    try {
      this.gp?.socials?.on("share", callback);
    } catch (error) {
      console.warn("[gp] socials.on(share) failed", error);
    }
  }

  onJoinCommunityResult(callback: (success: boolean) => void): void {
    try {
      this.gp?.socials?.on("joinCommunity", callback);
    } catch (error) {
      console.warn("[gp] socials.on(joinCommunity) failed", error);
    }
  }

  // ============================================================
  // Achievements (gp.achievements.*) — R3 fix M2: namespace `achievements`,
  // не `socials`. Feature-detected: canUseAchievements проверяет наличие
  // `gp.achievements`; если SDK старее GP-релиза с этим API — все методы
  // no-op / возвращают defaults.
  // ============================================================

  canUseAchievements(): boolean {
    return Boolean(this.gp?.achievements);
  }

  async fetchAchievements(): Promise<void> {
    if (!this.gp?.achievements?.fetch) return;
    try {
      await this.gp.achievements.fetch();
    } catch (error) {
      console.warn("[gp] achievements.fetch failed", error);
    }
  }

  getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }> {
    // R3 fix M2: правильный namespace — `achievements`, не `socials`.
    const list = this.gp?.achievements?.playerAchievementsList ?? [];
    return list.map((a) => ({
      tag: a.tag,
      progress: a.progress ?? 0,
      unlocked: Boolean(a.unlocked),
    }));
  }

  async unlockAchievement(tag: string): Promise<boolean> {
    if (!this.gp?.achievements?.unlock) return false;
    try {
      // R3 fix M4: trust SDK call — если await не throw'нул, write принят.
      await this.gp.achievements.unlock({ tag });
      return true;
    } catch (error) {
      console.warn("[gp] achievements.unlock failed", error);
      return false;
    }
  }

  async setAchievementProgress(tag: string, progress: number): Promise<boolean> {
    if (!this.gp?.achievements?.setProgress) return false;
    try {
      // R3 fix M4: ok=true означает SDK принял write без error,
      // НЕ "achievement unlocked". Reconciler определяет unlock-status
      // сам через `capped >= meta.max`.
      await this.gp.achievements.setProgress({ tag, progress });
      return true;
    } catch (error) {
      console.warn("[gp] achievements.setProgress failed", error);
      return false;
    }
  }

  async openAchievementsOverlay(): Promise<void> {
    // GP-SDK не имеет публичного API для открытия built-in overlay'я
    // ачивок (на 2026-05). Оставляем no-op, чтобы каркас был готов
    // переключиться, как только GP добавит метод.
  }

  async showPreloader(): Promise<boolean> {
    if (!this.gp?.ads) return false;
    // GP sandbox / draft-проекты без сконфигурированного preloader-слота
    // могут вернуть промис, который никогда не резолвится. Это вешает
    // весь BootScene (signalReady + loading-screen remove стоят после
    // await). Страхуемся 8-секундным таймаутом — в проде preloader
    // типично 3–5 сек, 8с оставляет запас; в sandbox даёт мгновенный
    // fallback в false, чтобы игра не зависала на лоадере.
    try {
      const adPromise = Promise.resolve(this.gp.ads.showPreloader());
      const timeout = new Promise<false>((resolve) => {
        setTimeout(() => resolve(false), 8000);
      });
      const result = await Promise.race([adPromise, timeout]);
      return !!result;
    } catch (error) {
      console.warn("[gp] showPreloader failed", error);
      return false;
    }
  }
}
