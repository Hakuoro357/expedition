// Универсальная иконка монеты. На Windows/старых Android эмодзи 🪙
// (U+1FA99, Unicode 13) часто отсутствует в системных шрифтах и
// рендерится квадратиком-tofu. Используем чистый CSS-бейдж, который
// одинаково выглядит везде.
//
// Подход "sentinel token": лейблы/строки содержат COIN_TOKEN вместо
// эмодзи, а финальная HTML-строка перед вставкой прогоняется через
// expandCoinTokens(). Токен — литерал `[[COIN]]`, escapeHtml его не
// трогает, так что порядок вызовов не важен.

export const COIN_TOKEN = "[[COIN]]";
export const COIN_ICON_HTML = '<span class="coin-icon" aria-hidden="true"></span>';

export function expandCoinTokens(html: string): string {
  return html.split(COIN_TOKEN).join(COIN_ICON_HTML);
}
