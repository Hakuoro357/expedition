import homeIconHtml from "../assets/ui/nav-icons/home.svg?raw";
import archiveIconHtml from "../assets/ui/nav-icons/archive.svg?raw";
import routeDayIconHtml from "../assets/ui/nav-icons/route-day.svg?raw";
import settingsIconHtml from "../assets/ui/nav-icons/settings.svg?raw";

import { escapeHtml } from "@/ui/escapeHtml";

export type AppNavItem = {
  id: "home" | "archive" | "daily" | "settings";
  label: string;
  active: boolean;
};

export function createAppNavIconHtml(id: AppNavItem["id"]): string {
  switch (id) {
    case "home":
      return homeIconHtml;
    case "archive":
      return archiveIconHtml;
    case "daily":
      return routeDayIconHtml;
    case "settings":
      return settingsIconHtml;
  }
}

export function createAppNavHtml(navItems: AppNavItem[]): string {
  return [
    '<div class="app-nav">',
    ...navItems.map(
      (item) => `
        <button class="app-nav__item${item.active ? " app-nav__item--active" : ""}" data-app-nav="${escapeHtml(item.id)}" type="button">
          <span class="app-nav__icon">${createAppNavIconHtml(item.id)}</span>
          <span class="app-nav__label">${escapeHtml(item.label)}</span>
        </button>`,
    ),
    "</div>",
  ].join("");
}
