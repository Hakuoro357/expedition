# Solitaire: Expedition — QWEN Context

## Project Overview

**Solitaire: Expedition** is a classic Klondike (Косынка) solitaire card game with a lightweight expedition/adventure meta-layer, built for **Yandex Games** platform.

The game differentiates from generic solitaire clones through:
- An expedition route map as the main hub (instead of abstract menus)
- Artifact collections and diary entries as progression rewards
- Premium, calm visual design inspired by travel journals and camp life
- Pre-vetted solvable deals for fair gameplay

## Tech Stack

- **TypeScript** — strict mode, ES2022 target
- **Phaser 3** (v3.90) — game engine for core gameplay and scenes
- **Vite** (v7) — build tool and dev server
- **Vitest** — unit testing
- **DOM/SVG overlay** — for sharp UI text rendering on top of Phaser canvas

## Architecture

```
src/
  app/           # Bootstrap, config, rendering helpers
  assets/        # Cards (SVG), artifacts, portraits, UI icons
  core/          # Pure game logic (no Phaser dependencies)
    cards/       # Card model and types
    klondike/    # Klondike rules, move validation, deal generation
    game-state/  # GameState model and types
  data/          # Chapters, artifacts, narrative content, route sheets, i18n
  features/      # Board helpers, card face markup/texture
  scenes/        # Phaser scenes: Boot, Map, Game, Reward, Diary, Settings, etc.
  services/      # SDK, save, i18n, analytics
  ui/            # DOM overlay helpers, button factory, canvas overlay
```

### Key Design Patterns

- **3-layer separation**: Game Logic → Presentation → Platform Services
- **Phaser + DOM hybrid**: Phaser handles gameplay (cards, board, hit-areas), DOM overlays handle text-heavy UI (route sheets, diary, rewards, settings)
- **Coordinate system**: Phaser uses center-origin coordinates; DOM overlay uses top-left. Helpers `getGameCardLeft()` / `getGameCardTop()` convert between them.
- **Card rendering**: Face-up cards rendered as SVG DOM elements for sharpness. Face-down cards use Phaser Image with SVG textures.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server on localhost:5173

# Build
npm run build        # TypeScript check + production build to dist/

# Preview production build
npm run preview      # Vite preview of dist/

# Tests
npm test             # Run vitest tests (83 tests, 26 files)
```

## Game State

- **Adventure mode**: 3 chapters × 10 deals = 30 solvable puzzles
- **Daily Route**: One daily deal based on date seed
- **Progression**: coins, artifact collections, diary entries, card back unlocks
- **Save**: localStorage + Yandex Games cloud save adapter

## Scenes

| Scene | Purpose |
|-------|---------|
| `BootScene` | Asset loading, SDK init, save restoration |
| `MapScene` | Expedition route map (main hub) |
| `DetailScene` | Route point detail modal (entry + artifact tabs) |
| `GameScene` | Klondike gameplay screen |
| `RewardScene` | Post-win reward reveal with animated items |
| `DiaryScene` | Artifact and entry collection book |
| `SettingsScene` | Language, sound toggles |
| `DevPreviewScene` | Developer preview/debug screen |

## Important Conventions

- **Path aliases**: `@/` maps to `src/` (e.g., `@/scenes/GameScene`)
- **Naming**: snake_case for files, PascalCase for classes, camelCase for variables
- **SVG assets**: Card faces loaded as SVG via `?raw` Vite import for sharpness
- **Coordinate helpers**: Always use `getGameCardLeft(x)` and `getGameCardTop(y)` when positioning in DOM overlay
- **Flip animations**: 80ms `scaleX(0→1)` with `Power2` easing — consistent across stock→waste and tableau reveals
- **Face-up gap**: `GAME_FACE_UP_GAP_Y = 18px` between overlapping face-up cards in tableau
- **Card dimensions**: 44×70px

## Testing

- Tests are co-located with source files (`*.test.ts`)
- Pure logic (klondike engine, data, overlay generation) is tested
- Phaser scenes with heavy rendering are tested via overlay HTML generation only
- Run `npm test` — all 83 tests must pass before committing

## Branching

- `main` — stable branch
- Feature branches follow `feature/<name>` pattern
- PRs are created and merged into `main`

## Backlog Status

All **P0** core gameplay features are ✅ done. Remaining P0 items:
- Test in Yandex Games platform environment
- Mobile string overflow check
- Publication assets (icon, cover, screenshots, descriptions)

## Known Technical Debt

- `GAME_FACE_UP_GAP_Y` and `GAME_FACE_DOWN_GAP_Y` both set to 18px — may need tuning
- Some temp files (`.tmp-*.png`, `TEMP_*.md`) in working tree should be cleaned
- `codex/reward-reveal-flow` branch was merged but not deleted locally
