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
  soundLabel: string;
  resetLabel: string;
  ruLabel: string;
  enLabel: string;
  soundToggleLabel: string;
  navItems: AppNavItem[];
};

export function createSettingsSceneOverlayHtml({
  title,
  languageLabel,
  soundLabel,
  resetLabel,
  ruLabel,
  enLabel,
  soundToggleLabel,
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
    "      </div>",
    "    </section>",
    '    <section class="settings-page__section">',
    `      <div class="settings-page__label">${escapeHtml(soundLabel)}</div>`,
    '      <div class="settings-page__row">',
    `        <button class="settings-page__action settings-page__action--wide" data-settings-action="toggle-sound" type="button">${escapeHtml(soundToggleLabel)}</button>`,
    "      </div>",
    "    </section>",
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
