// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mountPatronDialog } from "@/ui/patronDialog";
import * as appContextModule from "@/app/config/appContext";

// Minimal i18n stub
const i18nStub = {
  t: (key: string) => key,
  getLocale: () => "en" as const,
  getNarrativeLocale: () => "global" as const,
  setLocale: vi.fn(),
  currentLocale: () => "en" as const,
};

const analyticsMock = { track: vi.fn() };

const paymentsMock = {
  getPatronPrice: vi.fn().mockResolvedValue("199 ₽"),
  purchasePatron: vi.fn().mockResolvedValue({ ok: true }),
  canPurchasePatron: vi.fn().mockReturnValue(true),
  canUsePayments: vi.fn().mockReturnValue(true),
  restorePatronManual: vi.fn(),
  onChange: vi.fn().mockReturnValue(() => {}),
};

const contextStub = {
  i18n: i18nStub,
  analytics: analyticsMock,
  payments: paymentsMock,
  save: { load: vi.fn().mockReturnValue({ progress: { patronSupport: false } }) },
  sound: {},
  sdk: {},
  ads: {},
  achievements: {},
} as unknown as ReturnType<typeof appContextModule.getAppContext>;

beforeEach(() => {
  vi.spyOn(appContextModule, "getAppContext").mockReturnValue(contextStub);
  analyticsMock.track.mockClear();
  paymentsMock.purchasePatron.mockReset();
  paymentsMock.purchasePatron.mockResolvedValue({ ok: true });
  paymentsMock.getPatronPrice.mockReset();
  paymentsMock.getPatronPrice.mockResolvedValue("199 ₽");
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("mountPatronDialog", () => {
  it("renders title", () => {
    mountPatronDialog("settings");
    const title = document.querySelector(".patron-dialog__title");
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe("patronDialogTitle");
  });

  it("renders body text", () => {
    mountPatronDialog("settings");
    const body = document.querySelector(".patron-dialog__body");
    expect(body).not.toBeNull();
    expect(body!.textContent).toBe("patronDialogBody");
  });

  it("renders 4 benefit items", () => {
    mountPatronDialog("settings");
    const items = document.querySelectorAll(".patron-dialog__benefit");
    expect(items).toHaveLength(4);
  });

  it("renders confirm and cancel buttons with data-patron-action", () => {
    mountPatronDialog("settings");
    const confirm = document.querySelector("[data-patron-action='confirm']");
    const cancel = document.querySelector("[data-patron-action='cancel']");
    expect(confirm).not.toBeNull();
    expect(cancel).not.toBeNull();
  });

  it("confirm button has aria-label", () => {
    mountPatronDialog("settings");
    const confirm = document.querySelector<HTMLButtonElement>("[data-patron-action='confirm']");
    expect(confirm?.getAttribute("aria-label")).toBeTruthy();
  });

  it("cancel button has aria-label", () => {
    mountPatronDialog("settings");
    const cancel = document.querySelector<HTMLButtonElement>("[data-patron-action='cancel']");
    expect(cancel?.getAttribute("aria-label")).toBeTruthy();
  });

  it("price slot initially hidden", () => {
    mountPatronDialog("settings");
    const priceRow = document.querySelector(".patron-dialog__price-row");
    expect(priceRow).not.toBeNull();
    expect(priceRow!.hasAttribute("hidden")).toBe(true);
  });

  it("calls analytics.track with patron_purchase_open and source at mount", () => {
    mountPatronDialog("settings");
    expect(analyticsMock.track).toHaveBeenCalledWith("patron_purchase_open", { source: "settings" });
    expect(analyticsMock.track).toHaveBeenCalledTimes(1);
  });

  it("calls analytics.track with correct source for post_win_push", () => {
    mountPatronDialog("post_win_push");
    expect(analyticsMock.track).toHaveBeenCalledWith("patron_purchase_open", { source: "post_win_push" });
  });

  it("dialog has role=dialog and aria-modal", () => {
    mountPatronDialog("settings");
    const backdrop = document.querySelector("[role='dialog']");
    expect(backdrop).not.toBeNull();
    expect(backdrop!.getAttribute("aria-modal")).toBe("true");
  });

  it("clicking cancel removes the dialog", () => {
    mountPatronDialog("settings");
    const cancel = document.querySelector<HTMLButtonElement>("[data-patron-action='cancel']");
    cancel?.click();
    expect(document.querySelector(".patron-dialog__overlay")).toBeNull();
  });

  it("clicking backdrop removes the dialog", () => {
    mountPatronDialog("settings");
    const backdrop = document.querySelector<HTMLElement>(".patron-dialog__overlay");
    // Simulate click directly on backdrop (not on child)
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: backdrop, writable: false });
    backdrop?.dispatchEvent(event);
    expect(document.querySelector(".patron-dialog__overlay")).toBeNull();
  });

  it("confirm click calls payments.purchasePatron with source", async () => {
    mountPatronDialog("settings");
    const confirm = document.querySelector<HTMLButtonElement>("[data-patron-action='confirm']");
    confirm?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(paymentsMock.purchasePatron).toHaveBeenCalledWith("settings");
  });
});
