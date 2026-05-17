import { getAppContext } from "@/app/config/appContext";
import { lockClicksFor } from "@/ui/ghostClickGuard";
import { escapeHtml } from "@/ui/escapeHtml";

/**
 * Patron purchase dialog. Single-owner: caller mounts via mountPatronDialog().
 * analytics.track("patron_purchase_open", { source }) fires at mount — callers
 * MUST NOT track the open event separately.
 *
 * Rendered as an absolutely-positioned backdrop over document.body so it works
 * without a Phaser scene reference. Uses same visual language as confirm-dialog.
 */
export function mountPatronDialog(source: "settings" | "post_win_push"): void {
  const { analytics, i18n } = getAppContext();
  const payments = getAppContext().payments;

  analytics.track("patron_purchase_open", { source });

  const backdrop = document.createElement("div");
  backdrop.className = "patron-dialog__overlay";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", escapeHtml(i18n.t("patronDialogTitle")));

  const dialog = document.createElement("div");
  dialog.className = "patron-dialog";

  dialog.innerHTML = buildDialogInnerHtml(i18n, null);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  lockClicksFor(350);

  // Async: fetch native price and update price slot
  if (payments) {
    payments.getPatronPrice().then((price) => {
      if (!backdrop.isConnected) return;
      const priceEl = backdrop.querySelector<HTMLElement>(".patron-dialog__price");
      if (priceEl) {
        if (price) {
          priceEl.textContent = price;
          priceEl.closest<HTMLElement>(".patron-dialog__price-row")?.removeAttribute("hidden");
        } else {
          priceEl.closest<HTMLElement>(".patron-dialog__price-row")?.setAttribute("hidden", "");
        }
      }
    }).catch(() => { /* price unavailable — already hidden */ });
  }

  let settled = false;
  const close = (): void => {
    if (settled) return;
    settled = true;
    lockClicksFor(350);
    backdrop.remove();
  };

  const confirmBtn = dialog.querySelector<HTMLButtonElement>("[data-patron-action='confirm']");
  const cancelBtn = dialog.querySelector<HTMLButtonElement>("[data-patron-action='cancel']");

  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      if (settled) return;
      if (!payments) { close(); return; }
      confirmBtn.disabled = true;
      confirmBtn.classList.add("is-loading");
      payments.purchasePatron(source).then((result) => {
        if (result.ok) {
          close();
          showPatronToast(i18n.t("patronThankYouToast"));
        } else {
          confirmBtn.disabled = false;
          confirmBtn.classList.remove("is-loading");
          showPatronToast(i18n.t("patronError"));
        }
      }).catch(() => {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove("is-loading");
        showPatronToast(i18n.t("patronError"));
      });
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => close());
  }

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
}

function buildDialogInnerHtml(
  i18n: ReturnType<typeof getAppContext>["i18n"],
  _price: string | null,
): string {
  const benefits = [
    i18n.t("patronBenefitAds"),
    i18n.t("patronBenefitCoins"),
    i18n.t("patronBenefitArchive"),
    i18n.t("patronBenefitAchievement"),
  ];
  return [
    `<div class="patron-dialog__title">${escapeHtml(i18n.t("patronDialogTitle"))}</div>`,
    `<div class="patron-dialog__body">${escapeHtml(i18n.t("patronDialogBody"))}</div>`,
    '<ul class="patron-dialog__benefits">',
    ...benefits.map((b) => `  <li class="patron-dialog__benefit">${escapeHtml(b)}</li>`),
    "</ul>",
    '<div class="patron-dialog__price-row" hidden>',
    '  <span class="patron-dialog__price"></span>',
    "</div>",
    '<div class="patron-dialog__actions">',
    `  <button class="patron-dialog__button patron-dialog__button--cancel" type="button" data-patron-action="cancel" aria-label="${escapeHtml(i18n.t("patronCancelButton"))}">${escapeHtml(i18n.t("patronCancelButton"))}</button>`,
    `  <button class="patron-dialog__button patron-dialog__button--confirm" type="button" data-patron-action="confirm" aria-label="${escapeHtml(i18n.t("patronConfirmButton"))}">${escapeHtml(i18n.t("patronConfirmButton"))}</button>`,
    "</div>",
  ].join("\n");
}

/** Simple fixed-position DOM toast (reuses achievement-toast-stack container). */
function showPatronToast(text: string): void {
  if (typeof document === "undefined") return;
  // Reuse the achievement-toast visual style with a simplified patron variant
  const STACK_ID = "achievement-toast-stack";
  let stack = document.getElementById(STACK_ID);
  if (!stack) {
    stack = document.createElement("div");
    stack.id = STACK_ID;
    stack.className = "achievement-toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = "achievement-toast patron-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.innerHTML = `<div class="achievement-toast__copy"><div class="achievement-toast__title">${escapeHtml(text)}</div></div>`;
  stack.insertBefore(toast, stack.firstChild);
  requestAnimationFrame(() => { toast.classList.add("achievement-toast--visible"); });
  window.setTimeout(() => {
    toast.classList.remove("achievement-toast--visible");
    toast.classList.add("achievement-toast--leaving");
    window.setTimeout(() => {
      toast.remove();
      if (stack && stack.children.length === 0) stack.remove();
    }, 400);
  }, 3500);
}

