/**
 * Whitelists URLs that are safe to drop into `<img src>` / similar attributes
 * built from template literals. Today every caller passes a bundled asset URL,
 * but `escapeHtml` doesn't strip `javascript:` / `data:text/html` schemes — so
 * any future refactor that lets save data or locale strings reach an image src
 * would create an XSS sink. Funnel everything through this helper instead.
 *
 * Allowed:
 *   - relative paths starting with `/`
 *   - https://
 *   - data:image/*  (used for inlined SVG/PNG portraits)
 * Anything else collapses to a 1x1 transparent gif so the layout doesn't break.
 */
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export function safeImageUrl(url: string | null | undefined): string {
  if (typeof url !== "string" || url.length === 0) return TRANSPARENT_PIXEL;
  // Relative path inside the bundle. ВАЖНО: исключаем protocol-relative
  // (`//evil.com/x.png`) — он матчит startsWith("/") наивно, но позволяет
  // унаследовать схему страницы и тянуть картинку с произвольного хоста.
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  // `./assets/...` — Vite-bundled asset paths (с `base: "./"` в config).
  // Это files, которые Vite сам хеширует и кладёт в dist/. ВАЖНО исключить
  // `..` (path traversal): `../etc/passwd` или `./../x.png` запрещены.
  if (url.startsWith("./") && !url.includes("..")) return url;
  // Same-origin absolute URL. Vite в production резолвит `import.meta.glob`
  // через `new URL(...).href` → получается абсолютный URL вида
  // `http://localhost:4178/assets/voronov-XYZ.webp` или
  // `https://s2.gamepush.com/.../assets/voronov-XYZ.webp` — оба same-origin
  // безопасны для <img>. Проверяем что URL точно начинается с
  // `location.origin + "/"` (защита от protocol-relative и cross-origin).
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    const originPrefix = window.location.origin + "/";
    if (url.startsWith(originPrefix)) return url;
  }
  // Lower-case the scheme prefix only — leave the rest of the URL intact.
  const lower = url.slice(0, 32).toLowerCase().trim();
  if (lower.startsWith("https://")) return url;
  if (lower.startsWith("data:image/")) return url;
  return TRANSPARENT_PIXEL;
}

/**
 * Strict whitelist for achievement icon basenames. Accepts only `<tag>.png`
 * or `<tag>_locked.png` где `<tag>` это lowercase ASCII + cyfry + `_-`.
 * Защищает от path-traversal (../), URL-encoded chars и dynamic-key атак.
 *
 * Prefix `./assets/achievements/` хардкодим внутри — наружу basename только.
 * Per v0.3.58 plan R1-MIN1 + R2-codex-MIN.
 */
const ACHIEVEMENT_ICON_BASENAME = /^[a-z0-9_-]+(_locked)?\.png$/;

export function safeAchievementIconUrl(basename: string, fallback = "locked-generic.png"): string {
  if (typeof basename !== "string" || !ACHIEVEMENT_ICON_BASENAME.test(basename)) {
    return `./assets/achievements/${ACHIEVEMENT_ICON_BASENAME.test(fallback) ? fallback : "locked-generic.png"}`;
  }
  return `./assets/achievements/${basename}`;
}
