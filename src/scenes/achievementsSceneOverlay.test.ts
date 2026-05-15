import { describe, expect, it } from "vitest";
import { createAchievementsSceneOverlayHtml } from "@/scenes/achievementsSceneOverlay";
import type { AchievementsViewModel } from "@/data/buildAchievementsViewModel";

const minimalVm: AchievementsViewModel = {
  groups: [
    {
      tag: "path",
      title: "The Path",
      items: [
        {
          tag: "first_win",
          iconBasename: "first_win.png",
          title: "First Layout",
          description: "The deal came together.",
          unlocked: true,
          visuallyLocked: false,
        },
        {
          tag: "chapter_1_complete",
          iconBasename: "chapter_1_complete.png",
          title: "Line Restored",
          description: "All ten points completed.",
          unlocked: false,
          visuallyLocked: false,
          displayProgress: 3,
          displayPct: 30,
          max: 10,
        },
        {
          tag: "epilogue",
          iconBasename: "locked-generic.png",
          title: "???",
          description: "",
          unlocked: false,
          visuallyLocked: true,
        },
      ],
    },
    {
      tag: "archive",
      title: "Archive",
      items: [],
    },
  ],
};

function render(overrides: Partial<Parameters<typeof createAchievementsSceneOverlayHtml>[0]> = {}) {
  return createAchievementsSceneOverlayHtml({
    title: "Достижения",
    backLabel: "Назад",
    hiddenLabel: "Скрытое достижение",
    groups: minimalVm.groups,
    ...overrides,
  });
}

describe("createAchievementsSceneOverlayHtml — structure", () => {
  it("renders backdrop wrapper", () => {
    const html = render();
    expect(html).toContain('class="achievements-overlay__backdrop"');
  });

  it("renders header with title + back button", () => {
    const html = render();
    expect(html).toContain('"achievements-overlay__title">Достижения');
    expect(html).toContain('data-achievements-action="back"');
    expect(html).toContain('aria-label="Назад"');
  });

  it("renders scroll container", () => {
    const html = render();
    expect(html).toContain('class="achievements-overlay__scroll"');
  });

  it("renders one section per group", () => {
    const html = render();
    const sections = html.match(/data-group-tag="/g) ?? [];
    expect(sections.length).toBe(2);
    expect(html).toContain('data-group-tag="path"');
    expect(html).toContain('data-group-tag="archive"');
  });

  it("group lists have role=list and cards have role=listitem", () => {
    const html = render();
    expect(html).toContain('class="achievements-section__list" role="list"');
    const cards = html.match(/role="listitem"/g) ?? [];
    expect(cards.length).toBe(3); // 3 cards in path group
  });
});

describe("createAchievementsSceneOverlayHtml — card variants", () => {
  it("unlocked card → --unlocked class + ✓ check mark, no lock badge", () => {
    const html = render();
    expect(html).toContain('achievement-card--unlocked');
    expect(html).toContain('achievement-card__check');
    // unlocked has no lock-badge
    const unlockedSegment = html.split("First Layout")[1]?.split("Line Restored")[0] ?? "";
    expect(unlockedSegment).not.toContain('achievement-card__lock-badge');
  });

  it("non-hidden locked card → --locked class + lock badge, no check", () => {
    const html = render();
    expect(html).toContain('achievement-card--locked');
    // chapter_1_complete is locked but not hidden — gets lock badge
    const lockedSegment = html.split("Line Restored")[1]?.split("???")[0] ?? "";
    expect(lockedSegment).toContain('achievement-card__lock-badge');
  });

  it("hidden locked card → --hidden class + '???' title + empty description, locked-generic icon", () => {
    const html = render();
    expect(html).toContain('achievement-card--hidden');
    expect(html).toContain('"achievement-card__title">???');
    expect(html).toContain('locked-generic.png');
    // hidden card aria-label = hiddenLabel
    expect(html).toContain('aria-label="Скрытое достижение"');
  });
});

describe("createAchievementsSceneOverlayHtml — progress bar", () => {
  it("progressbar rendered for max-achievements with role + aria-valuenow/max", () => {
    const html = render();
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain('aria-valuemax="10"');
    expect(html).toContain('style="width: 30%"');
  });

  it("progress label shows current/max format", () => {
    const html = render();
    expect(html).toContain("3 / 10");
  });

  it("one-shot achievement (no max) has NO progressbar", () => {
    const html = render();
    // first_win has no max — its card segment should NOT contain role="progressbar"
    const firstWinSegment = html.split("First Layout")[1]?.split("Line Restored")[0] ?? "";
    expect(firstWinSegment).not.toContain('role="progressbar"');
  });
});

describe("createAchievementsSceneOverlayHtml — security", () => {
  it("escapes HTML in titles + descriptions", () => {
    const html = createAchievementsSceneOverlayHtml({
      title: "<script>alert(1)</script>",
      backLabel: "Back",
      hiddenLabel: "Hidden",
      groups: [
        {
          tag: "path",
          title: "T<>'\"&",
          items: [
            {
              tag: "x",
              iconBasename: "first_win.png",
              title: "<img onerror=alert(1)>",
              description: "<<>>",
              unlocked: true,
              visuallyLocked: false,
            },
          ],
        },
      ],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    // Verify raw `<img` is escaped — no executable tag, only literal text.
    expect(html).not.toContain("<img onerror=");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img onerror");
  });

  it("invalid icon basename falls back to locked-generic.png", () => {
    const html = createAchievementsSceneOverlayHtml({
      title: "X",
      backLabel: "B",
      hiddenLabel: "H",
      groups: [
        {
          tag: "path",
          title: "G",
          items: [
            {
              tag: "x",
              iconBasename: "../etc/passwd",
              title: "T",
              description: "",
              unlocked: false,
              visuallyLocked: false,
            },
          ],
        },
      ],
    });
    expect(html).toContain("./assets/achievements/locked-generic.png");
    expect(html).not.toContain("../etc");
  });
});
