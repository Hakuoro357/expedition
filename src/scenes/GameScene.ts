import Phaser from "phaser";
import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ECONOMY } from "@/app/config/economy";
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
  getAllHints,
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
import { createCardFaceSvgMarkup } from "@/features/board/cardFaceMarkup";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { COIN_ICON_HTML, COIN_TOKEN } from "@/ui/coinIcon";
import { escapeHtml } from "@/ui/escapeHtml";
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
  /**
   * Активный DOM-контейнер автокомплит-модалки. Нужен, чтобы renderBoard,
   * вызываемый несколько раз подряд до клика игрока, не плодил новые
   * модалки поверх существующей (старый баг: удалялась только верхняя,
   * под ней оставались призраки и закрывали игру).
   */
  private autoCompleteOverlayEl: HTMLElement | null = null;
  /**
   * Цикл подсказок: храним уже показанные в рамках текущего состояния
   * доски. На каждый клик «Подсказка» выдаём следующий неиспользованный
   * вариант из `getAllHints`. Когда `shownHintKeys` покрывают весь список —
   * кнопка блокируется. Любой ход игрока меняет fingerprint доски, и сет
   * сбрасывается в `renderBoard` → кнопка снова активна.
   */
  private shownHintKeys = new Set<string>();
  private lastBoardFingerprint = "";
  /** Кандидат на тап: gameobject, на котором pointerdown зафиксировал
   * касание. Чистится при dragstart или scene-level pointerup. Используется
   * как замена per-container `pointerup`, который на тач-устройствах
   * ненадёжен (не срабатывает, если палец сместился даже на пару пикселей
   * за hit area до отпускания). */
  private tapCandidate: Phaser.GameObjects.GameObject | null = null;
  private tapInputInstalled = false;

  constructor() {
    super(SCENES.game);
  }

  create(data: GameSceneData): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const ctx = getAppContext();
    ctx.sound.playBgm("game");
    if (!data.resumeCurrentGame) {
      ctx.sound.cardDeal();
    }
    const saveState = ctx.save.load();
    const restoredState = data.resumeCurrentGame ? saveState.currentGame : null;
    const mode = restoredState?.mode ?? data.mode ?? "adventure";
    const dealId = restoredState?.dealId ?? data.dealId ?? "c1n1";

    // Use provided seed (restart same deal). For adventure/daily, createInitialDeal resolves
    // the canonical per-node/per-date seed. Only quick-play / sandbox modes fall back to random.
    const seed = data.seed ?? (!restoredState && mode !== "daily" && mode !== "adventure" ? findRandomSolvableSeed() : undefined);
    this.gameState = restoredState ? cloneGameState(restoredState) : createInitialDeal(mode, dealId, seed);
    this.history = [];
    this.selection = null;
    // Require 12px movement before drag starts. На тач-устройствах
    // палец дрожит сильнее, чем мышь — 8px давало ложные dragstart-ы и
    // съедало одиночный тап (tap-to-move).
    this.input.dragDistanceThreshold = 12;
    this.tapInputInstalled = false;
    this.installTapDetection();

    this.pendingFlips.clear();
    this.autoCompleting = false;
    this.animating = false;
    this.hintsUsed = 0;
    this.hintHighlightTimer?.destroy();
    this.hintHighlightTimer = undefined;
    this.shownHintKeys.clear();
    this.lastBoardFingerprint = "";
    this.autoCompleteOverlayEl = null;
    this.draggedSelection = null;
    this.dragPreviewCards = [];
    this.dragPreviewNodes = [];
    this.tapCandidate = null;

    const { analytics, sdk } = getAppContext();
    analytics.track("deal_start", { mode, dealId });
    // ВАЖНО: на старте сессии (scene.create) save.updateCurrentGame НЕ
    // вызываем — GP-тестеры требуют «sync только при сохранении данных,
    // не на старте». Состояние gameState будет сохранено при первом
    // реальном ходе игрока (applyState → save.updateCurrentGame).
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
      const ctx = getAppContext();
      ctx.sdk.gameplayStop();
      // currentGame копится в памяти без debounced sync (см. SaveService).
      // При уходе со сцены принудительно сбрасываем его в облако — иначе
      // прерванная партия не подхватится при следующем заходе.
      void ctx.save.flush();
    });
  }

  /** Глобальная tap-детекция через scene.input.
   *
   * Per-container `pointerup` в Phaser срабатывает только если палец
   * отпустили над hit area того же объекта, на котором был pointerdown.
   * На тач-устройствах палец почти всегда дрожит между down и up — Phaser
   * не доставляет event, и тап теряется. Здесь мы фиксируем "кандидата
   * на тап" при pointerdown и принудительно вызываем колбэк при следующем
   * pointerup, если движение было меньше TAP_MAX_MOVE px и драг не
   * начался. Перенавешивается один раз на сцену (флаг `tapInputInstalled`)
   * — Phaser не дублирует listener при повторном вызове из create(). */
  private installTapDetection(): void {
    if (this.tapInputInstalled) return;
    this.tapInputInstalled = true;

    this.input.on(
      Phaser.Input.Events.GAMEOBJECT_DOWN,
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        if (!gameObject.getData || gameObject.getData("cardClick") == null) {
          this.tapCandidate = null;
          return;
        }
        this.tapCandidate = gameObject;
      },
    );

    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      const candidate = this.tapCandidate;
      this.tapCandidate = null;
      if (!candidate) return;
      // Дистанцию не проверяем: dragDistanceThreshold (12px) уже отсекает
      // движение на сцене — при превышении Phaser стартует драг и наш
      // dragstart-обработчик сам обнулит tapCandidate. Если до pointerup
      // драг не начался, это однозначно тап.
      const handler = candidate.getData("cardClick") as (() => void) | undefined;
      if (typeof handler === "function") handler();
    });

    // Палец ушёл с экрана / pointer cancelled — снимаем кандидата.
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => {
      this.tapCandidate = null;
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

  /**
   * Лёгкий fingerprint доски: длины стоков/waste/foundation/tableau + id
   * верхней waste-карты. Меняется ровно на тех изменениях, которые делают
   * предыдущие подсказки stale. Считается за O(pile-count), без JSON.
   */
  private computeBoardFingerprint(): string {
    const s = this.gameState;
    if (!s) return "";
    return [
      s.stock.cards.length,
      s.waste.cards.length,
      s.foundations.map((f) => f.cards.length).join(","),
      s.tableau.map((p) => p.cards.length).join(","),
      s.waste.cards[s.waste.cards.length - 1]?.id ?? "",
    ].join("|");
  }

  private renderGameOverlay(): void {
    const { i18n } = getAppContext();
    const foundationSuitSymbols = ["♠", "♣", "♦", "♥"];
    const backKey = this.cardBackKey();

    // Сброс цикла подсказок при любом реальном изменении доски —
    // разблокирует кнопку «Подсказка» после хода игрока (требование UX).
    const fp = this.computeBoardFingerprint();
    if (fp !== this.lastBoardFingerprint) {
      this.lastBoardFingerprint = fp;
      this.shownHintKeys.clear();
    }

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
      wasteHasCard: (this.gameState?.waste.cards.length ?? 0) > 0,
      wasteActive: this.selection?.kind === "waste",
      foundationSlots: foundationSuitSymbols.map((suitSymbol, index) => ({
        suitSymbol,
        active: this.selection?.kind === "foundation" && this.selection.pileIndex === index,
        hasCard: (this.gameState?.foundations[index]?.cards.length ?? 0) > 0,
      })),
      undoLabel: this.getUndoLabel(),
      hintLabel: this.getHintLabel(),
      // Кнопка заблокирована, только когда все подсказки для текущего
      // состояния доски уже показаны. Любой ход меняет fingerprint и
      // очищает shownHintKeys, что возвращает кнопку в активное состояние.
      hintDisabled: this.getRemainingHints().length === 0,
      rulesLabel: i18n.t("rules"),
      // Кнопка переименована «Настройки» → «Меню» по требованию ВК/ОК
      // тестировщиков: это теперь вход в полноценное меню, а не
      // технический экран настроек.
      settingsLabel: i18n.t("menu"),
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
        logicalWidth: GAME_CANVAS_WIDTH,
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
          | "settings"
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
            // Теперь это круглая «?»-кнопка в правом верхнем углу.
            this.showRulesOverlay();
            return;
          case "settings":
            // Открываем Settings с returnTo=game + данные о текущей
            // партии. Back-кнопка в SettingsScene вернёт игрока в ту же
            // партию: GameScene.create читает save.progress.currentGame
            // и восстанавливает ход, на котором вышли.
            if (this.gameState) {
              this.scene.start(SCENES.settings, {
                returnTo: "game",
                gameData: {
                  mode: this.gameState.mode,
                  dealId: this.gameState.dealId,
                },
              });
            } else {
              this.scene.start(SCENES.settings);
            }
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
    return `${i18n.t("undo")} ${COIN_TOKEN}${ECONOMY.undoCost}`;
  }

  private getHintLabel(): string {
    const { i18n } = getAppContext();
    if (this.hintsUsed === 0) return i18n.t("hint");
    return `${i18n.t("hint")} ${COIN_TOKEN}${ECONOMY.hintCost}`;
  }

  /** Уникальный ключ подсказки для дедупликации в рамках одного состояния доски. */
  private hintKey(h: HintResult): string {
    return `${h.from.zone}:${h.from.pileIndex}:${h.from.cardIndex}>${h.to.zone}:${h.to.pileIndex}`;
  }

  /**
   * Оставшиеся непоказанные подсказки для текущего состояния доски.
   * Используется и для выбора следующей подсказки, и для отключения
   * кнопки когда все варианты исчерпаны.
   */
  private getRemainingHints(): HintResult[] {
    if (!this.gameState) return [];
    return getAllHints(this.gameState).filter(
      (h) => !this.shownHintKeys.has(this.hintKey(h)),
    );
  }

  private handleHintAction(): void {
    if (!this.gameState || this.animating || this.autoCompleting) return;

    const remaining = this.getRemainingHints();
    if (remaining.length === 0) {
      // Все варианты показаны в рамках текущего состояния доски — кнопка
      // и так заблокирована, но на всякий случай guard.
      this.setStatus(getAppContext().i18n.t("noMoves"));
      getAppContext().sound.badMove();
      return;
    }

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
      // Явный sync в gp.player после списания монет.
      void save.flush();
    }

    const hint = remaining[0]!;
    this.shownHintKeys.add(this.hintKey(hint));
    this.hintsUsed++;
    analytics.track("hint_used", { dealId: this.gameState.dealId, cost });
    sound.hint();
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
    // Больше не перерендерим оверлей из таймера — состояние кнопки
    // определяется getRemainingHints(), а не наличием подсветки.
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
    // innerHTML (не textContent) — чтобы вставить CSS-иконку монеты. Текст
     // локали прогоняем через escapeHtml. cost — число, безопасно.
    restartBtn.innerHTML = `${escapeHtml(i18n.t("restart"))} (${COIN_ICON_HTML} ${cost})`;
    restartBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!this.gameState || !canAfford) return;
      const { mode, dealId } = this.gameState;
      save.addCoins(-cost);
      save.clearCurrentGame();
      this.scene.start(SCENES.game, { mode, dealId });
    });

    // Leave to map
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "modal-btn modal-btn--danger";
    confirmBtn.type = "button";
    confirmBtn.textContent = i18n.t("leaveConfirm");
    confirmBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.destroyLeaveConfirm();
      this.scene.start(SCENES.map);
    });

    // Cancel — back to game
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-btn";
    cancelBtn.type = "button";
    cancelBtn.textContent = i18n.t("leaveCancel");
    cancelBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); this.destroyLeaveConfirm(); });

    buttons.appendChild(restartBtn);
    buttons.appendChild(confirmBtn);
    buttons.appendChild(cancelBtn);
    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(buttons);
    container.appendChild(backdrop);
    container.appendChild(panel);
    overlayEl.appendChild(container);

    backdrop.addEventListener("pointerdown", (e) => { e.preventDefault(); this.destroyLeaveConfirm(); });

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
    const texts: Record<typeof locale, string[]> = {
      ru: [
        "Собери все карты по мастям в верхние стопки: от туза до короля.",
        "",
        "На поле карты кладутся по убыванию, чередуя красные и чёрные масти.",
        "",
        "Переноси открытые карты и стопки, открывай закрытые карты и добирай из колоды слева.",
      ],
      en: [
        "Build every suit in the top foundations from ace to king.",
        "",
        "On the tableau, build downward while alternating red and black cards.",
        "",
        "Move open cards and stacks, reveal face-down cards, and draw from the stock on the left.",
      ],
      tr: [
        "Her takımı üstteki temel yığınlara astan papaza kadar dizin.",
        "",
        "Tahtada kartları azalan sırayla, kırmızı ve siyah renkleri değiştirerek yerleştirin.",
        "",
        "Açık kartları ve yığınları taşıyın, kapalı kartları açın ve soldaki desteden yeni kart çekin.",
      ],
      es: [
        "Construye cada palo en las bases superiores, del as al rey.",
        "",
        "En el tablero, apila en orden descendente alternando cartas rojas y negras.",
        "",
        "Mueve cartas y pilas visibles, descubre las cartas boca abajo y roba del mazo a la izquierda.",
      ],
      pt: [
        "Construa cada naipe nas fundações superiores, do ás até o rei.",
        "",
        "No tabuleiro, empilhe em ordem decrescente alternando cartas vermelhas e pretas.",
        "",
        "Mova cartas e pilhas visíveis, revele cartas viradas para baixo e compre do monte à esquerda.",
      ],
      de: [
        "Lege jede Farbe in den oberen Ablagen vom Ass bis zum König ab.",
        "",
        "Auf dem Spielfeld staple absteigend und wechsle rote und schwarze Karten ab.",
        "",
        "Verschiebe offene Karten und Stapel, decke verdeckte Karten auf und ziehe aus dem Talon links.",
      ],
      fr: [
        "Construis chaque couleur dans les fondations du haut, de l'as au roi.",
        "",
        "Sur le tableau, empile par ordre décroissant en alternant cartes rouges et noires.",
        "",
        "Déplace les cartes et les piles visibles, retourne les cartes face cachée et pioche dans le talon à gauche.",
      ],
    };
    return (texts[locale] ?? texts.en).join("\n");
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
        getAppContext().sound.cardFlip();

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
        getAppContext().sound.stockRecycle();
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

  private createCardObject(
    x: number,
    y: number,
    card: Card,
    isSelected: boolean,
    onClick: () => void,
    dragSelection: Selection | null,
    stackCards: Card[],
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
    }
    // Face-up cards have no visual added at the Phaser layer — the DOM
    // overlay (gameSceneOverlay.ts) renders them as inline SVG. The container
    // here exists purely as an interaction target (hit area for tap/drag).

    cardContainer.setSize(CARD_WIDTH, CARD_HEIGHT);
    // Hit area для контейнера в Phaser задаётся в local-координатах, где
    // (0,0) = левый верхний угол визуального бокса, а (W,H) = правый нижний
    // (см. setSize). По бокам расширяем на 4px (между колонками 8px зазор).
    //
    // Особый случай — face-up карта в середине стопки tableau (есть карты
    // сверху над ней). Если давать ей полный hit area, он перекрывается с
    // hit area следующей карты, и Phaser в overlap-зоне всегда выбирает
    // верхнюю по display order — то есть нижнюю видимую карту. В итоге
    // тап по «корешку» средней карты не работает: всегда берётся нижняя.
    // Решение: для средних карт ограничиваем hit area только полоской,
    // которая реально не закрыта следующей картой (FACE_UP_GAP_Y) + чуть
    // запаса вверх, чтобы пальцем удобнее попадать. Нижняя face-up карта
    // (stackCards.length === 1) и face-down карты получают полный hit area.
    const hitPadX = 2;
    const isMiddleStackCard = dragSelection !== null && stackCards.length > 1;
    let hitRect: Phaser.Geom.Rectangle;
    if (isMiddleStackCard) {
      const stripPadTop = 4;
      const stripHeight = FACE_UP_GAP_Y + stripPadTop;
      hitRect = new Phaser.Geom.Rectangle(
        -hitPadX,
        -stripPadTop,
        CARD_WIDTH + hitPadX * 2,
        stripHeight,
      );
    } else {
      const hitPadBottom = 6;
      hitRect = new Phaser.Geom.Rectangle(
        -hitPadX,
        0,
        CARD_WIDTH + hitPadX * 2,
        CARD_HEIGHT + hitPadBottom,
      );
    }
    cardContainer.setInteractive(hitRect, Phaser.Geom.Rectangle.Contains);

    // Тап обрабатывается через scene-level pointerdown/pointerup
    // (см. installTapDetection). Хранение колбэка в data — у Phaser
    // нет встроенного "tap" события, а per-container `pointerup`
    // на тач-устройствах ненадёжен: если палец смещается с hit area
    // между down и up, событие не приходит и тап теряется.
    cardContainer.setData("cardClick", onClick);

    if (dragSelection && stackCards.length > 0) {
      this.input.setDraggable(cardContainer);
      cardContainer.on("dragstart", (pointer: Phaser.Input.Pointer) => {
        // Драг отменяет ожидающий тап.
        this.tapCandidate = null;
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
      top: pointerY - CARD_HEIGHT / 2 + index * FACE_UP_GAP_Y,
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
    // Двигаем через transform: translate3d (GPU-композиция) вместо
    // left/top, чтобы каждый pointer-move не запускал layout/paint всего
    // overlay — на Samsung A15 это критично: при 60+ touchmove в секунду
    // обновление left/top давало 30-50 мс лагов на каждом кадре.
    // initialLeft/initialTop — это inline-стиль, который мы поставили в
    // HTML на старте драга; смещение считаем как (новое — стартовое).
    for (let i = 0; i < this.dragPreviewCards.length; i++) {
      const node = this.dragPreviewNodes[i];
      const card = this.dragPreviewCards[i];
      if (!node || !card) continue;
      let initialLeft = Number(node.dataset.dragInitLeft);
      let initialTop = Number(node.dataset.dragInitTop);
      if (Number.isNaN(initialLeft) || Number.isNaN(initialTop)) {
        // Первый раз — снимаем стартовую позицию из inline-стиля,
        // который пришёл из HTML overlay, и кэшируем в data-атрибуты.
        initialLeft = parseFloat(node.style.left) || 0;
        initialTop = parseFloat(node.style.top) || 0;
        node.dataset.dragInitLeft = String(initialLeft);
        node.dataset.dragInitTop = String(initialTop);
      }
      const dx = card.left - initialLeft;
      const dy = card.top - initialTop;
      node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
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
    // Guard: не плодим дубли. renderBoard вызывается после каждого хода —
    // если оффер автокомплита доступен, он может сработать несколько раз
    // до того, как игрок среагирует. Одна модалка за раз.
    if (this.autoCompleteOverlayEl?.isConnected) return;

    const { i18n, sound } = getAppContext();
    sound.goodMove();

    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) return;

    const container = document.createElement("div");
    container.className = "game-overlay__rules-overlay";
    container.setAttribute("data-autocomplete-overlay", "true");
    this.autoCompleteOverlayEl = container;

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
    // Use pointerdown instead of click — ghostClickGuard blocks click
    // events for 300ms after renderGameOverlay(), which runs right before
    // this modal appears. pointerdown is not affected by the guard.
    autoBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.dismissAutoCompleteOverlay();
      this.autoCompleting = true;
      this.runAutoComplete();
    });

    const continueBtn = document.createElement("button");
    continueBtn.className = "modal-btn";
    continueBtn.type = "button";
    continueBtn.textContent = i18n.t("continue");
    continueBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.dismissAutoCompleteOverlay();
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
      this.dismissAutoCompleteOverlay();
    });
  }

  /**
   * Снять модалку автокомплита и при этом зачистить все случайные
   * призраки (если в DOM зацепились дубли от старых рендеров).
   */
  private dismissAutoCompleteOverlay(): void {
    this.autoCompleteOverlayEl?.remove();
    this.autoCompleteOverlayEl = null;
    const host = this.gameOverlay?.getHostElement();
    host?.querySelectorAll('[data-autocomplete-overlay="true"]').forEach((el) => el.remove());
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

    // Re-render board без перемещённой карты. Важно: face-up карты
    // рендерятся через DOM overlay (getOverlayCards), поэтому без
    // renderGameOverlay() визуально карта остаётся на исходной стопке,
    // хотя state уже обновлён — и игрок видит "дубликаты".
    this.boardLayer?.removeAll(true);
    this.renderTopArea();
    this.renderTableau();
    this.renderGameOverlay();

    // Fly animation using DOM overlay. Звук — в момент приземления.
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
        this.renderGameOverlay();

        if (this.gameState?.status === "won") {
          this.renderBoard();
          return;
        }

        this.time.delayedCall(15, () => {
          this.runAutoComplete();
        });
      },
      {
        flyDuration: 55,
        settleDuration: 20,
        onImpact: () => getAppContext().sound.goodMove(),
      },
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

    // Звук «приземления» проигрываем в момент окончания анимации, а не до
    // её старта — иначе на 150 мс fly-анимации звук опережает визуал и
    // воспринимается как «не от карты».
    this.animateFlyToFoundationDom(
      sourceX,
      sourceY,
      card,
      targetX,
      targetY,
      () => {
        this.animating = false;
        this.applyState(nextState, skipHistory);
      },
      { onImpact: () => getAppContext().sound.goodMove() },
    );
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

    // Звук «шлёпка» — в момент приземления, не на старте анимации.
    if (stackCards && stackCards.length > 1) {
      this.animateFlyStackToTableau(
        sourceX,
        stackSourceY ?? sourceY,
        stackCards,
        targetX,
        targetCardY,
        () => {
          this.animating = false;
          this.applyState(nextState, true);
        },
        () => getAppContext().sound.cardPlace(),
      );
    } else {
      this.animateFlyToFoundationDom(
        sourceX,
        sourceY,
        card,
        targetX,
        targetCardY,
        () => {
          this.animating = false;
          this.applyState(nextState, true);
        },
        { onImpact: () => getAppContext().sound.cardPlace() },
      );
    }
  }

  /** Animate a stack of cards flying from source to tableau */
  private animateFlyStackToTableau(
    sourceX: number,
    sourceTopY: number,
    stackCards: Card[],
    targetX: number,
    targetCardY: number,
    onComplete: () => void,
    onImpact?: () => void,
  ): void {
    const overlayEl = this.gameOverlay?.getHostElement();
    if (!overlayEl) {
      onComplete();
      return;
    }

    const scale = this.gameOverlay?.getScale() ?? 1;

    // Анимируем через CSS transition на transform (GPU-композиция),
    // а не на left/top — иначе на каждый промежуточный кадр браузер
    // делает layout, и на слабых Android драг стопки превращается
    // в слайдшоу. Якорная позиция фиксируется через left/top один раз
    // на старте, движение — translate3d.
    const animEls: HTMLElement[] = [];
    const sourceLefts: number[] = [];
    const sourceTops: number[] = [];
    stackCards.forEach((card, index) => {
      const yOffset = index * FACE_UP_GAP_Y;
      const animEl = document.createElement("div");
      animEl.className = "game-overlay__dom-card game-overlay__stack-anim-card";
      const cardLeft = getGameCardLeft(sourceX) * scale;
      const cardTop = getGameCardTop(sourceTopY + yOffset) * scale;
      sourceLefts.push(cardLeft);
      sourceTops.push(cardTop);
      animEl.style.cssText = `
        position: absolute;
        left: ${cardLeft}px;
        top: ${cardTop}px;
        transform: translate3d(0, 0, 0);
        will-change: transform;
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
        const dx = targetLeft - sourceLefts[index]!;
        const dy = (targetTopOffset + yOffset) - sourceTops[index]!;
        animEl.style.transition = `transform 220ms ease-out ${index * 15}ms`;
        animEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });

      // Звук «шлёпка» — в момент landing (конец transition + stagger),
      // не после 120мс буфера, иначе слышен после визуального приземления.
      const impactTime = 220 + (stackCards.length - 1) * 15;
      if (onImpact) {
        this.time.delayedCall(impactTime, () => onImpact());
      }
      const totalTime = impactTime + 120;
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
    onComplete: () => void,
    options?: { flyDuration?: number; settleDuration?: number; onImpact?: () => void },
  ): void {
    const flyDuration = options?.flyDuration ?? 110;
    const settleDuration = options?.settleDuration ?? 40;
    const svgMarkup = createCardFaceSvgMarkup(card, true, getAppContext().i18n.currentLocale());

    // Перемещение через transform: translate3d() — GPU-композиция, без
    // layout/paint на каждый кадр. Раньше использовалось обновление
    // style.left/top в onUpdate, что на слабых Android (Samsung A15 и
    // подобные) давало 30-50 мс лагов на каждом кадре fly-анимации.
    // Якорь -50%,-50% уносим в позицию: оффсетим left/top на CARD_W/H/2
    // заранее, а translate используем только для движения и финального scale.
    const animEl = document.createElement("div");
    animEl.className = "game-overlay__fly-anim";
    animEl.style.cssText = `
      position: absolute;
      left: ${sourceX - CARD_WIDTH / 2}px;
      top: ${sourceY - CARD_HEIGHT / 2}px;
      width: ${CARD_WIDTH}px;
      height: ${CARD_HEIGHT}px;
      transform: translate3d(0, 0, 0);
      will-change: transform;
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

    const deltaX = targetX - sourceX;
    const deltaY = targetY - sourceY;
    const offset = { t: 0 };
    this.tweens.add({
      targets: offset,
      t: 1,
      duration: flyDuration,
      ease: "Power2",
      onUpdate: () => {
        const x = deltaX * offset.t;
        const y = deltaY * offset.t;
        animEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      },
      onComplete: () => {
        // onImpact срабатывает В МОМЕНТ landing (конец fly-твина), а не после settle —
        // иначе звук слышен уже после того, как карта визуально легла.
        options?.onImpact?.();
        animEl.style.transition = `transform ${settleDuration}ms ease-out`;
        animEl.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.92)`;

        this.time.delayedCall(settleDuration, () => {
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
