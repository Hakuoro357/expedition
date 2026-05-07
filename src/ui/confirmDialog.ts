import { lockClicksFor } from "@/ui/ghostClickGuard";

type BaseDialogParams = {
  /** Куда монтировать — обычно `overlay.getHostElement()` из canvasOverlay. */
  parent: HTMLElement;
  title: string;
  message: string;
  okLabel: string;
};

type ShowConfirmDialogParams = BaseDialogParams & {
  cancelLabel: string;
};

type ShowInfoDialogParams = BaseDialogParams;

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
export function showConfirmDialog(params: ShowConfirmDialogParams): Promise<boolean> {
  return openDialog({
    parent: params.parent,
    title: params.title,
    message: params.message,
    okLabel: params.okLabel,
    cancelLabel: params.cancelLabel,
    closeOnBackdrop: true,
    allowEscape: true,
  });
}

/**
 * Info-only модалка с одной кнопкой OK. Возвращает Promise<void>,
 * который резолвится при закрытии (OK / backdrop / Escape).
 *
 * Используется для разовых уведомлений без выбора — например
 * «Возможных ходов нет» при клике на hint, когда подсказок не
 * осталось (см. GameScene.handleHintAction). Кнопка hint всегда
 * активна (no-cheating-tell), но без модалки click был бы немой.
 */
export function showInfoDialog(params: ShowInfoDialogParams): Promise<void> {
  return openDialog({
    parent: params.parent,
    title: params.title,
    message: params.message,
    okLabel: params.okLabel,
    cancelLabel: undefined,
    closeOnBackdrop: true,
    allowEscape: true,
  }).then(() => undefined);
}

type OpenDialogParams = {
  parent: HTMLElement;
  title: string;
  message: string;
  okLabel: string;
  /** undefined → single-OK режим (info dialog). */
  cancelLabel: string | undefined;
  closeOnBackdrop: boolean;
  allowEscape: boolean;
};

function openDialog(params: OpenDialogParams): Promise<boolean> {
  const { parent, title, message, okLabel, cancelLabel, closeOnBackdrop, allowEscape } = params;
  const hasCancel = cancelLabel !== undefined;

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

    let cancelBtn: HTMLButtonElement | null = null;
    if (hasCancel) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "confirm-dialog__button confirm-dialog__button--cancel";
      cancelBtn.textContent = cancelLabel as string;
      actions.appendChild(cancelBtn);
    }

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "confirm-dialog__button confirm-dialog__button--ok";
    okBtn.textContent = okLabel;
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
      if (allowEscape && event.key === "Escape") {
        event.preventDefault();
        // Для info-dialog Escape тоже закрывает (как OK для single-button —
        // resolved-result игнорируется в showInfoDialog).
        cleanup(false);
      }
    };

    backdrop.addEventListener("click", (event) => {
      // Клик по самому backdrop (не по dialog) — закрытие.
      if (event.target === backdrop && closeOnBackdrop) {
        cleanup(false);
      }
    });
    if (cancelBtn) cancelBtn.addEventListener("click", () => cleanup(false));
    okBtn.addEventListener("click", () => cleanup(true));
    document.addEventListener("keydown", onKeyDown);
  });
}
