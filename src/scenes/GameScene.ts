import Phaser from "phaser";
import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ECONOMY } from "@/app/config/economy";
import type { Card } from "@/core/cards/types";
import type { GameMode, GameState, Pile } from "@/core/game-state/types";
import { createInitialDeal } from "@/core/klondike/createInitialDeal";
import { findRandomSolvableSeed } from "@/core/klondike/randomSeed";
import { getNodeById } from "@/data/chapters";
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
import { formatCard, formatRank, formatSuit } from "@/features/board/formatCard";
import { createButton } from "@/ui/createButton";
type GameSceneData = {
  dealId?: string;
  mode?: GameMode;
  resumeCurrentGame?: boolean;
};

const CARD_WIDTH = 44;
const CARD_HEIGHT = 70;
// Layout: равные отступы 17px с каждой стороны
// CARD_WIDTH=44, GAP=52 → 44 + 6×52 = 356px, (390-356)/2 = 17px
// 7 columns: 39, 91, 143, 195, 247, 299, 351
const TABLEAU_START_X = 39;
const TABLEAU_GAP_X = 52;
const TABLEAU_START_Y = 205;
const FACE_UP_GAP_Y = 26;
const FACE_DOWN_GAP_Y = 18;
// Foundations align with cols 4-7: 195, 247, 299, 351
const FOUNDATION_START_X = 195;
const FOUNDATION_GAP_X = 52;
const TOP_ROW_Y = 115;

export class GameScene extends Phaser.Scene {
  private gameState: GameState | null = null;
  private history: GameState[] = [];
  private selection: Selection | null = null;
  private boardLayer?: Phaser.GameObjects.Container;
  private statusText?: Phaser.GameObjects.Text;
  private hintCountText?: Phaser.GameObjects.Text;
  private coinText?: Phaser.GameObjects.Text;
  private dragPreview?: Phaser.GameObjects.Container;
  private draggedSelection: Selection | null = null;
  private hintsUsedThisGame = 0;
  private lossDetected = false;
  private pendingFlips: Set<string> = new Set();
  private flyingCard?: Phaser.GameObjects.Container;
  private autoCompleting = false;
  private animating = false;

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
    // Require 8px movement before drag starts — prevents taps from triggering drag
    this.input.dragDistanceThreshold = 8;
    this.hintsUsedThisGame = 0;
    this.lossDetected = false;
    this.pendingFlips.clear();
    this.flyingCard?.destroy();
    this.flyingCard = undefined;
    this.autoCompleting = false;
    this.animating = false;
    this.dragPreview?.destroy();
    this.dragPreview = undefined;
    this.draggedSelection = null;

    const { i18n, analytics, save } = getAppContext();
    analytics.track("deal_start", { mode, dealId });
    save.updateCurrentGame(this.gameState);

    // ── Background ───────────────────────────────────────────────────────────
    const chapterNum = mode === "adventure" ? (parseInt(dealId.charAt(1), 10) || 1) : 1;
    const bgKey = `bg-chapter${chapterNum}`;
    if (this.textures.exists(bgKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setAlpha(0.55);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x102625);
    }
    // Dim overlay so board stays readable
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a1e1c, 0.45);

    // boardLayer создаётся ДО всего, чтобы карты не перекрывали UI поверх
    this.boardLayer = this.add.container(0, 0);

    // ── Header ───────────────────────────────────────────────────────────────
    this.add
      .text(GAME_WIDTH / 2, 30, i18n.t("boardPreview"), {
        fontFamily: "Georgia",
        fontSize: "22px",
        color: "#f5e7c8",
      })
      .setOrigin(0.5);

    // Subtitle: "Глава 1 • 4/10" for adventure, "Маршрут дня" for daily
    let subtitle = "";
    if (mode === "adventure") {
      const ch = parseInt(dealId.charAt(1), 10) || 1;
      const lvl = parseInt(dealId.substring(3), 10) || 1;
      subtitle = `${i18n.t("chapter")} ${ch} • ${lvl}/10`;
    } else if (mode === "daily") {
      subtitle = i18n.t("daily");
    }
    if (subtitle) {
      this.add
        .text(GAME_WIDTH / 2, 56, subtitle, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#ceb88e",
        })
        .setOrigin(0.5);
    }

    // ── Coin counter (рядом с subtitle, слева) ───────────────────────────────
    this.coinText = this.add
      .text(12, 56, `🪙 ${save.load().progress.coins}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#f0d97a",
      })
      .setOrigin(0, 0.5);

    // ── Hint usage indicator (рядом с subtitle, справа) ──────────────────────
    this.hintCountText = this.add
      .text(GAME_WIDTH - 12, 56, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ceb88e",
      })
      .setOrigin(1, 0.5);

    // ── Status text (над кнопками, не перекрывает карты) ─────────────────────
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 718, "", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#e7d8b3",
      })
      .setOrigin(0.5);

    this.createControls();
    this.renderBoard();
  }

  private createControls(): void {
    const { i18n, save, analytics, sound } = getAppContext();

    const BTN_Y = 755;
    // ── Undo ─────────────────────────────────────────────────────────────────
    // Layout: 3 кнопки по 110px, промежутки 14px, отступы 16px с краёв
    // x: 16+55=71, 71+55+14+55=195, 195+55+14+55=319
    const BTN_W = 110;
    createButton({
      scene: this,
      x: 71,
      y: BTN_Y,
      width: BTN_W,
      height: 48,
      label: i18n.t("undo"),
      onClick: () => {
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
      },
    });

    // ── Hint ─────────────────────────────────────────────────────────────────
    createButton({
      scene: this,
      x: 195,
      y: BTN_Y,
      width: BTN_W,
      height: 48,
      label: i18n.t("hint"),
      onClick: async () => {
        if (!this.gameState) return;

        const freeHintsLeft = ECONOMY.freeHintsPerGame - this.hintsUsedThisGame;

        if (freeHintsLeft <= 0) {
          // Try to spend coins or show ad
          const progress = save.load().progress;
          if (progress.coins >= ECONOMY.hintCoinCost) {
            save.addCoins(-ECONOMY.hintCoinCost);
            this.updateCoinDisplay();
          } else {
            // Offer rewarded ad for a hint
            const rewarded = await getAppContext().ads.showRewardedVideo("hint_reward");
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
      },
    });

    // ── Menu ──────────────────────────────────────────────────────────────────
    createButton({
      scene: this,
      x: 319,
      y: BTN_Y,
      width: BTN_W,
      height: 48,
      label: i18n.t("menu"),
      onClick: () => {
        this.scene.start(SCENES.map);
      },
    });
  }

  private renderBoard(): void {
    if (!this.gameState || !this.boardLayer) return;
    this.animating = false;
    this.boardLayer.removeAll(true);
    this.clearDragPreview();
    this.renderTopArea();
    this.renderTableau();

    const { analytics, save, sound } = getAppContext();

    // ── Win ───────────────────────────────────────────────────────────────────
    if (this.gameState.status === "won") {
      save.clearCurrentGame();
      analytics.track("deal_win", {
        mode: this.gameState.mode,
        dealId: this.gameState.dealId,
        undoCount: this.gameState.undoCount,
        hintCount: this.gameState.hintCount,
      });
      sound.victory();
      // Помечаем idle, чтобы повторный вызов renderBoard не запустил анимацию ещё раз
      const { mode, dealId } = this.gameState;
      this.gameState = { ...this.gameState, status: "idle" };
      this.playWinAnimation(() => {
        this.scene.start(SCENES.reward, { mode, dealId });
      });
      return;
    }

    // ── Auto-complete offer ──────────────────────────────────────────────────
    if (!this.autoCompleting && canAutoComplete(this.gameState)) {
      this.showAutoCompleteOverlay();
      return;
    }

    // ── Loss (no moves remaining) ─────────────────────────────────────────────
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

    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(500)
      .setInteractive();

    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 310, 230, 0x1c3532, 1)
      .setStrokeStyle(2, 0xdac9a1)
      .setDepth(501);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, i18n.t("noMoves"), {
        fontFamily: "Georgia",
        fontSize: "26px",
        color: "#f8ebcf",
      })
      .setOrigin(0.5)
      .setDepth(502);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, i18n.t("noMovesSubtitle"), {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#c9b98a",
        align: "center",
        wordWrap: { width: 270 },
      })
      .setOrigin(0.5)
      .setDepth(502);

    // Restart button
    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 10,
      width: 230,
      height: 48,
      label: i18n.t("restart"),
      depth: 502,
      onClick: () => {
        if (!this.gameState) return;
        const { mode, dealId } = this.gameState;
        save.clearCurrentGame();
        this.scene.start(SCENES.game, { mode, dealId });
      },
    });

    // Back to map
    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 68,
      width: 230,
      height: 48,
      label: i18n.t("backToMap"),
      depth: 502,
      onClick: () => {
        this.scene.start(SCENES.map);
      },
    });

    void overlay;
    void panel;
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
        // Animate drawn card from stock to waste (card-back slides, then flips)
        this.animating = true;
        const drawnCard = nextState.waste.cards[nextState.waste.cards.length - 1];
        const backKey = this.cardBackKey();
        const flyContainer = this.add.container(TABLEAU_START_X, TOP_ROW_Y).setDepth(100);
        if (this.textures.exists(backKey)) {
          flyContainer.add(
            this.add.image(0, 0, backKey).setDisplaySize(CARD_WIDTH, CARD_HEIGHT).setOrigin(0.5)
          );
        } else {
          flyContainer.add(
            this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x355854, 1)
              .setStrokeStyle(2, 0xdac9a1).setOrigin(0.5)
          );
        }
        getAppContext().sound.cardPlace();
        this.tweens.add({
          targets: flyContainer,
          x: TABLEAU_START_X + TABLEAU_GAP_X,
          duration: 150,
          ease: "Power2",
          onComplete: () => {
            // Shrink to 0 (hide back), replace with face, expand (flip effect)
            this.tweens.add({
              targets: flyContainer,
              scaleX: 0,
              duration: 80,
              onComplete: () => {
                flyContainer.removeAll(true);
                // Add face content
                const textColor = drawnCard.color === "red" ? "#a93f48" : "#1b1b1b";
                const label = `${formatRank(drawnCard)}${formatSuit(drawnCard)}`;
                flyContainer.add(this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0xf7ecd8, 1)
                  .setStrokeStyle(2, 0xdac9a1).setOrigin(0.5));
                flyContainer.add(this.add.text(-CARD_WIDTH / 2 + 4, -CARD_HEIGHT / 2 + 4, label, {
                  fontFamily: "Georgia", fontSize: "14px", fontStyle: "bold", color: textColor,
                }).setOrigin(0, 0));
                flyContainer.add(this.add.text(0, 0, formatSuit(drawnCard), {
                  fontFamily: "Georgia", fontSize: "24px", color: textColor,
                }).setOrigin(0.5));
                this.tweens.add({
                  targets: flyContainer,
                  scaleX: 1,
                  duration: 80,
                  onComplete: () => {
                    flyContainer.destroy();
                    this.animating = false;
                    this.applyState(nextState, "");
                  },
                });
              },
            });
          },
        });
      } else {
        // Recycle waste → stock, no fly animation needed
        getAppContext().sound.cardPlace();
        this.applyState(nextState, "");
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
      wasteTop ? { kind: "waste" } : null,   // drag разрешён без предварительного выбора
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
        // Drag разрешён для всех открытых карт (не только выбранных)
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
          dragSel ? pile.cards.slice(cardIndex) : []
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

    const slot = this.add
      .rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, pile.cards.length > 0 ? 0x244542 : 0x1f3b39, 1)
      .setStrokeStyle(2, isSelected ? 0xe3a34f : 0xdac9a1, pile.cards.length > 0 ? 1 : 0.6)
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
        stackCards
      );
      this.boardLayer.add(cardObject);
      return;
    }

    if (pile.type === "stock") {
      const text = this.add
        .text(x, y, String(pile.cards.length), {
          fontFamily: "Georgia",
          fontSize: "20px",
          color: "#f2e6cc",
        })
        .setOrigin(0.5);
      this.boardLayer.add(text);
    }

    if (pile.type === "foundation") {
      const suitSymbols = ["♠", "♣", "♦", "♥"];
      const pileIdx = parseInt(pile.id.replace("foundation-", ""), 10) - 1;
      const sym = suitSymbols[pileIdx] ?? "?";
      const text = this.add
        .text(x, y, sym, {
          fontFamily: "Georgia",
          fontSize: "24px",
          color: "#dac9a1",
        })
        .setOrigin(0.5)
        .setAlpha(0.4);
      this.boardLayer.add(text);
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

  private createCardObject(
    x: number,
    y: number,
    card: Card,
    isSelected: boolean,
    onClick: () => void,
    dragSelection: Selection | null,
    stackCards: Card[]
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
    } else {
      const rect = this.add
        .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0xf7ecd8, 1)
        .setStrokeStyle(2, borderColor)
        .setOrigin(0.5);
      cardContainer.add(rect);

      const textColor = card.color === "red" ? "#a93f48" : "#1b1b1b";
      const label = `${formatRank(card)}${formatSuit(card)}`;

      // Ранг+масть — верхний левый угол
      cardContainer.add(
        this.add.text(-CARD_WIDTH / 2 + 4, -CARD_HEIGHT / 2 + 4, label, {
          fontFamily: "Georgia", fontSize: "14px", fontStyle: "bold", color: textColor,
        }).setOrigin(0, 0)
      );
      // Большая масть — центр
      cardContainer.add(
        this.add.text(0, 0, formatSuit(card), {
          fontFamily: "Georgia", fontSize: "24px", color: textColor,
        }).setOrigin(0.5)
      );
      // Ранг+масть — нижний правый угол (повёрнут 180°)
      cardContainer.add(
        this.add.text(CARD_WIDTH / 2 - 4, CARD_HEIGHT / 2 - 4, label, {
          fontFamily: "Georgia", fontSize: "14px", fontStyle: "bold", color: textColor,
        }).setOrigin(0, 0).setAngle(180)
      );
    }

    cardContainer.setSize(CARD_WIDTH, CARD_HEIGHT);
    // Container origin is (0.5, 0.5) in Phaser 3.60+; use top-left Rectangle so
    // pointWithinHitArea's displayOrigin offset produces the correct world hit box.
    cardContainer.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT),
      Phaser.Geom.Rectangle.Contains
    );

    // pointerup + флаг wasDragged: тап вызывает onClick, drag — нет.
    // Используем pointerup (а не pointerdown), чтобы поднятый палец после drag
    // не запускал случайный тап-клик.
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
        duration: 220,
        ease: "Back.Out",
      });
    }

    return cardContainer;
  }

  private createEmptyTableauTarget(x: number, y: number, pileIndex: number): void {
    if (!this.boardLayer) return;

    const rect = this.add
      .rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0x1f3b39, 1)
      .setStrokeStyle(2, 0xdac9a1, 0.6)
      .setInteractive();
    rect.on("pointerdown", () => {
      this.handleTableauClick(pileIndex, 0);
    });
    this.boardLayer.add(rect);
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
          this.applyState(nextState, "");
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
        // Move invalid — re-select the clicked card if it is face-up
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

      getAppContext().sound.cardPlace();
      this.applyState(nextState, "");
    }
  }

  private applyMoveResult(nextState: GameState | null): void {
    if (!nextState) {
      getAppContext().sound.badMove();
      this.setStatus(getAppContext().i18n.t("invalidMove"));
      return;
    }
    getAppContext().sound.cardPlace();
    this.applyState(nextState, "");
  }

  private applyState(nextState: GameState, _message: string): void {
    if (!this.gameState) return;

    // Detect cards that flipped from face-down to face-up (for flip animation)
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

    this.pushHistory();
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

    const preview = this.add.container(pointerX, pointerY);

    cards.forEach((card, index) => {
      const y = index * Math.min(FACE_UP_GAP_Y, 18);
      const rect = this.add
        .rectangle(0, y, CARD_WIDTH, CARD_HEIGHT, 0xf7ecd8, 0.95)
        .setStrokeStyle(2, 0xe3a34f);
      const text = this.add
        .text(-CARD_WIDTH / 2 + 6, y - CARD_HEIGHT / 2 + 6, formatCard(card), {
          fontFamily: "Georgia",
          fontSize: "15px",
          color: card.color === "red" ? "#a93f48" : "#1b1b1b",
        })
        .setOrigin(0, 0);
      preview.add([rect, text]);
    });

    preview.setDepth(1000);
    this.dragPreview = preview;
  }

  private updateDragPreview(x: number, y: number): void {
    this.dragPreview?.setPosition(x, y);
  }

  private finishDrag(worldX: number, worldY: number): void {
    if (!this.gameState || !this.draggedSelection) {
      this.clearDragPreview();
      return;
    }

    const selection = this.draggedSelection;
    const tableauIndex = this.getTableauIndexAt(worldX, worldY);
    let nextState: GameState | null = null;

    // Foundation zone: entire row from first to last foundation slot (generous area)
    if (this.isInFoundationZone(worldX, worldY)) {
      // Try all 4 foundation slots — engine validates suit/rank
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
      this.applyState(nextState, "");
      return;
    }

    getAppContext().sound.badMove();
  }

  private clearDragPreview(): void {
    this.dragPreview?.destroy();
    this.dragPreview = undefined;
    this.draggedSelection = null;
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

    // Find the closest column within half-gap distance (generous tolerance)
    const halfGap = TABLEAU_GAP_X / 2; // 26px — covers the full space between columns
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
    const free = Math.max(0, ECONOMY.freeHintsPerGame - this.hintsUsedThisGame);
    this.hintCountText?.setText(free > 0 ? `💡×${free}` : "💡 0");
  }

  private updateCoinDisplay(): void {
    const coins = getAppContext().save.load().progress.coins;
    this.coinText?.setText(`🪙 ${coins}`);
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

    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, i18n.t("autoCompleteTitle"), {
        fontFamily: "Georgia",
        fontSize: "24px",
        color: "#f8ebcf",
      })
      .setOrigin(0.5)
      .setDepth(502);

    const body = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, i18n.t("autoCompleteBody"), {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#c9b98a",
        align: "center",
        wordWrap: { width: 260 },
      })
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
        this.autoCompleting = true; // prevent re-show
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
      // All done — check win
      if (this.gameState.status !== "won") {
        this.gameState = { ...this.gameState, status: getGameStatus(this.gameState) };
      }
      this.renderBoard();
      return;
    }

    // Determine source position for fly animation
    let sourceX: number;
    let sourceY: number;
    let card: Card;

    if (step.source === "waste") {
      // Card comes from waste
      if (step.target === "foundation") {
        const foundationPile = step.state.foundations[step.toPile];
        card = foundationPile.cards[foundationPile.cards.length - 1];
      } else {
        const tableauPile = step.state.tableau[step.toPile];
        card = tableauPile.cards[tableauPile.cards.length - 1];
      }
      sourceX = TABLEAU_START_X + TABLEAU_GAP_X; // waste position
      sourceY = TOP_ROW_Y;
    } else {
      // Card comes from tableau
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

    // Update state immediately (so the board re-renders without this card)
    this.pushHistory();
    this.gameState = { ...step.state, status: getGameStatus(step.state) };
    getAppContext().save.updateCurrentGame(this.gameState);

    // Re-render board without the moved card
    this.boardLayer?.removeAll(true);
    this.renderTopArea();
    this.renderTableau();

    // Fly animation
    const flyCard = this.createFlyingCard(sourceX, sourceY, card);
    getAppContext().sound.cardPlace();

    const targetScale = step.target === "foundation" ? 0.92 : 1;
    this.tweens.add({
      targets: flyCard,
      x: targetX,
      y: targetY,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: 120,
      ease: "Power2",
      onComplete: () => {
        flyCard.destroy();
        // Re-render to show updated foundation, then schedule next step
        this.boardLayer?.removeAll(true);
        this.renderTopArea();
        this.renderTableau();

        // Check win
        if (this.gameState?.status === "won") {
          this.renderBoard();
          return;
        }

        // Next card after a short pause
        this.time.delayedCall(60, () => {
          this.runAutoComplete();
        });
      },
    });
  }

  /** Find the foundation index where this card can be placed, or null */
  private findTargetFoundation(card: Card): number | null {
    if (!this.gameState) return null;
    for (let i = 0; i < this.gameState.foundations.length; i++) {
      if (canMoveCardToFoundation(card, this.gameState.foundations[i], i)) return i;
    }
    return null;
  }

  /** Create a visual-only card clone for fly animation (no interactivity) */
  private createFlyingCard(x: number, y: number, card: Card): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const rect = this.add
      .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0xf7ecd8, 1)
      .setStrokeStyle(2, 0xe3a34f)
      .setOrigin(0.5);
    container.add(rect);
    const textColor = card.color === "red" ? "#a93f48" : "#1b1b1b";
    const label = `${formatRank(card)}${formatSuit(card)}`;
    container.add(
      this.add.text(-CARD_WIDTH / 2 + 4, -CARD_HEIGHT / 2 + 4, label, {
        fontFamily: "Georgia", fontSize: "14px", fontStyle: "bold", color: textColor,
      }).setOrigin(0, 0)
    );
    container.add(
      this.add.text(0, 0, formatSuit(card), {
        fontFamily: "Georgia", fontSize: "24px", color: textColor,
      }).setOrigin(0.5)
    );
    container.add(
      this.add.text(CARD_WIDTH / 2 - 4, CARD_HEIGHT / 2 - 4, label, {
        fontFamily: "Georgia", fontSize: "14px", fontStyle: "bold", color: textColor,
      }).setOrigin(0, 0).setAngle(180)
    );
    container.setDepth(100);
    return container;
  }

  /** Animate a card flying from source position to foundation, then apply state */
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

    this.flyingCard?.destroy();
    this.flyingCard = this.createFlyingCard(sourceX, sourceY, card);

    this.tweens.add({
      targets: this.flyingCard,
      x: targetX,
      y: targetY,
      scaleX: 0.92,
      scaleY: 0.92,
      duration: 220,
      ease: "Power2",
      onComplete: () => {
        this.flyingCard?.destroy();
        this.flyingCard = undefined;
        this.animating = false;
        getAppContext().sound.goodMove();
        this.applyState(nextState, "");
      },
    });
  }

  private playWinAnimation(onComplete: () => void): void {
    // 1. Белая вспышка
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

    // 2. Runtime-текстура для частиц (маленький золотой кружок)
    if (!this.textures.exists("win-particle")) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0xffd700, 1);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture("win-particle", 8, 8);
      gfx.destroy();
    }

    // 3. Золотые частицы из зоны foundations (x-диапазон = весь ряд foundation)
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

    // 4. Текст "Победа!" поверх поля
    const { i18n } = getAppContext();
    const victoryText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, i18n.t("victory"), {
        fontFamily: "Georgia",
        fontSize: "42px",
        color: "#f8ebcf",
        stroke: "#3a2000",
        strokeThickness: 4,
      })
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

    // 5. Через 1.5с завершаем
    this.time.delayedCall(1500, () => {
      emitter.destroy();
      victoryText.destroy();
      flash.destroy();
      onComplete();
    });
  }

}
