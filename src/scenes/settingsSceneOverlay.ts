import { createAppNavHtml, type AppNavItem } from "@/ui/appNavHtml";

import { escapeHtml } from "@/ui/escapeHtml";
import homeIconHtml from "../assets/ui/nav-icons/home.svg?raw";
import undoIconHtml from "../assets/ui/nav-icons/undo.svg?raw";
import hintIconHtml from "../assets/ui/nav-icons/hint.svg?raw";
import settingsIconHtml from "../assets/ui/nav-icons/settings.svg?raw";

type SettingsSceneOverlayParams = {
  title: string;
  languageLabel: string;
  /** @deprecated панель сброса убрана из UI; параметр оставлен для обратной совместимости. */
  resetLabel?: string;
  /**
   * Если задано — в левом верхнем углу показываем кнопку «← назад»,
   * возвращающую в сцену, откуда пришли (обычно GameScene). Клик дёргает
   * `data-settings-action="go-back"`.
   */
  backLabel?: string;
  /**
   * Список доступных UI-локалей. Каждая кнопка — `{ code, label, active }`:
   *   code — идентификатор (ru/en/tr/es/pt/de/fr), используется в
   *     `data-settings-action="locale-${code}"`.
   *   label — отображаемая строка (с галочкой "✓" если активная).
   *   active — true для текущей локали (выделяется визуально).
   * Поддержка 7 локалей → 2 ряда по 4 или 4 ряда по 2, layout через CSS grid.
   */
  localeOptions: Array<{ code: string; label: string; active: boolean }>;
  sfxLabel: string;
  musicLabel: string;
  /** Label блока mute-тумблера (локализованный «Звук» / «Sound» / «Ses»). */
  soundLabel: string;
  /** Текст на кнопке: «Включить» / «Выключить». */
  muteToggleLabel: string;
  /** Текущее состояние: true = всё заглушено (mute активен). */
  muted: boolean;
  /** 0..1 */
  sfxVolume: number;
  /** 0..1 */
  musicVolume: number;
  /**
   * Если undefined — bottom-nav не рендерим вообще. С v0.3.44
   * используется для first-run-из-TitleScene (пролог ещё не пройден):
   * скрываем nav, чтобы игрок не обошёл стартовый funnel через
   * Archive/Daily. Раньше (до v0.3.43) использовалось для режима
   * `startmenu` — он удалён, теперь стартовый экран это TitleScene.
   */
  navItems?: AppNavItem[];
  /**
   * Если задано — рендерим game-style bottom bar (как GameScene action-bar)
   * вместо обычной map-nav. Undo/Hint — disabled, Settings — активна и
   * дублирует «Назад», Home/Карта — уводит в MapScene.
   */
  gameNavLabels?: {
    undo: string;
    hint: string;
    settings: string;
    home: string;
  };
  /**
   * Короткая подпись с версией билда. Показывается над нижним nav'ом —
   * GP-тестировщик по ней видит точно какой билд в песочнице.
   */
  versionLabel?: string;
  /**
   * v0.3.56: GP Achievements кнопка. Видна только если SDK поддерживает
   * (canUseAchievements()=true) — на Yandex undefined, секция не рендерится.
   * Клик дёргает `data-settings-action="open-achievements"`.
   */
  achievementsLabel?: string;
  /**
   * v0.3.60: «Поддержать автора» кнопка. Видна только если payments available
   * и patronSupport === false. Клик дёргает `data-settings-action="open-patron"`.
   */
  canPurchasePatron?: boolean;
  /**
   * v0.3.60: «Восстановить покупку» кнопка. Видна только если payments available
   * (независимо от patronSupport). Клик дёргает `data-settings-action="restore-patron"`.
   */
  canRestore?: boolean;
  /** i18n labels for patron section */
  supportAuthorLabel?: string;
  supportAuthorSubtitleLabel?: string;
  restorePurchaseLabel?: string;
};

/** Game-style bottom bar, идентичный визуально GameScene action-bar'у. */
function createGameStyleNavHtml(labels: NonNullable<SettingsSceneOverlayParams["gameNavLabels"]>): string {
  // Порядок [undo, hint, home, settings] — чтобы «Меню» (ex-«Настройки»)
  // оказалась в правом нижнем углу, единая thumb-zone позиция на всех
  // сценах (GameScene/MapScene/DiaryScene/SettingsScene).
  const items = [
    { id: "nav-undo-disabled", label: labels.undo, icon: undoIconHtml, disabled: true, active: false },
    { id: "nav-hint-disabled", label: labels.hint, icon: hintIconHtml, disabled: true, active: false },
    { id: "nav-home-map", label: labels.home, icon: homeIconHtml, disabled: false, active: false },
    // «Меню» (ранее «Настройки») активна и одновременно работает как «Назад» —
    // повторный клик сворачивает экран и возвращает игрока в партию.
    { id: "go-back", label: labels.settings, icon: settingsIconHtml, disabled: false, active: true },
  ];
  return [
    '  <div class="game-overlay__nav settings-page__game-nav">',
    ...items.map((item) => {
      const disabledAttr = item.disabled ? ' disabled aria-disabled="true"' : "";
      const classes = [
        "game-overlay__action",
        item.disabled ? "game-overlay__action--disabled" : "",
        item.active ? "game-overlay__action--active" : "",
      ].filter(Boolean).join(" ");
      return `    <button class="${classes}" data-settings-action="${item.id}" type="button" aria-label="${escapeHtml(item.label)}"${disabledAttr}><span class="game-overlay__action-icon">${item.icon}</span><span class="game-overlay__action-label">${escapeHtml(item.label)}</span></button>`;
    }),
    "  </div>",
  ].join("");
}

function renderSlider(
  kind: "sfx" | "music",
  label: string,
  volume: number,
): string {
  const clamped = Math.max(0, Math.min(1, volume));
  const percent = Math.round(clamped * 100);
  return [
    '    <section class="settings-page__section">',
    '      <div class="settings-page__slider-row">',
    `        <span class="settings-page__slider-label">${escapeHtml(label)}</span>`,
    `        <span class="settings-page__slider-value" data-settings-volume-value="${kind}">${percent}%</span>`,
    "      </div>",
    `      <input class="settings-page__slider" type="range" min="0" max="100" step="1" value="${percent}" data-settings-volume="${kind}" />`,
    "    </section>",
  ].join("");
}

export function createSettingsSceneOverlayHtml({
  title,
  languageLabel,
  localeOptions,
  sfxLabel,
  musicLabel,
  soundLabel,
  muteToggleLabel,
  muted,
  sfxVolume,
  musicVolume,
  backLabel,
  gameNavLabels,
  navItems,
  versionLabel,
  achievementsLabel,
  canPurchasePatron,
  canRestore,
  supportAuthorLabel,
  supportAuthorSubtitleLabel,
  restorePurchaseLabel,
}: SettingsSceneOverlayParams): string {
  // Иконка-spearker: sound-on / sound-off. Inline SVG вместо <img>, чтобы
  // не плодить файлы и легко перекрашивать через currentColor.
  const soundIcon = muted
    ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  const muteBtnClass = muted
    ? "settings-page__action settings-page__action--wide settings-page__action--muted"
    : "settings-page__action settings-page__action--wide";
  // Кнопка возврата в GameScene, показывается только если открыли
  // настройки из партии (с `returnTo: "game"`). Иконка стрелки inline SVG.
  const backBtnHtml = backLabel
    ? `  <button class="settings-page__back" type="button" data-settings-action="go-back" aria-label="${escapeHtml(backLabel)}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg><span>${escapeHtml(backLabel)}</span></button>`
    : "";
  // primaryActions блок удалён в v0.3.43 — «Начать»/«Продолжить» теперь
  // живут только на TitleScene. Settings — чистая страница настроек.
  return [
    '<div class="settings-page">',
    backBtnHtml,
    `  <div class="settings-page__title">${escapeHtml(title)}</div>`,
    '  <div class="settings-page__content">',
    '    <section class="settings-page__section">',
    `      <div class="settings-page__label">${escapeHtml(languageLabel)}</div>`,
    '      <div class="settings-page__locale-grid">',
    ...localeOptions.map(
      (opt) =>
        `        <button class="settings-page__action settings-page__locale-button${opt.active ? " settings-page__locale-button--active" : ""}" data-settings-action="locale-${escapeHtml(opt.code)}" type="button">${escapeHtml(opt.label)}</button>`,
    ),
    "      </div>",
    "    </section>",
    // Блок глобального mute: требование GP — явная кнопка управления
    // звуком, которая дёргает gp.sounds.mute()/unmute().
    '    <section class="settings-page__section">',
    `      <div class="settings-page__label">${escapeHtml(soundLabel)}</div>`,
    '      <div class="settings-page__row">',
    `        <button class="${muteBtnClass}" data-settings-action="toggle-mute" type="button" aria-pressed="${muted ? "true" : "false"}">${soundIcon}<span class="settings-page__action-label">${escapeHtml(muteToggleLabel)}</span></button>`,
    "      </div>",
    "    </section>",
    renderSlider("sfx", sfxLabel, sfxVolume),
    renderSlider("music", musicLabel, musicVolume),
    // v0.3.56: GP Achievements — секция видна только если SDK поддерживает.
    // На Yandex achievementsLabel будет undefined → секция не рендерится.
    achievementsLabel
      ? [
          '    <section class="settings-page__section">',
          '      <div class="settings-page__row">',
          `        <button class="settings-page__action settings-page__action--wide" data-settings-action="open-achievements" type="button"><span class="settings-page__action-label">${escapeHtml(achievementsLabel)}</span></button>`,
          "      </div>",
          "    </section>",
        ].join("\n")
      : "",
    // v0.3.60: «Поддержать автора» секция (только если payments available + не patron).
    canPurchasePatron && supportAuthorLabel
      ? [
          '    <section class="settings-page__section settings-page__patron">',
          '      <button class="settings-page__patron-button" type="button"',
          `        data-settings-action="open-patron"`,
          `        aria-label="${escapeHtml(supportAuthorLabel)}">`,
          `        <span class="settings-page__patron-title">${escapeHtml(supportAuthorLabel)}</span>`,
          supportAuthorSubtitleLabel
            ? `        <span class="settings-page__patron-subtitle">${escapeHtml(supportAuthorSubtitleLabel)}</span>`
            : "",
          "      </button>",
          "    </section>",
        ].filter(Boolean).join("\n")
      : "",
    // v0.3.60: «Восстановить покупку» кнопка (только если payments available).
    canRestore && restorePurchaseLabel
      ? [
          '    <section class="settings-page__section">',
          '      <div class="settings-page__row">',
          `        <button class="settings-page__patron-restore" type="button"`,
          `          data-settings-action="restore-patron"`,
          `          aria-label="${escapeHtml(restorePurchaseLabel)}">${escapeHtml(restorePurchaseLabel)}</button>`,
          "      </div>",
          "    </section>",
        ].join("\n")
      : "",
    // Панель «Сброс сохранения» убрана по требованию тестировщиков.
    "  </div>",
    // Версия билда — показываем над нижним nav'ом, чтобы GP-тестировщик
    // однозначно видел какой билд в песочнице.
    versionLabel
      ? `  <div class="settings-page__version">${escapeHtml(versionLabel)}</div>`
      : "",
    // Если открыли из GameScene — game-style nav, из map/archive — map-nav,
    // для startmenu (ни game, ни navItems) — nav скрыт полностью.
    gameNavLabels
      ? createGameStyleNavHtml(gameNavLabels)
      : navItems
        ? createAppNavHtml(navItems)
        : "",
    "</div>",
  ].join("");
}
