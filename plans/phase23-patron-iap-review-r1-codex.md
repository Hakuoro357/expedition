[MINOR] (1) В локальном `git diff --name-only` есть изменения `.omc/*` помимо целевых файлов Layer 4/5. (2) Это нарушает scope hygiene для Phase 2+3 и может уехать в коммит как посторонний state. (3) Убрать `.omc/*` из коммита/диффа, оставить только `types.ts`, `SaveService*`, `AchievementsReconciler*`.

По критическим инвариантам кода замечаний нет: optional поля не ломают legacy save, validation принимает `undefined` и правильные типы, `patronGrantedAt` проверяется через `Number.isFinite`, задержка применяется только для `tag === "patron" && patronJustActivated`, повторный `markPatronJustActivated()` сбрасывает timer. `PaymentsService` не тронут.

CONCERNS REMAIN