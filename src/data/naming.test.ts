import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/data/chapters";
import { getChapterTitle, getNamingValue } from "@/data/naming";

describe("naming", () => {
  it("returns ru and global values for chapter names", () => {
    expect(getNamingValue("chapter_01", "ru")).toBe("Начало маршрута");
    expect(getNamingValue("chapter_01", "en")).toBe("Trailhead");
    expect(getChapterTitle("chapter_03", "en")).toBe("Last Camp");
  });

  it("assigns canonical chapter ids in order", () => {
    expect(CHAPTERS.map((chapter) => chapter.chapterId)).toEqual([
      "chapter_01",
      "chapter_02",
      "chapter_03",
    ]);
  });
});
