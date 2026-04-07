import "@/styles.css";
import { createGame } from "@/app/bootstrap/createGame";
import { locales } from "@/services/i18n/locales";
import { installGhostClickGuard } from "@/ui/ghostClickGuard";

installGhostClickGuard();

// data-rotate-prompt считывается CSS через @media (orientation: landscape)
// + ::after { content: attr(...) }. Локаль определяем по navigator до того,
// как поднимется SDK — этого достаточно для подсказки «поверни телефон».
{
  const lang = (typeof navigator !== "undefined" ? navigator.language : "ru").slice(0, 2).toLowerCase();
  const locale = lang === "ru" ? "ru" : "en";
  document.body.setAttribute("data-rotate-prompt", locales[locale].rotatePrompt);
}

const container = document.getElementById("app");

if (!container) {
  throw new Error("App root not found");
}

createGame(container);

