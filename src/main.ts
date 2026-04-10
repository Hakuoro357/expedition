import "@/styles.css";
import { createGame } from "@/app/bootstrap/createGame";

// JS/CSS бандл загружен — фаза 0–10% экрана загрузки.
// Останавливаем fake-progress анимацию и ставим точное значение.
const _loadBar = document.getElementById("loading-bar");
if (_loadBar) { _loadBar.style.animation = "none"; _loadBar.style.width = "10%"; }
import { locales } from "@/services/i18n/locales";
import { installGhostClickGuard } from "@/ui/ghostClickGuard";

installGhostClickGuard();

// Глобальный перехват unhandled promise rejections. В draft-превью
// Яндекс Игр мы видели "Uncaught (in promise) undefined", но без стека
// невозможно понять, где промис отклоняется без reason. Логируем
// reason, stack и promise, чтобы следующее появление было диагностируемым.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const stack =
      reason && typeof reason === "object" && "stack" in reason
        ? (reason as { stack?: string }).stack
        : undefined;
    console.warn("[unhandledrejection]", {
      reason,
      stack,
      type: typeof reason,
    });
    // Не вызываем event.preventDefault() — пусть браузер всё равно
    // сообщает в консоль, но наш лог добавит контекст.
  });
}

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

