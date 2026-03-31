# Stage 1 Naming Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вынести naming в отдельный runtime layer и перевести главы на канонические названия без поломки текущего gameplay/progression.

**Architecture:** Добавляем отдельный `src/data/naming.ts` как источник canonical display values и переводим `src/data/chapters.ts` на `chapterId` вместо `titleRu/titleEn`. UI `MapScene` и `DiaryScene` начинает брать display titles через helper, а не напрямую из chapter data.

**Tech Stack:** TypeScript, Vitest, Phaser scenes, existing `@/` path aliases

---

### Task 1: Naming Data Layer

**Files:**
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\naming.test.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\naming.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- `getNamingValue("chapter_01", "ru") === "Начало маршрута"`
- `getNamingValue("chapter_01", "en") === "Trailhead"`
- `getChapterTitle("chapter_03", "en") === "Last Camp"`
- `CHAPTERS.map(c => c.chapterId)` returns canonical ids in order

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/data/naming.test.ts`
Expected: FAIL because `src/data/naming.ts` does not exist and `chapterId` is missing in `chapters.ts`

- [ ] **Step 3: Write minimal implementation**

Create `src/data/naming.ts` with:
- `ChapterId`
- `NamingEntityId`
- naming table
- `getNamingValue`
- `getChapterTitle`

Update `src/data/chapters.ts`:
- remove `titleRu/titleEn`
- add `chapterId`
- preserve seeds, difficulty, node ids, helper functions

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/data/naming.test.ts`
Expected: PASS

### Task 2: UI Chapter Title Wiring

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\MapScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts`

- [ ] **Step 1: Replace direct chapter titles**

In both scenes:
- remove direct `titleRu/titleEn` reads
- import `getChapterTitle`
- render display title through `chapter.chapterId` and current locale

- [ ] **Step 2: Verify TypeScript build**

Run: `npm.cmd run build`
Expected: PASS, no references to removed `titleRu/titleEn`

- [ ] **Step 3: Run full tests**

Run: `npm.cmd test`
Expected: PASS
