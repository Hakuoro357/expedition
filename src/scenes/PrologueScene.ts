import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { PROLOGUE_TEXT } from "@/data/narrative/prologue";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { escapeHtml } from "@/ui/escapeHtml";

const FIRST_DEAL_ID = "c1n1";

export class PrologueScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private cleanup?: () => void;

  constructor() {
    super(SCENES.prologue);
  }

  create(): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const { i18n, analytics } = getAppContext();
    analytics.track("prologue_open", {});

    // Solid background — same dark tone as rules overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x132220);

    const locale = i18n.currentLocale();
    // Fallback на английский, а не русский — для неизвестной локали
    // корректнее показать интернациональный текст.
    const paragraphs = PROLOGUE_TEXT[locale] ?? PROLOGUE_TEXT.en;
    const buttonLabel = i18n.t("prologueButton");

    const html = this.buildHtml(paragraphs, buttonLabel);

    this.overlay = createCanvasAnchoredOverlay({
      scene: this,
      html,
      className: "prologue-overlay-root",
      logicalWidth: GAME_CANVAS_WIDTH,
      logicalHeight: GAME_HEIGHT,
    });

    this.bindButton();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup?.();
      this.overlay?.destroy();
      this.overlay = undefined;
    });
    // Prologue-shown flag пишется ТОЛЬКО при клике «Продолжить»
    // (см. bindButton). На этапе create — никаких save-мутаций, иначе
    // debounced persist триггерит gp.player.sync() на старте.
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
      // Помечаем prologue просмотренным ПО КЛИКУ пользователя —
      // это явное пользовательское действие, допустимый триггер для
      // debounced cloud-sync. На этапе scene.create мутацию не делаем.
      const { save } = getAppContext();
      save.updateProgress((p) => ({ ...p, prologueShown: true }));
      this.scene.start(SCENES.game, { mode: "adventure", dealId: FIRST_DEAL_ID });
    };
    button.addEventListener("click", onClick);

    // Убираем fade-маску когда игрок доскроллил до конца — иначе
    // последний параграф остаётся полупрозрачным, это сбивает.
    const body = root.querySelector<HTMLElement>(".prologue-overlay__body");
    const onScroll = (): void => {
      if (!body) return;
      const atBottom =
        body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
      body.classList.toggle("is-at-bottom", atBottom);
    };
    if (body) {
      body.addEventListener("scroll", onScroll, { passive: true });
      // Если весь текст помещается и скролл не нужен — сразу убираем fade.
      if (body.scrollHeight <= body.clientHeight + 2) {
        body.classList.add("is-at-bottom");
      }
    }

    this.cleanup = () => {
      button.removeEventListener("click", onClick);
      body?.removeEventListener("scroll", onScroll);
    };
  }
}

