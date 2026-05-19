import { safeAchievementIconUrl } from "@/ui/safeUrl";
import { escapeHtml } from "@/ui/escapeHtml";

/**
 * Slide-in toast notification when an achievement is unlocked.
 *
 * v0.3.58: появляется в правом верхнем углу, slide-out по таймеру.
 * Дискретный DOM элемент поверх canvas + canvas-anchored overlay'ев
 * (z-index: 10000).
 *
 * v0.3.61: очередь со стаггером 1000ms между entry — несколько ачивок
 * разом не наслаиваются на одном кадре, появляются последовательно.
 * Default lifetime увеличен 4000 → 7000ms (больше времени прочитать).
 *
 * Безопасно для SSR (early return если нет document).
 */
export type AchievementToastOptions = {
  /** Localized title, e.g. "Первый расклад". */
  title: string;
  /** Subtitle line above title, e.g. "Достижение получено!". */
  subtitle: string;
  /**
   * PNG basename for the icon, e.g. "first_win.png". Hidden achievements
   * post-unlock should pass real basename (no need for locked-generic).
   */
  iconBasename: string;
  /** How long to keep visible before slide-out (ms). Default 7000. */
  durationMs?: number;
};

const STACK_ID = "achievement-toast-stack";
const STAGGER_MS = 1000;
const DEFAULT_DURATION_MS = 7000;
const SLIDE_OUT_MS = 400;

const queue: AchievementToastOptions[] = [];
let pumping = false;

/** Get-or-create the singleton stack container (fixed top-right flex column). */
function getOrCreateStack(): HTMLElement {
  let stack = document.getElementById(STACK_ID);
  if (!stack) {
    stack = document.createElement("div");
    stack.id = STACK_ID;
    stack.className = "achievement-toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

export function showAchievementToast(opts: AchievementToastOptions): void {
  if (typeof document === "undefined") return;
  queue.push(opts);
  if (!pumping) {
    pumping = true;
    pumpQueue();
  }
}

function pumpQueue(): void {
  const next = queue.shift();
  if (!next) {
    pumping = false;
    return;
  }
  displayToast(next);
  // Stagger следующего entry на STAGGER_MS — даже если очередь длинная,
  // tost'ы появляются с понятным ритмом.
  window.setTimeout(pumpQueue, STAGGER_MS);
}

function displayToast(opts: AchievementToastOptions): void {
  const stack = getOrCreateStack();
  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.innerHTML = `
    <img class="achievement-toast__icon" src="${escapeHtml(safeAchievementIconUrl(opts.iconBasename))}" alt="" />
    <div class="achievement-toast__copy">
      <div class="achievement-toast__subtitle">${escapeHtml(opts.subtitle)}</div>
      <div class="achievement-toast__title">${escapeHtml(opts.title)}</div>
    </div>
  `;
  // Newest toast at the top: prepend so visually-recent unlocks dominate.
  stack.insertBefore(toast, stack.firstChild);
  // Trigger slide-in next frame (so transition runs from initial state).
  requestAnimationFrame(() => {
    toast.classList.add("achievement-toast--visible");
  });
  const duration = opts.durationMs ?? DEFAULT_DURATION_MS;
  window.setTimeout(() => {
    toast.classList.remove("achievement-toast--visible");
    toast.classList.add("achievement-toast--leaving");
    window.setTimeout(() => {
      toast.remove();
      // Clean up empty stack (in case nothing else queued — keeps DOM tidy).
      if (stack.children.length === 0) stack.remove();
    }, SLIDE_OUT_MS);
  }, duration);
}
