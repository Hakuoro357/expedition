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
type BgmTrack = "map" | "game_a" | "game_b";

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
  game_a: "audio/music/bgm_game_a.mp3",
  game_b: "audio/music/bgm_game_b.mp3",
};

const SCENE_PLAYLISTS: Record<BgmScene, BgmTrack[]> = {
  map: ["map"],
  game: ["game_a", "game_b"],
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
  private currentBgm: BgmHandle | null = null;
  private currentScene: BgmScene | null = null;
  private playlistIndex = 0;
  private masterGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private loadPromise: Promise<void> | null = null;
  private pendingScene: BgmScene | null = null;
  private unlockListenerInstalled = false;

  private installUnlockListener(): void {
    if (this.unlockListenerInstalled) return;
    if (typeof window === "undefined") return;
    this.unlockListenerInstalled = true;

    const unlock = (): void => {
      const ctx = this.ctx;
      if (ctx && ctx.state === "suspended") {
        void ctx.resume();
      }
      if (this.pendingScene && this.musicVolume > 0) {
        const scene = this.pendingScene;
        this.pendingScene = null;
        this.playBgm(scene);
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
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

        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.sfxVolume * SFX_MAX_GAIN;
        this.sfxBus.connect(this.masterGain);

        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicVolume * BGM_MAX_GAIN;
        this.musicBus.connect(this.masterGain);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Load all audio files into AudioBuffers. Safe to call multiple times. */
  async loadAll(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    const ctx = this.getContext();
    if (!ctx) return;

    this.loadPromise = (async () => {
      const sfxEntries = Object.entries(SFX_FILES) as [SfxKey, string][];
      const bgmEntries = Object.entries(BGM_FILES) as [BgmTrack, string][];

      const loadBuffer = async (url: string): Promise<AudioBuffer | null> => {
        try {
          const response = await fetch(url);
          if (!response.ok) return null;
          const arrayBuffer = await response.arrayBuffer();
          return await ctx.decodeAudioData(arrayBuffer);
        } catch {
          return null;
        }
      };

      await Promise.all([
        ...sfxEntries.map(async ([key, url]) => {
          const buffer = await loadBuffer(url);
          if (buffer) this.sfxBuffers[key] = buffer;
        }),
        ...bgmEntries.map(async ([key, url]) => {
          const buffer = await loadBuffer(url);
          if (buffer) this.bgmBuffers[key] = buffer;
        }),
      ]);

      // If a scene was requested before buffers were ready, kick it off now.
      if (this.pendingScene && this.musicVolume > 0) {
        const scene = this.pendingScene;
        this.pendingScene = null;
        this.playBgm(scene);
      }
    })();

    return this.loadPromise;
  }

  // ============================================================
  // Volume
  // ============================================================

  setSfxVolume(value: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(
        this.sfxVolume * SFX_MAX_GAIN,
        this.ctx.currentTime,
        0.01,
      );
    }
  }

  setMusicVolume(value: number): void {
    const prev = this.musicVolume;
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(
        this.musicVolume * BGM_MAX_GAIN,
        this.ctx.currentTime,
        0.05,
      );
    }
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

    // Buffers not loaded yet? Remember and let loadAll() trigger us.
    const anyLoaded = playlist.some((track) => this.bgmBuffers[track]);
    if (!anyLoaded) {
      this.pendingScene = scene;
      return;
    }

    this.currentScene = scene;
    this.playlistIndex = 0;
    this.startTrack(playlist[0], SCENE_CROSSFADE_SEC);
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
          this.playlistIndex = (this.playlistIndex + 1) % playlist.length;
          this.startTrack(playlist[this.playlistIndex], CHAIN_CROSSFADE_SEC);
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
