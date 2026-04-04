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
import { getNodeById } from "@/data/chapters";
import { getPointTitleByDealId } from "@/data/narrative/points";
import { ROUTE_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import {
  autoCompleteStep,
  canAutoComplete,
  canMoveCardToFoundation,
  cloneGameState,
  drawFromStock,
  getHint,
  getGameStatus,
  hasAnyMoves,
  moveFoundationToTableau,
  moveTableauToFoundation,
  moveTableauToTableau,
  moveWasteToFoundation,
  moveWasteToTableau,
  tryAutoMoveToFoundation,
  type Selection,
} from "@/core/klondike/engine";
import { formatCard } from "@/features/board/formatCard";
import { ensureCardFaceTexture } from "@/features/board/cardFaceTexture";
import { createCardFaceSvgMarkup } from "@/features/board/cardFaceMarkup";
import { applyTextRenderQuality } from "@/app/rendering";
import { createButton } from "@/ui/createButton";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { createGameSceneOverlayHtml, type GameOverlayCard, type GameOverlayFaceDownCard } from "@/scenes/gameSceneOverlay";
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
  resumeCurrentGame?: boolean;
};

export class GameScene extends Phaser.Scene {
  private gameState: GameState | null = null;
  private history: GameState[] = [];
  private selection: Selection | null = null;
  private boardLayer?: Phaser.GameObjects.Container;
  private statusText?: Phaser.GameObjects.Text;
  private dragPreview?: Phaser.GameObjects.Container;
  private draggedSelection: Selection | null = null;
  private dragPreviewCards: GameOverlayCard[] = [];
  private hintsUsedThisGame = 0;
  private lossDetected = false;
  private pendingFlips: Set<string> = new Set();
  private autoCompleting = false;
  private animating = false;
  private rulesOverlayObjects: Phaser.GameObjects.GameObject[] = [];
  private gameOverlay?: CanvasOverlayHandle;
  private gameOverlayCleanup?: () => void;

  constructor() {
    super(SCENES.game);
  }

  create(data: GameSceneData): void {
    const saveState = getAppContext().save.load();
    const restoredState = data.resumeCurrentGame ? saveState.currentGame : null;
    const mode = restoredState?.mode ?? data.mode ?? "adventure";
    const dealId = restoredState?.dealId ?? data.dealId ?? "c1n1";

    // Always use a random solvable seed for new games (daily uses date-based seed internally)
    const randomSeed = !restoredState && mode !== "daily" ? findRandomSolvableSeed() : undefined;
    this.gameState = restoredState ? cloneGameState(restoredState) : createInitialDeal(mode, dealId, randomSeed);
    this.history = [];
    this.selection = null;
    // Require 8px movement before drag starts - prevents taps from triggering drag
    this.input.dragDistanceThreshold = 8;
    this.hintsUsedThisGame = 0;
    this.lossDetected = false;
    this.pendingFlips.clear();
    this.autoCompleting = false;
    this.animating = false;
    this.dragPreview?.destroy();
    this.dragPreview = undefined;
    this.draggedSelection = null;
    this.dragPreviewCards = [];

    const { analytics, save } = getAppContext();
    analytics.track("deal_start", { mode, dealId });
    save.updateCurrentGame(this.gameState);

    // Background
    const chapterNum = mode === "adventure" ? (parseInt(dealId.charAt(1), 10) || 1) : 1;
    const bgKey = `bg-chapter${chapterNum}`;
    if (this.textures.exists(bgKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setAlpha(0.55);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x102625);
    }
    // Dim overlay so board stays readable
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a1e1c, 0.45);
    this.renderBottomBar();
    this.renderGameOverlay();

    // boardLayer is created BEFORE everything so cards do not overlap UI
    this.boardLayer = this.add.container(0, 0);

    this.statusText = applyTextRenderQuality(
      this.add.text(GAME_WIDTH / 2, 718, "", {
        fontFamily: "'Trebuchet MS', Verdana, sans-serif",
        fontSize: "15px",
        color: "#e7d8b3",
      }),
    ).setOrigin(0.5);

    this.renderBoard();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyRulesOverlay();
      this.gameOverlayCleanup?.();
      this.gameOverlay?.destroy();
      this.gameOverlay = undefined;
      this.gameOverlayCleanup = undefined;
    });
  }

  private renderBottomBar(): void {
    const barTop = GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT;
    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, barTop, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
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
      undoLabel: i18n.t("undo"),
      hintLabel: i18n.t("hint"),
      homeLabel: i18n.t("home"),
      rulesLabel: i18n.t("rules"),
      cards: this.getOverlayCards(),
      dragCards: this.dragPreviewCards,
      cardBackSvg: `<div class="game-overlay__card-back">${cardBackSvg}</div>`,
      faceDownCards: this.getOverlayFaceDownCards(),
    });

    if (!this.gameOverlay) {
      this.gameOverlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "game-overlay-root",
        logicalWidth: GAME_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.gameOverlay.setHtml(html);
    }

    this.bindGameOverlayEvents();
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

    this.gameState.tableau.forEach((pile, pileIndex) => {
      const x = getGameTableauX(pileIndex);
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

    return faceDownCards;
  }

  private bindGameOverlayEvents(): void {
    if (!this.gameOverlay) {
      return;
    }

    const root = this.gameOverlay.getInnerElement();
    this.gameOverlayCleanup?.();

    const disposers: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>("[data-game-action]").forEach((element) => {
      const action = element.dataset.gameAction as "undo" | "hint" | "home" | undefined;
      if (!action) {
        return;
      }

      const onClick = (): void => {
        switch (action) {
          case "undo":
            this.handleUndoAction();
            return;
          case "hint":
            void this.handleHintAction();
            return;
          case "home":
            this.scene.start(SCENES.map);
            return;
        }
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    const rulesButton = root.querySelector<HTMLElement>("[data-game-rules]");
    if (rulesButton) {
      const onClick = (): void => this.showRulesOverlay();
      rulesButton.style.pointerEvents = "auto";
      rulesButton.addEventListener("click", onClick);
      disposers.push(() => rulesButton.removeEventListener("click", onClick));
    }

    this.gameOverlayCleanup = () => {
      disposers.forEach((dispose) => dispose());
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

    this.gameState = {
      ...previousState,
      undoCount: previousState.undoCount + 1,
    };
    save.updateCurrentGame(this.gameState);
    analytics.track("undo_used", { dealId: this.gameState.dealId });
    this.selection = null;
    this.lossDetected = false;
    sound.cardPlace();
    this.renderBoard();
  }

  private async handleHintAction(): Promise<void> {
    const { i18n, save, analytics, sound, ads } = getAppContext();
    if (!this.gameState) return;

    const freeHintsLeft = ECONOMY.freeHintsPerGame - this.hintsUsedThisGame;

    if (freeHintsLeft <= 0) {
      const progress = save.load().progress;
      if (progress.coins >= ECONOMY.hintCoinCost) {
        save.addCoins(-ECONOMY.hintCoinCost);
        this.updateCoinDisplay();
      } else {
        const rewarded = await ads.showRewardedVideo("hint_reward");
        if (!rewarded) {
          this.setStatus(i18n.t("notEnoughCoins"));
          sound.badMove();
          return;
        }
      }
    }

    const hint = getHint(this.gameState);
    this.hintsUsedThisGame++;
    this.gameState = {
      ...this.gameState,
      hintCount: this.gameState.hintCount + 1,
    };
    save.updateCurrentGame(this.gameState);
    analytics.track("hint_used", {
      dealId: this.gameState.dealId,
      mode: this.gameState.mode,
      hint,
      hintsUsed: this.gameState.hintCount,
    });

    this.setStatus(hint ? `💡 ${hint}` : i18n.t("noMovesFound"));
    this.updateHintDisplay();
    sound.goodMove();
  }

  private showRulesOverlay(): void {
    const { i18n } = getAppContext();
    this.destroyRulesOverlay();

    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.58)
      .setDepth(500)
      .setInteractive();

    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 322, 412, 0x17302d, 0.98)
      .setStrokeStyle(1, 0x5f7d77, 0.55)
      .setDepth(501);

    const title = applyTextRenderQuality(
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 164, i18n.t("rules"), {
        fontFamily: "'Trebuchet MS', Verdana, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#f7edd8",
      }),
    )
      .setOrigin(0.5)
      .setDepth(502);

    const body = applyTextRenderQuality(
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 124, this.getRulesBody(), {
        fontFamily: "'Trebuchet MS', Verdana, sans-serif",
        fontSize: "16px",
        color: "#e7d8b3",
        align: "left",
        wordWrap: { width: 258 },
        lineSpacing: 4,
      }),
    )
      .setOrigin(0.5, 0)
      .setDepth(502);

    const closeButton = createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 164,
      width: 188,
      height: 40,
      label: i18n.t("close"),
      depth: 502,
      onClick: () => this.destroyRulesOverlay(),
    });

    overlay.on("pointerdown", () => this.destroyRulesOverlay());
    this.rulesOverlayObjects = [overlay, panel, title, body, closeButton];
  }

  private destroyRulesOverlay(): void {
    this.rulesOverlayObjects.forEach((item) => item.destroy());
    this.rulesOverlayObjects = [];
  }

  private getRulesBody(): string {
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
        hintCount: this.gameState.hintCount,
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

    // Loss (no moves remaining)
    if (!this.lossDetected && !hasAnyMoves(this.gameState)) {
      this.lossDetected = true;
      this.showLossOverlay();
      analytics.track("deal_fail", {
        mode: this.gameState.mode,
        dealId: this.gameState.dealId,
      });
    }
  }

  private showLossOverlay(): void {
    const { i18n, save, sound } = getAppContext();
    sound.badMove();

    // Create DOM overlay for loss screen
    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) return;

    const lossContainer = document.createElement("div");
    lossContainer.className = "game-overlay__loss-screen";
    lossContainer.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 300;
      pointer-events: auto;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      background: #1c3532;
      border: 2px solid #dac9a1;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      max-width: 280px;
    `;

    // Title
    const title = document.createElement("h2");
    title.textContent = i18n.t("noMoves");
    title.style.cssText = `
      color: #f8ebcf;
      font-family: 'Trebuchet MS', Verdana, sans-serif;
      font-size: 24px;
      margin: 0;
    `;

    // Subtitle
    const subtitle = document.createElement("p");
    subtitle.textContent = i18n.t("noMovesSubtitle");
    subtitle.style.cssText = `
      color: #c9b98a;
      font-family: 'Trebuchet MS', Verdana, sans-serif;
      font-size: 14px;
      margin: 0;
      text-align: center;
    `;

    // Buttons container
    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    `;

    // Restart Button
    const restartBtn = document.createElement("button");
    restartBtn.textContent = i18n.t("restart");
    restartBtn.className = "route-overlay__nav-item route-overlay__nav-button";
    restartBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      font-size: 16px;
      cursor: pointer;
    `;
    restartBtn.addEventListener("click", () => {
      if (!this.gameState) return;
      const { mode, dealId } = this.gameState;
      save.clearCurrentGame();
      this.scene.start(SCENES.game, { mode, dealId });
    });

    // Home Button
    const homeBtn = document.createElement("button");
    homeBtn.textContent = i18n.t("home");
    homeBtn.className = "route-overlay__nav-item route-overlay__nav-button";
    homeBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      font-size: 16px;
      cursor: pointer;
    `;
    homeBtn.addEventListener("click", () => {
      this.scene.start(SCENES.map);
    });

    btnContainer.appendChild(restartBtn);
    btnContainer.appendChild(homeBtn);
    panel.appendChild(title);
    panel.appendChild(subtitle);
    panel.appendChild(btnContainer);
    lossContainer.appendChild(panel);
    overlayEl.appendChild(lossContainer);

    // Cleanup on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      lossContainer.remove();
    });
  }

  private renderTopArea(): void {
    if (!this.gameState || !this.boardLayer) return;

    const currentState = this.gameState;

    // Stock aligns with col 1, waste with col 2
    this.createPileSlot(TABLEAU_START_X, TOP_ROW_Y, currentState.stock, () => {
      if (this.animating) return;
      if (this.selection) {
        this.selection = null;
        this.renderBoard();
        return;
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
        this.setStatus(`${formatCard(wasteTop)}`);
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

      if (pile.cards.length === 0) {
        this.createEmptyTableauTarget(x, TABLEAU_START_Y, pileIndex);
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

  private createFaceCardImage(
    x: number,
    y: number,
    card: Card,
    isSelected: boolean,
  ): Phaser.GameObjects.Image {
    const svgTextureKey = getSvgCardFaceTextureKey(card.rank, card.suit);
    const textureKey = this.textures.exists(svgTextureKey)
      ? svgTextureKey
      : ensureCardFaceTexture(this, card, CARD_WIDTH, CARD_HEIGHT, isSelected);
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

  private createEmptyTableauTarget(x: number, y: number, pileIndex: number): void {
    if (!this.boardLayer) return;

    // Use Graphics for rounded corners (Phaser Rectangle does not support radius)
    const g = this.add.graphics();
    g.fillStyle(0x1f3b39, 1);
    g.lineStyle(2, 0xdac9a1, 0.6);
    g.fillRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 4.5);
    g.strokeRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 4.5);

    // Invisible hit area for input
    const hit = this.add.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0).setInteractive();
    hit.on("pointerdown", () => {
      this.handleTableauClick(pileIndex, 0);
    });

    this.boardLayer.add(g);
    this.boardLayer.add(hit);
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
      this.applyMoveResult(nextState);
      return;
    }

    if (this.selection.kind === "tableau") {
      const nextState = moveTableauToFoundation(
        this.gameState,
        this.selection.pileIndex,
        foundationIndex
      );
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
            this.animateFlyToFoundation(sourceX, sourceY, card, fi, nextState);
            return;
          }
        }
      }

      this.selection = { kind: "tableau", pileIndex, cardIndex };
      this.setStatus(`${formatCard(card)}`);
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
          this.setStatus(`${formatCard(clickedCard)}`);
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
    this.renderGameOverlay();
  }

  private updateDragPreview(x: number, y: number): void {
    if (this.dragPreviewCards.length === 0) {
      return;
    }
    this.dragPreviewCards = this.dragPreviewCards.map((previewCard, index) => ({
      ...previewCard,
      left: x - CARD_WIDTH / 2,
      top: y - CARD_HEIGHT / 2 + index * Math.min(FACE_UP_GAP_Y, 18),
    }));
    this.renderGameOverlay();
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

  private getMaxUndos(): number {
    if (!this.gameState) return ECONOMY.maxUndosDefault;
    const node = getNodeById(this.gameState.dealId);
    if (node) return ECONOMY.maxUndos[node.difficulty] ?? ECONOMY.maxUndosDefault;
    return ECONOMY.maxUndosDefault;
  }

  private pushHistory(): void {
    if (!this.gameState) return;
    this.history.push(cloneGameState(this.gameState));
    const max = this.getMaxUndos();
    if (this.history.length > max) {
      this.history.splice(0, this.history.length - max);
    }
  }

  private getTableauCardY(pile: Pile, cardIndex: number): number {
    let offset = 0;
    for (let index = 0; index < cardIndex; index++) {
      offset += pile.cards[index]?.faceUp ? FACE_UP_GAP_Y : FACE_DOWN_GAP_Y;
    }
    return TABLEAU_START_Y + offset;
  }

  private setStatus(message: string): void {
    this.statusText?.setText(message);
  }

  private updateHintDisplay(): void {
    this.renderGameOverlay();
  }

  private updateCoinDisplay(): void {
    this.renderGameOverlay();
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

    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setDepth(500)
      .setInteractive();

    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 300, 200, 0x1c3532, 1)
      .setStrokeStyle(2, 0xdac9a1)
      .setDepth(501);

    const title = applyTextRenderQuality(
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, i18n.t("autoCompleteTitle"), {
        fontFamily: "'Trebuchet MS', Verdana, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#f8ebcf",
      }),
    )
      .setOrigin(0.5)
      .setDepth(502);

    const body = applyTextRenderQuality(
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, i18n.t("autoCompleteBody"), {
        fontFamily: "'Trebuchet MS', Verdana, sans-serif",
        fontSize: "15px",
        color: "#c9b98a",
        align: "center",
        wordWrap: { width: 260 },
      }),
    )
      .setOrigin(0.5)
      .setDepth(502);

    const btn1 = createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 30,
      width: 230,
      height: 48,
      label: `✨ ${i18n.t("autoComplete")}`,
      depth: 502,
      onClick: () => {
        destroyModal();
        this.autoCompleting = true;
        this.runAutoComplete();
      },
    });

    const btn2 = createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 86,
      width: 230,
      height: 48,
      label: i18n.t("continue"),
      depth: 502,
      onClick: () => {
        destroyModal();
        this.autoCompleting = true;
      },
    });

    const destroyModal = () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      body.destroy();
      btn1.destroy();
      btn2.destroy();
    };
  }

  /** Automatically move all cards to foundation one-by-one with fly animation */
  private runAutoComplete(): void {
    if (!this.gameState) return;

    const step = autoCompleteStep(this.gameState);
    if (!step) {
      if (this.gameState.status !== "won") {
        this.gameState = { ...this.gameState, status: getGameStatus(this.gameState) };
      }
      this.renderBoard();
      return;
    }

    let sourceX: number;
    let sourceY: number;
    let card: Card;

    if (step.source === "waste") {
      if (step.target === "foundation") {
        const foundationPile = step.state.foundations[step.toPile];
        card = foundationPile.cards[foundationPile.cards.length - 1];
      } else {
        const tableauPile = step.state.tableau[step.toPile];
        card = tableauPile.cards[tableauPile.cards.length - 1];
      }
      sourceX = TABLEAU_START_X + TABLEAU_GAP_X;
      sourceY = TOP_ROW_Y;
    } else {
      const sourcePile = this.gameState.tableau[step.fromPile];
      card = sourcePile.cards[sourcePile.cards.length - 1];
      sourceX = TABLEAU_START_X + step.fromPile * TABLEAU_GAP_X;
      sourceY = this.getTableauCardY(sourcePile, sourcePile.cards.length - 1);
    }

    let targetX: number;
    let targetY: number;
    if (step.target === "foundation") {
      targetX = FOUNDATION_START_X + step.toPile * FOUNDATION_GAP_X;
      targetY = TOP_ROW_Y;
    } else {
      targetX = TABLEAU_START_X + step.toPile * TABLEAU_GAP_X;
      const destPile = step.state.tableau[step.toPile];
      targetY = this.getTableauCardY(destPile, destPile.cards.length - 1);
    }

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

        this.time.delayedCall(60, () => {
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
    nextState: GameState
  ): void {
    this.animating = true;
    const targetX = FOUNDATION_START_X + foundationIndex * FOUNDATION_GAP_X;
    const targetY = TOP_ROW_Y;

    this.animateFlyToFoundationDom(sourceX, sourceY, card, targetX, targetY, () => {
      this.animating = false;
      getAppContext().sound.goodMove();
      this.applyState(nextState);
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

      const svgMarkup = createCardFaceSvgMarkup(card, true);
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

    const targetLeft = getGameCardLeft(targetX) * scale;
    const targetTopOffset = getGameCardTop(targetCardY) * scale;

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

    // Card back using imported SVG
    const backKey = this.cardBackKey();
    let backSvg: string;
    switch (backKey) {
      case "card-back-compass": backSvg = backCompassSvg; break;
      case "card-back-map": backSvg = backMapSvg; break;
      default: backSvg = backDefaultSvg; break;
    }
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
        const svgMarkup = createCardFaceSvgMarkup(card, true);
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
    const svgMarkup = createCardFaceSvgMarkup(card, true);

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
      duration: 220,
      ease: "Power2",
      onUpdate: () => {
        animEl.style.left = `${startPos.x}px`;
        animEl.style.top = `${startPos.y}px`;
      },
      onComplete: () => {
        animEl.style.transition = "transform 80ms ease-out";
        animEl.style.transform = "translate(-50%, -50%) scale(0.92)";

        this.time.delayedCall(80, () => {
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

    // 4. "Victory!" text
    const { i18n } = getAppContext();
    const victoryText = applyTextRenderQuality(
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, i18n.t("victory"), {
        fontFamily: "'Trebuchet MS', Verdana, sans-serif",
        fontSize: "42px",
        fontStyle: "bold",
        color: "#f8ebcf",
        stroke: "#3a2000",
        strokeThickness: 4,
      }),
    )
      .setOrigin(0.5)
      .setDepth(202)
      .setAlpha(0);
    this.tweens.add({
      targets: victoryText,
      alpha: 1,
      y: GAME_HEIGHT / 2 - 80,
      duration: 400,
      ease: "Back.Out",
    });

    // 5. Cleanup after 1.5s
    this.time.delayedCall(1500, () => {
      emitter.destroy();
      victoryText.destroy();
      flash.destroy();
      onComplete();
    });
  }

}
