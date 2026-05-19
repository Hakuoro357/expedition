import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { socialsContext } from "@/app/socialsContext";
import { getArtifactById } from "@/data/artifacts";
import { resolveArtifactLargeUrl } from "@/data/artifactAssetUrls";
import { getNodeById } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { getNarrativeEntry } from "@/data/narrative/entries";
import { getPointTitleByDealId } from "@/data/narrative/points";
import { getRewardById } from "@/data/narrative/rewards";
import { getNarrativeSpeakerProfile } from "@/data/narrative/speakers";
import { resolvePortraitUrl } from "@/data/portraitAssetUrls";
import { getRouteSheetByDealId, ROUTE_SHEETS } from "@/data/routeSheets";
import { buildShareArtifactText, buildShareEntryText } from "@/scenes/buildShareText";
import {
  createDetailSceneOverlayHtml,
  type DetailSceneTabId,
} from "@/scenes/detailSceneOverlay";
import { ROUTE_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { escapeHtml } from "@/ui/escapeHtml";

export type DetailOrigin = {
  scene: string;
  data?: Record<string, unknown>;
};

export type DetailSceneData = {
  dealId?: string;
  initialTab?: DetailSceneTabId;
  origin?: DetailOrigin;
  /**
   * Явный override артефакта. Когда DiaryScene открывает конкретный
   * артефакт через клик, нужен именно ОН — не «тот, что reward
   * для этого узла грантит». Без override DetailScene резолвит через
   * `reward.collectibleArtifactId ?? node.artifactId`, что для
   * RewardScene правильно (хотим показать только что найденный
   * артефакт), но для DiaryScene даёт чужой артефакт когда reward
   * на узле подменяет дефолтный node.artifactId. v0.3.48.
   */
  artifactId?: string;
  /**
   * v0.3.60: true → render author_thanks layout (patron entry, no chapter node).
   * When set, dealId is ignored and renderAuthorThanksLayout() is used instead.
   */
  authorThanksEntry?: boolean;
  /** v0.3.60: scene key to return to when back button pressed in authorThanksEntry mode. */
  returnTo?: string;
};

type DetailNavTarget = "archive" | "daily" | "settings";

export class DetailScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private overlayCleanup?: () => void;
  private dealId = "";
  private activeTab: DetailSceneTabId = "entry";
  private origin?: DetailOrigin;
  private artifactIdOverride?: string;
  private statusText?: Phaser.GameObjects.Text;
  /** v0.3.55: per-tab one-shot cooldown для share-кнопки. Сбрасываются
   *  при каждом вход в сцену (см. create) — после возврата в архив и
   *  обратно можно поделиться снова. */
  private entryShareUsed = false;
  private artifactShareUsed = false;
  /** v0.3.60: true when opened as patron author_thanks entry (no chapter node). */
  private authorThanksMode = false;
  private returnToScene = "diary";

  constructor() {
    super(SCENES.detail);
  }

  create(data: DetailSceneData): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    getAppContext().sound.playBgm("map");
    this.entryShareUsed = false;
    this.artifactShareUsed = false;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlayCleanup?.();
      this.overlay?.destroy();
      this.overlay = undefined;
      this.overlayCleanup = undefined;
    });

    // v0.3.60: author_thanks patron entry — no chapter node needed.
    this.authorThanksMode = Boolean(data?.authorThanksEntry);
    this.returnToScene = data?.returnTo ?? "diary";

    if (this.authorThanksMode) {
      this.renderAuthorThanksLayout();
      return;
    }

    this.dealId = data.dealId ?? "";
    const node = this.dealId ? getNodeById(this.dealId) : undefined;

    if (!node) {
      this.scene.start(SCENES.map);
      return;
    }

    const initialTab = data.initialTab ?? "entry";
    this.activeTab = initialTab;
    this.origin = data.origin;
    this.artifactIdOverride = data.artifactId;

    this.render();
  }

  /**
   * v0.3.60: Minimal layout for the author_thanks patron entry.
   * No chapter node, tabs, artifact panel, or next-entry navigation.
   */
  private renderAuthorThanksLayout(): void {
    const { i18n } = getAppContext();
    const locale = i18n.getNarrativeLocale();
    const entry = getNarrativeEntry("author_thanks", locale);
    const speaker = getNarrativeSpeakerProfile("author", locale);

    // Fallback: if entry not found route to diary.
    if (!entry || !speaker) {
      this.scene.start(SCENES.diary);
      return;
    }

    this.children.removeAll(true);
    // Use a neutral background matching the map palette.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x162927, 0x162927, 0x0e1e1c, 0x0e1e1c, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(
      new Phaser.Geom.Line(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT),
    );

    // Author thanks — initials-кружок (не resolvePortraitUrl чтобы добавление
    // author.webp в v0.3.61 не silently сменило layout).
    // Structure mirrors detailSceneOverlay: ВСЁ содержимое внутри scroll-body
    // (eyebrow + portrait + author + body). home-button — sticky внизу
    // panel'а как в standard detail-page (.detail-page__home + modal-btn).
    const portraitHtml = `<div class="detail-page__portrait" style="--archive-portrait-accent:${escapeHtml(speaker.accent)}">${escapeHtml(speaker.initials)}</div>`;

    const html = [
      '<div class="detail-page detail-page--entry author-thanks-page">',
      '  <div class="detail-page__panel">',
      '    <div class="detail-page__scroll-body" data-detail-scroll>',
      `      <div class="detail-page__eyebrow">${escapeHtml(i18n.t("authorThanksPointLabel"))}</div>`,
      `      ${portraitHtml}`,
      `      <div class="detail-page__entry-author">${escapeHtml(speaker.fullName)}</div>`,
      `      <div class="detail-page__entry-body">${escapeHtml(entry.body)}</div>`,
      "    </div>",
      `    <button class="detail-page__home modal-btn modal-btn--primary" type="button" data-author-thanks-back aria-label="${escapeHtml(i18n.t("back"))}">${escapeHtml(i18n.t("back"))}</button>`,
      "  </div>",
      "</div>",
    ].join("\n");

    if (!this.overlay) {
      this.overlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "detail-page-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.overlay.setHtml(html);
    }

    const root = this.overlay.getInnerElement();
    this.overlayCleanup?.();
    const disposers: Array<() => void> = [];

    const backBtn = root.querySelector<HTMLElement>("[data-author-thanks-back]");
    if (backBtn) {
      backBtn.style.pointerEvents = "auto";
      const onClick = (): void => { this.scene.start(this.returnToScene); };
      backBtn.addEventListener("click", onClick);
      disposers.push(() => backBtn.removeEventListener("click", onClick));
    }

    const scrollBody = root.querySelector<HTMLElement>("[data-detail-scroll]");
    if (scrollBody) {
      scrollBody.style.pointerEvents = "auto";
      const updateScrollState = (): void => {
        const atBottom = scrollBody.scrollTop + scrollBody.clientHeight >= scrollBody.scrollHeight - 2;
        scrollBody.classList.toggle("is-at-bottom", atBottom);
      };
      const onScroll = (): void => updateScrollState();
      scrollBody.addEventListener("scroll", onScroll, { passive: true });
      updateScrollState();
      disposers.push(() => scrollBody.removeEventListener("scroll", onScroll));
    }

    this.overlayCleanup = () => { disposers.forEach((d) => d()); };
  }

  private render(): void {
    const { i18n } = getAppContext();
    const node = getNodeById(this.dealId);
    if (!node) {
      this.scene.start(SCENES.map);
      return;
    }

    const locale = i18n.getNarrativeLocale();
    const sheet = getRouteSheetByDealId(node.id) ?? ROUTE_SHEETS[0];
    const entry = node.entryId ? getNarrativeEntry(node.entryId, locale) : undefined;
    const speaker = entry ? getNarrativeSpeakerProfile(entry.speakerEntityId, locale) : undefined;
    // Резолвинг артефакта (v0.3.48):
    //   1. `data.artifactId` override — самый приоритетный. DiaryScene
    //      открывает конкретный артефакт по клику, нужен ИМЕННО он.
    //   2. `reward.collectibleArtifactId` — приоритет когда reward для
    //      этого узла грантит свой артефакт (RewardScene flow).
    //   3. `node.artifactId` — дефолтный артефакт узла.
    // До v0.3.43 учитывался только (3) — если reward подменял
    // артефакт, тап по плитке открывал «entry» вместо «artifact»
    // (L87-88 fallback). v0.3.43 ввёл (2). v0.3.48 ввёл (1) — без
    // него DiaryScene клик показывал не тот артефакт когда reward
    // на узле грантил другой.
    const reward = node.rewardId ? getRewardById(node.rewardId) : undefined;
    const expectedArtifactId =
      this.artifactIdOverride ??
      reward?.collectibleArtifactId ??
      node.artifactId ??
      null;
    const artifact = expectedArtifactId ? getArtifactById(expectedArtifactId) : undefined;
    const canShowEntry = Boolean(entry);
    const canShowArtifact = Boolean(artifact);

    if (this.activeTab === "artifact" && !canShowArtifact && canShowEntry) {
      this.activeTab = "entry";
    }

    if (this.activeTab === "entry" && !canShowEntry && canShowArtifact) {
      this.activeTab = "artifact";
    }

    this.children.removeAll(true);
    this.renderBackground(sheet);

    // Для артефакта локализация по старой схеме: ru/tr свои переводы,
    // остальные (en/es/pt/de/fr) — английский fallback. Это MVP:
    // атмосферные названия артефактов остаются на английском для
    // европейских локалей, как и весь нарратив (см. narrative.global).
    const uiLocale = i18n.currentLocale();
    const artifactTitle = artifact
      ? uiLocale === "ru"
        ? artifact.titleRu
        : uiLocale === "tr"
          ? artifact.titleTr ?? artifact.titleEn
          : artifact.titleEn
      : "";
    const artifactDescription = artifact
      ? uiLocale === "ru"
        ? artifact.descriptionRu
        : uiLocale === "tr"
          ? artifact.descriptionTr ?? artifact.descriptionEn
          : artifact.descriptionEn
      : "";
    // v0.3.55: share-кнопка в DetailScene. Видна когда canShare и
    // у активного таба есть содержимое для расшарки. one-shot per
    // visit per tab (флаги ниже).
    const sdk = getAppContext().sdk;
    const canShareThis =
      sdk.canShare() &&
      ((this.activeTab === "entry" && !!entry) ||
        (this.activeTab === "artifact" && !!artifact));
    const shareUsedForActiveTab =
      this.activeTab === "entry" ? this.entryShareUsed : this.artifactShareUsed;
    const html = createDetailSceneOverlayHtml({
      homeLabel: i18n.t("back"),
      navItems: [
        { id: "archive", label: i18n.t("archive"), active: false },
        { id: "daily", label: i18n.t("daily"), active: false },
        { id: "settings", label: i18n.t("menu"), active: false },
      ],
      activeTab: this.activeTab,
      entryTabLabel: i18n.t("tabEntry"),
      artifactTabLabel: i18n.t("tabArtifact"),
      shareLabel: canShareThis ? i18n.t("share") : undefined,
      shareDisabled: shareUsedForActiveTab,
      entry:
        entry && speaker
          ? {
              pointLabel: getPointTitleByDealId(node.id, locale) ?? node.pointId,
              author: speaker.fullName,
              initials: speaker.initials,
              accent: speaker.accent,
              portraitUrl: resolvePortraitUrl(speaker.portraitKey),
              body: entry.body,
            }
          : undefined,
      artifact: artifact
        ? {
            title: artifactTitle,
            description: artifactDescription,
            imageUrl: resolveArtifactLargeUrl(artifact.largeImageKey),
          }
        : undefined,
    });

    if (!this.overlay) {
      this.overlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "detail-page-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.overlay.setHtml(html);
    }

    this.bindOverlayEvents();
  }

  private renderBackground(sheet: (typeof ROUTE_SHEETS)[number]): void {
    const { topColor, bottomColor, glowColor } = sheet.background;
    const collageKey = `map-chapter-${sheet.page}`;
    const hasCollage = this.textures.exists(collageKey);

    if (hasCollage) {
      // Используем коллаж главы как фон. DetailScene имеет тёмную
      // карточку-панель в центре поверх — фон работает на полях,
      // tint при 0.5 alpha сохраняет читаемость карточки и при этом
      // даёт почувствовать атмосферу главы.
      const img = this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, collageKey)
        .setOrigin(0.5);
      const scale = Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height);
      img.setScale(scale);
      const tint = this.add.graphics();
      tint.fillStyle(topColor, 0.5);
      tint.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
      const background = this.add.graphics();
      background.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
      background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      background.fillStyle(glowColor, 0.18);
      background.fillEllipse(GAME_WIDTH / 2, 148, 320, 164);
      background.fillStyle(glowColor, 0.1);
      background.fillEllipse(GAME_WIDTH / 2, 332, 360, 220);

      const field = this.add.graphics();
      field.fillStyle(topColor, 0.4);
      field.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT);
    }

    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(
      new Phaser.Geom.Line(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT),
    );
  }

  private bindOverlayEvents(): void {
    if (!this.overlay) {
      return;
    }

    const root = this.overlay.getInnerElement();
    this.overlayCleanup?.();

    const disposers: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>("[data-detail-tab]").forEach((element) => {
      const nextTab = element.dataset.detailTab as DetailSceneTabId | undefined;
      if (!nextTab) {
        return;
      }

      const onClick = (): void => {
        if (this.activeTab === nextTab) {
          return;
        }

        this.activeTab = nextTab;
        this.render();
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root.querySelectorAll<HTMLElement>("[data-app-nav]").forEach((element) => {
      const target = element.dataset.appNav as DetailNavTarget | undefined;
      if (!target) {
        return;
      }

      const onClick = (): void => this.handleBottomNav(target);
      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    const shareButton = root.querySelector<HTMLElement>("[data-detail-share]");
    if (shareButton) {
      shareButton.style.pointerEvents = "auto";
      const onClick = (): void => {
        const usedFlag =
          this.activeTab === "entry" ? this.entryShareUsed : this.artifactShareUsed;
        if (usedFlag) return;
        const ctx = getAppContext();
        const narrativeLocale = ctx.i18n.getNarrativeLocale();
        let text: string;
        if (this.activeTab === "entry") {
          text = buildShareEntryText(this.dealId, narrativeLocale, ctx.i18n);
          this.entryShareUsed = true;
        } else {
          // Артефакт-локализация по схеме DetailScene (см. render).
          const node = getNodeById(this.dealId);
          const reward = node?.rewardId ? getRewardById(node.rewardId) : undefined;
          const expectedArtifactId =
            this.artifactIdOverride ??
            reward?.collectibleArtifactId ??
            node?.artifactId ??
            null;
          const artifact = expectedArtifactId
            ? getArtifactById(expectedArtifactId)
            : undefined;
          const uiLocale = ctx.i18n.currentLocale();
          const artifactTitle = artifact
            ? uiLocale === "ru"
              ? artifact.titleRu
              : uiLocale === "tr"
                ? (artifact.titleTr ?? artifact.titleEn)
                : artifact.titleEn
            : "";
          text = buildShareArtifactText(artifactTitle, ctx.i18n);
          this.artifactShareUsed = true;
        }
        socialsContext.pendingShare = {
          dealId: this.dealId,
          locale: narrativeLocale,
        };
        void ctx.sdk.share({ text });
        this.render();
      };
      shareButton.addEventListener("click", onClick);
      disposers.push(() => shareButton.removeEventListener("click", onClick));
    }

    const homeButton = root.querySelector<HTMLElement>("[data-detail-home]");
    if (homeButton) {
      const onClick = (): void => {
        if (this.origin) {
          this.scene.start(this.origin.scene, this.origin.data);
        } else {
          this.scene.start(SCENES.diary);
        }
      };
      homeButton.style.pointerEvents = "auto";
      homeButton.addEventListener("click", onClick);
      disposers.push(() => homeButton.removeEventListener("click", onClick));
    }

    // Scroll-listener для fade-маски: когда пользователь доскроллил до
    // конца — снимаем класс is-at-bottom через toggle, иначе последний
    // параграф остаётся полупрозрачным. Если контент помещается без
    // скролла — сразу добавляем is-at-bottom, чтобы маски не было вообще.
    const scrollBody = root.querySelector<HTMLElement>("[data-detail-scroll]");
    if (scrollBody) {
      scrollBody.style.pointerEvents = "auto";
      const updateScrollState = (): void => {
        const atBottom =
          scrollBody.scrollTop + scrollBody.clientHeight >= scrollBody.scrollHeight - 2;
        scrollBody.classList.toggle("is-at-bottom", atBottom);
      };
      const onScroll = (): void => updateScrollState();
      scrollBody.addEventListener("scroll", onScroll, { passive: true });
      // Первичная оценка: контент короче, чем высота окна → сразу at-bottom.
      updateScrollState();
      disposers.push(() => scrollBody.removeEventListener("scroll", onScroll));
    }

    this.overlayCleanup = () => {
      disposers.forEach((dispose) => dispose());
    };
  }

  private handleBottomNav(target: DetailNavTarget): void {
    const { i18n, save } = getAppContext();

    switch (target) {
      case "archive":
        this.scene.start(SCENES.diary);
        return;
      case "daily": {
        const progress = save.load().progress;
        const dailyKey = getDailyDateKey();

        if (progress.dailyClaimedOn === dailyKey) {
          this.setStatus(i18n.t("dailyAlreadyClaimed"));
          return;
        }

        this.scene.start(SCENES.game, {
          mode: "daily",
          dealId: `daily-${dailyKey}`,
        });
        return;
      }
      case "settings":
        this.scene.start(SCENES.settings);
        return;
    }
  }

  private setStatus(message: string): void {
    if (!this.statusText) {
      this.statusText = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT - 16, message, {
          fontFamily: "'Trebuchet MS', Verdana, sans-serif",
          fontSize: "13px",
          color: "#ceb88e",
        })
        .setOrigin(0.5);
      return;
    }

    this.statusText.setText(message);
  }
}
