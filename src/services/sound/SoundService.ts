/**
 * Audio engine: real sample playback via Web Audio API.
 *
 * SFX: short one-shot buffers (card_place, card_flip, ui_click, ...).
 * BGM: scene-based playback. A "scene" maps to one or more tracks.
 *   - "map"  → single looping track (bgm_map)
 *   - "game" → playlist of bgm_game_a and bgm_game_b, chained with a long crossfade
 *
 * Files are loaded lazily on first call to loadAll(). Missing files
 * do not crash the game — affected sounds simply go silent.
 */

export type SfxKey =
  | "card_place"
  | "card_flip"
  | "card_deal"
  | "stock_recycle"
  | "card_invalid"
  | "foundation"
  | "ui_click"
  | "ui_back"
  | "page_turn"
  | "victory"
  | "reward_reveal"
  | "artifact_found"
  | "route_unlock"
  | "hint";

/** Scene keys used by callers (SceneXxx.playBgm("map")). */
export type BgmScene = "map" | "game";

/** Internal track keys (1:1 with mp3 files). */
type BgmTrack =
  | "map"
  | "game_c" // Grasslight Dorian — favourite, weighted ×3 in playlist
  | "game_d" // Grasslight Dorian (1) — favourite, weighted ×3 in playlist
  | "game_e" // Tundra Breathwork
  | "game_f"; // Tundra Breathwork (1)

const SFX_FILES: Record<SfxKey, string> = {
  card_place: "audio/sfx/sfx_card_place.mp3",
  card_flip: "audio/sfx/sfx_card_flip.mp3",
  card_deal: "audio/sfx/sfx_card_deal.mp3",
  stock_recycle: "audio/sfx/sfx_stock_recycle.mp3",
  card_invalid: "audio/sfx/sfx_card_invalid.mp3",
  foundation: "audio/sfx/sfx_foundation.mp3",
  ui_click: "audio/sfx/sfx_ui_click.mp3",
  ui_back: "audio/sfx/sfx_ui_back.mp3",
  page_turn: "audio/sfx/sfx_page_turn.mp3",
  victory: "audio/sfx/sfx_victory.mp3",
  reward_reveal: "audio/sfx/sfx_reward_reveal.mp3",
  artifact_found: "audio/sfx/sfx_artifact_found.mp3",
  route_unlock: "audio/sfx/sfx_route_unlock.mp3",
  hint: "audio/sfx/sfx_hint.mp3",
};

const BGM_FILES: Record<BgmTrack, string> = {
  map: "audio/music/bgm_map.mp3",
  game_c: "audio/music/bgm_game_c.mp3",
  game_d: "audio/music/bgm_game_d.mp3",
  game_e: "audio/music/bgm_game_e.mp3",
  game_f: "audio/music/bgm_game_f.mp3",
};

// Дубликаты в плейлисте = вес. Grasslight (c, d) × 3, Tundra (e, f) × 1.
// Случайный выбор автоматически даст ~75% времени любимым трекам.
const SCENE_PLAYLISTS: Record<BgmScene, BgmTrack[]> = {
  map: ["map"],
  game: [
    "game_c", "game_c", "game_c",
    "game_d", "game_d", "game_d",
    "game_e",
    "game_f",
  ],
};

/** Maximum SFX channel gain (user slider 0..1 is multiplied by this). */
const SFX_MAX_GAIN = 0.9;
/** Maximum BGM channel gain (user slider 0..1 is multiplied by this). */
const BGM_MAX_GAIN = 0.35;
/** Short fade when the scene changes (e.g. map → game). */
const SCENE_CROSSFADE_SEC = 0.6;
/** Long, gentle fade when chaining tracks within the same scene. */
const CHAIN_CROSSFADE_SEC = 4.0;

type BgmHandle = {
  track: BgmTrack;
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** Timeout for the next chain step (scheduled crossfade to next track). */
  chainTimeout: ReturnType<typeof setTimeout> | null;
};

export class SoundService {
  private ctx: AudioContext | null = null;
  private sfxVolume = 0.8;
  private musicVolume = 0.6;
  private sfxBuffers: Partial<Record<SfxKey, AudioBuffer>> = {};
  private bgmBuffers: Partial<Record<BgmTrack, AudioBuffer>> = {};
  private bgmLoadPromises: Partial<Record<BgmTrack, Promise<AudioBuffer | null>>> = {};
  private currentBgm: BgmHandle | null = null;
  private currentScene: BgmScene | null = null;
  private masterGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private loadPromise: Promise<void> | null = null;
  private pendingScene: BgmScene | null = null;
  private unlockListenerInstalled = false;
  private visibilityListenerInstalled = false;
  /**
   * Глобальный mute от платформы (GamePush шлёт "change:mute" / "toggleMute",
   * когда игрок жмёт иконку звука в оболочке GP). Хранится отдельно от
   * user-слайдеров, чтобы при разбане мы могли вернуть ровно те громкости,
   * которые игрок выставил руками.
   */
  private platformMuted = false;

  /**
   * Требование Яндекса 1.3: при сворачивании вкладки/смене таба звук
   * должен прекращаться. Suspend AudioContext полностью гасит и SFX, и BGM
   * (включая запланированные кроссфейды), а после возврата resume()
   * восстанавливает воспроизведение с того же места без перезапуска треков.
   */
  private installVisibilityListener(): void {
    if (this.visibilityListenerInstalled) return;
    if (typeof document === "undefined") return;
    this.visibilityListenerInstalled = true;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.suspendAudio();
      } else {
        this.resumeAudio();
      }
    });
  }

  /** Suspend AudioContext (mute all sound). Called by SDK pause events and visibility change. */
  suspendAudio(): void {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  /** Resume AudioContext (unmute sound). Called by SDK resume events and visibility change. */
  resumeAudio(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private installUnlockListener(): void {
    if (this.unlockListenerInstalled) return;
    if (typeof window === "undefined") return;
    this.unlockListenerInstalled = true;

    // Async-handler: ОБЯЗАТЕЛЬНО await ctx.resume() до вызова playBgm,
    // иначе playBgm видит ctx.state === "suspended" и снова откладывает
    // сцену в pendingScene, а listener уже удалён — музыка остаётся
    // "замороженной" до следующей сценовой transition. Ранее использовался
    // `void ctx.resume()` (fire-and-forget) что давало гонку.
    const unlock = async (): Promise<void> => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      this.unlockListenerInstalled = false;
      const ctx = this.ctx;
      if (ctx && ctx.state === "suspended") {
        try { await ctx.resume(); } catch { /* no-op */ }
      }
      if (this.pendingScene && this.musicVolume > 0) {
        const scene = this.pendingScene;
        this.pendingScene = null;
        this.playBgm(scene);
      }
    };

    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    window.addEventListener("touchstart", unlock, { once: false });
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1;
        this.masterGain.connect(this.ctx.destination);

        // Важно: при инициализации bus'ов учитываем platformMuted, иначе
        // получаем баг «кнопка звука показывает muted, а музыка играет» —
        // setPlatformMuted мог быть вызван ДО создания контекста (bus был
        // null → apply no-op), затем loadAll создаёт контекст и без этой
        // проверки залил бы gain без учёта mute.
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.platformMuted ? 0 : this.sfxVolume * SFX_MAX_GAIN;
        this.sfxBus.connect(this.masterGain);

        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.platformMuted ? 0 : this.musicVolume * BGM_MAX_GAIN;
        this.musicBus.connect(this.masterGain);

        // Подвешиваем visibilitychange один раз — после создания контекста.
        this.installVisibilityListener();
      } catch {
        return null;
      }
    }
    // Не делаем resume(), если страница скрыта — иначе звук пойдёт в фоне,
    // нарушая требование 1.3. Резюм произойдёт по visibilitychange.
    if (this.ctx.state === "suspended" && typeof document !== "undefined" && !document.hidden) {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Load SFX into AudioBuffers. BGM грузится лениво (см. ensureBgmTrack)
   * — не задерживает старт игры на 5+ МБ музыки.
   */
  async loadAll(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    const ctx = this.getContext();
    if (!ctx) return;

    this.loadPromise = (async () => {
      const sfxEntries = Object.entries(SFX_FILES) as [SfxKey, string][];

      await Promise.all(
        sfxEntries.map(async ([key, url]) => {
          const buffer = await this.fetchAndDecode(url);
          if (buffer) this.sfxBuffers[key] = buffer;
        }),
      );

      // If a scene was requested before SFX were ready, kick it off now.
      if (this.pendingScene && this.musicVolume > 0) {
        const scene = this.pendingScene;
        this.pendingScene = null;
        this.playBgm(scene);
      }
    })();

    return this.loadPromise;
  }

  /** Generic fetch + decodeAudioData with error swallowing. */
  private async fetchAndDecode(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch {
      return null;
    }
  }

  /**
   * Случайный выбор следующего трека из плейлиста с весами (через дубликаты).
   * Если задан `exclude` — гарантированно не повторим текущий, чтобы не было
   * скучного «играет дважды подряд». Падение к exclude-only только если в
   * плейлисте этот трек единственный (например, single-song playlist).
   */
  private pickRandomBgmTrack(playlist: BgmTrack[], exclude: BgmTrack | null): BgmTrack {
    const candidates = exclude ? playlist.filter((t) => t !== exclude) : playlist;
    const pool = candidates.length > 0 ? candidates : playlist;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Lazy-load одного BGM-трека. Возвращает буфер (готовый или дождётся
   * параллельной загрузки). Идемпотентно: повторные вызовы не перезагружают.
   */
  private ensureBgmTrack(track: BgmTrack): Promise<AudioBuffer | null> {
    if (this.bgmBuffers[track]) return Promise.resolve(this.bgmBuffers[track]!);
    let pending = this.bgmLoadPromises[track];
    if (!pending) {
      pending = (async () => {
        const buffer = await this.fetchAndDecode(BGM_FILES[track]);
        if (buffer) this.bgmBuffers[track] = buffer;
        return buffer;
      })();
      this.bgmLoadPromises[track] = pending;
    }
    return pending;
  }

  // ============================================================
  // Volume
  // ============================================================

  /**
   * Платформенный mute от GP: заглушает все шины независимо от того,
   * где стоят user-слайдеры. При `muted=false` возвращаем пользовательские
   * громкости (они не были затёрты — просто применялся коэффициент 0).
   */
  /**
   * Единственный источник истины для UI-иконок звука. Инициализируется
   * в BootScene через `sound.setPlatformMuted(sdk.isMuted())` и далее
   * обновляется только через `sdk.onMuteChange` event listener.
   * UI должен читать отсюда, а НЕ `sdk.isMuted()` напрямую — иначе
   * иконка и реальный gain bus'а могут разойтись, если gp.sounds.isMuted
   * мигнёт между вызовами (например, во время preloader-ad'а).
   */
  isPlatformMuted(): boolean { return this.platformMuted; }

  /** Слушатели смены platformMuted — сцены подписываются для re-render иконки. */
  private muteChangeListeners = new Set<(muted: boolean) => void>();

  /**
   * Подписка на изменение platformMuted. Возвращает unsubscribe.
   * Нужно чтобы UI (иконка в MapScene/SettingsScene) перерисовывалась,
   * когда платформа (GP) меняет mute-состояние ПОСЛЕ того как сцена
   * уже отрендерилась — например, после закрытия preloader-ad'а.
   */
  onMuteChange(listener: (muted: boolean) => void): () => void {
    this.muteChangeListeners.add(listener);
    return () => this.muteChangeListeners.delete(listener);
  }

  setPlatformMuted(muted: boolean): void {
    const changed = this.platformMuted !== muted;
    this.platformMuted = muted;
    this.applySfxBusGain();
    this.applyMusicBusGain();
    if (changed) {
      this.muteChangeListeners.forEach((listener) => {
        try { listener(muted); }
        catch (e) { console.warn("[sound] mute-change listener threw", e); }
      });
    }
  }

  private applySfxBusGain(): void {
    if (!this.sfxBus || !this.ctx) return;
    const target = this.platformMuted ? 0 : this.sfxVolume * SFX_MAX_GAIN;
    // Прямое присваивание `.value` — единственный bulletproof-способ:
    // `setValueAtTime(target, currentTime)` не всегда отражается в
    // `gain.value` getter в Chrome (логи с продом показали что после
    // setValueAtTime(0) `.value` остаётся 0.21 и звук продолжает идти).
    // Присваивание сразу меняет effective gain — audio graph видит 0.
    this.sfxBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.sfxBus.gain.value = target;
  }

  private applyMusicBusGain(): void {
    if (!this.musicBus || !this.ctx) return;
    const target = this.platformMuted ? 0 : this.musicVolume * BGM_MAX_GAIN;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.value = target;
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    this.applySfxBusGain();
  }

  setMusicVolume(value: number): void {
    const prev = this.musicVolume;
    this.musicVolume = Math.max(0, Math.min(1, value));
    this.applyMusicBusGain();
    // If music was muted and user restored volume, try to resume the active scene.
    if (prev === 0 && this.musicVolume > 0 && this.pendingScene) {
      const scene = this.pendingScene;
      this.pendingScene = null;
      this.playBgm(scene);
    }
    // If user muted music and there was an active scene, remember it for later.
    if (prev > 0 && this.musicVolume === 0 && this.currentScene) {
      this.pendingScene = this.currentScene;
      this.stopBgm();
    }
  }

  getSfxVolume(): number { return this.sfxVolume; }
  getMusicVolume(): number { return this.musicVolume; }

  // ============================================================
  // SFX
  // ============================================================

  private playSfx(key: SfxKey): void {
    if (this.sfxVolume <= 0) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxBus) return;
    const buffer = this.sfxBuffers[key];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxBus);
    source.start(0);
  }

  cardPlace(): void { this.playSfx("card_place"); }
  cardFlip(): void { this.playSfx("card_flip"); }
  cardDeal(): void { this.playSfx("card_deal"); }
  stockRecycle(): void { this.playSfx("stock_recycle"); }
  cardInvalid(): void { this.playSfx("card_invalid"); }
  foundation(): void { this.playSfx("foundation"); }
  uiClick(): void { this.playSfx("ui_click"); }
  uiBack(): void { this.playSfx("ui_back"); }
  pageTurn(): void { this.playSfx("page_turn"); }
  victory(): void { this.playSfx("victory"); }
  rewardReveal(): void { this.playSfx("reward_reveal"); }
  artifactFound(): void { this.playSfx("artifact_found"); }
  routeUnlock(): void { this.playSfx("route_unlock"); }
  hint(): void { this.playSfx("hint"); }

  // Legacy aliases — existing callers use goodMove() / badMove()
  goodMove(): void { this.playSfx("foundation"); }
  badMove(): void { this.playSfx("card_invalid"); }

  // ============================================================
  // BGM
  // ============================================================

  /**
   * Start (or continue) BGM for a scene.
   * No-op if the same scene is already active — the playlist keeps chaining.
   */
  playBgm(scene: BgmScene): void {
    // Remember scene intent even if music is currently muted —
    // raising the slider later should resume the right track.
    if (this.musicVolume <= 0) {
      this.pendingScene = scene;
      this.currentScene = scene;
      return;
    }

    const ctx = this.getContext();
    if (!ctx || !this.musicBus) return;

    // Same scene already active → leave the current chain alone.
    if (this.currentScene === scene && this.currentBgm) return;

    // Browser autoplay policy: context suspended until first user gesture.
    if (ctx.state === "suspended") {
      this.pendingScene = scene;
      this.currentScene = scene;
      this.installUnlockListener();
      return;
    }

    const playlist = SCENE_PLAYLISTS[scene];
    if (playlist.length === 0) return;

    this.currentScene = scene;
    // Случайный первый трек (не последовательно), чтобы каждая игровая сессия
    // начиналась с новой композиции. Повтор предыдущего трека невозможен —
    // chain-логика тоже использует pickRandomBgmTrack(exclude).
    const firstTrack = this.pickRandomBgmTrack(playlist, null);

    // Превентивно подгружаем уникальные треки плейлиста в фоне,
    // чтобы chain-кроссфейд не споткнулся.
    const uniqueTracks = Array.from(new Set(playlist));
    for (const track of uniqueTracks) {
      if (track !== firstTrack) void this.ensureBgmTrack(track);
    }

    if (this.bgmBuffers[firstTrack]) {
      this.startTrack(firstTrack, SCENE_CROSSFADE_SEC);
      return;
    }

    // Lazy-load первого трека и стартуем как только готов,
    // если за это время сцена не сменилась.
    void this.ensureBgmTrack(firstTrack).then((buffer) => {
      if (!buffer) return;
      if (this.currentScene !== scene) return;
      if (this.musicVolume <= 0) {
        this.pendingScene = scene;
        return;
      }
      const ctx = this.ctx;
      if (!ctx || ctx.state === "suspended") {
        this.pendingScene = scene;
        return;
      }
      this.startTrack(firstTrack, SCENE_CROSSFADE_SEC);
    });
  }

  /**
   * Start a specific track, crossfading from whatever is currently playing.
   * Schedules the next chain step before this track ends.
   */
  private startTrack(track: BgmTrack, fadeInSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;

    const buffer = this.bgmBuffers[track];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // We manage looping manually via the chain, so no built-in loop.
    source.loop = false;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeInSec);

    source.connect(gain);
    gain.connect(this.musicBus);
    source.start(0);

    // Fade out whatever was playing
    if (this.currentBgm) {
      const prev = this.currentBgm;
      if (prev.chainTimeout !== null) {
        clearTimeout(prev.chainTimeout);
        prev.chainTimeout = null;
      }
      prev.gain.gain.cancelScheduledValues(ctx.currentTime);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, ctx.currentTime);
      prev.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeInSec);
      try {
        prev.source.stop(ctx.currentTime + fadeInSec + 0.05);
      } catch {
        // already stopped
      }
    }

    const handle: BgmHandle = { track, source, gain, chainTimeout: null };
    this.currentBgm = handle;

    // Schedule the next chain step: start crossfading before this track ends.
    const scene = this.currentScene;
    if (scene) {
      const playlist = SCENE_PLAYLISTS[scene];
      if (playlist.length > 1) {
        const chainDelayMs = Math.max(
          0,
          (buffer.duration - CHAIN_CROSSFADE_SEC) * 1000,
        );
        handle.chainTimeout = setTimeout(() => {
          handle.chainTimeout = null;
          // Guard: only chain if this is still the active track.
          if (this.currentBgm !== handle || this.currentScene !== scene) return;
          // Случайный выбор с no-repeat: исключаем текущий трек.
          const nextTrack = this.pickRandomBgmTrack(playlist, track);
          // Ждём lazy-load если ещё не готов (обычно уже готов после prefetch).
          void this.ensureBgmTrack(nextTrack).then((nextBuffer) => {
            if (!nextBuffer) return;
            if (this.currentBgm !== handle || this.currentScene !== scene) return;
            this.startTrack(nextTrack, CHAIN_CROSSFADE_SEC);
          });
        }, chainDelayMs);
      } else {
        // Single-track playlist: loop seamlessly.
        source.loop = true;
      }
    }
  }

  stopBgm(): void {
    const ctx = this.ctx;
    if (!ctx || !this.currentBgm) {
      this.currentScene = null;
      return;
    }
    const prev = this.currentBgm;
    if (prev.chainTimeout !== null) {
      clearTimeout(prev.chainTimeout);
      prev.chainTimeout = null;
    }
    prev.gain.gain.cancelScheduledValues(ctx.currentTime);
    prev.gain.gain.setValueAtTime(prev.gain.gain.value, ctx.currentTime);
    prev.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + SCENE_CROSSFADE_SEC);
    try {
      prev.source.stop(ctx.currentTime + SCENE_CROSSFADE_SEC + 0.05);
    } catch {
      // already stopped
    }
    this.currentBgm = null;
  }
}
