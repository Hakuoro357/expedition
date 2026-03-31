/**
 * Pre-verified seeds for Daily Route.
 * 60 seeds → covers ~2 months before cycling.
 * Seeds 2001–2060, verified as solvable by the lightweight greedy solver.
 */
export const DAILY_SEEDS: number[] = [
  2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020,
  2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
  2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040,
  2041, 2042, 2043, 2044, 2045, 2046, 2047, 2048, 2049, 2050,
  2051, 2052, 2053, 2054, 2055, 2056, 2057, 2058, 2059, 2060,
];

/**
 * Returns a daily seed deterministically based on the current calendar date.
 * The same date always returns the same seed (cycles every 60 days).
 */
export function getDailySeedForDate(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const index = dayOfYear % DAILY_SEEDS.length;
  return DAILY_SEEDS[index] ?? 2001;
}

/**
 * Returns a unique string key for a given calendar date, e.g. "2026-03-27".
 */
export function getDailyDateKey(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
