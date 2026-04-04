import { describe, expect, it } from "vitest";
import { createButtonLabelsOverlayHtml } from "@/ui/buttonLabelsOverlay";

describe("buttonLabelsOverlay", () => {
  it("renders all provided labels", () => {
    const html = createButtonLabelsOverlayHtml([
      { label: "Играть", x: 195, y: 480, width: 230, height: 52 },
      { label: "Дневник", x: 195, y: 608, width: 230, height: 52 },
    ]);

    expect(html).toContain("Играть");
    expect(html).toContain("Дневник");
    expect(html).toContain("left:80px");
  });
});
