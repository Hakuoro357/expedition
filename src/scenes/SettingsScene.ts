import Phaser from "phaser";
import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { createInitialProgressState } from "@/core/game-state/progress";
import { createButton } from "@/ui/createButton";

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super(SCENES.settings);
  }

  create(): void {
    const { i18n, save, sound } = getAppContext();
    const currentState = save.load();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x182b2a);

    // ── Title ──────────────────────────────────────────────────────────────────
    this.add
      .text(GAME_WIDTH / 2, 100, i18n.t("settings"), {
        fontFamily: "Georgia",
        fontSize: "32px",
        color: "#f4e8cc",
      })
      .setOrigin(0.5);

    // ── Language ───────────────────────────────────────────────────────────────
    this.add
      .text(GAME_WIDTH / 2, 172, i18n.t("language"), {
        fontFamily: "Georgia",
        fontSize: "20px",
        color: "#d8c59d",
      })
      .setOrigin(0.5);

    createButton({
      scene: this,
      x: GAME_WIDTH / 2 - 62,
      y: 216,
      width: 100,
      height: 44,
      label: i18n.getLocale() === "ru" ? "✓ RU" : "RU",
      onClick: () => {
        save.save({ ...currentState, progress: { ...currentState.progress, locale: "ru" } });
        i18n.setLocale("ru");
        this.scene.restart();
      },
    });

    createButton({
      scene: this,
      x: GAME_WIDTH / 2 + 62,
      y: 216,
      width: 100,
      height: 44,
      label: i18n.getLocale() === "en" ? "✓ EN" : "EN",
      onClick: () => {
        save.save({ ...currentState, progress: { ...currentState.progress, locale: "en" } });
        i18n.setLocale("en");
        this.scene.restart();
      },
    });

    // ── Sound ──────────────────────────────────────────────────────────────────
    this.add
      .text(GAME_WIDTH / 2, 290, i18n.t("sound"), {
        fontFamily: "Georgia",
        fontSize: "20px",
        color: "#d8c59d",
      })
      .setOrigin(0.5);

    const soundLabel = (): string =>
      sound.isEnabled() ? `${i18n.t("sound")}: ON` : `${i18n.t("sound")}: OFF`;

    const soundBtn = createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: 334,
      width: 200,
      height: 44,
      label: soundLabel(),
      onClick: () => {
        sound.toggle();
        // Update label
        const textObj = soundBtn.list[1] as Phaser.GameObjects.Text | undefined;
        if (textObj) textObj.setText(soundLabel());
        if (sound.isEnabled()) sound.goodMove();
      },
    });

    // ── Reset save ─────────────────────────────────────────────────────────────
    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: 440,
      width: 220,
      height: 48,
      label: i18n.t("saveReset"),
      onClick: () => {
        save.save({ version: 1, progress: createInitialProgressState(), currentGame: null });
        i18n.setLocale("ru");
        this.scene.start(SCENES.map);
      },
    });

    // ── Back ───────────────────────────────────────────────────────────────────
    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 80,
      width: 220,
      height: 48,
      label: i18n.t("backToMap"),
      onClick: () => {
        this.scene.start(SCENES.map);
      },
    });
  }
}
