import { escapeHtml } from "@/ui/escapeHtml";

export type TitleSceneOverlayParams = {
  title: string;
  subtitle: string;
  newGameLabel: string;
  continueLabel: string;
  /** false → кнопка «Продолжить» дизейблена (первый запуск, prologueShown=false). */
  continueEnabled: boolean;
  settingsLabel: string;
  /**
   * v0.3.51: 4-я кнопка «Сообщество» — рендерим только если SDK
   * платформенно поддерживает joinCommunity И community URL прописан в
   * panel.gamepush.com. Когда условие false — кнопки нет вообще
   * (hero-блок не разрастается).
   */
  showCommunityButton?: boolean;
  communityLabel?: string;
  /**
   * v0.3.58: кнопка «Достижения». Видна только если
   * `sdk.canUseAchievements() && state.progress.prologueShown` (anti-spoiler
   * gate на first-run). На Yandex — всегда отсутствует.
   */
  showAchievementsButton?: boolean;
  achievementsLabel?: string;
};

/**
 * HTML для титульной страницы. Структура минималистичная:
 *   - hero: заголовок «Solitaire: Expedition» + краткий саб-тайтл
 *   - column из 3 кнопок: «Начать», «Продолжить» (опционально dimmed),
 *     «Настройки»
 *
 * Локаль-кнопки сюда НЕ добавляются — они только в SettingsScene
 * (плюс `?lang=` в URL). Цель TitleScene — минимум визуального шума
 * на первом экране, чтобы коллаж-фон работал.
 *
 * Primary-стиль (золотой) у кнопки «Продолжить», если она enabled —
 * это рекомендуемое действие для возвращающегося игрока. На первом
 * запуске «Продолжить» dimmed → primary переключается на «Начать».
 */
export function createTitleSceneOverlayHtml(params: TitleSceneOverlayParams): string {
  const {
    title,
    subtitle,
    newGameLabel,
    continueLabel,
    continueEnabled,
    settingsLabel,
    showCommunityButton,
    communityLabel,
    showAchievementsButton,
    achievementsLabel,
  } = params;
  const newGameIsPrimary = !continueEnabled;
  const continueIsPrimary = continueEnabled;
  const newGameClass = `title-scene__button${newGameIsPrimary ? " title-scene__button--primary" : ""}`;
  const continueClass =
    `title-scene__button${continueIsPrimary ? " title-scene__button--primary" : ""}` +
    `${continueEnabled ? "" : " title-scene__button--disabled"}`;
  const continueDisabledAttr = continueEnabled ? "" : ' disabled aria-disabled="true"';
  return [
    '<div class="title-scene">',
    '  <header class="title-scene__hero">',
    `    <h1 class="title-scene__title">${escapeHtml(title)}</h1>`,
    `    <p class="title-scene__subtitle">${escapeHtml(subtitle)}</p>`,
    "  </header>",
    '  <nav class="title-scene__buttons">',
    `    <button class="${newGameClass}" data-title-action="new-game" type="button">${escapeHtml(newGameLabel)}</button>`,
    `    <button class="${continueClass}" data-title-action="continue" type="button"${continueDisabledAttr}>${escapeHtml(continueLabel)}</button>`,
    showAchievementsButton && achievementsLabel
      ? `    <button class="title-scene__button" data-title-action="achievements" type="button">${escapeHtml(achievementsLabel)}</button>`
      : "",
    `    <button class="title-scene__button" data-title-action="settings" type="button">${escapeHtml(settingsLabel)}</button>`,
    showCommunityButton && communityLabel
      ? `    <button class="title-scene__button" data-title-action="community" type="button">${escapeHtml(communityLabel)}</button>`
      : "",
    "  </nav>",
    "</div>",
  ].join("");
}
