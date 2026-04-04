import { describe, expect, it } from "vitest";
import {
  createArtifactCardOverlayHtml,
  getArtifactCardLayout,
} from "@/scenes/artifactCardOverlay";

describe("artifactCardOverlay", () => {
  it("renders the artifact title and description", () => {
    const html = createArtifactCardOverlayHtml({
      title: "Штамп экспедиции",
      description: "Служебный штамп дела экспедиции.",
    });

    expect(html).toContain("artifact-card-overlay__title");
    expect(html).toContain("Штамп экспедиции");
    expect(html).toContain("Служебный штамп дела экспедиции.");
  });

  it("renders a separate copy block under the title", () => {
    const html = createArtifactCardOverlayHtml({
      title: "Штамп экспедиции",
      description: "Служебный штамп дела экспедиции.",
    });

    expect(html).toContain("artifact-card-overlay__copy");
    expect(html.indexOf("artifact-card-overlay__title")).toBeLessThan(
      html.indexOf("artifact-card-overlay__copy")
    );
  });

  it("pushes the close button lower for long descriptions", () => {
    const shortLayout = getArtifactCardLayout("Короткое описание.");
    const longLayout = getArtifactCardLayout(
      "Жёсткий контейнер для Навигационный диск. Здесь находка становится не теорией, а вещью."
    );

    expect(longLayout.closeButtonY).toBeGreaterThan(shortLayout.closeButtonY);
  });
});
