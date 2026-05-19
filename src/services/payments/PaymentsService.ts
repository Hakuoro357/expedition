import type { AnalyticsService } from "@/services/analytics/AnalyticsService";
import type { SaveService } from "@/services/save/SaveService";
import type { SdkService, PurchasesResult } from "@/services/sdk/SdkService";
import type { AchievementsReconciler } from "@/services/achievements/AchievementsReconciler";
import type { AdsService } from "@/services/ads/AdsService";
import { withTimeout } from "./withTimeout";

export const PATRON_TAG = "patron_support";
export const PATRON_BONUS_COINS = 300;
const PATRON_LOCAL_KEY = "isPatron";
const RESTORE_BOOT_TIMEOUT_MS = 1500;
const RESTORE_MANUAL_TIMEOUT_MS = 10000; // U3

// PurchasesFailureReason is Extract<PurchasesResult, { ok: false }>["reason"]
type PurchasesFailureReason = Extract<PurchasesResult, { ok: false }>["reason"];

export type RestoreManualResult =
  | { ok: true; alreadyActive: boolean; mismatch?: boolean }
  | { ok: false; alreadyActive: boolean; reason: PurchasesFailureReason | "not_found" };

export class PaymentsService {
  private inFlight = false;
  private listeners = new Set<(isPatron: boolean) => void>();

  constructor(
    private readonly sdk: SdkService,
    private readonly analytics: AnalyticsService,
    private readonly save: SaveService,
    private readonly achievements: AchievementsReconciler,
    private readonly ads: AdsService,
  ) {}

  canUsePayments(): boolean { return this.sdk.canUsePayments(); }
  canPurchasePatron(): boolean {
    return this.canUsePayments() && !this.save.load().progress.patronSupport;
  }

  async getPatronPrice(): Promise<string | null> {
    try {
      const info = await this.sdk.getProductInfo(PATRON_TAG);
      return info?.price ?? null;
    } catch (err) { console.warn("[payments.getPatronPrice]", err); return null; }
  }

  onChange(listener: (isPatron: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * U4 (R7-ceiling fix): helper includes `achievements.reconcile()` to
   * repair missing patron achievement on preserved paths (post-crash / migration edge).
   *
   * U1 (R7-ceiling fix): called BEFORE early return on unavailable payments.
   * Existing patrons on Crazy/Poki / temporary SDK failure don't see ads.
   */
  private confirmPatronEntitlement(origin: "purchase" | "restore" | "preserved"): void {
    this.ads.markPatronConfirmed();
    if (origin === "purchase") {
      this.achievements.markPatronJustActivated();
    }
    this.achievements.reconcile(this.save.load()); // U4: idempotent repair
  }

  async purchasePatron(source: "settings" | "post_win_push" | "map_top"): Promise<{ ok: boolean }> {
    if (this.inFlight) {
      this.analytics.track("patron_purchase_blocked", { source, reason: "in_flight" });
      return { ok: false };
    }
    if (!this.canPurchasePatron()) {
      this.analytics.track("patron_purchase_blocked", { source, reason: "not_eligible" });
      return { ok: false };
    }
    this.inFlight = true;
    try {
      this.analytics.track("patron_purchase_attempt", { source });
      const result = await this.sdk.purchase(PATRON_TAG);
      if (!result.ok) {
        const event = result.reason === "cancelled"
          ? "patron_purchase_cancelled" : "patron_purchase_error";
        this.analytics.track(event, { source, reason: result.reason ?? "unknown" });
        return { ok: false };
      }
      await this.activatePatron("purchase");
      this.analytics.track("patron_purchase_success", { source });
      return { ok: true };
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * U3 (R7-ceiling fix): wrap getPurchases in timeout. SDK hang does NOT
   * permanently lock inFlight.
   */
  async restorePatronManual(): Promise<RestoreManualResult> {
    if (this.inFlight) {
      this.analytics.track("patron_purchase_blocked", { source: "restore", reason: "in_flight" });
      return { ok: false, alreadyActive: false, reason: "error" };
    }
    this.inFlight = true;
    try {
      const localPatron = this.save.load().progress.patronSupport === true;
      // U3: bounded
      const result = await withTimeout(
        this.sdk.getPurchases(),
        RESTORE_MANUAL_TIMEOUT_MS,
        { ok: false, reason: "timeout" as const } as PurchasesResult,
      );

      if (!result.ok) {
        this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: "manual" });
        if (localPatron) this.confirmPatronEntitlement("preserved"); // V1
        return { ok: false, alreadyActive: localPatron, reason: result.reason };
      }
      const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

      if (!platformPatron && localPatron) {
        console.warn("[payments] manual restore: platform NOT patron, local says yes");
        this.analytics.track("patron_purchase_restore", { found: false, source: "manual", note: "local_only" });
        this.confirmPatronEntitlement("preserved");
        return { ok: true, alreadyActive: true, mismatch: true };
      }
      if (platformPatron && !localPatron) {
        await this.activatePatron("restore");
        this.analytics.track("patron_purchase_restore", { found: true, source: "manual" });
        return { ok: true, alreadyActive: false };
      }
      if (platformPatron && localPatron) {
        this.confirmPatronEntitlement("preserved");
        return { ok: true, alreadyActive: true };
      }
      this.analytics.track("patron_purchase_restore", { found: false, source: "manual" });
      return { ok: false, alreadyActive: false, reason: "not_found" };
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * U1 (R7-ceiling fix): confirm local entitlement BEFORE early return on
   * `!canUsePayments`. Existing patrons on Crazy/Poki/etc all paths get sticky-close.
   *
   * U2 (R7-ceiling fix): timeout does NOT consume SDK result. Late positive SDK
   * response can still activate. Only optimistic-clear is timeout-bound.
   */
  async restoreOnBoot(): Promise<void> {
    // U1: confirm local entitlement first, regardless of payments availability
    const localPatron = this.save.load().progress.patronSupport === true;
    if (localPatron) {
      this.confirmPatronEntitlement("preserved");
    }

    if (!this.canUsePayments()) {
      // U1: ads already confirmed above for local-patron case
      return;
    }

    let localHint = false;
    try {
      if (typeof localStorage !== "undefined") {
        localHint = localStorage.getItem(PATRON_LOCAL_KEY) === "true";
      }
    } catch { /* private mode */ }

    if (localHint && !localPatron) {
      console.info("[payments] local hint optimistic ad-suppression");
      this.ads.setPatronOptimistic();
    }

    const ctx = { localHint, localPatron, source: "boot" as const };

    // U2: separate timeout-for-optimistic-clear from SDK-result-processing.
    // SDK promise is processed via .then() ALWAYS, even after timeout.
    // Optimistic-clear at timeout — best-effort cleanup only.
    let sdkResolved = false;

    this.sdk.getPurchases()
      .then(result => {
        sdkResolved = true;
        return this.processRestoreResult(result, ctx);
      })
      .catch(err => {
        console.warn("[payments] getPurchases threw", err);
        sdkResolved = true;
        return this.processRestoreResult({ ok: false, reason: "error" }, ctx);
      });

    // Bounded boot — return control after timeout regardless
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!sdkResolved && ctx.localHint && !ctx.localPatron) {
          // U2: only clear optimistic if SDK hasn't responded yet AND no local entitlement
          console.info("[payments] boot timeout — clearing optimistic suppression while SDK still pending");
          try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch { /* ignore */ }
          this.ads.clearPatronOptimistic();
        }
        resolve();
      }, RESTORE_BOOT_TIMEOUT_MS);
    });
  }

  private async processRestoreResult(
    result: PurchasesResult,
    ctx: { localHint: boolean; localPatron: boolean; source: "boot" | "manual" },
  ): Promise<void> {
    if (!result.ok) {
      this.analytics.track("patron_purchase_restore", { found: false, reason: result.reason, source: ctx.source });
      if (ctx.localPatron) {
        this.confirmPatronEntitlement("preserved");
      } else if (ctx.localHint) {
        console.info("[payments] SDK failed, local hint unverified — clearing optimistic");
        try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch { /* ignore */ }
        this.ads.clearPatronOptimistic();
      }
      return;
    }
    const platformPatron = result.purchases.some(p => p.tag === PATRON_TAG);

    if (platformPatron && !ctx.localPatron) {
      await this.activatePatron("restore");
      this.analytics.track("patron_purchase_restore", { found: true, source: ctx.source });
      return;
    }
    if (!platformPatron && ctx.localPatron) {
      console.warn("[payments] platform NOT patron, local says yes — possible refund (observability)");
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "local_only" });
      this.confirmPatronEntitlement("preserved");
      return;
    }
    if (!platformPatron && ctx.localHint && !ctx.localPatron) {
      console.info("[payments] local hint disproven — clearing optimistic");
      try { localStorage.removeItem(PATRON_LOCAL_KEY); } catch { /* ignore */ }
      this.ads.clearPatronOptimistic();
      this.analytics.track("patron_purchase_restore", { found: false, source: ctx.source, note: "hint_disproven" });
      return;
    }
    if (platformPatron && ctx.localPatron) {
      this.confirmPatronEntitlement("preserved");
      return;
    }
  }

  private async activatePatron(origin: "purchase" | "restore"): Promise<void> {
    const before = this.save.load().progress;
    if (before.patronSupport && before.patronBonusGranted) {
      this.confirmPatronEntitlement(origin === "purchase" ? "purchase" : "preserved");
      return;
    }

    this.save.updateProgress((p) => ({
      ...p,
      patronSupport: true,
      patronBonusGranted: true,
      patronGrantedAt: p.patronGrantedAt ?? Date.now(),
      coins: p.patronBonusGranted ? p.coins : (p.coins ?? 0) + PATRON_BONUS_COINS,
    }));

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PATRON_LOCAL_KEY, "true");
      }
    } catch { /* ignore */ }

    this.confirmPatronEntitlement(origin);
    this.listeners.forEach((fn) => fn(true));

    try { await this.save.flush(); }
    catch (err) { console.error("[payments] activate flush failed; local state holds", err); }
  }
}
