import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import {
  GAME_CANVAS_WIDTH,
  GAME_HEIGHT,
  GAME_OFFSET_X,
  GAME_WIDTH,
  SCENES,
} from "@/app/config/gameConfig";
import { createInitialProgressState } from "@/core/game-state/progress";
import { createTitleSceneOverlayHtml } from "@/scenes/titleSceneOverlay";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { showConfirmDialog } from "@/ui/confirmDialog";

/**
 * TitleScene — первая сцена игры (с v0.3.43). Заменила собой
 * `SettingsScene` в режиме `returnTo: "startmenu"` как entry point из
 * BootScene. Оставлена минималистичной: коллаж-фон + три кнопки
 * (Начать / Продолжить / Настройки). Локаль-кнопки и звуковые слайдеры
 * перенесены в SettingsScene — она теперь чистая страница настроек.
 *
 * Background: пока ассета `promo/title-collage.webp` нет, рендерим
 * тёмно-теаловый градиент с лёгкой золотой подсветкой по центру —
 * перекликается с фонарём из нарратива. Когда коллаж готов:
 *   1. положить файл по `public/assets/title-collage.webp`
 *   2. в `BootScene.preload` добавить
 *      `this.load.image("title-collage", "assets/title-collage.webp")`
 *   3. в `renderBackground()` ниже заменить блок graphics на
 *      `this.add.image(GAME_CANVAS_WIDTH/2, GAME_HEIGHT/2, "title-collage")
 *        .setOrigin(0.5).setDisplaySize(GAME_CANVAS_WIDTH, GAME_HEIGHT)`
 */
export class TitleScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private overlayCleanup?: () => void;

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    getAppContext().sound.playBgm("map");
    this.renderBackground();
    this.renderOverlay();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlayCleanup?.();
      this.overlay?.destroy();
      this.overlay = undefined;
      this.overlayCleanup = undefined;
    });
  }

  /**
   * Заглушка под коллаж: тёмно-теаловый вертикальный градиент +
   * мягкая радиальная золотая подсветка ближе к верхней трети (там,
   * где будет hero-блок с заголовком). Когда коллаж появится — этот
   * метод заменяется на 3 строки с this.add.image.
   */
  private renderBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a1e1c, 0x0a1e1c, 0x10201f, 0x162e2c, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Лёгкое golden-glow в области заголовка — намёк на фонарь над
    // картой в нарративе.
    bg.fillStyle(0xd4a962, 0.08);
    bg.fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT * 0.32, 320, 220);
    bg.fillStyle(0xd4a962, 0.04);
    bg.fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT * 0.32, 480, 320);
  }

  private renderOverlay(): void {
    const { i18n, save } = getAppContext();
    const state = save.load();
    // «Продолжить» доступна только после первого прохождения пролога.
    // Чистый старт (prologueShown=false/undefined) → кнопка disabled,
    // primary переключается на «Начать». Явное приведение к boolean
    // нужно потому что prologueShown в типе ProgressState помечен как
    // optional (boolean | undefined).
    const continueEnabled = Boolean(state.progress.prologueShown);

    const html = createTitleSceneOverlayHtml({
      title: i18n.t("title"),
      subtitle: i18n.t("subtitle"),
      newGameLabel: i18n.t("newGame"),
      continueLabel: i18n.t("continue"),
      continueEnabled,
      settingsLabel: i18n.t("settings"),
    });

    this.overlay = createCanvasAnchoredOverlay({
      scene: this,
      html,
      className: "title-scene-root",
      logicalWidth: GAME_CANVAS_WIDTH,
      logicalHeight: GAME_HEIGHT,
    });
    this.bindOverlayEvents(continueEnabled);
  }

  private bindOverlayEvents(continueEnabled: boolean): void {
    if (!this.overlay) return;
    const root = this.overlay.getInnerElement();
    const disposers: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>("[data-title-action]").forEach((el) => {
      const action = el.dataset.titleAction;
      const onClick = (): void => {
        if (action === "new-game") {
          void this.handleNewGame();
        } else if (action === "continue") {
          if (!continueEnabled) return; // защита от программного клика
          this.handleContinue();
        } else if (action === "settings") {
          this.scene.start(SCENES.settings, { returnTo: "title" });
        }
      };
      el.style.pointerEvents = "auto";
      el.addEventListener("click", onClick);
      disposers.push(() => el.removeEventListener("click", onClick));
    });

    this.overlayCleanup = () => disposers.forEach((d) => d());
  }

  /**
   * «Начать»: на чистом старте — сразу пролог. Если пролог уже
   * пройден или есть активная партия — confirm reset (теряем
   * прогресс), потом сброс progress + переход в пролог.
   */
  private async handleNewGame(): Promise<void> {
    const { i18n, save } = getAppContext();
    if (!this.overlay) return;
    const state = save.load();
    const hasSomethingToLose =
      state.progress.prologueShown || state.currentGame !== null;
    if (hasSomethingToLose) {
      const confirmed = await showConfirmDialog({
        parent: this.overlay.getHostElement(),
        title: i18n.t("newGame"),
        message: i18n.t("confirmResetProgress"),
        okLabel: i18n.t("newGame"),
        cancelLabel: i18n.t("back"),
      });
      if (!confirmed) return;
    }
    // Сохраняем выбранный язык — initial state вернул бы дефолтный ru,
    // и игрок на en/tr увидел бы русский пролог.
    const keepLocale = state.progress.locale;
    save.save({
      version: 1,
      progress: { ...createInitialProgressState(), locale: keepLocale },
      currentGame: null,
    });
    this.scene.start(SCENES.prologue);
  }

  /**
   * «Продолжить»: возврат в активную партию (если есть и не
   * завершена) или на карту. На первом запуске сюда не попадаем —
   * кнопка disabled.
   */
  private handleContinue(): void {
    const { save } = getAppContext();
    const state = save.load();
    const cg = state.currentGame;
    const inProgress = cg && cg.status !== "won" && cg.status !== "lost";
    if (inProgress) {
      this.scene.start(SCENES.game, { resumeCurrentGame: true });
    } else {
      this.scene.start(SCENES.map);
    }
  }
}
