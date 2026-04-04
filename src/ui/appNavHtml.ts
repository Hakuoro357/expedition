import homeIconHtml from "../assets/ui/nav-icons/home.svg?raw";
import archiveIconHtml from "../assets/ui/nav-icons/archive.svg?raw";
import routeDayIconHtml from "../assets/ui/nav-icons/route-day.svg?raw";
import settingsIconHtml from "../assets/ui/nav-icons/settings.svg?raw";

export type AppNavItem = {
  id: "home" | "archive" | "daily" | "settings";
  label: string;
  active: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
    '<div class="route-overlay__nav">',
    ...navItems.map(
      (item) => `
        <div class="route-overlay__nav-item${item.active ? " route-overlay__nav-item--active" : ""}" data-app-nav="${escapeHtml(item.id)}">
          <span class="route-overlay__nav-icon" aria-label="${escapeHtml(item.label)}">${createAppNavIconHtml(item.id)}</span>
        </div>`,
    ),
    "</div>",
  ].join("");
}
