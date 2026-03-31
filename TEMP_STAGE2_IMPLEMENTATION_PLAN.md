# Stage 2 Points Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить narrative point layer поверх текущих `dealId`, чтобы каждая из 30 точек получила `pointId`, `entryId` и `rewardId`.

**Architecture:** Gameplay ids `c1n1` остаются как legacy id для сейвов и стартов партий. Новый слой `src/data/narrative/points.ts` становится источником narrative bindings, а `chapters.ts` начинает прокидывать эти ids в узлы.

**Tech Stack:** TypeScript, Vitest, existing `@/` aliases

---

### Task 1: Narrative Point Mapping

**Files:**
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\types.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\points.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\points.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- `getPointByDealId("c1n1")?.pointId === "pt_01"`
- `getPointByDealId("c2n1")?.pointId === "pt_11"`
- `getPointByDealId("c3n10")?.rewardId === "reward_finale_bundle_01"`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/data/narrative/points.test.ts`
Expected: FAIL because narrative point files do not exist

- [ ] **Step 3: Write minimal implementation**

Create:
- `types.ts` with point-related ids/types
- `points.ts` with all 30 point bindings and lookup helpers

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/data/narrative/points.test.ts`
Expected: PASS

### Task 2: Expose Narrative Ids Through Chapter Nodes

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts`

- [ ] **Step 1: Extend ChapterNode**

Add:
- `pointId`
- `entryId`
- `rewardId`

- [ ] **Step 2: Wire chapter nodes to point mapping**

Use the narrative point layer inside `buildChapterNodes()` so each node gets its canonical ids without changing seeds/order.

- [ ] **Step 3: Add/extend tests if needed**

Assert:
- `CHAPTERS[0].nodes[0].pointId === "pt_01"`
- `CHAPTERS[1].nodes[0].entryId === "entry_11"`

- [ ] **Step 4: Run full tests**

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 5: Run build**

Run: `npm.cmd run build`
Expected: PASS
