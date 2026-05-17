import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ARTIFACTS, type Artifact } from "@/data/artifacts";
import { resolveArtifactGridUrl } from "@/data/artifactAssetUrls";
import { CHAPTERS, getNodeByArtifactId, getNodeByEntryId } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { getNarrativeEntry, getNarrativeEntryExcerpt } from "@/data/narrative/entries";
import { getPointTitleByPointId } from "@/data/narrative/points";
import { getNarrativeSpeakerProfile } from "@/data/narrative/speakers";
import { resolvePortraitUrl } from "@/data/portraitAssetUrls";
import {
  createArchiveOverlayHtml,
  type ArchiveTabId,
} from "@/scenes/archiveSceneOverlay";
import { ROUTE_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

type ArchiveEntryItem = {
  entryId: string;
  pointId: string;
  pointLabel: string;
  author: string;
  initials: string;
  accent: string;
  portraitUrl: string | undefined;
  excerpt: string;
  body: string;
  /** v0.3.60: true for the author_thanks patron entry (no chapter node). */
  isAuthorThanks?: boolean;
};

type ArchiveNavTarget = "home" | "daily" | "settings";

/** Локализованная карточка артефакта для HTML-списка во вкладке
 *  «Артефакты». Структура зеркалит ArchiveEntryItem (см. archiveSceneOverlay). */
type ArchiveArtifactItem = {
  artifactId: string;
  title: string;
  description: string;
  imageUrl: string | undefined;
};

export class DiaryScene extends Phaser.Scene {
  private archiveOverlay?: CanvasOverlayHandle;
  private archiveOverlayCleanup?: () => void;
  private activeTab: ArchiveTabId = "entries";
  private archiveEntries: ArchiveEntryItem[] = [];
  private archiveArtifacts: ArchiveArtifactItem[] = [];

  constructor() {
    super(SCENES.diary);
  }

  create(): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const { i18n, save, sound } = getAppContext();
    sound.playBgm("map");
    const { progress } = save.load();
    // Гейтим dev-флаг ?preview=all-artifacts: в продакшен-сборке его быть
    // не должно, иначе игрок может одним URL-параметром "разлочить" весь архив
    // визуально (без реального сейва, но с раскрытием спойлеров).
    const previewAllArtifacts =
      import.meta.env.DEV &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "all-artifacts";
    const narrativeLocale = i18n.getNarrativeLocale();
    const visibleArtifactIds = previewAllArtifacts
      ? ARTIFACTS.map((artifact) => artifact.id)
      : progress.artifacts;

    this.archiveEntries = this.buildArchiveEntries(narrativeLocale);
    this.archiveArtifacts = this.buildArchiveArtifacts(visibleArtifactIds, narrativeLocale);

    if (this.textures.exists("diary-collage")) {
      // DiaryScene — архив, выкладка находок. Коллаж 3×4 предметов
      // под equally-distributed soft light. Tint 0.55 alpha — нужно
      // достаточно затемнения чтобы grid из карточек артефактов
      // поверх читался без давления, но и коллаж проступал
      // самобытно (это не «фон» а «стол на котором всё лежит»).
      const img = this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "diary-collage")
        .setOrigin(0.5);
      const scale = Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height);
      img.setScale(scale);
      const tint = this.add.graphics();
      tint.fillStyle(0x162927, 0.55);
      tint.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x162927);
      this.add
        .rectangle(GAME_WIDTH / 2, (GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, 0x213733, 0.58);
    }
    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(
      new Phaser.Geom.Line(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT),
    );

    this.renderArchiveOverlay();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.archiveOverlayCleanup?.();
      this.archiveOverlay?.destroy();
      this.archiveOverlay = undefined;
    });
  }

  private buildArchiveEntries(
    locale: "ru" | "global" | "en" | "tr" | "es" | "pt" | "de" | "fr",
  ): ArchiveEntryItem[] {
    const { save, i18n } = getAppContext();
    const { progress } = save.load();

    const entries: ArchiveEntryItem[] = progress.completedNodes
      .map((nodeId) => {
        const chapterNode = this.getChapterNode(nodeId);
        if (!chapterNode) {
          return null;
        }

        const entry = getNarrativeEntry(chapterNode.entryId, locale);
        if (!entry) {
          return null;
        }

        const speaker = getNarrativeSpeakerProfile(entry.speakerEntityId, locale);

        return {
          entryId: chapterNode.entryId,
          pointId: chapterNode.pointId,
          pointLabel: getPointTitleByPointId(chapterNode.pointId, locale) ?? chapterNode.pointId,
          author: speaker.fullName,
          initials: speaker.initials,
          accent: speaker.accent,
          portraitUrl: resolvePortraitUrl(speaker.portraitKey),
          excerpt: getNarrativeEntryExcerpt(chapterNode.entryId, locale) ?? "",
          body: entry.body,
        };
      })
      .filter((item): item is ArchiveEntryItem => Boolean(item));

    // v0.3.60: prepend author_thanks entry at top for patrons.
    if (progress.patronSupport) {
      const authorEntry = getNarrativeEntry("author_thanks", locale);
      const authorSpeaker = getNarrativeSpeakerProfile("author", locale);
      if (authorEntry && authorSpeaker) {
        entries.unshift({
          entryId: "author_thanks",
          pointId: "",
          pointLabel: i18n.t("authorThanksPointLabel"),
          author: authorSpeaker.fullName,
          initials: authorSpeaker.initials,
          accent: authorSpeaker.accent,
          // Author entry — initials-кружок fallback (нет author.webp asset).
          // Explicit undefined чтобы добавление webp в v0.3.61 не сломало
          // ad-hoc Phase 9 rendering без обновления layout.
          portraitUrl: undefined,
          excerpt: authorEntry.excerpt ?? "",
          body: authorEntry.body,
          isAuthorThanks: true,
        });
      }
    }

    return entries;
  }

  private getChapterNode(nodeId: string) {
    return CHAPTERS.flatMap((chapter) => chapter.nodes).find((node) => node.id === nodeId);
  }

  /**
   * Локализованный список артефактов для HTML-вкладки «Артефакты».
   * До v0.3.48 был Phaser-grid 3×3 квадратных плиток без описаний.
   * Сейчас — карточка-в-ряд под стиль entry-card: image + title +
   * description, как у записей. Так пользователь сразу видит контекст
   * каждого артефакта без необходимости открывать карточку.
   */
  private buildArchiveArtifacts(
    visibleArtifactIds: string[],
    locale: "ru" | "global" | "en" | "tr" | "es" | "pt" | "de" | "fr",
  ): ArchiveArtifactItem[] {
    return ARTIFACTS.filter((artifact) => visibleArtifactIds.includes(artifact.id))
      .map((artifact) => {
        // Локализация артефактов: ru/tr — нативные, остальные локали
        // (en/es/pt/de/fr) — английский fallback. Совпадает со схемой
        // в DetailScene и rewardRevealItems.
        const title =
          locale === "ru"
            ? artifact.titleRu
            : locale === "tr"
              ? (artifact.titleTr ?? artifact.titleEn)
              : artifact.titleEn;
        const description =
          locale === "ru"
            ? artifact.descriptionRu
            : locale === "tr"
              ? (artifact.descriptionTr ?? artifact.descriptionEn)
              : artifact.descriptionEn;
        return {
          artifactId: artifact.id,
          title,
          description,
          imageUrl: resolveArtifactGridUrl(artifact.imageKey),
        };
      });
  }

  private renderArchiveOverlay(): void {
    const { i18n } = getAppContext();
    const html = createArchiveOverlayHtml({
      title: i18n.t("archive"),
      activeTab: this.activeTab,
      entriesLabel: i18n.t("entries"),
      artifactsLabel: i18n.t("artifacts"),
      emptyEntriesLabel: i18n.t("diaryEmptyEntries"),
      emptyArtifactsLabel: i18n.t("diaryEmptyArtifacts"),
      entryItems: this.archiveEntries.map((item) => ({
        entryId: item.entryId,
        pointId: item.pointId,
        pointLabel: item.pointLabel,
        author: item.author,
        initials: item.initials,
        accent: item.accent,
        portraitUrl: item.portraitUrl,
        excerpt: item.excerpt,
      })),
      artifactItems: this.archiveArtifacts,
      navItems: [
        { id: "home", label: i18n.t("backToMap"), active: false },
        { id: "daily", label: i18n.t("daily"), active: false },
        { id: "settings", label: i18n.t("menu"), active: false },
      ],
    });

    if (!this.archiveOverlay) {
      this.archiveOverlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "archive-overlay-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.archiveOverlay.setHtml(html);
    }

    const root = this.archiveOverlay.getInnerElement();
    this.archiveOverlayCleanup?.();

    const disposers: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>("[data-archive-tab]").forEach((element) => {
      const nextTab = element.dataset.archiveTab as ArchiveTabId | undefined;
      if (!nextTab) {
        return;
      }

      const onClick = (): void => {
        if (this.activeTab === nextTab) {
          return;
        }

        this.activeTab = nextTab;
        this.renderArchiveOverlay();
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root.querySelectorAll<HTMLElement>("[data-archive-entry]").forEach((element) => {
      const entryId = element.dataset.archiveEntry;
      if (!entryId) {
        return;
      }

      const onClick = (): void => {
        const item = this.archiveEntries.find((entry) => entry.entryId === entryId);
        if (!item) {
          return;
        }

        this.openEntryDetail(item);
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root.querySelectorAll<HTMLElement>("[data-archive-artifact]").forEach((element) => {
      const artifactId = element.dataset.archiveArtifact;
      if (!artifactId) {
        return;
      }

      const onClick = (): void => {
        const artifact = ARTIFACTS.find((item) => item.id === artifactId);
        if (!artifact) {
          return;
        }
        this.openArtifactDetail(artifact);
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root.querySelectorAll<HTMLElement>("[data-app-nav]").forEach((element) => {
      const target = element.dataset.appNav as ArchiveNavTarget | undefined;
      if (!target) {
        return;
      }

      const onClick = (): void => this.handleBottomNav(target);
      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    const entriesList = root.querySelector<HTMLElement>(".archive-overlay__entries-list");
    if (entriesList) {
      entriesList.style.pointerEvents = "auto";
    }

    this.archiveOverlayCleanup = () => {
      disposers.forEach((dispose) => dispose());
    };
  }

  private handleBottomNav(target: ArchiveNavTarget): void {
    const { save } = getAppContext();

    switch (target) {
      case "home":
        this.scene.start(SCENES.map);
        return;
      case "daily": {
        const saveState = save.load();
        const progress = saveState.progress;
        const dailyKey = getDailyDateKey();

        if (progress.dailyClaimedOn === dailyKey) {
          return;
        }

        // Если у игрока есть незавершённая дневная партия — продолжаем её,
        // а не создаём новый расклад поверх (иначе теряется прогресс).
        const dailyDealId = `daily-${dailyKey}`;
        const savedGame = saveState.currentGame;
        if (
          savedGame &&
          savedGame.dealId === dailyDealId &&
          savedGame.status !== "won" &&
          savedGame.status !== "lost"
        ) {
          this.scene.start(SCENES.game, { resumeCurrentGame: true });
          return;
        }

        this.scene.start(SCENES.game, {
          mode: "daily",
          dealId: dailyDealId,
        });
        return;
      }
      case "settings":
        // returnTo="archive" — чтобы «← Назад» и повторный клик по
        // активной «Настройки» вернули игрока в DiaryScene.
        this.scene.start(SCENES.settings, { returnTo: "archive" });
        return;
    }
  }

  private openEntryDetail(item: ArchiveEntryItem): void {
    // v0.3.60: author_thanks has no chapter node — route to DetailScene in authorThanksEntry mode.
    if (item.isAuthorThanks) {
      this.scene.start(SCENES.detail, { authorThanksEntry: true, returnTo: "diary" });
      return;
    }

    const node = getNodeByEntryId(item.entryId);
    if (!node) {
      return;
    }

    this.scene.start(SCENES.detail, {
      dealId: node.id,
      initialTab: "entry",
    });
  }

  private openArtifactDetail(artifact: Artifact): void {
    const node = getNodeByArtifactId(artifact.id);
    if (!node) {
      return;
    }

    this.scene.start(SCENES.detail, {
      dealId: node.id,
      initialTab: "artifact",
      // Явно передаём artifactId — DetailScene по умолчанию
      // резолвит через reward.collectibleArtifactId, который для
      // некоторых узлов отличается от node.artifactId. Без override
      // клик по артефакту в архиве открывал бы чужой артефакт.
      artifactId: artifact.id,
    });
  }
}
