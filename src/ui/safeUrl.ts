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
  // Lower-case the scheme prefix only — leave the rest of the URL intact.
  const lower = url.slice(0, 32).toLowerCase().trim();
  if (lower.startsWith("https://")) return url;
  if (lower.startsWith("data:image/")) return url;
  return TRANSPARENT_PIXEL;
}
