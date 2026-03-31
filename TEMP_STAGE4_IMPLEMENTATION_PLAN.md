# Stage 4 Text Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить `ru/global` narrative text packs для записей и наград, не смешивая их с UI-локализацией.

**Architecture:** `locales.ts` остаётся только для UI. Narrative content переезжает в отдельные data-файлы `entries.*` и `rewardTexts.*`, а `I18nService` получает минимальный helper для выбора narrative layer.

**Tech Stack:** TypeScript, Vitest, existing i18n service

---

### Task 1: Narrative Text Packs

**Files:**
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.ru.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.global.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewardTexts.ru.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewardTexts.global.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\texts.test.ts`

- [ ] **Step 1: Write the failing test**

Cover:
- entry `entry_01` exists in `ru`
- entry `entry_01` exists in `global`
- reward text for `reward_diary_page_01` exists in `ru`
- reward text for `reward_finale_bundle_01` exists in `global`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/data/narrative/texts.test.ts`
Expected: FAIL because text pack files do not exist

- [ ] **Step 3: Write minimal implementation**

Create:
- entries packs
- reward text packs

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/data/narrative/texts.test.ts`
Expected: PASS

### Task 2: Narrative Locale Helper

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\I18nService.ts`

- [ ] **Step 1: Add helper**

Add:
- `getNarrativeLocale(): "ru" | "global"`

- [ ] **Step 2: Add small test coverage if needed**

Prefer extending an existing/new test only if helper isn’t trivial; otherwise verify by typecheck/build

- [ ] **Step 3: Run full tests**

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 4: Run build**

Run: `npm.cmd run build`
Expected: PASS
