import "@/styles.css";
import { createGame } from "@/app/bootstrap/createGame";
import { locales } from "@/services/i18n/locales";
import { installGhostClickGuard } from "@/ui/ghostClickGuard";

installGhostClickGuard();

// Требования Яндекс Игр 1.6.1.8 / 1.6.2.7: правый клик и долгое нажатие
// не должны открывать браузерное контекстное меню. CSS user-select: none
// блокирует визуальное выделение, но contextmenu/selectstart прилетают
// отдельно и нуждаются в JS-перехвате.
if (typeof window !== "undefined") {
  window.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("selectstart", (event) => event.preventDefault());
  // На iOS Safari long-press картинок открывает share sheet — gesturestart
  // предотвращает pinch-zoom внутри игры (canvas сам масштабируется через Phaser).
  window.addEventListener("gesturestart", (event) => event.preventDefault());
}

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

