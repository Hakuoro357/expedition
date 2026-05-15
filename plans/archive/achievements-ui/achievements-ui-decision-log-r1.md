# Decision log — round 1 (codex + xiaomi)

Codex verdict: CONCERNS REMAIN. 2 CRITICAL + 11 MAJOR + 5 MINOR + alternatives.
Xiaomi verdict: CONCERNS REMAIN. 8 MAJOR + 6 MINOR + alternatives.

Совпадение по 6 ключевым concerns (asset strategy, AppNavItem extension,
view-model approach, hidden masking, top-bar collision, scene-flow).

## Accepted (all)

- **C1 (codex)** UI primary = `ACHIEVEMENTS.compute({ progress })`. SDK list — confirmation only.
- **C2 (codex)** Separate `achievementUiMeta.ts` (group/order/i18n keys) from compute-meta.
- **M1 (both)** `scene.launch + pause` вместо `scene.start` — сохраняет parent state.
- **M2 (both)** Hidden masking полное: icon, title="???", description="", без progress.
  Locked fallback CSS-grayscale если `_locked.png` отсутствует (xiaomi).
- **M3 (both)** Asset strategy = `public/assets/achievements/` only (sync-скрипт из `dist/achievement-icons/`).
- **M4 (both)** NOT extending `AppNavItem.id` — trophy = отдельная top-right button.
- **M5 (codex)** Gate `prologueShown` на TitleScene button (no spoilers first-run).
- **M6 (codex)** TitleScene button order documented (Community-aware).
- **M7 (codex)** `returnTo` includes `mapData: { page }` — preserve MapScene page.
- **M8 (codex)** Scroll-container bounded в overlay.
- **M9 (both)** VM tests + integration tests + overlay tests.
- **M10 (xiaomi)** Inline RU+EN для всех 43 ключей, EN fallback для 5 локалей.
- **MIN1 (codex)** `safeImageUrl` whitelist.
- **MIN2 (both)** A11y: role, aria-valuenow, aria-label.
- **MIN3 (codex)** `achievements_open` analytics event.

## Rejected

(none — все приняты, реальные риски)

## Применяю в draft-r2 — следующий round.
