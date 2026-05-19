import type { Locale } from "@/services/i18n/locales";
import type { SdkService, ProductInfo, PurchaseResult, PurchasesResult } from "@/services/sdk/SdkService";

const DEV_PURCHASES_KEY = "dev_purchases";

function readDevPurchases(): string[] {
  try {
    const raw = localStorage.getItem(DEV_PURCHASES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // ignore
  }
  return [];
}

function writeDevPurchases(tags: string[]): void {
  try {
    localStorage.setItem(DEV_PURCHASES_KEY, JSON.stringify(tags));
  } catch {
    // ignore
  }
}

/**
 * Development stub — used in local dev server and as factory fallback.
 *
 * Payments in DEV: backed by localStorage so purchases survive page refresh.
 * Uses window.confirm() for purchase flow to simulate the native dialog.
 */
export class DevStubSdkService implements SdkService {
  async init(): Promise<void> {
    // no-op
  }

  isAvailable(): boolean {
    return false;
  }

  signalReady(): void {
    // no-op
  }

  gameplayStart(): void {
    // no-op
  }

  gameplayStop(): void {
    // no-op
  }

  detectLocale(): Locale | null {
    const raw = typeof navigator !== "undefined" ? navigator.language : "";
    if (!raw) return null;
    const lang = raw.slice(0, 2).toLowerCase();
    if (lang === "ru") return "ru";
    if (lang === "tr") return "tr";
    if (lang === "es") return "es";
    if (lang === "pt") return "pt";
    if (lang === "de") return "de";
    if (lang === "fr") return "fr";
    return "en";
  }

  changeLanguage(_locale: Locale): void {
    // no-op
  }

  async showRewardedVideo(): Promise<boolean> {
    return false;
  }

  async showInterstitial(): Promise<void> {
    // no-op
  }

  async getCloudSave(): Promise<string | null> {
    return null;
  }

  async setCloudSave(_json: string): Promise<void> {
    // no-op
  }

  onPause(_callback: () => void): void {
    // no-op
  }

  onResume(_callback: () => void): void {
    // no-op
  }

  onLanguageChange(_callback: (lang: string) => void): void {
    // no-op
  }

  onMuteChange(_callback: (muted: boolean) => void): void {
    // no-op
  }

  isMuted(): boolean {
    return false;
  }

  muteSounds(): void {
    // no-op
  }

  unmuteSounds(): void {
    // no-op
  }

  setSfxMuted(_muted: boolean): void {
    // no-op
  }

  setMusicMuted(_muted: boolean): void {
    // no-op
  }

  showSticky(): void {
    // no-op
  }

  closeSticky(): void {
    // no-op
  }

  refreshSticky(): void {
    // no-op
  }

  async showPreloader(): Promise<boolean> {
    return false;
  }

  canShare(): boolean {
    return false;
  }

  canJoinCommunity(): boolean {
    return false;
  }

  async share(_options: { text?: string; url?: string; image?: string }): Promise<void> {
    // no-op
  }

  async joinCommunity(): Promise<boolean> {
    return false;
  }

  onShareResult(_callback: (success: boolean) => void): void {
    // no-op
  }

  onJoinCommunityResult(_callback: (success: boolean) => void): void {
    // no-op
  }

  canUseAchievements(): boolean {
    return false;
  }

  async fetchAchievements(): Promise<void> {
    // no-op
  }

  getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }> {
    return [];
  }

  async unlockAchievement(_tag: string): Promise<boolean> {
    return false;
  }

  async setAchievementProgress(_tag: string, _progress: number): Promise<boolean> {
    return false;
  }

  async openAchievementsOverlay(): Promise<void> {
    // no-op
  }

  // ============================================================
  // Payments — dev-friendly impl backed by localStorage
  // ============================================================

  canUsePayments(): boolean {
    return import.meta.env.DEV;
  }

  async getProductInfo(tag: string): Promise<ProductInfo | null> {
    if (!import.meta.env.DEV) return null;
    return { tag, title: tag, price: "199 ₽" };
  }

  async purchase(tag: string): Promise<PurchaseResult> {
    if (!import.meta.env.DEV) return { ok: false, reason: "unavailable" };
    const confirmed = window.confirm(`[DevStub] Purchase "${tag}" for 199 RUB?`);
    if (!confirmed) return { ok: false, reason: "cancelled" };
    const existing = readDevPurchases();
    if (!existing.includes(tag)) {
      writeDevPurchases([...existing, tag]);
    }
    return { ok: true };
  }

  async getPurchases(): Promise<PurchasesResult> {
    if (!import.meta.env.DEV) return { ok: true, purchases: [] };
    const tags = readDevPurchases();
    return { ok: true, purchases: tags.map((tag) => ({ tag })) };
  }

  triggerLogin(): Promise<void> {
    // no-op — dev stub doesn't have auth
    return Promise.resolve();
  }
}
