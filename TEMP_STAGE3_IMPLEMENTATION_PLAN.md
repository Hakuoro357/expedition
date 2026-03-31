# Stage 3 Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вынести reward metadata в отдельный слой и перевести reward flow на `rewardId`, сохранив текущую коллекцию и не ломая сейвы.

**Architecture:** Новый `src/data/narrative/rewards.ts` становится источником сведений о типе награды и optional collectible artifact. `completeNode()` возвращает `rewardId`, а `RewardScene` читает reward metadata вместо слепой зависимости от `artifactId` узла.

**Tech Stack:** TypeScript, Vitest, Phaser, existing save flow

---

### Task 1: Reward Metadata Layer

**Files:**
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- `getRewardById("reward_diary_page_01")?.rewardType === "diary_page"`
- `getRewardById("reward_finale_bundle_01")?.rewardType === "finale_reward"`
- `getRewardById("reward_unknown_item_01")?.collectibleArtifactId` is defined

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/data/narrative/rewards.test.ts`
Expected: FAIL because reward metadata file does not exist

- [ ] **Step 3: Write minimal implementation**

Create reward metadata file with:
- reward ids for all 30 points
- reward types
- optional `collectibleArtifactId` only where needed now

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/data/narrative/rewards.test.ts`
Expected: PASS

### Task 2: SaveService Reward Summary

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\save\SaveService.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\save\SaveService.test.ts`

- [ ] **Step 1: Write/extend failing test**

Cover:
- `completeNode("c1n1")` returns `rewardId`
- artifact is awarded through reward metadata, not direct node artifact only

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/services/save/SaveService.test.ts`
Expected: FAIL because `rewardId` is not returned yet

- [ ] **Step 3: Write minimal implementation**

Update `completeNode()`:
- resolve node
- read `rewardId`
- resolve reward metadata
- determine `collectibleArtifactId`
- return `rewardId`

- [ ] **Step 4: Run targeted test**

Run: `npm.cmd test -- src/services/save/SaveService.test.ts`
Expected: PASS

### Task 3: RewardScene Wiring

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts`

- [ ] **Step 1: Replace direct node artifact dependency**

Use:
- `rewardId`
- reward metadata
- optional collectible artifact

Keep:
- coins
- chapter completion
- current UI shell

- [ ] **Step 2: Run full tests**

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm.cmd run build`
Expected: PASS
