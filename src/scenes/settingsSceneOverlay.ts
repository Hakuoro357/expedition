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
   * Блок primary-actions («Новая игра» / «Продолжить») сверху контентной
   * области. Если undefined — блок не рендерим (например в dev-preview
   * или тестах). По умолчанию добавляется из SettingsScene.
   */
  primaryActions?: {
    newGameLabel: string;
    continueLabel: string;
    /** true — кнопка «Продолжить» визуально/функционально задизейблена (первый запуск). */
    continueDisabled: boolean;
    /**
     * Какая из кнопок — визуально primary (золотая).
     * Если есть активная партия/прогресс — «Продолжить» становится
     * рекомендованным действием, и золотым выделяется она. Иначе
     * (первый запуск, прогресса нет) — primary у «Новая игра».
     */
    primaryButton: "new-game" | "continue";
  };
  /**
   * Если undefined — bottom-nav не рендерим вообще. Используется для
   * режима `startmenu` (стартовое меню не показывает archive/daily,
   * только primary-actions).
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
  primaryActions,
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
  const primaryActionsHtml = primaryActions
    ? (() => {
        // Порядок кнопок фиксированный: «Новая игра» сверху, «Продолжить»
        // ниже — одинаковый layout во всех контекстах. Только стиль primary
        // (золотой) переключается на ту кнопку, которая рекомендована
        // в текущем состоянии (есть прогресс → continue; чистый старт →
        // new-game).
        const newGameIsPrimary = primaryActions.primaryButton === "new-game";
        const continueIsPrimary = primaryActions.primaryButton === "continue";
        const newGameClass = `settings-page__primary-button${newGameIsPrimary ? " settings-page__primary-button--primary" : ""}`;
        const continueClass = `settings-page__primary-button${continueIsPrimary ? " settings-page__primary-button--primary" : ""}${primaryActions.continueDisabled ? " settings-page__primary-button--disabled" : ""}`;
        return [
          '    <section class="settings-page__section settings-page__primary-actions">',
          `      <button class="${newGameClass}" data-settings-action="primary-new-game" type="button">${escapeHtml(primaryActions.newGameLabel)}</button>`,
          `      <button class="${continueClass}" data-settings-action="primary-continue" type="button"${primaryActions.continueDisabled ? ' disabled aria-disabled="true"' : ""}>${escapeHtml(primaryActions.continueLabel)}</button>`,
          "    </section>",
        ].join("");
      })()
    : "";
  return [
    '<div class="settings-page">',
    backBtnHtml,
    `  <div class="settings-page__title">${escapeHtml(title)}</div>`,
    '  <div class="settings-page__content">',
    primaryActionsHtml,
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
