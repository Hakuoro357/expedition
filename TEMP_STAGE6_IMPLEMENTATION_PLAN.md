# Stage 6 Diary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить narrative entries к `DiaryScene`, сохранив коллекцию артефактов и текущий chapter progress.

**Architecture:** Добавляется helper для чтения `entryId -> text` по `ru/global`. `DiaryScene` вычисляет открытые записи через `completedNodes`, показывает последнюю запись крупно и список нескольких последних записей рядом с существующей коллекцией/прогрессом.

**Tech Stack:** TypeScript, Vitest, Phaser scene

---

### Task 1: Entry Display Helper

**Files:**
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\texts.test.ts`

- [x] **Step 1: Add failing test**

Cover:
- `getNarrativeEntry("entry_01", "ru")`
- `getNarrativeEntry("entry_01", "global")`

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/data/narrative/texts.test.ts`
Expected: FAIL because helper does not exist

- [x] **Step 3: Implement helper**

Add `getNarrativeEntry(entryId, locale)`

- [x] **Step 4: Run test**

Run: `npm.cmd test -- src/data/narrative/texts.test.ts`
Expected: PASS

### Task 2: DiaryScene Narrative Wiring

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts`

- [x] **Step 1: Compute unlocked entries**

Build list from completed nodes using:
- `CHAPTERS.flatMap(nodes)`
- `entryId`

- [x] **Step 2: Render latest entry block**

Show:
- latest speaker/title surrogate
- latest body preview
- unlocked entry count

- [x] **Step 3: Render recent entries list**

Show last few unlocked entries as short lines

- [x] **Step 4: Keep artifact collection and chapter progress**

Do not delete collection grid entirely; compress layout if needed

- [x] **Step 5: Run full tests**

Run: `npm.cmd test`
Expected: PASS

- [x] **Step 6: Run build**

Run: `npm.cmd run build`
Expected: PASS
