import { lockClicksFor } from "@/ui/ghostClickGuard";

type ShowConfirmDialogParams = {
  /** Куда монтировать — обычно `overlay.getHostElement()` из canvasOverlay. */
  parent: HTMLElement;
  title: string;
  message: string;
  okLabel: string;
  cancelLabel: string;
};

/**
 * Inline DOM-модалка подтверждения. Возвращает Promise<boolean>:
 *   true  — игрок нажал OK
 *   false — Cancel / клик по backdrop / Escape
 *
 * Монтируется в `parent` (host overlay'а), т.к. host уже абсолютно
 * позиционирован поверх canvas'а и повторяет его рект. Backdrop
 * растягивается на 100% host'а — получается затемнение ровно
 * поверх игрового холста.
 *
 * ghostClickGuard.lockClicksFor(300) вызывается сразу после монтажа,
 * чтобы tap, открывший dialog, не проходил дальше и случайно не
 * активировал кнопку под пальцем.
 */
export function showConfirmDialog({
  parent,
  title,
  message,
  okLabel,
  cancelLabel,
}: ShowConfirmDialogParams): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-dialog-backdrop";
    backdrop.style.pointerEvents = "auto";

    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog";

    const titleEl = document.createElement("div");
    titleEl.className = "confirm-dialog__title";
    titleEl.textContent = title;

    const messageEl = document.createElement("div");
    messageEl.className = "confirm-dialog__message";
    messageEl.textContent = message;

    const actions = document.createElement("div");
    actions.className = "confirm-dialog__actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "confirm-dialog__button confirm-dialog__button--cancel";
    cancelBtn.textContent = cancelLabel;

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "confirm-dialog__button confirm-dialog__button--ok";
    okBtn.textContent = okLabel;

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);

    dialog.appendChild(titleEl);
    dialog.appendChild(messageEl);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);
    parent.appendChild(backdrop);

    // Ghost-click защита: tap, открывший диалог, мог не до конца
    // зафиналиться — без lock он ударит по кнопке dialog.
    lockClicksFor(300);

    let settled = false;
    const cleanup = (result: boolean): void => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      resolve(result);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(false);
      }
    };

    backdrop.addEventListener("click", (event) => {
      // Клик по самому backdrop (не по dialog) — отмена.
      if (event.target === backdrop) {
        cleanup(false);
      }
    });
    cancelBtn.addEventListener("click", () => cleanup(false));
    okBtn.addEventListener("click", () => cleanup(true));
    document.addEventListener("keydown", onKeyDown);
  });
}
