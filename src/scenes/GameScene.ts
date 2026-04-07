import Phaser from "phaser";
import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ECONOMY } from "@/app/config/economy";
import { getCardFaceTextureKey as getSvgCardFaceTextureKey } from "@/assets/cards/cardFaceSvg";
import backDefaultSvg from "@/assets/cards/back-default.svg?raw";
import backCompassSvg from "@/assets/cards/back-compass.svg?raw";
import backMapSvg from "@/assets/cards/back-map.svg?raw";
import type { Card } from "@/core/cards/types";
import type { GameMode, GameState, Pile } from "@/core/game-state/types";
import { createInitialDeal } from "@/core/klondike/createInitialDeal";
import { findRandomSolvableSeed } from "@/core/klondike/randomSeed";
import { getPointTitleByDealId } from "@/data/narrative/points";
import { GAME_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import { getRouteSheetByDealId, ROUTE_SHEETS } from "@/data/routeSheets";
import {
  autoCompleteStep,
  canAutoComplete,
  canMoveCardToFoundation,
  cloneGameState,
  drawFromStock,
  getGameStatus,
  getHint,

  moveFoundationToTableau,
  moveTableauToFoundation,
  moveTableauToTableau,
  moveWasteToFoundation,
  moveWasteToTableau,
  tryAutoMoveToFoundation,
  type HintResult,
  type Selection,
} from "@/core/klondike/engine";
import { formatCard } from "@/features/board/formatCard";
import { ensureCardFaceTexture } from "@/features/board/cardFaceTexture";
import { createCardFaceSvgMarkup } from "@/features/board/cardFaceMarkup";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { createGameSceneOverlayHtml, type GameOverlayCard, type GameOverlayFaceDownCard, type GameOverlayEmptySlot, fixCardBackSvgAspect } from "@/scenes/gameSceneOverlay";
import {
  GAME_CARD_HEIGHT as CARD_HEIGHT,
  GAME_CARD_WIDTH as CARD_WIDTH,
  GAME_FACE_DOWN_GAP_Y as FACE_DOWN_GAP_Y,
  GAME_FACE_UP_GAP_Y as FACE_UP_GAP_Y,
  GAME_FOUNDATION_GAP_X as FOUNDATION_GAP_X,
  GAME_FOUNDATION_START_X as FOUNDATION_START_X,
  GAME_TABLEAU_GAP_X as TABLEAU_GAP_X,
  GAME_TABLEAU_START_X as TABLEAU_START_X,
  GAME_TABLEAU_START_Y as TABLEAU_START_Y,
  GAME_TOP_ROW_Y as TOP_ROW_Y,
  getGameCardLeft,
  getGameCardTop,
  getGameFoundationX,
  getGameTableauX,
} from "@/scenes/gameSceneLayout";
type GameSceneData = {
  dealId?: string;
  mode?: GameMode;
  /** Seed for restarting the same deal layout */
  seed?: number;
  resumeCurrentGame?: boolean;
  devPreviewScreen?: "loss" | "autocomplete" | "win" | "rules" | "leave";
};

export class GameScene extends Phaser.Scene {
  private gameState: GameState | null = null;
  private history: GameState[] = [];
  private selection: Selection | null = null;
  private boardLayer?: Phaser.GameObjects.Container;
  private dragPreview?: Phaser.GameObjects.Container;
  private draggedSelection: Selection | null = null;
  private dragPreviewCards: GameOverlayCard[] = [];
  /** Кэш DOM-узлов drag-карт, заполняется при старте драга чтобы
   * updateDragPreview не дёргал querySelectorAll на каждый pointer-move. */
  private dragPreviewNodes: HTMLElement[] = [];
  private pendingFlips: Set<string> = new Set();
  private autoCompleting = false;
  private animating = false;
  private gameOverlay?: CanvasOverlayHandle;
  private gameOverlayCleanup?: () => void;
  private _emptyTableauSlots: GameOverlayEmptySlot[] = [];
  private hintsUsed = 0;
  private hintHighlightTimer?: Phaser.Time.TimerEvent;
  private hintGlowObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENES.game);
  }

  create(data: GameSceneData): void {
    const saveState = getAppContext().save.load();
    const restoredState = data.resumeCurrentGame ? saveState.currentGame : null;
    const mode = restoredState?.mode ?? data.mode ?? "adventure";
    const dealId = restoredState?.dealId ?? data.dealId ?? "c1n1";

    // Use provided seed (restart same deal), or find a random solvable seed for new games
    const seed = data.seed ?? (!restoredState && mode !== "daily" ? findRandomSolvableSeed() : undefined);
    this.gameState = restoredState ? cloneGameState(restoredState) : createInitialDeal(mode, dealId, seed);
    this.history = [];
    this.selection = null;
    // Require 8px movement before drag starts - prevents taps from triggering drag
    this.input.dragDistanceThreshold = 8;

    this.pendingFlips.clear();
    this.autoCompleting = false;
    this.animating = false;
    this.hintsUsed = 0;
    this.hintHighlightTimer?.destroy();
    this.hintHighlightTimer = undefined;
    this.dragPreview?.destroy();
    this.dragPreview = undefined;
    this.draggedSelection = null;
    this.dragPreviewCards = [];
    this.dragPreviewNodes = [];

    const { analytics, save, sdk } = getAppContext();
    analytics.track("deal_start", { mode, dealId });
    save.updateCurrentGame(this.gameState);
    sdk.gameplayStart();

    // Ensure card back texture is loaded for Phaser rendering
    this.ensureCardBackTexture();

    // Background — use route sheet colors for consistent theming
    const sheet = getRouteSheetByDealId(dealId) ?? ROUTE_SHEETS[0];
    const { topColor, bottomColor, glowColor } = sheet.background;
    const bg = this.add.graphics();
    bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(glowColor, 0.12);
    bg.fillEllipse(GAME_WIDTH / 2, 148, 320, 164);
    // Dim overlay so board stays readable
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a1e1c, 0.35);
    this.renderBottomBar();
    this.renderGameOverlay();

    // boardLayer is created BEFORE everything so cards do not overlap UI
    this.boardLayer = this.add.container(0, 0);

    this.renderBoard();

    if (data.devPreviewScreen) {
      this.time.delayedCall(100, () => this.showDevPreviewScreen(data.devPreviewScreen!));
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyRulesOverlay();
      this.gameOverlayCleanup?.();
      this.gameOverlay?.destroy();
      this.gameOverlay = undefined;
      this.gameOverlayCleanup = undefined;
      getAppContext().sdk.gameplayStop();
    });
  }

  private showDevPreviewScreen(screen: string): void {
    switch (screen) {
      case "loss":
      case "leave":
        this.showLeaveConfirm();
        break;
      case "autocomplete":
        this.showAutoCompleteOverlay();
        break;
      case "win":
        this.playWinAnimation(() => {
          const mode = this.gameState?.mode ?? "adventure";
          const dealId = this.gameState?.dealId ?? "c1n1";
          this.scene.start(SCENES.reward, { mode, dealId, preview: true });
        });
        break;
      case "rules":
        this.showRulesOverlay();
        break;
    }
  }

  private renderBottomBar(): void {
    const barTop = GAME_HEIGHT - GAME_BOTTOM_NAV_HEIGHT;
    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, barTop, GAME_WIDTH, GAME_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(new Phaser.Geom.Line(0, barTop, GAME_WIDTH, barTop));
  }

  private renderGameOverlay(): void {
    const { i18n } = getAppContext();
    const foundationSuitSymbols = ["♠", "♣", "♦", "♥"];
    const backKey = this.cardBackKey();

    // Get card back SVG for stock slot display
    let cardBackSvg: string | undefined;
    switch (backKey) {
      case "card-back-compass":
        cardBackSvg = backCompassSvg;
        break;
      case "card-back-map":
        cardBackSvg = backMapSvg;
        break;
      case "card-back-default":
      default:
        cardBackSvg = backDefaultSvg;
        break;
    }

    const html = createGameSceneOverlayHtml({
      title: this.getOverlayTitle(),
      subtitle: this.getOverlaySubtitle(),
      coinsLabel: String(getAppContext().save.load().progress.coins),
      stockCountLabel: String(this.gameState?.stock.cards.length ?? 0),
      wasteHasCard: (this.gameState?.waste.cards.length ?? 0) > 0,
      wasteActive: this.selection?.kind === "waste",
      foundationSlots: foundationSuitSymbols.map((suitSymbol, index) => ({
        suitSymbol,
        active: this.selection?.kind === "foundation" && this.selection.pileIndex === index,
        hasCard: (this.gameState?.foundations[index]?.cards.length ?? 0) > 0,
      })),
      undoLabel: this.getUndoLabel(),
      hintLabel: this.getHintLabel(),
      rulesLabel: i18n.t("rules"),
      homeLabel: i18n.t("home"),
      cards: this.getOverlayCards(),
      dragCards: this.dragPreviewCards,
      // Stock card back: only show when stock has cards (prevents ghost card impression)
      stockCardBackSvg: (this.gameState?.stock.cards.length ?? 0) > 0 ? fixCardBackSvgAspect(cardBackSvg) : undefined,
      // Tableau face-down cards always need the card back SVG regardless of stock state
      cardBackSvg: fixCardBackSvgAspect(cardBackSvg),
      faceDownCards: this.getOverlayFaceDownCards(),
      emptyTableauSlots: this._emptyTableauSlots,
      locale: i18n.currentLocale(),
    });

    if (!this.gameOverlay) {
      this.gameOverlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "game-overlay-root",
        logicalWidth: GAME_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
      // Делегированный click-обработчик ставится один раз на стабильный
      // root overlay; повторные setHtml() не пересоздают listener.
      this.bindGameOverlayEvents();
    } else {
      this.gameOverlay.setHtml(html);
    }
  }

  private getOverlayCards(): GameOverlayCard[] {
    if (!this.gameState) {
      return [];
    }

    const cards: GameOverlayCard[] = [];

    this.gameState.tableau.forEach((pile, pileIndex) => {
      const x = getGameTableauX(pileIndex);
      pile.cards.forEach((card, cardIndex) => {
        if (!card.faceUp) {
          return;
        }

        const y = this.getTableauCardY(pile, cardIndex);
        cards.push({
          key: `tableau-${card.id}`,
          left: getGameCardLeft(x),
          top: getGameCardTop(y),
          card,
          selected:
            this.selection?.kind === "tableau" &&
            this.selection.pileIndex === pileIndex &&
            this.selection.cardIndex === cardIndex,
        });
      });
    });

    const wasteTop = this.gameState.waste.cards[this.gameState.waste.cards.length - 1];
    if (wasteTop) {
      cards.push({
        key: `waste-${wasteTop.id}`,
        left: getGameCardLeft(getGameTableauX(1)),
        top: getGameCardTop(TOP_ROW_Y),
        card: wasteTop,
        selected: this.selection?.kind === "waste",
      });
    }

    this.gameState.foundations.forEach((pile, foundationIndex) => {
      const topCard = pile.cards[pile.cards.length - 1];
      if (!topCard) {
        return;
      }

      cards.push({
        key: `foundation-${topCard.id}`,
        left: getGameCardLeft(getGameFoundationX(foundationIndex)),
        top: getGameCardTop(TOP_ROW_Y),
        card: topCard,
        selected:
          this.selection?.kind === "foundation" &&
          this.selection.pileIndex === foundationIndex,
      });
    });

    return cards;
  }

  private getOverlayFaceDownCards(): GameOverlayFaceDownCard[] {
    if (!this.gameState) {
      return [];
    }

    const faceDownCards: GameOverlayFaceDownCard[] = [];
    const emptyTableauSlots: GameOverlayEmptySlot[] = [];

    this.gameState.tableau.forEach((pile, pileIndex) => {
      const x = getGameTableauX(pileIndex);

      if (pile.cards.length === 0) {
        // Empty tableau pile — render as empty slot in DOM
        emptyTableauSlots.push({
          key: `tableau-empty-${pileIndex}`,
          left: getGameCardLeft(x),
          top: getGameCardTop(TABLEAU_START_Y),
        });
        return;
      }

      pile.cards.forEach((card, cardIndex) => {
        if (card.faceUp) {
          return;
        }

        const y = this.getTableauCardY(pile, cardIndex);
        faceDownCards.push({
          key: `tableau-facedown-${card.id}`,
          left: getGameCardLeft(x),
          top: getGameCardTop(y),
        });
      });
    });

    // Store empty slots for overlay rendering
    this._emptyTableauSlots = emptyTableauSlots;

    return faceDownCards;
  }

  private bindGameOverlayEvents(): void {
    if (!this.gameOverlay) {
      return;
    }

    // Перевязывать обработчики при каждом ререндере overlay небезопасно:
    // setHtml() пересоздаёт DOM-узлы, и если клик пришёл между сменой
    // innerHTML и повторным querySelectorAll, он попадает в "потерянную"
    // ноду без слушателя. Делегация от стабильного root решает обе
    // проблемы — одна привязка, один cleanup, никакого race.
    if (this.gameOverlayCleanup) {
      return;
    }

    const root = this.gameOverlay.getInnerElement();

    const onClick = (event: Event): void => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const actionEl = target.closest<HTMLElement>("[data-game-action]");
      if (actionEl) {
        const action = actionEl.dataset.gameAction as
          | "undo"
          | "hint"
          | "rules"
          | "home"
          | undefined;
        switch (action) {
          case "undo":
            this.handleUndoAction();
            return;
          case "hint":
            this.handleHintAction();
            return;
          case "rules":
            this.showRulesOverlay();
            return;
          case "home":
            this.showLeaveConfirm();
            return;
        }
        return;
      }

      const emptySlot = target.closest<HTMLElement>(".game-overlay__empty-slot");
      if (emptySlot) {
        const key = emptySlot.dataset.cardKey ?? "";
        const pileIndex = parseInt(key.replace("tableau-empty-", ""), 10);
        if (!Number.isNaN(pileIndex)) {
          this.handleTableauClick(pileIndex, 0);
        }
      }
    };

    root.addEventListener("click", onClick);
    this.gameOverlayCleanup = () => {
      root.removeEventListener("click", onClick);
    };
  }

  private handleUndoAction(): void {
    const { i18n, save, analytics, sound } = getAppContext();
    const previousState = this.history.pop();

    if (!previousState || !this.gameState) {
      this.setStatus(i18n.t("nothingToUndo"));
      sound.badMove();
      return;
    }

    const isFirstUndo = (this.gameState?.undoCount ?? 0) === 0;
    const cost = isFirstUndo ? 0 : ECONOMY.undoCost;
    if (cost > 0) {
      const coins = save.load().progress.coins;
      if (coins < cost) {
        this.history.push(previousState); // put it back
        this.setStatus(i18n.t("notEnoughCoins"));
        sound.badMove();
        return;
      }
      save.addCoins(-cost);
    }
    this.gameState = {
      ...previousState,
      undoCount: previousState.undoCount + 1,
    };
    save.updateCurrentGame(this.gameState);
    analytics.track("undo_used", { dealId: this.gameState.dealId });
    this.selection = null;

    this.pendingFlips.clear();
    sound.cardPlace();
    this.renderBoard();
  }

  private getUndoLabel(): string {
    const { i18n } = getAppContext();
    const isFirstUndo = (this.gameState?.undoCount ?? 0) === 0;
    if (isFirstUndo) return i18n.t("undo");
    return `${i18n.t("undo")} 🪙${ECONOMY.undoCost}`;
  }

  private getHintLabel(): string {
    const { i18n } = getAppContext();
    if (this.hintsUsed === 0) return i18n.t("hint");
    return `${i18n.t("hint")} 🪙${ECONOMY.hintCost}`;
  }

  private handleHintAction(): void {
    if (!this.gameState || this.animating || this.autoCompleting) return;

    const { save, sound, i18n, analytics } = getAppContext();
    const isFirstHint = this.hintsUsed === 0;
    const cost = isFirstHint ? 0 : ECONOMY.hintCost;

    if (cost > 0) {
      const coins = save.load().progress.coins;
      if (coins < cost) {
        this.setStatus(i18n.t("notEnoughCoins"));
        sound.badMove();
        return;
      }
      save.addCoins(-cost);
    }

    const hint = getHint(this.gameState);
    if (!hint) {
      this.setStatus(i18n.t("noMoves"));
      sound.badMove();
      return;
    }

    this.hintsUsed++;
    analytics.track("hint_used", { dealId: this.gameState.dealId, cost });
    sound.goodMove();
    this.showHintHighlight(hint);
    this.renderBoard();
  }

  private showHintHighlight(hint: HintResult): void {
    this.clearHintHighlight();
    if (!this.gameState) return;

    const fromPos = this.getHintCardPosition(hint.from.zone, hint.from.pileIndex, hint.from.cardIndex);
    const toPos = this.getHintCardPosition(hint.to.zone, hint.to.pileIndex, -1);

    [fromPos, toPos].forEach((pos) => {
      if (!pos) return;
      const glow = this.add.graphics();
      glow.lineStyle(3, 0xffd700, 0.9);
      glow.strokeRoundedRect(
        pos.x - CARD_WIDTH / 2 - 4,
        pos.y - CARD_HEIGHT / 2 - 4,
        CARD_WIDTH + 8,
        CARD_HEIGHT + 8,
        6,
      );
      glow.setDepth(9999);
      this.hintGlowObjects.push(glow);

      this.tweens.add({
        targets: glow,
        alpha: { from: 1, to: 0.3 },
        duration: 500,
        yoyo: true,
        repeat: 3,
        onComplete: () => glow.destroy(),
      });
    });

    this.hintHighlightTimer = this.time.delayedCall(3500, () => {
      this.clearHintHighlight();
    });
  }

  private clearHintHighlight(): void {
    this.hintHighlightTimer?.destroy();
    this.hintHighlightTimer = undefined;
    this.hintGlowObjects.forEach((obj) => obj.destroy());
    this.hintGlowObjects = [];
  }

  private getHintCardPosition(
    zone: string,
    pileIndex: number,
    cardIndex: number,
  ): { x: number; y: number } | null {
    if (zone === "stock") {
      return { x: TABLEAU_START_X, y: TOP_ROW_Y };
    }
    if (zone === "waste") {
      return { x: TABLEAU_START_X + TABLEAU_GAP_X, y: TOP_ROW_Y };
    }
    if (zone === "foundation") {
      return { x: FOUNDATION_START_X + pileIndex * FOUNDATION_GAP_X, y: TOP_ROW_Y };
    }
    if (zone === "tableau" && this.gameState) {
      const pile = this.gameState.tableau[pileIndex];
      if (!pile) return null;
      const x = TABLEAU_START_X + pileIndex * TABLEAU_GAP_X;
      if (cardIndex >= 0) {
        return { x, y: this.getTableauCardY(pile, cardIndex) };
      }
      // Target: top card or empty slot
      if (pile.cards.length > 0) {
        return { x, y: this.getTableauCardY(pile, pile.cards.length - 1) };
      }
      return { x, y: TABLEAU_START_Y };
    }
    return null;
  }

  private showRulesOverlay(): void {
    const { i18n } = getAppContext();
    this.destroyRulesOverlay();

    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) return;

    const container = document.createElement("div");
    container.className = "game-overlay__rules-overlay";
    container.setAttribute("data-rules-overlay", "true");

    const backdrop = document.createElement("div");
    backdrop.className = "game-overlay__rules-backdrop";

    const panel = document.createElement("div");
    panel.className = "game-overlay__rules-panel";

    const title = document.createElement("h2");
    title.className = "game-overlay__rules-title";
    title.textContent = i18n.t("rules");

    const body = document.createElement("div");
    body.className = "game-overlay__rules-body";
    body.textContent = this.getRulesBodyText();

    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-btn modal-btn--inline";
    closeBtn.type = "button";
    closeBtn.textContent = i18n.t("close");
    closeBtn.addEventListener("click", () => this.destroyRulesOverlay());

    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(closeBtn);
    container.appendChild(backdrop);
    container.appendChild(panel);
    overlayEl.appendChild(container);

    // Backdrop click closes overlay
    backdrop.addEventListener("click", () => this.destroyRulesOverlay());

    // Cleanup on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      container.remove();
    });
  }

  private showLeaveConfirm(): void {
    const { i18n, save } = getAppContext();
    this.destroyLeaveConfirm();

    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) return;

    const container = document.createElement("div");
    container.className = "game-overlay__rules-overlay";
    container.setAttribute("data-leave-overlay", "true");

    const backdrop = document.createElement("div");
    backdrop.className = "game-overlay__rules-backdrop";

    const panel = document.createElement("div");
    panel.className = "game-overlay__rules-panel";

    const title = document.createElement("h2");
    title.className = "game-overlay__rules-title";
    title.textContent = i18n.t("leaveTitle");

    const body = document.createElement("div");
    body.className = "modal__body";
    body.textContent = i18n.t("leaveBody");

    const buttons = document.createElement("div");
    buttons.className = "modal__buttons";

    // Restart (same deal, same seed) — costs coins
    const coins = save.load().progress.coins;
    const cost = ECONOMY.restartCost;
    const canAfford = coins >= cost;

    const restartBtn = document.createElement("button");
    restartBtn.className = `modal-btn modal-btn--primary${canAfford ? "" : " modal-btn--disabled"}`;
    restartBtn.type = "button";
    restartBtn.textContent = `${i18n.t("restart")} (🪙 ${cost})`;
    restartBtn.addEventListener("click", () => {
      if (!this.gameState || !canAfford) return;
      const { mode, dealId, seed } = this.gameState;
      save.addCoins(-cost);
      save.clearCurrentGame();
      this.scene.start(SCENES.game, { mode, dealId, seed });
    });

    // Leave to map
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "modal-btn modal-btn--danger";
    confirmBtn.type = "button";
    confirmBtn.textContent = i18n.t("leaveConfirm");
    confirmBtn.addEventListener("click", () => {
      this.destroyLeaveConfirm();
      this.scene.start(SCENES.map);
    });

    // Cancel — back to game
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-btn";
    cancelBtn.type = "button";
    cancelBtn.textContent = i18n.t("leaveCancel");
    cancelBtn.addEventListener("click", () => this.destroyLeaveConfirm());

    buttons.appendChild(restartBtn);
    buttons.appendChild(confirmBtn);
    buttons.appendChild(cancelBtn);
    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(buttons);
    container.appendChild(backdrop);
    container.appendChild(panel);
    overlayEl.appendChild(container);

    backdrop.addEventListener("click", () => this.destroyLeaveConfirm());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      container.remove();
    });
  }

  private destroyLeaveConfirm(): void {
    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) return;
    const existing = overlayEl.querySelector('[data-leave-overlay="true"]');
    if (existing) {
      existing.remove();
    }
  }

  private destroyRulesOverlay(): void {
    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) return;
    const existing = overlayEl.querySelector('[data-rules-overlay="true"]');
    if (existing) {
      existing.remove();
    }
  }

  private getRulesBodyText(): string {
    const locale = getAppContext().i18n.currentLocale();
    if (locale === "ru") {
      return [
        "Собери все карты по мастям в верхние стопки: от туза до короля.",
        "",
        "На поле карты кладутся по убыванию, чередуя красные и чёрные масти.",
        "",
        "Переноси открытые карты и стопки, открывай закрытые карты и добирай из колоды слева.",
      ].join("\n");
    }

    return [
      "Build every suit in the top foundations from ace to king.",
      "",
      "On the tableau, build downward while alternating red and black cards.",
      "",
      "Move open cards and stacks, reveal face-down cards, and draw from the stock on the left.",
    ].join("\n");
  }

  private renderBoard(): void {
    if (!this.gameState || !this.boardLayer) return;
    this.animating = false;
    this.renderGameOverlay();
    this.boardLayer.removeAll(true);
    this.clearDragPreview();
    this.renderTopArea();
    this.renderTableau();

    const { analytics, save, sound } = getAppContext();

    // Win
    if (this.gameState.status === "won") {
      save.clearCurrentGame();
      analytics.track("deal_win", {
        mode: this.gameState.mode,
        dealId: this.gameState.dealId,
        undoCount: this.gameState.undoCount,
      });
      sound.victory();
      const { mode, dealId } = this.gameState;
      this.gameState = { ...this.gameState, status: "idle" };
      this.playWinAnimation(() => {
        this.scene.start(SCENES.reward, { mode, dealId });
      });
      return;
    }

    // Auto-complete offer
    if (!this.autoCompleting && canAutoComplete(this.gameState)) {
      this.showAutoCompleteOverlay();
      return;
    }

    // Deadlock detection removed — player decides when to quit/restart via the leave modal
  }


  private renderTopArea(): void {
    if (!this.gameState || !this.boardLayer) return;

    const currentState = this.gameState;

    // Stock aligns with col 1, waste with col 2
    this.createPileSlot(TABLEAU_START_X, TOP_ROW_Y, currentState.stock, () => {
      if (this.animating) return;

      // If a card is selected, deselect it and then deal from stock
      if (this.selection) {
        this.selection = null;
        this.renderBoard();
      }

      const hasCards =
        currentState.stock.cards.length > 0 || currentState.waste.cards.length > 0;
      if (!hasCards) return;

      const nextState = drawFromStock(currentState);
      const drewCard = nextState.waste.cards.length > currentState.waste.cards.length;

      if (drewCard) {
        // Animate drawn card from stock to waste using Phaser container with SVG texture
        this.animating = true;
        const drawnCard = nextState.waste.cards[nextState.waste.cards.length - 1];
        getAppContext().sound.cardPlace();

        // Center coordinates for Phaser animation
        const stockCenterX = TABLEAU_START_X;
        const wasteCenterX = TABLEAU_START_X + TABLEAU_GAP_X;
        const centerY = TOP_ROW_Y;
        const midCenterX = (stockCenterX + wasteCenterX) / 2;

        // Start Phaser flip animation (midpoint -> waste slide + reveal)
        this.animateStockToWasteDom(drawnCard, midCenterX, centerY, wasteCenterX, () => {
          this.animating = false;
          this.applyState(nextState);
        });
      } else {
        // Recycle waste -> stock, no fly animation needed
        getAppContext().sound.cardPlace();
        this.applyState(nextState);
      }
    });

    const wasteTop = currentState.waste.cards[currentState.waste.cards.length - 1];
    const wasteSelected = this.selection?.kind === "waste";

    this.createPileSlot(
      TABLEAU_START_X + TABLEAU_GAP_X,
      TOP_ROW_Y,
      currentState.waste,
      () => {
        if (this.animating) return;
        if (!wasteTop) return;

        // Auto-move waste to foundation on first click if possible
        const fi = this.findTargetFoundation(wasteTop);
        if (fi !== null) {
          const nextState = tryAutoMoveToFoundation(currentState, { kind: "waste" });
          if (nextState) {
            const sourceX = TABLEAU_START_X + TABLEAU_GAP_X;
            const sourceY = TOP_ROW_Y;
            this.animateFlyToFoundation(sourceX, sourceY, wasteTop, fi, nextState);
            return;
          }
        }

        if (wasteSelected) {
          this.selection = null;
          this.renderBoard();
          return;
        }

        this.selection = { kind: "waste" };
        this.setStatus(`${formatCard(wasteTop, getAppContext().i18n.currentLocale())}`);
        this.renderBoard();
      },
      wasteTop,
      wasteTop ? { kind: "waste" } : null,
      wasteTop ? [wasteTop] : []
    );

    currentState.foundations.forEach((pile, index) => {
      const topCard = pile.cards[pile.cards.length - 1];
      const foundationSelected =
        this.selection?.kind === "foundation" && this.selection.pileIndex === index;

      this.createPileSlot(
        FOUNDATION_START_X + index * FOUNDATION_GAP_X,
        TOP_ROW_Y,
        pile,
        () => {
          this.handleFoundationClick(index);
        },
        topCard,
        foundationSelected ? { kind: "foundation", pileIndex: index } : null,
        topCard ? [topCard] : []
      );
    });
  }

  private renderTableau(): void {
    if (!this.gameState || !this.boardLayer) return;

    this.gameState.tableau.forEach((pile, pileIndex) => {
      const x = TABLEAU_START_X + pileIndex * TABLEAU_GAP_X;

      // Empty piles are rendered as DOM overlay slots (getOverlayFaceDownCards tracks them)
      if (pile.cards.length === 0) {
        return;
      }

      pile.cards.forEach((card, cardIndex) => {
        const y = this.getTableauCardY(pile, cardIndex);
        const isSelected =
          this.selection?.kind === "tableau" &&
          this.selection.pileIndex === pileIndex &&
          this.selection.cardIndex === cardIndex;
        // Drag is allowed for all face-up cards
        const dragSel = card.faceUp
          ? ({ kind: "tableau", pileIndex, cardIndex } as const)
          : null;

        const cardContainer = this.createCardObject(
          x,
          y,
          card,
          isSelected,
          () => {
            this.handleTableauClick(pileIndex, cardIndex);
          },
          dragSel,
          dragSel ? pile.cards.slice(cardIndex) : [],
          false
        );

        this.boardLayer?.add(cardContainer);
      });
    });
  }

  private createPileSlot(
    x: number,
    y: number,
    pile: Pile,
    onClick: () => void,
    topCard?: Card,
    dragSelection?: Selection | null,
    stackCards: Card[] = []
  ): void {
    if (!this.boardLayer) return;

    const isSelected =
      (this.selection?.kind === "waste" && pile.type === "waste") ||
      (this.selection?.kind === "foundation" &&
        pile.type === "foundation" &&
        pile.id === `foundation-${this.selection.pileIndex + 1}`);

    const isTopRowSlot =
      pile.type === "stock" ||
      pile.type === "waste" ||
      pile.type === "foundation";

    const slot = this.add
      .rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0xffffff, isTopRowSlot ? 0 : pile.cards.length > 0 ? 1 : 0.24)
      .setStrokeStyle(
        isTopRowSlot ? 0 : 2,
        isSelected ? 0xe3a34f : 0xdac9a1,
        isTopRowSlot ? 0 : pile.cards.length > 0 ? 1 : 0.6,
      )
      .setInteractive();
    slot.on("pointerdown", onClick);
    this.boardLayer.add(slot);

    if (topCard) {
      const cardObject = this.createCardObject(
        x,
        y,
        topCard,
        isSelected,
        onClick,
        dragSelection ?? null,
        stackCards,
        false
      );
      this.boardLayer.add(cardObject);
      return;
    }

    if (pile.type === "stock" || pile.type === "foundation") {
      return;
    }
  }

  /** Which card-back texture to use (maps to chapter or daily) */
  private cardBackKey(): string {
    if (!this.gameState) return "card-back-default";
    if (this.gameState.mode !== "adventure") return "card-back-default";
    const ch = parseInt(this.gameState.dealId.charAt(1), 10);
    if (ch === 1) return "card-back-compass";
    if (ch === 2) return "card-back-map";
    return "card-back-default";
  }

  /** Create a Phaser texture from the SVG card back string */
  private ensureCardBackTexture(): void {
    const key = this.cardBackKey();
    if (this.textures.exists(key)) return;

    let svg: string;
    switch (key) {
      case "card-back-compass":
        svg = backCompassSvg;
        break;
      case "card-back-map":
        svg = backMapSvg;
        break;
      default:
        svg = backDefaultSvg;
        break;
    }

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      if (this.textures.exists(key)) {
        URL.revokeObjectURL(url);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = CARD_WIDTH * 2;
      canvas.height = CARD_HEIGHT * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.textures.addCanvas(key, canvas);
        // Re-render board so face-down cards pick up the new texture
        this.renderBoard();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  private createFaceCardImage(
    x: number,
    y: number,
    card: Card,
    isSelected: boolean,
  ): Phaser.GameObjects.Image {
    const locale = getAppContext().i18n.currentLocale();
    const svgTextureKey = getSvgCardFaceTextureKey(card.rank, card.suit, locale);
    const textureKey = this.textures.exists(svgTextureKey)
      ? svgTextureKey
      : ensureCardFaceTexture(this, card, CARD_WIDTH, CARD_HEIGHT, isSelected, locale);
    return this.add.image(x, y, textureKey).setDisplaySize(CARD_WIDTH, CARD_HEIGHT).setOrigin(0.5);
  }

  private createCardObject(
    x: number,
    y: number,
    card: Card,
    isSelected: boolean,
    onClick: () => void,
    dragSelection: Selection | null,
    stackCards: Card[],
    renderFaceUpVisual = true,
  ): Phaser.GameObjects.Container {
    const cardContainer = this.add.container(x, y);
    const borderColor = isSelected ? 0xe3a34f : 0xdac9a1;

    if (!card.faceUp) {
      // Use SVG card back if loaded, else fall back to solid colour
      const backKey = this.cardBackKey();
      if (this.textures.exists(backKey)) {
        const img = this.add.image(0, 0, backKey)
          .setDisplaySize(CARD_WIDTH, CARD_HEIGHT)
          .setOrigin(0.5);
        cardContainer.add(img);
        if (isSelected) {
          const border = this.add
            .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0)
            .setStrokeStyle(2, borderColor)
            .setOrigin(0.5);
          cardContainer.add(border);
        }
      } else {
        const rect = this.add
          .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x355854, 1)
          .setStrokeStyle(2, borderColor)
          .setOrigin(0.5);
        cardContainer.add(rect);
      }
    } else if (renderFaceUpVisual) {
      cardContainer.add(this.createFaceCardImage(0, 0, card, isSelected));
    }

    cardContainer.setSize(CARD_WIDTH, CARD_HEIGHT);
    cardContainer.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT),
      Phaser.Geom.Rectangle.Contains
    );

    // pointerup + flag wasDragged: tap triggers onClick, drag does not
    let wasDragged = false;
    cardContainer.on("pointerup", () => {
      if (!wasDragged) onClick();
      wasDragged = false;
    });

    if (dragSelection && stackCards.length > 0) {
      this.input.setDraggable(cardContainer);
      cardContainer.on("dragstart", (pointer: Phaser.Input.Pointer) => {
        wasDragged = true;
        this.startDragPreview(dragSelection, stackCards, pointer.worldX, pointer.worldY);
      });
      cardContainer.on(
        "drag",
        (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
          this.updateDragPreview(dragX, dragY);
        }
      );
      cardContainer.on("dragend", (pointer: Phaser.Input.Pointer) => {
        this.finishDrag(pointer.worldX, pointer.worldY);
      });
    }

    // Flip animation: card was face-down and just revealed
    if (card.faceUp && this.pendingFlips.has(card.id)) {
      this.pendingFlips.delete(card.id);
      cardContainer.setScale(0, 1);
      this.tweens.add({
        targets: cardContainer,
        scaleX: 1,
        duration: 80,
        ease: "Power2",
      });
    }

    return cardContainer;
  }

  private handleFoundationClick(foundationIndex: number): void {
    if (!this.gameState || this.animating) return;

    if (!this.selection) {
      const pile = this.gameState.foundations[foundationIndex];
      if (pile.cards.length === 0) return;
      this.selection = { kind: "foundation", pileIndex: foundationIndex };
      this.renderBoard();
      return;
    }

    if (this.selection.kind === "waste") {
      const nextState = moveWasteToFoundation(this.gameState, foundationIndex);
      if (nextState) {
        const wasteCard = this.gameState.waste.cards[this.gameState.waste.cards.length - 1];
        const sourceX = TABLEAU_START_X + TABLEAU_GAP_X;
        const sourceY = TOP_ROW_Y;

        // Save history before mutating, remove card from waste immediately
        this.pushHistory();
        this.gameState = {
          ...this.gameState,
          waste: { ...this.gameState.waste, cards: this.gameState.waste.cards.slice(0, -1) },
        };
        getAppContext().save.updateCurrentGame(this.gameState);
        this.selection = null;
        this.renderBoard();

        this.animateFlyToFoundation(sourceX, sourceY, wasteCard, foundationIndex, nextState, true);
        return;
      }
      this.applyMoveResult(nextState);
      return;
    }

    if (this.selection.kind === "tableau") {
      const sourcePileIndex = this.selection.pileIndex;
      const sourcePile = this.gameState.tableau[sourcePileIndex];
      const sourceCard = sourcePile.cards[sourcePile.cards.length - 1];
      const sourceX = TABLEAU_START_X + sourcePileIndex * TABLEAU_GAP_X;
      const sourceY = this.getTableauCardY(sourcePile, sourcePile.cards.length - 1);

      const nextState = moveTableauToFoundation(
        this.gameState,
        sourcePileIndex,
        foundationIndex
      );

      if (nextState) {
        // Save history before mutating, remove card from tableau immediately
        this.pushHistory();
        this.gameState = {
          ...this.gameState,
          tableau: this.gameState.tableau.map((p, i) =>
            i === sourcePileIndex ? { ...p, cards: p.cards.slice(0, -1) } : p
          ),
        };
        getAppContext().save.updateCurrentGame(this.gameState);
        this.selection = null;
        this.renderBoard();

        this.animateFlyToFoundation(sourceX, sourceY, sourceCard, foundationIndex, nextState, true);
        return;
      }
      this.applyMoveResult(nextState);
      return;
    }

    this.selection = null;
    this.renderBoard();
  }

  private handleTableauClick(pileIndex: number, cardIndex: number): void {
    if (!this.gameState || this.animating) return;

    if (!this.selection) {
      const pile = this.gameState.tableau[pileIndex];
      const card = pile.cards[cardIndex];
      if (!card || !card.faceUp) return;

      // Auto-move top card to foundation on single click
      if (cardIndex === pile.cards.length - 1) {
        const fi = this.findTargetFoundation(card);
        if (fi !== null) {
          const sel: Selection = { kind: "tableau", pileIndex, cardIndex };
          const nextState = tryAutoMoveToFoundation(this.gameState, sel);
          if (nextState) {
            const sourceX = TABLEAU_START_X + pileIndex * TABLEAU_GAP_X;
            const sourceY = this.getTableauCardY(pile, cardIndex);

            // Remove card from tableau immediately so it disappears before animation
            this.pushHistory();
            this.gameState = {
              ...this.gameState,
              tableau: this.gameState.tableau.map((p, i) =>
                i === pileIndex ? { ...p, cards: p.cards.slice(0, -1) } : p
              ),
            };
            getAppContext().save.updateCurrentGame(this.gameState);
            this.selection = null;
            this.renderBoard();

            this.animateFlyToFoundation(sourceX, sourceY, card, fi, nextState, true);
            return;
          }
        }
      }

      this.selection = { kind: "tableau", pileIndex, cardIndex };
      this.setStatus(`${formatCard(card, getAppContext().i18n.currentLocale())}`);
      this.renderBoard();
      return;
    }

    if (this.selection.kind === "waste") {
      const nextState = moveWasteToTableau(this.gameState, pileIndex);
      if (nextState) {
        // Animate Waste -> Tableau
        const sourceX = TABLEAU_START_X + TABLEAU_GAP_X; // Waste center X
        const sourceY = TOP_ROW_Y; // Waste center Y
        const targetPile = nextState.tableau[pileIndex];
        const targetY = this.getTableauCardY(targetPile, targetPile.cards.length);

        const wasteCard = this.gameState.waste.cards[this.gameState.waste.cards.length - 1];

        // Remove card from Waste immediately so it disappears before animation
        this.pushHistory();
        this.gameState = {
          ...this.gameState,
          waste: { ...this.gameState.waste, cards: this.gameState.waste.cards.slice(0, -1) },
        };
        getAppContext().save.updateCurrentGame(this.gameState);
        this.selection = null;
        this.renderBoard();

        this.animateFlyToTableau(
          sourceX,
          sourceY,
          wasteCard,
          pileIndex,
          targetY,
          nextState
        );
        return;
      }
      this.applyMoveResult(nextState);
      return;
    }

    if (this.selection.kind === "foundation") {
      const nextState = moveFoundationToTableau(
        this.gameState,
        this.selection.pileIndex,
        pileIndex
      );
      this.applyMoveResult(nextState);
      return;
    }

    if (this.selection.kind === "tableau") {
      const sameSelection =
        this.selection.pileIndex === pileIndex &&
        this.selection.cardIndex === cardIndex;

      if (sameSelection) {
        const nextState = tryAutoMoveToFoundation(this.gameState, this.selection);
        if (nextState) {
          this.applyState(nextState);
          getAppContext().sound.goodMove();
          return;
        }
        this.selection = null;
        this.renderBoard();
        return;
      }

      const nextState = moveTableauToTableau(
        this.gameState,
        this.selection.pileIndex,
        this.selection.cardIndex,
        pileIndex
      );

      if (!nextState) {
        // Move invalid - re-select the clicked card if it is face-up
        const clickedPile = this.gameState.tableau[pileIndex];
        const clickedCard = clickedPile?.cards[cardIndex];
        if (clickedCard?.faceUp) {
          this.selection = { kind: "tableau", pileIndex, cardIndex };
          this.setStatus(`${formatCard(clickedCard, getAppContext().i18n.currentLocale())}`);
          this.renderBoard();
          return;
        }
        getAppContext().sound.badMove();
        this.setStatus(getAppContext().i18n.t("invalidMove"));
        return;
      }

      const sourcePile = this.gameState.tableau[this.selection.pileIndex];
      const stackCards = sourcePile.cards.slice(this.selection.cardIndex);
      const sourceCard = stackCards[0];
      const sourceX = TABLEAU_START_X + this.selection.pileIndex * TABLEAU_GAP_X;
      const sourceY = this.getTableauCardY(sourcePile, this.selection.cardIndex);
      const targetPile = nextState.tableau[pileIndex];
      const targetY = this.getTableauCardY(targetPile, targetPile.cards.length);

      // Detect flips BEFORE mutating gameState (compare original vs nextState)
      this.pendingFlips.clear();
      for (let i = 0; i < nextState.tableau.length; i++) {
        const oldPile = this.gameState.tableau[i];
        const newPile = nextState.tableau[i];
        const newTop = newPile.cards[newPile.cards.length - 1];
        if (newTop?.faceUp) {
          const oldCard = oldPile.cards.find((c) => c.id === newTop.id);
          if (oldCard && !oldCard.faceUp) {
            this.pendingFlips.add(newTop.id);
          }
        }
      }

      // Remove cards from source immediately so they don't appear doubled
      this.pushHistory();
      const srcPileIndex = this.selection.pileIndex;
      const srcCardIndex = this.selection.cardIndex;
      this.gameState = {
        ...this.gameState,
        tableau: this.gameState.tableau.map((pile, i) =>
          i === srcPileIndex
            ? { ...pile, cards: pile.cards.slice(0, srcCardIndex) }
            : pile
        ),
      };
      getAppContext().save.updateCurrentGame(this.gameState);

      // Re-render board without source cards (flip animations already in pendingFlips)
      this.selection = null;
      this.renderBoard();

      this.animateFlyToTableau(
        sourceX,
        sourceY,
        sourceCard,
        pileIndex,
        targetY,
        nextState,
        stackCards,
        sourceY
      );
    }
  }

  private applyMoveResult(nextState: GameState | null): void {
    if (!nextState) {
      getAppContext().sound.badMove();
      this.setStatus(getAppContext().i18n.t("invalidMove"));
      return;
    }
    getAppContext().sound.cardPlace();
    this.applyState(nextState);
  }

  private applyState(nextState: GameState, skipHistory = false): void {
    if (!this.gameState) return;

    // Flip detection - only run if pendingFlips not already set
    if (this.pendingFlips.size === 0) {
      for (let i = 0; i < nextState.tableau.length; i++) {
        const oldPile = this.gameState.tableau[i];
        const newPile = nextState.tableau[i];
        const newTop = newPile.cards[newPile.cards.length - 1];
        if (newTop?.faceUp) {
          const oldCard = oldPile.cards.find((c) => c.id === newTop.id);
          if (oldCard && !oldCard.faceUp) {
            this.pendingFlips.add(newTop.id);
          }
        }
      }
    }

    if (!skipHistory) {
      this.pushHistory();
    }
    this.gameState = {
      ...nextState,
      status: getGameStatus(nextState),
    };
    getAppContext().save.updateCurrentGame(this.gameState);
    this.selection = null;
    this.setStatus("");
    this.renderBoard();
  }

  private startDragPreview(
    selection: Selection,
    cards: Card[],
    pointerX: number,
    pointerY: number
  ): void {
    this.clearDragPreview();
    this.draggedSelection = selection;
    this.dragPreviewCards = cards.map((card, index) => ({
      key: `drag-${card.id}-${index}`,
      left: pointerX - CARD_WIDTH / 2,
      top: pointerY - CARD_HEIGHT / 2 + index * Math.min(FACE_UP_GAP_Y, 18),
      card,
      selected: true,
    }));
    // Disable pointer-events on DOM slots during drag to prevent them stealing the pointer
    this.gameOverlay?.getHostElement()?.classList.add("game-overlay--dragging");
    this.renderGameOverlay();

    // После полного ререндера фиксируем ссылки на drag-узлы — дальнейшие
    // pointer-move будут обновлять только их style без querySelectorAll.
    const root = this.gameOverlay?.getInnerElement();
    this.dragPreviewNodes = root
      ? Array.from(root.querySelectorAll<HTMLElement>(".game-overlay__dom-card--drag"))
      : [];
  }

  private updateDragPreview(x: number, y: number): void {
    if (this.dragPreviewCards.length === 0) {
      return;
    }
    const left = x - CARD_WIDTH / 2;
    const baseTop = y - CARD_HEIGHT / 2;
    const stepY = Math.min(FACE_UP_GAP_Y, 18);
    this.dragPreviewCards = this.dragPreviewCards.map((previewCard, index) => ({
      ...previewCard,
      left,
      top: baseTop + index * stepY,
    }));

    // Перетаскивание происходит на каждом фрейме pointer-move. Полный
    // renderGameOverlay() при каждом мув-евенте перепарсивает innerHTML
    // всего overlay — заметно подвисает на слабых мобилках. Двигаем
    // drag-карты прямой манипуляцией стилей по закешированным узлам;
    // полный ререндер случается только в start/end драга.
    if (this.dragPreviewNodes.length !== this.dragPreviewCards.length) {
      // Кэш потерял синхронизацию (например, кто-то сделал ререндер
      // overlay в середине драга) — пересобираем один раз.
      const root = this.gameOverlay?.getInnerElement();
      this.dragPreviewNodes = root
        ? Array.from(root.querySelectorAll<HTMLElement>(".game-overlay__dom-card--drag"))
        : [];
      if (this.dragPreviewNodes.length !== this.dragPreviewCards.length) {
        return;
      }
    }
    for (let i = 0; i < this.dragPreviewCards.length; i++) {
      const node = this.dragPreviewNodes[i];
      const card = this.dragPreviewCards[i];
      if (!node || !card) continue;
      node.style.left = `${card.left}px`;
      node.style.top = `${card.top}px`;
    }
  }

  private finishDrag(worldX: number, worldY: number): void {
    if (!this.gameState || !this.draggedSelection) {
      this.clearDragPreview();
      return;
    }

    const selection = this.draggedSelection;
    const tableauIndex = this.getTableauIndexAt(worldX, worldY);
    let nextState: GameState | null = null;

    // Foundation zone: entire row from first to last foundation slot
    if (this.isInFoundationZone(worldX, worldY)) {
      for (let fi = 0; fi < 4; fi++) {
        if (selection.kind === "waste") {
          nextState = moveWasteToFoundation(this.gameState, fi);
        } else if (selection.kind === "tableau") {
          nextState = moveTableauToFoundation(this.gameState, selection.pileIndex, fi);
        }
        if (nextState) break;
      }
    } else if (tableauIndex !== null) {
      if (selection.kind === "waste") {
        nextState = moveWasteToTableau(this.gameState, tableauIndex);
      } else if (selection.kind === "tableau") {
        nextState = moveTableauToTableau(
          this.gameState,
          selection.pileIndex,
          selection.cardIndex,
          tableauIndex
        );
      } else if (selection.kind === "foundation") {
        nextState = moveFoundationToTableau(
          this.gameState,
          selection.pileIndex,
          tableauIndex
        );
      }
    }

    this.clearDragPreview();

    if (nextState) {
      getAppContext().sound.cardPlace();
      this.applyState(nextState);
      return;
    }

    getAppContext().sound.badMove();
  }

  private clearDragPreview(): void {
    this.dragPreview?.destroy();
    this.dragPreview = undefined;
    this.draggedSelection = null;
    this.dragPreviewCards = [];
    this.dragPreviewNodes = [];
    this.gameOverlay?.getHostElement()?.classList.remove("game-overlay--dragging");
    this.renderGameOverlay();
  }

  /** Returns true if (x, y) is anywhere inside the foundation row area */
  private isInFoundationZone(x: number, y: number): boolean {
    if (y < TOP_ROW_Y - CARD_HEIGHT / 2 - 20 || y > TOP_ROW_Y + CARD_HEIGHT / 2 + 20) return false;
    const zoneLeft = FOUNDATION_START_X - CARD_WIDTH / 2 - 14;
    const zoneRight = FOUNDATION_START_X + 3 * FOUNDATION_GAP_X + CARD_WIDTH / 2 + 14;
    return x >= zoneLeft && x <= zoneRight;
  }

  private getTableauIndexAt(x: number, y: number): number | null {
    if (y < TABLEAU_START_Y - CARD_HEIGHT / 2 - 20 || y > 740) return null;

    const halfGap = TABLEAU_GAP_X / 2;
    let bestIndex: number | null = null;
    let bestDist = halfGap + 1;

    for (let index = 0; index < 7; index++) {
      const centerX = TABLEAU_START_X + index * TABLEAU_GAP_X;
      const dist = Math.abs(x - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  private pushHistory(): void {
    if (!this.gameState) return;
    this.history.push(cloneGameState(this.gameState));
  }

  private getTableauCardY(pile: Pile, cardIndex: number): number {
    let offset = 0;
    for (let index = 0; index < cardIndex; index++) {
      offset += pile.cards[index]?.faceUp ? FACE_UP_GAP_Y : FACE_DOWN_GAP_Y;
    }
    return TABLEAU_START_Y + offset;
  }

  private setStatus(message: string): void {
    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) return;
    const statusEl = overlayEl.querySelector('[data-game-status="true"]') as HTMLElement | null;
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  private getOverlayTitle(): string {
    if (!this.gameState) {
      return getAppContext().i18n.t("currentNode");
    }

    const { i18n } = getAppContext();
    return this.gameState.mode === "adventure"
      ? getPointTitleByDealId(this.gameState.dealId, i18n.getNarrativeLocale()) ?? i18n.t("currentNode")
      : i18n.t("daily");
  }

  private getOverlaySubtitle(): string {
    if (!this.gameState) {
      return "";
    }

    const { i18n } = getAppContext();

    if (this.gameState.mode === "adventure") {
      const ch = parseInt(this.gameState.dealId.charAt(1), 10) || 1;
      const lvl = parseInt(this.gameState.dealId.substring(3), 10) || 1;
      return `${i18n.t("chapter")} ${ch} • ${lvl}/10`;
    }

    if (this.gameState.mode === "daily") {
      return i18n.t("currentNode");
    }

    return "";
  }

  private showAutoCompleteOverlay(): void {
    const { i18n, sound } = getAppContext();
    sound.goodMove();

    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) return;

    const container = document.createElement("div");
    container.className = "game-overlay__rules-overlay";
    container.setAttribute("data-autocomplete-overlay", "true");

    const backdrop = document.createElement("div");
    backdrop.className = "game-overlay__rules-backdrop";

    const panel = document.createElement("div");
    panel.className = "game-overlay__rules-panel";

    const title = document.createElement("h2");
    title.className = "game-overlay__rules-title";
    title.textContent = i18n.t("autoCompleteTitle");

    const body = document.createElement("div");
    body.className = "modal__body";
    body.textContent = i18n.t("autoCompleteBody");

    const buttons = document.createElement("div");
    buttons.className = "modal__buttons";

    const autoBtn = document.createElement("button");
    autoBtn.className = "modal-btn modal-btn--primary";
    autoBtn.type = "button";
    autoBtn.textContent = `✨ ${i18n.t("autoComplete")}`;
    autoBtn.addEventListener("click", () => {
      container.remove();
      this.autoCompleting = true;
      this.runAutoComplete();
    });

    const continueBtn = document.createElement("button");
    continueBtn.className = "modal-btn";
    continueBtn.type = "button";
    continueBtn.textContent = i18n.t("continue");
    continueBtn.addEventListener("click", () => {
      container.remove();
      this.autoCompleting = true;
    });

    buttons.appendChild(autoBtn);
    buttons.appendChild(continueBtn);
    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(buttons);
    container.appendChild(backdrop);
    container.appendChild(panel);
    overlayEl.appendChild(container);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      container.remove();
    });
  }

  /** Automatically move all cards to foundation one-by-one with fly animation */
  private runAutoComplete(): void {
    if (!this.gameState) return;

    // Move cards from tableau to foundation one at a time
    const step = autoCompleteStep(this.gameState);
    if (!step) {
      if (this.gameState.status !== "won") {
        this.gameState = { ...this.gameState, status: getGameStatus(this.gameState) };
      }
      this.renderBoard();
      return;
    }

    // Source is always tableau → foundation now
    const sourcePile = this.gameState.tableau[step.fromPile];
    const card = sourcePile.cards[sourcePile.cards.length - 1];
    const sourceX = TABLEAU_START_X + step.fromPile * TABLEAU_GAP_X;
    const sourceY = this.getTableauCardY(sourcePile, sourcePile.cards.length - 1);
    const targetX = FOUNDATION_START_X + step.toPile * FOUNDATION_GAP_X;
    const targetY = TOP_ROW_Y;

    // Update state immediately
    this.pushHistory();
    this.gameState = { ...step.state, status: getGameStatus(step.state) };
    getAppContext().save.updateCurrentGame(this.gameState);

    // Re-render board without the moved card
    this.boardLayer?.removeAll(true);
    this.renderTopArea();
    this.renderTableau();

    // Fly animation using DOM overlay
    getAppContext().sound.cardPlace();

    this.animateFlyToFoundationDom(
      sourceX,
      sourceY,
      card,
      targetX,
      targetY,
      () => {
        this.boardLayer?.removeAll(true);
        this.renderTopArea();
        this.renderTableau();

        if (this.gameState?.status === "won") {
          this.renderBoard();
          return;
        }

        this.time.delayedCall(30, () => {
          this.runAutoComplete();
        });
      }
    );
  }

  /** Find the foundation index where this card can be placed, or null */
  private findTargetFoundation(card: Card): number | null {
    if (!this.gameState) return null;
    for (let i = 0; i < this.gameState.foundations.length; i++) {
      if (canMoveCardToFoundation(card, this.gameState.foundations[i], i)) return i;
    }
    return null;
  }

  /** Animate a card flying from source position to foundation using DOM overlay */
  private animateFlyToFoundation(
    sourceX: number,
    sourceY: number,
    card: Card,
    foundationIndex: number,
    nextState: GameState,
    skipHistory = false
  ): void {
    this.animating = true;
    const targetX = FOUNDATION_START_X + foundationIndex * FOUNDATION_GAP_X;
    const targetY = TOP_ROW_Y;

    this.animateFlyToFoundationDom(sourceX, sourceY, card, targetX, targetY, () => {
      this.animating = false;
      getAppContext().sound.goodMove();
      this.applyState(nextState, skipHistory);
    });
  }

  /** Animate a card flying from source position to tableau using DOM overlay */
  private animateFlyToTableau(
    sourceX: number,
    sourceY: number,
    card: Card,
    targetPileIndex: number,
    targetCardY: number,
    nextState: GameState,
    stackCards?: Card[],
    stackSourceY?: number,
  ): void {
    this.animating = true;
    const targetX = TABLEAU_START_X + targetPileIndex * TABLEAU_GAP_X;

    if (stackCards && stackCards.length > 1) {
      this.animateFlyStackToTableau(
        sourceX,
        stackSourceY ?? sourceY,
        stackCards,
        targetX,
        targetCardY,
        () => {
          this.animating = false;
          getAppContext().sound.cardPlace();
          this.applyState(nextState, true);
        }
      );
    } else {
      this.animateFlyToFoundationDom(sourceX, sourceY, card, targetX, targetCardY, () => {
        this.animating = false;
        getAppContext().sound.cardPlace();
        this.applyState(nextState, true);
      });
    }
  }

  /** Animate a stack of cards flying from source to tableau */
  private animateFlyStackToTableau(
    sourceX: number,
    sourceTopY: number,
    stackCards: Card[],
    targetX: number,
    targetCardY: number,
    onComplete: () => void
  ): void {
    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) {
      onComplete();
      return;
    }

    const scale = this.gameOverlay?.getScale() ?? 1;

    const animEls: HTMLElement[] = [];
    stackCards.forEach((card, index) => {
      const yOffset = index * Math.min(FACE_UP_GAP_Y, 18);
      const animEl = document.createElement("div");
      animEl.className = "game-overlay__dom-card game-overlay__stack-anim-card";
      const cardLeft = getGameCardLeft(sourceX) * scale;
      const cardTop = getGameCardTop(sourceTopY + yOffset) * scale;
      animEl.style.cssText = `
        position: absolute;
        left: ${cardLeft}px;
        top: ${cardTop}px;
        pointer-events: none;
        z-index: ${100 + index};
      `;

      const svgMarkup = createCardFaceSvgMarkup(card, true, getAppContext().i18n.currentLocale());
      animEl.innerHTML = svgMarkup;
      const svgEl = animEl.querySelector("svg");
      if (svgEl) {
        svgEl.style.width = `${CARD_WIDTH * scale}px`;
        svgEl.style.height = `${CARD_HEIGHT * scale}px`;
      }

      overlayEl.appendChild(animEl);
      animEls.push(animEl);
    });

    void animEls[0].offsetHeight;

    // targetCardY is where the BOTTOM (last) card of the stack should land.
    // The TOP (first) card should land at targetCardY - (n-1) * gap.
    const topCardTargetY = targetCardY - (stackCards.length - 1) * Math.min(FACE_UP_GAP_Y, 18);
    const targetLeft = getGameCardLeft(targetX) * scale;
    const targetTopOffset = getGameCardTop(topCardTargetY) * scale;

    requestAnimationFrame(() => {
      animEls.forEach((animEl, index) => {
        const yOffset = index * Math.min(FACE_UP_GAP_Y, 18) * scale;
        animEl.style.transition = `left 220ms ease-out ${index * 15}ms, top 220ms ease-out ${index * 15}ms`;
        animEl.style.left = `${targetLeft}px`;
        animEl.style.top = `${targetTopOffset + yOffset}px`;
      });

      const totalTime = 220 + (stackCards.length - 1) * 15 + 120;
      this.time.delayedCall(totalTime, () => {
        animEls.forEach(el => {
          if (el.parentNode) el.remove();
        });
        onComplete();
      });
    });
  }

  /**
   * Animate stock->waste card draw using DOM overlay.
   * Slide + flip/reveal effect. Uses CENTER coordinates (Phaser coordinate system).
   */
  private animateStockToWasteDom(
    card: Card,
    fromCenterX: number,
    fromCenterY: number,
    toCenterX: number,
    onComplete: () => void
  ): void {
    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) {
      onComplete();
      return;
    }

    const scale = this.gameOverlay?.getScale() ?? 1;
    const fromLeft = getGameCardLeft(fromCenterX) * scale;
    const fromTop = getGameCardTop(fromCenterY) * scale;
    const toLeft = getGameCardLeft(toCenterX) * scale;
    const cardW = CARD_WIDTH * scale;
    const cardH = CARD_HEIGHT * scale;

    // Create animation container with card back
    const animEl = document.createElement("div");
    animEl.className = "game-overlay__stock-anim";
    animEl.style.cssText = `
      position: absolute;
      left: ${fromLeft}px;
      top: ${fromTop}px;
      width: ${cardW}px;
      height: ${cardH}px;
      pointer-events: none;
      z-index: 200;
    `;

    // Card back using imported SVG (fix aspect ratio)
    const backKey = this.cardBackKey();
    let backSvg: string;
    switch (backKey) {
      case "card-back-compass": backSvg = backCompassSvg; break;
      case "card-back-map": backSvg = backMapSvg; break;
      default: backSvg = backDefaultSvg; break;
    }
    backSvg = fixCardBackSvgAspect(backSvg);
    animEl.innerHTML = `<div style="width:100%;height:100%;">${backSvg}</div>`;
    const backSvgEl = animEl.querySelector("svg");
    if (backSvgEl) {
      backSvgEl.style.width = "100%";
      backSvgEl.style.height = "100%";
    }

    overlayEl.appendChild(animEl);
    void animEl.offsetHeight; // Force reflow

    // Phase 1: Slide
    animEl.style.transition = "left 150ms ease-out";
    animEl.style.left = `${toLeft}px`;

    // Phase 2: Flip
    this.time.delayedCall(150, () => {
      animEl.style.transition = "transform 80ms ease-in";
      animEl.style.transform = "scaleX(0)";

      this.time.delayedCall(80, () => {
        // Swap to face-up
        const svgMarkup = createCardFaceSvgMarkup(card, true, getAppContext().i18n.currentLocale());
        animEl.innerHTML = `<div style="width:100%;height:100%;">${svgMarkup}</div>`;
        const faceSvgEl = animEl.querySelector("svg");
        if (faceSvgEl) {
          faceSvgEl.style.width = "100%";
          faceSvgEl.style.height = "100%";
        }

        // Phase 3: Expand
        animEl.style.transition = "transform 80ms ease-out";
        animEl.style.transform = "scaleX(1)";

        this.time.delayedCall(80, () => {
          animEl.remove();
          onComplete();
        });
      });
    });
  }

  /** Animate a card flying from source to target using DOM overlay */
  private animateFlyToFoundationDom(
    sourceX: number,
    sourceY: number,
    card: Card,
    targetX: number,
    targetY: number,
    onComplete: () => void
  ): void {
    const svgMarkup = createCardFaceSvgMarkup(card, true, getAppContext().i18n.currentLocale());

    const animEl = document.createElement("div");
    animEl.className = "game-overlay__fly-anim";
    animEl.style.cssText = `
      position: absolute;
      left: ${sourceX}px;
      top: ${sourceY}px;
      width: ${CARD_WIDTH}px;
      height: ${CARD_HEIGHT}px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 100;
    `;
    animEl.innerHTML = svgMarkup;

    const svgEl = animEl.querySelector("svg");
    if (svgEl) {
      svgEl.style.width = "100%";
      svgEl.style.height = "100%";
    }

    const overlayEl = this.gameOverlay?.getInnerElement();
    if (overlayEl) {
      overlayEl.appendChild(animEl);
    }

    const startPos = { x: sourceX, y: sourceY };
    this.tweens.add({
      targets: startPos,
      x: targetX,
      y: targetY,
      duration: 110,
      ease: "Power2",
      onUpdate: () => {
        animEl.style.left = `${startPos.x}px`;
        animEl.style.top = `${startPos.y}px`;
      },
      onComplete: () => {
        animEl.style.transition = "transform 40ms ease-out";
        animEl.style.transform = "translate(-50%, -50%) scale(0.92)";

        this.time.delayedCall(40, () => {
          animEl.remove();
          onComplete();
        });
      },
    });
  }

  private playWinAnimation(onComplete: () => void): void {
    // 1. White flash
    const flash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setDepth(200);
    this.tweens.add({
      targets: flash,
      alpha: 0.35,
      duration: 180,
      yoyo: true,
      ease: "Power2",
    });

    // 2. Runtime texture for particles (small gold circle)
    if (!this.textures.exists("win-particle")) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0xffd700, 1);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture("win-particle", 8, 8);
      gfx.destroy();
    }

    // 3. Gold particles from foundations zone
    const emitter = this.add.particles(
      0,
      TOP_ROW_Y - 10,
      "win-particle",
      {
        x: { min: FOUNDATION_START_X - 10, max: FOUNDATION_START_X + 3 * FOUNDATION_GAP_X + 10 },
        speed: { min: 70, max: 180 },
        angle: { min: -120, max: -60 },
        scale: { start: 1.3, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 1100,
        quantity: 4,
        frequency: 90,
        tint: [0xffd700, 0xffe97a, 0xf5c518, 0xfffacd],
      }
    ).setDepth(201);

    // 4. "Victory!" text as DOM overlay (above card DOM layer)
    const { i18n } = getAppContext();
    const victoryEl = document.createElement("div");
    victoryEl.className = "game-overlay__victory-text";
    victoryEl.textContent = i18n.t("victory");
    const overlayEl = this.gameOverlay?.getHostElement();
    if (overlayEl) {
      overlayEl.appendChild(victoryEl);
      void victoryEl.offsetHeight; // Force reflow
      victoryEl.classList.add("game-overlay__victory-text--visible");
    }

    // 5. Cleanup after 1.5s
    this.time.delayedCall(1500, () => {
      emitter.destroy();
      victoryEl.remove();
      flash.destroy();
      onComplete();
    });
  }

}
