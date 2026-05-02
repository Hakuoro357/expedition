import { describe, it, expect } from "vitest";
import { safeImageUrl } from "@/ui/safeUrl";

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * safeImageUrl — белый список схем для `<img src>`. Любой не-whitelisted
 * URL должен схлопнуться в прозрачный пиксель, иначе появляется XSS-сток
 * (javascript:, data:text/html, file:// и т.д.). Используется для портретов
 * персонажей и грид-картинок артефактов из bundle, а также для путей,
 * прокинутых из data-файлов.
 */
describe("safeImageUrl", () => {
  it("allows relative paths starting with /", () => {
    expect(safeImageUrl("/assets/voronov.webp")).toBe("/assets/voronov.webp");
  });

  it("allows https:// urls", () => {
    expect(safeImageUrl("https://cdn.example.com/x.png")).toBe(
      "https://cdn.example.com/x.png",
    );
    expect(safeImageUrl("HTTPS://CDN.example.com/x.png")).toBe(
      "HTTPS://CDN.example.com/x.png",
    );
  });

  it("allows data:image/* schemes (used for inlined SVG/PNG)", () => {
    expect(safeImageUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(safeImageUrl("data:image/svg+xml,%3Csvg/%3E")).toBe(
      "data:image/svg+xml,%3Csvg/%3E",
    );
  });

  it("blocks javascript: scheme (XSS sink)", () => {
    expect(safeImageUrl("javascript:alert(1)")).toBe(TRANSPARENT_PIXEL);
    expect(safeImageUrl("JavaScript:alert(1)")).toBe(TRANSPARENT_PIXEL);
    expect(safeImageUrl("  javascript:alert(1)")).toBe(TRANSPARENT_PIXEL);
  });

  it("blocks data:text/html (XSS sink)", () => {
    expect(safeImageUrl("data:text/html,<script>alert(1)</script>")).toBe(
      TRANSPARENT_PIXEL,
    );
    expect(safeImageUrl("DATA:text/html,...")).toBe(TRANSPARENT_PIXEL);
  });

  it("blocks file:// and other unknown schemes", () => {
    expect(safeImageUrl("file:///etc/passwd")).toBe(TRANSPARENT_PIXEL);
    expect(safeImageUrl("ftp://example.com/x.png")).toBe(TRANSPARENT_PIXEL);
    expect(safeImageUrl("vbscript:msgbox(1)")).toBe(TRANSPARENT_PIXEL);
  });

  it("blocks plain http:// (not on whitelist — only https)", () => {
    expect(safeImageUrl("http://example.com/x.png")).toBe(TRANSPARENT_PIXEL);
  });

  it("returns transparent pixel for null / undefined / empty / non-string", () => {
    expect(safeImageUrl(null)).toBe(TRANSPARENT_PIXEL);
    expect(safeImageUrl(undefined)).toBe(TRANSPARENT_PIXEL);
    expect(safeImageUrl("")).toBe(TRANSPARENT_PIXEL);
    expect(safeImageUrl(42 as unknown as string)).toBe(TRANSPARENT_PIXEL);
  });

  it("blocks protocol-relative urls (`//evil.com/x.png`)", () => {
    // Эти URL могут унаследовать протокол страницы; не whitelisted —
    // должен схлопнуться в transparent. Не подпадает ни под `/` (одиночный
    // префикс — ок) ни под `https://`.
    expect(safeImageUrl("//evil.com/x.png")).toBe(TRANSPARENT_PIXEL);
  });
});
