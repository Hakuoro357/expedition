import { createAppNavHtml, type AppNavItem } from "@/ui/appNavHtml";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type SettingsSceneOverlayParams = {
  title: string;
  languageLabel: string;
  resetLabel: string;
  ruLabel: string;
  enLabel: string;
  trLabel: string;
  sfxLabel: string;
  musicLabel: string;
  /** 0..1 */
  sfxVolume: number;
  /** 0..1 */
  musicVolume: number;
  navItems: AppNavItem[];
};

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
  resetLabel,
  ruLabel,
  enLabel,
  trLabel,
  sfxLabel,
  musicLabel,
  sfxVolume,
  musicVolume,
  navItems,
}: SettingsSceneOverlayParams): string {
  return [
    '<div class="settings-page">',
    `  <div class="settings-page__title">${escapeHtml(title)}</div>`,
    '  <div class="settings-page__content">',
    '    <section class="settings-page__section">',
    `      <div class="settings-page__label">${escapeHtml(languageLabel)}</div>`,
    '      <div class="settings-page__row settings-page__row--double">',
    `        <button class="settings-page__action" data-settings-action="locale-ru" type="button">${escapeHtml(ruLabel)}</button>`,
    `        <button class="settings-page__action" data-settings-action="locale-en" type="button">${escapeHtml(enLabel)}</button>`,
    `        <button class="settings-page__action" data-settings-action="locale-tr" type="button">${escapeHtml(trLabel)}</button>`,
    "      </div>",
    "    </section>",
    renderSlider("sfx", sfxLabel, sfxVolume),
    renderSlider("music", musicLabel, musicVolume),
    '    <section class="settings-page__section">',
    `      <div class="settings-page__label">${escapeHtml(resetLabel)}</div>`,
    '      <div class="settings-page__row">',
    `        <button class="settings-page__action settings-page__action--wide settings-page__action--danger" data-settings-action="reset-save" type="button">${escapeHtml(resetLabel)}</button>`,
    "      </div>",
    "    </section>",
    "  </div>",
    createAppNavHtml(navItems),
    "</div>",
  ].join("");
}
