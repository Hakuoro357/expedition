import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { PROLOGUE_TEXT } from "@/data/narrative/prologue";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

const FIRST_DEAL_ID = "c1n1";

export class PrologueScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private cleanup?: () => void;

  constructor() {
    super(SCENES.prologue);
  }

  create(): void {
    const { i18n, save, analytics } = getAppContext();
    analytics.track("prologue_open", {});

    // Solid background — same dark tone as rules overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x132220);

    const locale = i18n.currentLocale();
    const paragraphs = PROLOGUE_TEXT[locale] ?? PROLOGUE_TEXT.ru;
    const buttonLabel = i18n.t("prologueButton");

    const html = this.buildHtml(paragraphs, buttonLabel);

    this.overlay = createCanvasAnchoredOverlay({
      scene: this,
      html,
      className: "prologue-overlay-root",
      logicalWidth: GAME_WIDTH,
      logicalHeight: GAME_HEIGHT,
    });

    this.bindButton();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup?.();
      this.overlay?.destroy();
      this.overlay = undefined;
    });

    // Mark prologue as shown so it never appears again
    save.updateProgress((p) => ({ ...p, prologueShown: true }));
  }

  private buildHtml(paragraphs: string[], buttonLabel: string): string {
    const paragraphHtml = paragraphs
      .map((p) => `<p class="prologue-overlay__paragraph">${escapeHtml(p)}</p>`)
      .join("");

    return `
      <div class="prologue-overlay">
        <div class="prologue-overlay__panel">
          <div class="prologue-overlay__case">№ 47/3</div>
          <div class="prologue-overlay__body">${paragraphHtml}</div>
          <button type="button" class="modal-btn modal-btn--primary prologue-overlay__button" data-prologue-button>
            ${escapeHtml(buttonLabel)}
          </button>
        </div>
      </div>
    `;
  }

  private bindButton(): void {
    const root = this.overlay?.getInnerElement();
    if (!root) return;

    const button = root.querySelector<HTMLElement>("[data-prologue-button]");
    if (!button) return;

    button.style.pointerEvents = "auto";
    const onClick = (): void => {
      this.scene.start(SCENES.game, { mode: "adventure", dealId: FIRST_DEAL_ID });
    };
    button.addEventListener("click", onClick);

    this.cleanup = () => {
      button.removeEventListener("click", onClick);
    };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
