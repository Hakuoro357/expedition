import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/ui/escapeHtml";

/**
 * escapeHtml — единая XSS-защита для всех overlay-генераторов (16 файлов
 * вставляют пользовательский / нарративный текст в HTML через template
 * literals). Любая регрессия здесь = XSS sink везде, где есть data-driven
 * текст из points.ts / entries.*.ts / переводов.
 */
describe("escapeHtml", () => {
  it("escapes the five canonical HTML-significant characters", () => {
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
    expect(escapeHtml("&")).toBe("&amp;");
  });

  it("escapes & first to avoid double-encoding", () => {
    // Если бы порядок был обратный (< → &lt; до & → &amp;), то «&» внутри
    // «&lt;» снова экранировался бы и получили бы «&amp;lt;».
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("neutralises a script-tag injection attempt", () => {
    const payload = '<script>alert("XSS")</script>';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });

  it("neutralises img onerror injection attempt", () => {
    const payload = `<img src=x onerror="alert(1)">`;
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<img");
    expect(escaped).not.toContain('"');
    expect(escaped).toContain("&lt;img");
    expect(escaped).toContain("&quot;");
  });

  it("preserves cyrillic and emoji unchanged", () => {
    expect(escapeHtml("Воронов вычёркивает полстраницы.")).toBe(
      "Воронов вычёркивает полстраницы.",
    );
    expect(escapeHtml("🗺️ карта")).toBe("🗺️ карта");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes all five chars when mixed in one string", () => {
    expect(escapeHtml(`a<b>c"d'e&f`)).toBe("a&lt;b&gt;c&quot;d&#39;e&amp;f");
  });
});
