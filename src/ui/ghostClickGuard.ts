// На мобильных браузерах после tap-а в DOM-кнопку браузер
// иногда дополнительно синтезирует click уже на новом DOM-узле,
// который оказался под пальцем после ребилда сцены. В практике
// это ловит, например, так: тап «Архив» в нижнем меню карты →
// открывается архив → ghost-click попадает на «Назад» в нижнем
// меню архива (та же позиция) → нас выкидывает обратно.
//
// Решение: после переходов сцен включаем короткий капчер-фазный
// глушитель кликов на window. Он съедает любой click в течение
// `lockoutMs` миллисекунд от установки.

let lockoutUntil = 0;
let installed = false;

export function lockClicksFor(ms: number): void {
  const target = Date.now() + ms;
  if (target > lockoutUntil) {
    lockoutUntil = target;
  }
}

export function installGhostClickGuard(): void {
  if (installed || typeof window === "undefined") {
    return;
  }
  installed = true;
  const handler = (event: Event): void => {
    if (Date.now() < lockoutUntil) {
      event.stopPropagation();
      event.preventDefault();
    }
  };
  window.addEventListener("click", handler, true);
}
