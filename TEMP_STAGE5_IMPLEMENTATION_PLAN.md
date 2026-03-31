# Stage 5 Reward Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить narrative reward titles к `RewardScene` и убрать технический вывод `rewardType`.

**Architecture:** `rewards.ts` получает helper, который по `rewardId` и narrative locale возвращает display text из `rewardTexts.ru/global`. `RewardScene` использует этот helper через `i18n.getNarrativeLocale()`.

**Tech Stack:** TypeScript, Vitest, Phaser scene

---

### Task 1: Reward Display Helper

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.test.ts`

- [ ] **Step 1: Add failing test**

Cover:
- `getRewardDisplayText("reward_diary_page_01", "ru")?.title`
- `getRewardDisplayText("reward_diary_page_01", "global")?.title`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/data/narrative/rewards.test.ts`
Expected: FAIL because helper does not exist

- [ ] **Step 3: Implement helper**

Add `getRewardDisplayText(rewardId, locale)`

- [ ] **Step 4: Run test**

Run: `npm.cmd test -- src/data/narrative/rewards.test.ts`
Expected: PASS

### Task 2: RewardScene Wiring

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts`

- [ ] **Step 1: Replace `rewardType` fallback**

Use display title from helper instead of `reward.rewardType`

- [ ] **Step 2: Run full tests**

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm.cmd run build`
Expected: PASS
