/**
 * Экранирует HTML-спецсимволы для безопасной вставки текста в template-literal
 * HTML-билдеры. Единая реализация — раньше была дублирована в 15 файлах.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
