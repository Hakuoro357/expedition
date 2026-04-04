# Reward Reveal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переделать экран награды так, чтобы после прохождения точки игрок сразу видел новые награды в блоке `Вы нашли` и мог открыть подробности по артефакту, записи дневника или фрагменту карты без перехода в дневник.

**Architecture:** Поверх текущего `RewardScene` добавить единый reveal-flow из трёх игроковских типов наград: `artifact`, `entry`, `map`. Логику классификации наград вынести в отдельный helper, а детали наград показывать в модалках поверх экрана награды через уже принятый внешний DOM overlay, привязанный к `canvas rect`.

**Tech Stack:** Phaser, TypeScript, Vite, внешний DOM overlay через `createCanvasAnchoredOverlay`, Vitest, existing narrative data layer.

---

## File Structure

### Existing files to modify

- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts`
  - центральный orchestration экрана награды;
  - будет собирать reveal items, рендерить блок `Вы нашли`, открывать/закрывать модалки.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardSceneOverlay.ts`
  - текущий DOM overlay заголовка и reward lines;
  - нужно расширить под новый layout: монеты, прогресс главы, карточки `Вы нашли`.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\styles.css`
  - стили reward-экрана, карточек наград и модалок.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\locales.ts`
  - новые UI-строки для `Вы нашли`, `Карта обновлена`, бейджей типов и пустых состояний.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\BootScene.ts`
  - при необходимости preload мини-схем/иконок карты для reward reveal.

### New files to create

- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardRevealItems.ts`
  - переводит `rewardId`, `artifactAwarded`, `dealId` в единый массив reveal items для UI.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardRevealItems.test.ts`
  - тесты классификации наград по трем типам.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardSceneDetailOverlay.ts`
  - DOM HTML для модалок записи и карты.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardSceneDetailOverlay.test.ts`
  - тесты структуры HTML detail-модалок.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardMapPreview.ts`
  - helper мини-схемы карты для reward reveal.
- `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardMapPreview.test.ts`
  - тесты вычисления нового выделенного участка.

## Task 1: Собрать единый view-model наград точки

**Files:**
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardRevealItems.ts`
- Test: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardRevealItems.test.ts`
- Read: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.ts`
- Read: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts`
- Read: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.ts`
- Read: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\artifacts.ts`

- [ ] **Step 1: Write the failing tests for reward classification**

```ts
import { describe, expect, it } from "vitest";
import { buildRewardRevealItems } from "@/scenes/rewardRevealItems";

describe("buildRewardRevealItems", () => {
  it("returns an entry item before an artifact item when a point has both", () => {
    const items = buildRewardRevealItems({
      dealId: "c2n6",
      rewardId: "reward_anonymous_note_01",
      artifactAwarded: "field-journal",
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry", "artifact"]);
  });

  it("returns a map item for map rewards", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n3",
      rewardId: "reward_map_piece_01",
      artifactAwarded: "old-map",
      locale: "ru",
    });

    expect(items.some((item) => item.type === "map")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- src/scenes/rewardRevealItems.test.ts
```

Expected:

- `FAIL`
- module or export `buildRewardRevealItems` does not exist yet

- [ ] **Step 3: Add the minimal reveal item builder**

```ts
export type RewardRevealType = "entry" | "artifact" | "map";

export type RewardRevealItem = {
  type: RewardRevealType;
  id: string;
  title: string;
  badgeLabel: string;
};

export function buildRewardRevealItems(...) {
  const items: RewardRevealItem[] = [];

  // 1. entry
  // 2. artifact
  // 3. map

  return items;
}
```

Implementation notes:

- `entry` берётся из `node.entryId`, только если точка реально завершена впервые;
- `artifact` создаётся только если `artifactAwarded` не `null`;
- `map` создаётся для reward types:
  - `map_piece`
  - `map_variant`
  - `map_marker`
  - `chapter_piece`
- порядок элементов должен быть жёстко задан: `entry -> artifact -> map`.

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```powershell
npm.cmd test -- src/scenes/rewardRevealItems.test.ts
```

Expected:

- `PASS`

- [ ] **Step 5: Commit**

```powershell
git add src/scenes/rewardRevealItems.ts src/scenes/rewardRevealItems.test.ts
git commit -m "feat: add reward reveal item builder"
```

## Task 2: Перестроить reward overlay под блок `Вы нашли`

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardSceneOverlay.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\styles.css`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\locales.ts`
- Test: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardSceneOverlay.test.ts`

- [ ] **Step 1: Extend the overlay test with `Вы нашли` card markup**

```ts
import { describe, expect, it } from "vitest";
import { createRewardOverlayHtml } from "@/scenes/rewardSceneOverlay";

describe("createRewardOverlayHtml", () => {
  it("renders reveal cards and chapter progress", () => {
    const html = createRewardOverlayHtml({
      title: "Победа!",
      coinsLabel: "+50 монет",
      chapterProgressLabel: "Глава 1 • 2/10",
      foundTitle: "Вы нашли",
      revealItems: [
        { type: "entry", id: "entry", title: "Точка 2", badgeLabel: "Запись" },
      ],
      adStatus: "",
    });

    expect(html).toContain("Вы нашли");
    expect(html).toContain("reward-overlay__found-card");
    expect(html).toContain("reward-overlay__chapter-progress");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- src/scenes/rewardSceneOverlay.test.ts
```

Expected:

- `FAIL`
- missing params/markup

- [ ] **Step 3: Update the overlay builder and strings**

```ts
type RewardOverlayParams = {
  title: string;
  coinsLabel: string;
  chapterProgressLabel: string;
  foundTitle: string;
  revealItems: Array<{
    type: "entry" | "artifact" | "map";
    id: string;
    title: string;
    badgeLabel: string;
  }>;
  adStatus?: string;
};
```

Required locale keys:

```ts
foundItems: "Вы нашли",
rewardTypeEntry: "Запись",
rewardTypeArtifact: "Артефакт",
rewardTypeMap: "Карта",
mapUpdated: "Карта обновлена",
```

CSS requirements:

- header with title, coins, chapter progress;
- unified found-card row;
- one calm visual language for all reward cards;
- small badge in each card, not separate full layouts by type.

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm.cmd test -- src/scenes/rewardSceneOverlay.test.ts
npm.cmd run build
```

Expected:

- overlay test passes
- build passes

- [ ] **Step 5: Commit**

```powershell
git add src/scenes/rewardSceneOverlay.ts src/scenes/rewardSceneOverlay.test.ts src/styles.css src/services/i18n/locales.ts
git commit -m "feat: redesign reward overlay for reveal cards"
```

## Task 3: Собрать detail-модалки для записи и карты

**Files:**
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardSceneDetailOverlay.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardSceneDetailOverlay.test.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardMapPreview.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardMapPreview.test.ts`
- Reuse: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\artifactCardOverlay.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\styles.css`

- [ ] **Step 1: Write failing tests for entry modal and map modal**

```ts
import { describe, expect, it } from "vitest";
import { createRewardEntryDetailHtml, createRewardMapDetailHtml } from "@/scenes/rewardSceneDetailOverlay";

describe("rewardSceneDetailOverlay", () => {
  it("renders entry detail with author and body", () => {
    const html = createRewardEntryDetailHtml({
      pointLabel: "Точка 16",
      author: "Климова",
      body: "Ни имени, ни даты.",
    });

    expect(html).toContain("Точка 16");
    expect(html).toContain("Климова");
    expect(html).toContain("Ни имени, ни даты.");
  });

  it("renders map detail with map updated title", () => {
    const html = createRewardMapDetailHtml({
      title: "Карта обновлена",
      caption: "Добавлен новый участок маршрута",
    });

    expect(html).toContain("Карта обновлена");
    expect(html).toContain("Добавлен новый участок маршрута");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- src/scenes/rewardSceneDetailOverlay.test.ts src/scenes/rewardMapPreview.test.ts
```

Expected:

- `FAIL`

- [ ] **Step 3: Add minimal overlay helpers**

```ts
export function createRewardEntryDetailHtml(...) { ... }
export function createRewardMapDetailHtml(...) { ... }
export function getRewardMapPreviewData(dealId: string) { ... }
```

Implementation notes:

- entry modal fields:
  - point label
  - author
  - body
- map modal fields:
  - static title `Карта обновлена`
  - preview caption
  - mini-scheme data for Phaser rendering
- map preview should highlight the current node / current chapter piece instead of showing a random paper fragment.

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm.cmd test -- src/scenes/rewardSceneDetailOverlay.test.ts src/scenes/rewardMapPreview.test.ts
npm.cmd run build
```

Expected:

- tests pass
- build passes

- [ ] **Step 5: Commit**

```powershell
git add src/scenes/rewardSceneDetailOverlay.ts src/scenes/rewardSceneDetailOverlay.test.ts src/scenes/rewardMapPreview.ts src/scenes/rewardMapPreview.test.ts src/styles.css
git commit -m "feat: add reward detail overlays for entries and map reveals"
```

## Task 4: Переподключить RewardScene к новым reveal items и модалкам

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts`
- Read: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\ui\canvasOverlay.ts`
- Read: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\ui\buttonLabelsOverlay.ts`
- Read: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\artifactCardOverlay.ts`

- [ ] **Step 1: Write or extend RewardScene test coverage for reveal orchestration**

```ts
import { describe, expect, it } from "vitest";
import { buildRewardRevealItems } from "@/scenes/rewardRevealItems";

describe("reward reveal flow", () => {
  it("produces up to three reveal items for a point", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n3",
      rewardId: "reward_map_piece_01",
      artifactAwarded: "old-map",
      locale: "ru",
    });

    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the targeted tests first**

Run:

```powershell
npm.cmd test -- src/scenes/rewardRevealItems.test.ts src/scenes/rewardSceneOverlay.test.ts
```

Expected:

- currently `PASS`

- [ ] **Step 3: Refactor RewardScene to render `Вы нашли` and open detail modals**

Implementation checklist:

```ts
const revealItems = buildRewardRevealItems({
  dealId,
  rewardId,
  artifactAwarded,
  locale: i18n.getNarrativeLocale(),
});

this.renderRewardOverlay({
  title: i18n.t("victory"),
  coinsLabel: `+${coinsAwarded} ${i18n.t("coins")}`,
  chapterProgressLabel: `${i18n.t("chapter")} ${...}`,
  foundTitle: i18n.t("foundItems"),
  revealItems,
  adStatus: adStatusText,
});
```

Scene behavior requirements:

- clicking a reveal card opens:
  - artifact modal via existing artifact-card pattern;
  - entry modal via new entry overlay;
  - map modal via new map preview modal;
- detail modal closes back to the reward screen;
- `Continue` works without opening any modal;
- rewarded ad remains below the reveal block and does not cover the cards.

- [ ] **Step 4: Run end-to-end verification**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Then manually verify in browser:

1. win a point with an entry reward
2. win a point with an artifact reward
3. win a point with a map reward
4. verify `Вы нашли` shows only new rewards for that point
5. verify `Continue` works without opening modal

- [ ] **Step 5: Commit**

```powershell
git add src/scenes/RewardScene.ts
git commit -m "feat: connect reward scene to reveal modals"
```

## Task 5: Синхронизировать архивные экраны и документацию

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\UI_FLOW.md`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\2026-04-01-reward-reveal-flow.md`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts` (only if labels or behavior references need wording alignment)

- [ ] **Step 1: Update docs to reflect implemented reward-first reveal**

```md
- Победа -> Экран результата точки -> Вы нашли -> Карта
- Дневник = архив уже открытого
- Карта = накопленный прогресс маршрута
```

- [ ] **Step 2: Run documentation sanity check**

Run:

```powershell
Get-Content -Raw -Encoding UTF8 docs\specs\2026-04-01-reward-reveal-flow.md
Get-Content -Raw -Encoding UTF8 docs\specs\UI_FLOW.md
git diff -- docs/specs/2026-04-01-reward-reveal-flow.md docs/specs/UI_FLOW.md
```

Expected:

- readable UTF-8 text
- no contradiction between flow spec and UI flow

- [ ] **Step 3: Final verification pass**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Then capture reward screen with browser tooling and confirm:

- calm unified cards in `Вы нашли`
- badge-based type distinction
- map modal uses mini-scheme, not loose paper
- ad is visually secondary

- [ ] **Step 4: Commit**

```powershell
git add docs/specs/UI_FLOW.md docs/specs/2026-04-01-reward-reveal-flow.md
git commit -m "docs: align reward reveal flow with implemented UX"
```

## Self-Review

### Spec coverage

- reward screen as first reveal point: covered by Tasks 2 and 4
- three reveal types only: covered by Tasks 1 and 4
- diary/archive role split: covered by Tasks 4 and 5
- map reward as mini-scheme reveal: covered by Tasks 3 and 4
- rewarded ad as secondary element: covered by Tasks 2 and 4

### Placeholder scan

- no `TODO`, `TBD`, or “implement later”
- all tasks have exact files, commands, and expected outcomes

### Type consistency

- reveal item types are consistently `entry | artifact | map`
- `RewardScene` remains the only orchestration point
- DOM overlays remain external canvas-anchored overlays
